import { ConvexHttpClient } from "convex/browser";
import { AllocationReport, DatabaseSaveResult, PortfolioAllocation, TechnicalDataRow } from "../types";

/**
 * Database Service for Convex integration
 *
 * Handles saving and retrieving analysis data from Convex database.
 *
 * ## Error Handling Strategy: SUCCESS FLAG / EMPTY RETURNS
 *
 * This service NEVER throws. Instead:
 * - `saveAnalysisReport()` returns `{ success: boolean, error?: string }`
 * - Query methods return empty arrays `[]` or `null` on failure
 * - Constructor sets `enabled: false` if initialization fails
 *
 * **Rationale:** Database is optional storage. Analysis should complete
 * even if persistence fails. Use `isEnabled()` to check availability.
 *
 * IMPORTANT: Before using this service, you must:
 * 1. Run `pnpm exec convex dev` to initialize Convex and generate API types
 * 2. Set CONVEX_URL in your .env file
 */
export class DatabaseService {
  private client: ConvexHttpClient | null = null;
  private enabled: boolean = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private api: any = null;
  private apiLoaded: boolean = false;
  private apiLoadError: string | null = null;

  constructor(convexUrl: string) {
    if (convexUrl && convexUrl.length > 0) {
      try {
        this.client = new ConvexHttpClient(convexUrl);
        this.enabled = true;
        console.log('📦 Database service initialized (Convex)');
      } catch (error) {
        console.warn('⚠️ Failed to initialize Convex client:', error);
        this.enabled = false;
      }
    } else {
      console.log('📦 Database service disabled (no CONVEX_URL)');
    }
  }

  /**
   * Check if database is enabled
   */
  isEnabled(): boolean {
    return this.enabled && this.client !== null;
  }

  /**
   * Load Convex API dynamically
   * The generated api file is created by `npx convex dev`
   */
  private async loadApi(): Promise<boolean> {
    if (this.apiLoaded) {
      return this.api !== null;
    }

    try {
      // Dynamic import of the generated Convex API
      // Use string concatenation to prevent TypeScript from validating the path
      // Path is relative to the compiled output in dist/services/
      const apiPath = '../../convex/_generated/api' + '.js';
      const convexModule = await import(/* webpackIgnore: true */ apiPath);
      this.api = convexModule.api;
      this.apiLoaded = true;
      return true;
    } catch {
      this.apiLoaded = true;
      this.apiLoadError = 'Convex API not generated. Run: pnpm exec convex dev';
      console.warn(`⚠️ ${this.apiLoadError}`);
      return false;
    }
  }

