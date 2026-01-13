import { ConvexHttpClient } from "convex/browser";
import { AllocationReport, DatabaseSaveResult, PortfolioAllocation, TechnicalDataRow } from "../types";
import { CSSService } from "./cssScoring";
import { logger } from "../utils/logger";

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
  private cssService: CSSService = new CSSService();

  constructor(convexUrl: string) {
    if (convexUrl && convexUrl.length > 0) {
      try {
        this.client = new ConvexHttpClient(convexUrl);
        this.enabled = true;
        logger.info('📦 Database service initialized (Convex)');
      } catch (error) {
        logger.warn('Failed to initialize Convex client', { error: error instanceof Error ? error.message : 'Unknown' });
        this.enabled = false;
      }
    } else {
      logger.info('📦 Database service disabled (no CONVEX_URL)');
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
      logger.warn(this.apiLoadError);
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

    // Extract date in YYYY-MM-DD format for deduplication
    const date = report.date.toISOString().split('T')[0];
    let replacedSnapshotId: string | undefined;

    try {
      // Check if snapshot already exists for this date
      const existingSnapshot = await this.client.query(
        this.api.snapshots.getSnapshotByDate,
        { date }
      );

      if (existingSnapshot) {
        // Delete existing snapshot and its stock analyses to replace with fresh data
        logger.info(`Replacing existing snapshot for ${date}`, {
          existingSnapshotId: existingSnapshot._id
        });
        await this.client.mutation(this.api.snapshots.deleteSnapshot, {
          snapshotId: existingSnapshot._id,
        });
        replacedSnapshotId = existingSnapshot._id;
      }

      // 1. Save the main snapshot
      const snapshotId = await this.client.mutation(this.api.snapshots.saveWeeklySnapshot, {
        date,
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

      logger.success(`Saved snapshot`, { snapshotId: snapshotId as string });

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
        logger.success(`Saved stock analyses`, { count: stockAnalyses.length });
      }

      return {
        success: true,
        snapshotId: snapshotId as string,
        stockAnalysesCount: stockAnalyses.length,
        replaced: !!replacedSnapshotId,
        replacedSnapshotId,
      };
    } catch (error) {
      logger.error('Failed to save to database', { error: error instanceof Error ? error.message : 'Unknown' });
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
      logger.error('Failed to fetch recent snapshots', { error: error instanceof Error ? error.message : 'Unknown' });
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
      logger.error('Failed to fetch snapshot', { error: error instanceof Error ? error.message : 'Unknown' });
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
      logger.error('Failed to fetch stock history', { error: error instanceof Error ? error.message : 'Unknown' });
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
      logger.error('Failed to fetch snapshots by date range', { error: error instanceof Error ? error.message : 'Unknown' });
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
      logger.error('Failed to fetch statistics', { error: error instanceof Error ? error.message : 'Unknown' });
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
      logger.error('Failed to fetch latest snapshot', { error: error instanceof Error ? error.message : 'Unknown' });
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

      // Calculate CSS scores using shared CSSService logic
      const vixScore = this.cssService.calculateVIXScore(vix);
      const rsiScore = techData ? this.cssService.calculateRSIScore(techData.rsi) : 50;
      const bbWidthScore = techData ? this.cssService.calculateBBWidthScore(techData.bbWidth) : 50;
      const ma50Score = techData ? this.cssService.calculateMA50Score(techData.ma50Deviation) : 50;
      const fearGreedScore = fearGreedIndex !== null ? this.cssService.calculateFearGreedScore(fearGreedIndex) : undefined;

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
}
