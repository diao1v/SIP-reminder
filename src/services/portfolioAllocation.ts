import { MarketDataService } from './marketData';
import { TechnicalAnalysisService } from './technicalAnalysis';
import { AdjustmentMultiplierService } from './adjustmentMultipliers';
import { 
  StockAnalysis, 
  PortfolioAllocation, 
  AllocationReport, 
  Config,
  TechnicalDataRow 
} from '../types';
import { 
  BASE_ALLOCATIONS, 
  ASSET_CATEGORIES, 
  DEFENSIVE_ALLOCATION_PERCENTAGE 
} from '../utils/multiplierThresholds';

export class PortfolioAllocationEngine {
  private marketDataService: MarketDataService;
  private technicalAnalysisService: TechnicalAnalysisService;
  private adjustmentMultiplierService: AdjustmentMultiplierService;

  constructor(
    marketDataService?: MarketDataService,
    technicalAnalysisService?: TechnicalAnalysisService,
    adjustmentMultiplierService?: AdjustmentMultiplierService
  ) {
    this.marketDataService = marketDataService ?? new MarketDataService();
    this.technicalAnalysisService = technicalAnalysisService ?? new TechnicalAnalysisService();
    this.adjustmentMultiplierService = adjustmentMultiplierService ?? new AdjustmentMultiplierService();
  }

  /**
   * Main method to generate portfolio allocation recommendations
   */
  async generateAllocation(config: Config): Promise<AllocationReport> {
    console.log('🔍 Fetching market data and analyzing...');

    // Fetch VIX for overall market sentiment
    const vix = await this.marketDataService.fetchVIX();
    const vixMultiplier = this.adjustmentMultiplierService.calculateVIXMultiplier(vix);
    const marketCondition = this.determineMarketCondition(vix);

    console.log(`📊 VIX: ${vix.toFixed(2)} (${vixMultiplier}x) - Market: ${marketCondition}`);

    // Get stocks to analyze (excluding defensive duplicates)
    const stocksToAnalyze = this.getStocksToAnalyze(config.defaultStocks);
    
    // Analyze each stock
    const analyses = await this.analyzeStocks(stocksToAnalyze);

    // Select the best defensive asset if both XLV and XLP are in the list
    const selectedDefensive = await this.selectDefensiveAsset(config.defaultStocks, analyses);
    if (selectedDefensive) {
      console.log(`🛡️ Selected defensive asset: ${selectedDefensive.symbol} (Score: ${selectedDefensive.score.toFixed(1)})`);
    }

    // Filter analyses to only include selected assets
    const filteredAnalyses = this.filterAnalysesForAllocation(analyses, selectedDefensive?.symbol);

    // Calculate allocations using multi-dimensional adjustment
    const allocations = this.calculateAllocations(
      filteredAnalyses,
      config.weeklyInvestmentAmount,
      vix,
      selectedDefensive?.symbol
    );

    // Generate technical data for report (include all analyzed stocks for reference)
    const technicalData = this.generateTechnicalData(analyses);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      filteredAnalyses,
      vix,
      marketCondition,
      config.riskTolerance,
      selectedDefensive
    );

