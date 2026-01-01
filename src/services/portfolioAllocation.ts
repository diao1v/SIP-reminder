import { MarketDataService } from './marketData';
import { TechnicalAnalysisService } from './technicalAnalysis';
import { CSSService } from './cssScoring';
import { FearGreedService } from './fearGreedIndex';
import { 
  StockAnalysis, 
  PortfolioAllocation, 
  AllocationReport, 
  Config,
  TechnicalDataRow,
  FearGreedResponse
} from '../types';
import { BASE_ALLOCATIONS, BUDGET_CONSTRAINTS } from '../utils/multiplierThresholds';

/**
 * Portfolio Allocation Engine (CSS v4.2)
 * 
 * Uses Composite Signal Score (CSS) to adjust investment amounts:
 * - Never fully stops investing (min 0.5x = $125)
 * - Maximum investment capped at 1.2x ($300)
 * - 5 weighted indicators: VIX, RSI, BB Width, MA50, Fear & Greed
 */
export class PortfolioAllocationEngine {
  private marketDataService: MarketDataService;
  private technicalAnalysisService: TechnicalAnalysisService;
  private cssService: CSSService;
  private fearGreedService: FearGreedService;

  constructor(
    marketDataService?: MarketDataService,
    technicalAnalysisService?: TechnicalAnalysisService,
    cssService?: CSSService,
    fearGreedService?: FearGreedService
  ) {
    this.marketDataService = marketDataService ?? new MarketDataService();
    this.technicalAnalysisService = technicalAnalysisService ?? new TechnicalAnalysisService();
    this.cssService = cssService ?? new CSSService();
    this.fearGreedService = fearGreedService ?? new FearGreedService();
  }

  /**
   * Main method to generate portfolio allocation recommendations
   */
  async generateAllocation(config: Config): Promise<AllocationReport> {
    console.log('🔍 Fetching market data and analyzing (CSS v4.2)...');

    // Fetch market-wide indicators
    const vix = await this.marketDataService.fetchVIX();
    const fearGreedResponse = await this.fearGreedService.fetchFearGreedIndex();
    const fearGreedIndex = fearGreedResponse.success ? fearGreedResponse.value : null;

    // Calculate market-wide CSS component
    const marketCSS = this.cssService.calculateMarketCSS(vix, fearGreedIndex);
    const marketCondition = this.determineMarketCondition(vix);

    console.log(`📊 VIX: ${vix.toFixed(2)} | F&G: ${fearGreedIndex ?? 'FAILED'} | Market CSS: ${marketCSS.toFixed(1)}`);
    
    if (!fearGreedResponse.success) {
      console.warn('⚠️  Fear & Greed fetch failed - VIX weight doubled to 40%');
    }

    // Analyze each stock
    const analyses = await this.analyzeStocks(config.defaultStocks, vix, fearGreedIndex);

    // Calculate allocations using CSS
    const allocations = this.calculateAllocations(
      analyses,
      config.weeklyInvestmentAmount,
      config.minBudget,
      config.maxBudget
    );

    // Generate technical data for report
    const technicalData = this.generateTechnicalData(analyses);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      analyses,
      vix,
      fearGreedIndex,
      marketCondition,
      fearGreedResponse
    );

    // Calculate actual total after CSS adjustments
    const totalAmount = allocations.reduce((sum, a) => sum + a.amount, 0);