  /**
   * Save an analysis report to the database
   * Returns success status and snapshot ID
   */
  async saveAnalysisReport(report: AllocationReport): Promise<DatabaseSaveResult> {
    if (!this.isEnabled() || !this.client) {
      return { success: false, error: 'Database not enabled' };
    }

    const apiReady = await this.loadApi();
    if (!apiReady || !this.api) {
      return { success: false, error: this.apiLoadError || 'Convex API not available' };
    }

    try {
      // 1. Save the main snapshot
      const snapshotId = await this.client.mutation(this.api.snapshots.saveWeeklySnapshot, {
        timestamp: report.date.toISOString(),
        vix: report.vix,
        fearGreedIndex: report.fearGreedIndex ?? undefined,
        fearGreedLabel: this.getFearGreedLabel(report.fearGreedIndex),
        fearGreedFailed: report.fearGreedFailed,
        marketCSS: report.marketCSS,
        totalAmount: report.totalAmount,
        baseBudget: report.baseBudget,
        minBudget: report.minBudget,
        maxBudget: report.maxBudget,
        marketCondition: report.marketCondition,
        marketDataSource: report.dataSourceStatus?.marketDataSource ?? 'axios-fallback',
        indicatorSource: report.dataSourceStatus?.indicatorSource ?? 'custom-fallback',
        recommendations: report.recommendations,
      });

      console.log(`✅ Saved snapshot: ${snapshotId}`);

      // 2. Save stock analyses
      const stockAnalyses = this.buildStockAnalyses(
        snapshotId,
        report.allocations,
        report.technicalData || [],
        report.vix,
        report.fearGreedIndex
      );

      if (stockAnalyses.length > 0) {
        await this.client.mutation(this.api.snapshots.saveStockAnalyses, {
          analyses: stockAnalyses,
        });
        console.log(`✅ Saved ${stockAnalyses.length} stock analyses`);
      }

      return {
        success: true,
        snapshotId: snapshotId as string,
        stockAnalysesCount: stockAnalyses.length,
      };
    } catch (error) {
      console.error('❌ Failed to save to database:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get recent snapshots
   */
  async getRecentSnapshots(limit: number = 20) {
    if (!this.isEnabled() || !this.client) return [];
    
    const apiReady = await this.loadApi();
    if (!apiReady || !this.api) return [];

    try {
      return await this.client.query(this.api.snapshots.getRecentSnapshots, { limit });
    } catch (error) {
      console.error('❌ Failed to fetch recent snapshots:', error);
      return [];
    }
  }

  /**
   * Get snapshot with stocks by ID
   */
  async getSnapshotWithStocks(snapshotId: string) {
    if (!this.isEnabled() || !this.client) return null;
    
    const apiReady = await this.loadApi();
    if (!apiReady || !this.api) return null;

    try {
      return await this.client.query(this.api.snapshots.getSnapshotWithStocks, {
        snapshotId,
      });
    } catch (error) {
      console.error('❌ Failed to fetch snapshot:', error);
      return null;
    }
  }

  /**
   * Get stock history by symbol
   */
  async getStockHistory(symbol: string, limit: number = 52) {
    if (!this.isEnabled() || !this.client) return [];
    
    const apiReady = await this.loadApi();
    if (!apiReady || !this.api) return [];

    try {
      return await this.client.query(this.api.snapshots.getStockHistory, {
        symbol: symbol.toUpperCase(),
        limit,
      });
    } catch (error) {
      console.error('❌ Failed to fetch stock history:', error);
      return [];
    }
  }

  /**
   * Get snapshots by date range
   */
  async getSnapshotsByDateRange(startDate: string, endDate: string) {
    if (!this.isEnabled() || !this.client) return [];
    
    const apiReady = await this.loadApi();
    if (!apiReady || !this.api) return [];

    try {
      return await this.client.query(this.api.snapshots.getSnapshotsByDateRange, {
        startDate,
        endDate,
      });
    } catch (error) {
      console.error('❌ Failed to fetch snapshots by date range:', error);
      return [];
    }
  }

  /**
   * Get statistics
   */
  async getStatistics() {
    if (!this.isEnabled() || !this.client) return null;
    
    const apiReady = await this.loadApi();
    if (!apiReady || !this.api) return null;

    try {
      return await this.client.query(this.api.snapshots.getStatistics, {});
    } catch (error) {
      console.error('❌ Failed to fetch statistics:', error);
      return null;
    }
  }

  /**
   * Get the latest snapshot
   */
  async getLatestSnapshot() {
    if (!this.isEnabled() || !this.client) return null;
    
    const apiReady = await this.loadApi();
    if (!apiReady || !this.api) return null;

    try {
      return await this.client.query(this.api.snapshots.getLatestSnapshot, {});
    } catch (error) {
      console.error('❌ Failed to fetch latest snapshot:', error);
      return null;
    }
  }

  /**
   * Build stock analyses array for batch insert
   */
  private buildStockAnalyses(
    snapshotId: string,
    allocations: PortfolioAllocation[],
    technicalData: TechnicalDataRow[],
    vix: number,
    fearGreedIndex: number | null
  ) {
    // Create a map of technical data by symbol for quick lookup
    const techDataMap = new Map<string, TechnicalDataRow>();
    for (const data of technicalData) {
      techDataMap.set(data.symbol, data);
    }

    return allocations.map((allocation) => {
      const techData = techDataMap.get(allocation.symbol);

      // Calculate CSS scores (simplified - ideally would come from the analysis)
      const vixScore = this.calculateVixScore(vix);
      const rsiScore = techData ? this.calculateRsiScore(techData.rsi) : 50;
      const bbWidthScore = techData ? this.calculateBbWidthScore(techData.bbWidth) : 50;
      const ma50Score = techData ? this.calculateMa50Score(techData.ma50Deviation) : 50;
      const fearGreedScore = fearGreedIndex !== null ? this.calculateFearGreedScore(fearGreedIndex) : undefined;

      return {
        snapshotId,
        symbol: allocation.symbol,
        price: techData?.price ?? 0,
        previousClose: techData?.price ?? 0,
        changePercent: 0,
        rsi: techData?.rsi ?? 0,
        ma20: techData?.ma20 ?? 0,
        ma50: techData?.ma50 ?? 0,
        bbWidth: techData?.bbWidth ?? 0,
        atr: techData?.atr ?? 0,
        ma50Deviation: techData?.ma50Deviation ?? 0,
        cssScore: allocation.cssScore,
        multiplier: allocation.multiplier,
        vixScore,
        rsiScore,
        bbWidthScore,
        ma50Score,
        fearGreedScore,
        baseAllocationPercent: allocation.percentage,
        baseAmount: allocation.baseAmount,
        finalAmount: allocation.amount,
        signal: allocation.cssScore >= 50 ? 'BUY' : 'HOLD',
        reasoning: allocation.reasoning,
      };
    });
  }

  /**
   * Get Fear & Greed label from index value
   */
  private getFearGreedLabel(index: number | null): string | undefined {
    if (index === null) return undefined;
    if (index <= 25) return 'Extreme Fear';
    if (index <= 45) return 'Fear';
    if (index <= 55) return 'Neutral';
    if (index <= 75) return 'Greed';
    return 'Extreme Greed';
  }

  // Score calculation helpers (matching CSS service logic)
  private calculateVixScore(vix: number): number {
    if (vix <= 12) return 10;
    if (vix <= 15) return 20;
    if (vix <= 20) return 40;
    if (vix <= 25) return 55;
    if (vix <= 30) return 70;
    if (vix <= 40) return 85;
    return 100;
  }

  private calculateRsiScore(rsi: number): number {
    if (rsi <= 20) return 100;
    if (rsi <= 30) return 85;
    if (rsi <= 40) return 65;
    if (rsi <= 50) return 50;
    if (rsi <= 60) return 40;
    if (rsi <= 70) return 25;
    return 10;
  }

  private calculateBbWidthScore(bbWidth: number): number {
    if (bbWidth <= 3) return 20;
    if (bbWidth <= 5) return 35;
    if (bbWidth <= 8) return 50;
    if (bbWidth <= 12) return 65;
    if (bbWidth <= 18) return 80;
    return 90;
  }

  private calculateMa50Score(deviation: number): number {
    if (deviation <= -15) return 100;
    if (deviation <= -10) return 85;
    if (deviation <= -5) return 70;
    if (deviation <= 0) return 55;
    if (deviation <= 5) return 40;
    if (deviation <= 10) return 25;
    return 10;
  }

  private calculateFearGreedScore(fg: number): number {
    if (fg <= 10) return 100;
    if (fg <= 25) return 85;
    if (fg <= 40) return 65;
    if (fg <= 55) return 50;
    if (fg <= 70) return 35;
    if (fg <= 85) return 20;
    return 10;
  }
}