    return {
      date: new Date(),
      totalAmount: config.weeklyInvestmentAmount,
      vix,
      vixMultiplier,
      marketCondition,
      allocations,
      recommendations,
      technicalData
    };
  }

  /**
   * Get the list of stocks to analyze, ensuring both defensive options are analyzed
   */
  private getStocksToAnalyze(configuredStocks: string[]): string[] {
    const stocks = new Set(configuredStocks);
    
    // Ensure both defensive options are analyzed for comparison
    if (stocks.has('XLV') || stocks.has('XLP')) {
      stocks.add('XLV');
      stocks.add('XLP');
    }
    
    return Array.from(stocks);
  }

  /**
   * Filter analyses to only include assets that should be allocated
   * (excludes the non-selected defensive asset)
   */
  private filterAnalysesForAllocation(
    analyses: StockAnalysis[],
    selectedDefensive: string | undefined
  ): StockAnalysis[] {
    return analyses.filter(a => {
      // If this is a defensive asset and not the selected one, exclude it
      if (ASSET_CATEGORIES.DEFENSIVE.includes(a.symbol as 'XLV' | 'XLP')) {
        return a.symbol === selectedDefensive;
      }
      return true;
    });
  }

  /**
   * Select the best defensive asset between XLV and XLP based on technical indicators
   * Uses a scoring system:
   * - Lower RSI = better (40 points max)
   * - Below entry point = better (30 points max)
   * - Higher BB Width = more opportunity (20 points max)
   * - Better momentum (10 points max)
   */
  private async selectDefensiveAsset(
    configuredStocks: string[],
    analyses: StockAnalysis[]
  ): Promise<{ symbol: string; score: number; reason: string } | null> {
    const hasXLV = configuredStocks.includes('XLV');
    const hasXLP = configuredStocks.includes('XLP');

    // If only one defensive asset is configured, use it
    if (hasXLV && !hasXLP) {
      return { symbol: 'XLV', score: 100, reason: 'Only XLV configured' };
    }
    if (hasXLP && !hasXLV) {
      return { symbol: 'XLP', score: 100, reason: 'Only XLP configured' };
    }
    if (!hasXLV && !hasXLP) {
      return null; // No defensive assets
    }

    // Both are configured, compare them
    const xlvAnalysis = analyses.find(a => a.symbol === 'XLV');
    const xlpAnalysis = analyses.find(a => a.symbol === 'XLP');

    if (!xlvAnalysis || !xlpAnalysis) {
      // If we couldn't analyze one, use the other
      return xlvAnalysis 
        ? { symbol: 'XLV', score: 100, reason: 'XLP analysis unavailable' }
        : xlpAnalysis 
        ? { symbol: 'XLP', score: 100, reason: 'XLV analysis unavailable' }
        : null;
    }

    const xlvScore = this.scoreDefensiveAsset(xlvAnalysis);
    const xlpScore = this.scoreDefensiveAsset(xlpAnalysis);

    console.log(`   XLV Score: ${xlvScore.total.toFixed(1)} (RSI: ${xlvAnalysis.technicalIndicators.rsi.toFixed(1)})`);
    console.log(`   XLP Score: ${xlpScore.total.toFixed(1)} (RSI: ${xlpAnalysis.technicalIndicators.rsi.toFixed(1)})`);

    if (xlvScore.total >= xlpScore.total) {
      return { 
        symbol: 'XLV', 
        score: xlvScore.total, 
        reason: xlvScore.reasons.join('; ')
      };
    } else {
      return { 
        symbol: 'XLP', 
        score: xlpScore.total, 
        reason: xlpScore.reasons.join('; ')
      };
    }
  }

  /**
   * Score a defensive asset based on technical indicators
   */
  private scoreDefensiveAsset(analysis: StockAnalysis): { total: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];
    const { rsi, ma20, atr, bbWidth, bollingerBands } = analysis.technicalIndicators;
    const price = analysis.marketData.price;

    // RSI Score (0-40 points) - Lower RSI is better
    // RSI 30 or below = 40 points, RSI 70+ = 0 points
    const rsiScore = Math.max(0, Math.min(40, (70 - rsi) * (40 / 40)));
    score += rsiScore;
    if (rsi < 40) {
      reasons.push(`Low RSI (${rsi.toFixed(0)})`);
    }

    // Entry Point Score (0-30 points) - Below MA20-0.5*ATR is better
    const calculatedMa20 = ma20 ?? bollingerBands.middle;
    const entryThreshold = calculatedMa20 - 0.5 * atr;
    const entryDiff = entryThreshold - price;
    if (entryDiff > 0) {
      // Below entry point - good
      const entryScore = Math.min(30, entryDiff / atr * 15);
      score += entryScore;
      reasons.push(`Below entry ($${price.toFixed(2)} < $${entryThreshold.toFixed(2)})`);
    }

    // BB Width Score (0-20 points) - Higher width = more opportunity
    const calculatedBbWidth = bbWidth ?? ((bollingerBands.upper - bollingerBands.lower) / bollingerBands.middle * 100);
    const bbScore = Math.min(20, calculatedBbWidth * 2);
    score += bbScore;
    if (calculatedBbWidth > 5) {
      reasons.push(`Good volatility (BB: ${calculatedBbWidth.toFixed(1)}%)`);
    }

    // Momentum Score (0-10 points) - Positive change is bonus, but not primary
    const changePercent = analysis.marketData.changePercent;
    if (changePercent > 0) {
      const momentumScore = Math.min(10, changePercent * 2);
      score += momentumScore;
    }

    if (reasons.length === 0) {
      reasons.push('Standard conditions');
    }

    return { total: score, reasons };
  }

  /**
   * Analyze multiple stocks
   */
  private async analyzeStocks(symbols: string[]): Promise<StockAnalysis[]> {
    const analyses: StockAnalysis[] = [];
    
    for (const symbol of symbols) {
      try {
        const analysis = await this.analyzeStock(symbol);
        analyses.push(analysis);
        console.log(`✓ Analyzed ${symbol}: ${analysis.signal} (RSI: ${analysis.technicalIndicators.rsi.toFixed(1)}, strength: ${analysis.strength})`);
      } catch (error) {
        console.error(`✗ Failed to analyze ${symbol}:`, error);
      }
    }
    
    return analyses;
  }

  /**
   * Analyze a single stock with technical indicators
   */
  private async analyzeStock(symbol: string): Promise<StockAnalysis> {
    const marketData = await this.marketDataService.fetchStockData(symbol);
    const historicalPrices = await this.marketDataService.fetchHistoricalData(symbol, 30);
    const technicalIndicators = this.technicalAnalysisService.calculateIndicators(historicalPrices);
    const { signal, strength } = this.technicalAnalysisService.analyzeSignal(
      technicalIndicators,
      marketData.price
    );

    return {
      symbol,
      marketData,
      technicalIndicators,
      signal,
      strength
    };
  }

  /**
   * Determine market condition based on VIX
   */
  private determineMarketCondition(vix: number): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (vix < 15) return 'BULLISH';
    if (vix > 25) return 'BEARISH';
    return 'NEUTRAL';
  }

  /**
   * Calculate portfolio allocations using multi-dimensional adjustment system
   * Final Investment Amount = Base Amount × BB_Multiplier × VIX_Multiplier × RSI_Multiplier
   */
  private calculateAllocations(
    analyses: StockAnalysis[],
    totalAmount: number,
    vix: number,
    selectedDefensive: string | undefined
  ): PortfolioAllocation[] {
    // Check for defensive rotation
    const avgRsi = this.calculateAverageRSI(analyses);
    const shouldRotateDefensive = this.adjustmentMultiplierService.shouldTriggerDefensiveRotation(vix, avgRsi);

    if (shouldRotateDefensive) {
      console.log(`🛡️ Defensive rotation triggered (VIX: ${vix}, Avg RSI: ${avgRsi.toFixed(1)})`);
    }

    const allocations: PortfolioAllocation[] = [];

    for (const analysis of analyses) {
      const allocation = this.calculateSingleAllocation(
        analysis,
        totalAmount,
        vix,
        shouldRotateDefensive,
        selectedDefensive
      );
      
      if (allocation) {
        allocations.push(allocation);
      }
    }

    // Sort by amount descending
    return allocations.sort((a, b) => b.amount - a.amount);
  }

  /**
   * Calculate allocation for a single asset
   */
  private calculateSingleAllocation(
    analysis: StockAnalysis,
    totalAmount: number,
    vix: number,
    shouldRotateDefensive: boolean,
    selectedDefensive: string | undefined
  ): PortfolioAllocation | null {
    const { symbol, technicalIndicators } = analysis;
    const { rsi, bollingerBands } = technicalIndicators;

    // Get base allocation percentage
    const basePercentage = this.getBaseAllocationPercentage(symbol, selectedDefensive);
    const baseAmount = (totalAmount * basePercentage) / 100;

    // Calculate combined multiplier (BB × VIX × RSI)
    const multiplierBreakdown = this.adjustmentMultiplierService.getMultiplierBreakdown(
      vix,
      rsi,
      bollingerBands
    );

    // Check if RSI indicates overbought (pause)
    if (multiplierBreakdown.rsiMultiplier === 0) {
      return {
        symbol,
        amount: 0,
        percentage: 0,
        reasoning: `Overbought (RSI=${rsi.toFixed(0)}) - PAUSED 🔴`,
        baseAmount,
        multiplier: 0,
        rsiRecommendation: multiplierBreakdown.rsiRecommendation
      };
    }

    // Apply defensive rotation if needed
    let adjustedMultiplier = multiplierBreakdown.combined;
    const isDefensiveAsset = this.isDefensiveAsset(symbol);

    if (shouldRotateDefensive) {
      if (isDefensiveAsset) {
        adjustedMultiplier *= this.adjustmentMultiplierService.getDefensiveIncreaseMultiplier();
      } else {
        // Reduce aggressive assets proportionally
        adjustedMultiplier *= 0.7;
      }
    }

    // Calculate final amount
    const finalAmount = Math.round(baseAmount * adjustedMultiplier);
    const finalPercentage = (finalAmount / totalAmount) * 100;

    return {
      symbol,
      amount: finalAmount,
      percentage: Math.round(finalPercentage * 100) / 100,
      reasoning: this.generateReasoning(analysis, vix, multiplierBreakdown),
      baseAmount: Math.round(baseAmount),
      multiplier: Math.round(adjustedMultiplier * 1000) / 1000,
      rsiRecommendation: multiplierBreakdown.rsiRecommendation
    };
  }

  /**
   * Get base allocation percentage for a symbol
   */
  private getBaseAllocationPercentage(symbol: string, selectedDefensive: string | undefined): number {
    // For defensive assets, use the defensive allocation percentage
    if (ASSET_CATEGORIES.DEFENSIVE.includes(symbol as 'XLV' | 'XLP')) {
      // Only allocate to the selected defensive asset
      if (symbol === selectedDefensive) {
        return DEFENSIVE_ALLOCATION_PERCENTAGE;
      }
      return 0; // Don't allocate to non-selected defensive
    }
    
    // Check if symbol has a predefined allocation
    if (BASE_ALLOCATIONS[symbol]) {
      return BASE_ALLOCATIONS[symbol];
    }
    
    // For custom stocks, distribute equally among non-predefined stocks
    return 20; // Default 20% for custom stocks
  }

  /**
   * Check if an asset is defensive
   */
  private isDefensiveAsset(symbol: string): boolean {
    return ASSET_CATEGORIES.DEFENSIVE.includes(symbol as 'XLV' | 'XLP');
  }

  /**
   * Calculate average RSI across all analyses
   */
  private calculateAverageRSI(analyses: StockAnalysis[]): number {
    if (analyses.length === 0) return 50;
    const totalRsi = analyses.reduce((sum, a) => sum + a.technicalIndicators.rsi, 0);
    return totalRsi / analyses.length;
  }

  /**
   * Generate reasoning for allocation
   */
  private generateReasoning(
    analysis: StockAnalysis,
    vix: number,
    multiplierBreakdown: ReturnType<AdjustmentMultiplierService['getMultiplierBreakdown']>
  ): string {
    const reasons: string[] = [];
    const { rsi, atr, ma20 } = analysis.technicalIndicators;
    const price = analysis.marketData.price;

    // RSI-based reason
    if (rsi < 30) {
      reasons.push(`RSI oversold (${rsi.toFixed(0)})`);
    } else if (rsi < 40) {
      reasons.push(`RSI shows opportunity (${rsi.toFixed(0)})`);
    }

    // BB Width-based reason
    if (multiplierBreakdown.bbWidth > 10) {
      reasons.push(`High volatility (BB: ${multiplierBreakdown.bbWidth.toFixed(1)}%)`);
    }

    // VIX-based reason
    if (multiplierBreakdown.vixMultiplier > 1) {
      reasons.push(`Fear premium (VIX: ${vix.toFixed(0)}, ${multiplierBreakdown.vixMultiplier}x)`);
    }

    // Entry point reason
    if (ma20 && atr) {
      const entryThreshold = ma20 - 0.5 * atr;
      if (price < entryThreshold) {
        reasons.push(`Below entry target ($${entryThreshold.toFixed(2)})`);
      }
    }

    // Momentum reason
    if (analysis.marketData.changePercent > 2) {
      reasons.push('Strong momentum');
    }

    if (reasons.length === 0) {
      reasons.push('Standard DCA allocation');
    }

    return reasons.join('; ');
  }

  /**
   * Generate technical data for report
   */
  private generateTechnicalData(analyses: StockAnalysis[]): TechnicalDataRow[] {
    return analyses.map(analysis => {
      const { symbol, marketData, technicalIndicators } = analysis;
      const { rsi, atr, ma20, bbWidth, bollingerBands } = technicalIndicators;
      
      const calculatedMa20 = ma20 ?? bollingerBands.middle;
      const calculatedBbWidth = bbWidth ?? 
        ((bollingerBands.upper - bollingerBands.lower) / bollingerBands.middle * 100);
      const entryPoint = calculatedMa20 - 0.5 * atr;
      
      return {
        symbol,
        price: Math.round(marketData.price * 100) / 100,
        rsi: Math.round(rsi * 100) / 100,
        ma20: Math.round(calculatedMa20 * 100) / 100,
        atr: Math.round(atr * 100) / 100,
        bbWidth: Math.round(calculatedBbWidth * 100) / 100,
        entryPoint: Math.round(entryPoint * 100) / 100,
        isGoodEntry: marketData.price < entryPoint
      };
    });
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    analyses: StockAnalysis[],
    vix: number,
    marketCondition: string,
    riskTolerance: string,
    selectedDefensive: { symbol: string; score: number; reason: string } | null
  ): string[] {
    const recommendations: string[] = [];
    const vixMultiplier = this.adjustmentMultiplierService.calculateVIXMultiplier(vix);

    // Market condition recommendations
    if (marketCondition === 'BEARISH') {
      recommendations.push('⚠️ High market volatility detected. Defensive rotation active.');
    } else if (marketCondition === 'BULLISH') {
      recommendations.push('✅ Favorable market conditions. Good time for systematic investments.');
    }

    // VIX-specific recommendations
    if (vix > 30) {
      recommendations.push(`📉 VIX at ${vix.toFixed(1)} indicates extreme fear. Multiplier: ${vixMultiplier}x - This could be a buying opportunity for long-term investors.`);
    } else if (vix < 12) {
      recommendations.push('📈 VIX below 12 indicates complacency. Markets may be due for a correction.');
    }

    // Defensive asset selection explanation
    if (selectedDefensive) {
      recommendations.push(`🛡️ Defensive allocation: ${selectedDefensive.symbol} selected (${selectedDefensive.reason})`);
    }

    // Stock-specific recommendations
    const priorityBuys = analyses.filter(a => a.technicalIndicators.rsi < 30);
    if (priorityBuys.length > 0) {
      recommendations.push(`🎯 PRIORITY BUY (Oversold): ${priorityBuys.map(a => `${a.symbol} (RSI=${a.technicalIndicators.rsi.toFixed(0)})`).join(', ')}`);
    }

    const pausedAssets = analyses.filter(a => a.technicalIndicators.rsi > 70);
    if (pausedAssets.length > 0) {
      recommendations.push(`🔴 PAUSED (Overbought): ${pausedAssets.map(a => `${a.symbol} (RSI=${a.technicalIndicators.rsi.toFixed(0)})`).join(', ')}`);
    }

    // Entry point opportunities
    const goodEntries = analyses.filter(a => {
      const { ma20, atr } = a.technicalIndicators;
      if (!ma20 || !atr) return false;
      return a.marketData.price < (ma20 - 0.5 * atr);
    });
    if (goodEntries.length > 0) {
      recommendations.push(`💡 Strong entry points: ${goodEntries.map(a => a.symbol).join(', ')} (Price below MA20 - 0.5×ATR)`);
    }

    // Risk management
    recommendations.push('📊 Maintain disciplined investing regardless of market sentiment.');
    recommendations.push('⏰ Review and rebalance portfolio quarterly to maintain target allocation.');

    return recommendations;
  }
}