    return {
      date: new Date(),
      totalAmount,
      baseBudget: config.weeklyInvestmentAmount,
      minBudget: config.minBudget,
      maxBudget: config.maxBudget,
      vix,
      fearGreedIndex,
      fearGreedFailed: !fearGreedResponse.success,
      marketCSS,
      marketCondition,
      allocations,
      recommendations,
      technicalData
    };
  }

  /**
   * Analyze multiple stocks with CSS scoring
   */
  private async analyzeStocks(
    symbols: string[],
    vix: number,
    fearGreedIndex: number | null
  ): Promise<StockAnalysis[]> {
    const analyses: StockAnalysis[] = [];
    
    for (const symbol of symbols) {
      try {
        const analysis = await this.analyzeStock(symbol, vix, fearGreedIndex);
        analyses.push(analysis);
        console.log(`✓ ${symbol}: CSS=${analysis.cssBreakdown.totalCSS.toFixed(1)} (${analysis.cssBreakdown.multiplier}x) RSI=${analysis.technicalIndicators.rsi.toFixed(1)}`);
      } catch (error) {
        console.error(`✗ Failed to analyze ${symbol}:`, error);
      }
    }
    
    return analyses;
  }

  /**
   * Analyze a single stock with technical indicators and CSS
   */
  private async analyzeStock(
    symbol: string,
    vix: number,
    fearGreedIndex: number | null
  ): Promise<StockAnalysis> {
    const marketData = await this.marketDataService.fetchStockData(symbol);
    const historicalPrices = await this.marketDataService.fetchHistoricalData(symbol);
    const technicalIndicators = this.technicalAnalysisService.calculateIndicators(historicalPrices);
    
    // Calculate CSS breakdown for this asset
    const cssBreakdown = this.cssService.calculateCSSBreakdown(
      vix,
      fearGreedIndex,
      technicalIndicators,
      marketData.price
    );
    
    const { signal, strength } = this.technicalAnalysisService.analyzeSignal(
      technicalIndicators,
      marketData.price
    );

    return {
      symbol,
      marketData,
      technicalIndicators,
      cssBreakdown,
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
   * Calculate portfolio allocations using CSS multipliers
   */
  private calculateAllocations(
    analyses: StockAnalysis[],
    baseBudget: number,
    minBudget: number,
    maxBudget: number
  ): PortfolioAllocation[] {
    const allocations: PortfolioAllocation[] = [];

    for (const analysis of analyses) {
      const allocation = this.calculateSingleAllocation(
        analysis,
        baseBudget,
        minBudget,
        maxBudget
      );
      allocations.push(allocation);
    }

    // Sort by amount descending
    return allocations.sort((a, b) => b.amount - a.amount);
  }

  /**
   * Calculate allocation for a single asset using CSS
   */
  private calculateSingleAllocation(
    analysis: StockAnalysis,
    baseBudget: number,
    minBudget: number,
    maxBudget: number
  ): PortfolioAllocation {
    const { symbol, cssBreakdown } = analysis;

    // Get base allocation percentage
    const basePercentage = this.getBaseAllocationPercentage(symbol);
    const baseAmount = (baseBudget * basePercentage) / 100;

    // Apply CSS multiplier
    const multiplier = cssBreakdown.multiplier;
    let finalAmount = baseAmount * multiplier;

    // Apply min/max constraints proportionally
    const minForAsset = (minBudget * basePercentage) / 100;
    const maxForAsset = (maxBudget * basePercentage) / 100;
    finalAmount = Math.max(minForAsset, Math.min(maxForAsset, finalAmount));
    finalAmount = Math.round(finalAmount);

    const finalPercentage = (finalAmount / baseBudget) * 100;

    return {
      symbol,
      amount: finalAmount,
      percentage: Math.round(finalPercentage * 100) / 100,
      reasoning: this.generateReasoning(analysis),
      baseAmount: Math.round(baseAmount),
      cssScore: cssBreakdown.totalCSS,
      multiplier
    };
  }

  /**
   * Get base allocation percentage for a symbol
   */
  private getBaseAllocationPercentage(symbol: string): number {
    if (BASE_ALLOCATIONS[symbol]) {
      return BASE_ALLOCATIONS[symbol];
    }
    // For unknown assets, use equal distribution
    return 100 / Object.keys(BASE_ALLOCATIONS).length;
  }

  /**
   * Generate reasoning for allocation
   */
  private generateReasoning(analysis: StockAnalysis): string {
    const { cssBreakdown, technicalIndicators } = analysis;
    const reasons: string[] = [];

    // CSS interpretation
    const cssInterpretation = this.cssService.getCSSInterpretation(cssBreakdown.totalCSS);
    reasons.push(`CSS ${cssBreakdown.totalCSS.toFixed(0)}: ${cssInterpretation}`);

    // RSI insight
    if (cssBreakdown.rsiScore >= 80) {
      reasons.push(`Oversold (RSI ${technicalIndicators.rsi.toFixed(0)})`);
    } else if (cssBreakdown.rsiScore <= 20) {
      reasons.push(`Overbought (RSI ${technicalIndicators.rsi.toFixed(0)})`);
    }

    // MA50 insight
    if (cssBreakdown.ma50DeviationPercent < -5) {
      reasons.push(`${Math.abs(cssBreakdown.ma50DeviationPercent).toFixed(1)}% below MA50`);
    } else if (cssBreakdown.ma50DeviationPercent > 5) {
      reasons.push(`${cssBreakdown.ma50DeviationPercent.toFixed(1)}% above MA50`);
    }

    // F&G fallback note
    if (cssBreakdown.vixWeightAdjusted) {
      reasons.push('(VIX weight doubled)');
    }

    return reasons.join('; ');
  }

  /**
   * Generate technical data for report
   */
  private generateTechnicalData(analyses: StockAnalysis[]): TechnicalDataRow[] {
    return analyses.map(analysis => {
      const { symbol, marketData, technicalIndicators, cssBreakdown } = analysis;
      
      return {
        symbol,
        price: Math.round(marketData.price * 100) / 100,
        rsi: Math.round(technicalIndicators.rsi * 100) / 100,
        ma20: Math.round(technicalIndicators.ma20 * 100) / 100,
        ma50: Math.round(technicalIndicators.ma50 * 100) / 100,
        atr: Math.round(technicalIndicators.atr * 100) / 100,
        bbWidth: Math.round(technicalIndicators.bbWidth * 100) / 100,
        ma50Deviation: cssBreakdown.ma50DeviationPercent,
        cssScore: cssBreakdown.totalCSS,
        multiplier: cssBreakdown.multiplier
      };
    });
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    analyses: StockAnalysis[],
    vix: number,
    fearGreedIndex: number | null,
    marketCondition: string,
    fearGreedResponse: FearGreedResponse
  ): string[] {
    const recommendations: string[] = [];

    // Fear & Greed failure warning
    if (!fearGreedResponse.success) {
      recommendations.push('⚠️ Fear & Greed Index fetch FAILED - VIX weight doubled to 40% as fallback');
    } else {
      const emoji = this.fearGreedService.getRatingEmoji(fearGreedResponse.rating);
      recommendations.push(`${emoji} Fear & Greed: ${fearGreedIndex} (${fearGreedResponse.rating})`);
    }

    // Market condition recommendations
    if (marketCondition === 'BEARISH') {
      recommendations.push('📉 High volatility market. CSS adjustments active.');
    } else if (marketCondition === 'BULLISH') {
      recommendations.push('📈 Low volatility market. Standard allocations.');
    }

    // VIX-specific recommendations
    if (vix > 30) {
      recommendations.push(`🔥 VIX at ${vix.toFixed(1)} - Elevated fear, CSS boosting investments.`);
    } else if (vix < 15) {
      recommendations.push(`😎 VIX at ${vix.toFixed(1)} - Market complacent, CSS reducing slightly.`);
    }

    // High CSS opportunities
    const highCSS = analyses.filter(a => a.cssBreakdown.totalCSS >= 60);
    if (highCSS.length > 0) {
      recommendations.push(`🎯 High CSS opportunities: ${highCSS.map(a => `${a.symbol} (${a.cssBreakdown.totalCSS.toFixed(0)})`).join(', ')}`);
    }

    // Low CSS holdings
    const lowCSS = analyses.filter(a => a.cssBreakdown.totalCSS <= 35);
    if (lowCSS.length > 0) {
      recommendations.push(`📊 Lower allocation (high greed): ${lowCSS.map(a => `${a.symbol} (${a.cssBreakdown.totalCSS.toFixed(0)})`).join(', ')}`);
    }

    // Oversold assets
    const oversold = analyses.filter(a => a.technicalIndicators.rsi < 30);
    if (oversold.length > 0) {
      recommendations.push(`💡 Oversold (RSI<30): ${oversold.map(a => a.symbol).join(', ')}`);
    }

    // Below MA50 discounts
    const discounts = analyses.filter(a => a.cssBreakdown.ma50DeviationPercent < -5);
    if (discounts.length > 0) {
      recommendations.push(`🏷️ Discounted (5%+ below MA50): ${discounts.map(a => `${a.symbol} (${a.cssBreakdown.ma50DeviationPercent.toFixed(1)}%)`).join(', ')}`);
    }

    // Budget reminder
    recommendations.push(`💰 Budget range: $${BUDGET_CONSTRAINTS.MIN_BUDGET} - $${BUDGET_CONSTRAINTS.MAX_BUDGET} (never $0)`);
    recommendations.push('📊 CSS v4.2: Always invest at least 0.5x, maximum 1.2x');

    return recommendations;
  }
}
