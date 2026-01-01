import { MarketDataService } from './marketData';
import { TechnicalAnalysisService } from './technicalAnalysis';
import { StockAnalysis, PortfolioAllocation, AllocationReport, Config } from '../types';

export class PortfolioAllocationEngine {
  private marketDataService: MarketDataService;
  private technicalAnalysisService: TechnicalAnalysisService;

  constructor() {
    this.marketDataService = new MarketDataService();
    this.technicalAnalysisService = new TechnicalAnalysisService();
  }

  /**
   * Main method to generate portfolio allocation recommendations
   */
  async generateAllocation(config: Config): Promise<AllocationReport> {
    console.log('🔍 Fetching market data and analyzing...');

    // Fetch VIX for overall market sentiment
    const vix = await this.marketDataService.fetchVIX();
    const marketCondition = this.determineMarketCondition(vix);

    console.log(`📊 VIX: ${vix.toFixed(2)} - Market: ${marketCondition}`);

    // Analyze each stock
    const analyses: StockAnalysis[] = [];
    for (const symbol of config.defaultStocks) {
      try {
        const analysis = await this.analyzeStock(symbol);
        analyses.push(analysis);
        console.log(`✓ Analyzed ${symbol}: ${analysis.signal} (strength: ${analysis.strength})`);
      } catch (error) {
        console.error(`✗ Failed to analyze ${symbol}:`, error);
      }
    }

    // Calculate allocations using multi-dimensional adjustment
    const allocations = this.calculateAllocations(
      analyses,
      config.weeklyInvestmentAmount,
      vix,
      config.riskTolerance
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      analyses,
      vix,
      marketCondition,
      config.riskTolerance
    );

    return {
      date: new Date(),
      totalAmount: config.weeklyInvestmentAmount,
      vix,
      marketCondition,
      allocations,
      recommendations
    };
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
   */
  private calculateAllocations(
    analyses: StockAnalysis[],
    totalAmount: number,
    vix: number,
    riskTolerance: 'conservative' | 'moderate' | 'aggressive'
  ): PortfolioAllocation[] {
    // Filter to only BUY signals
    const buyOpportunities = analyses.filter(a => a.signal === 'BUY');

    if (buyOpportunities.length === 0) {
      // No buy signals - recommend holding cash or conservative allocation
      return [{
        symbol: 'CASH',
        amount: totalAmount,
        percentage: 100,
        reasoning: 'No strong buy signals detected. Holding cash until better opportunities arise.'
      }];
    }

    // Calculate base scores
    const scores = buyOpportunities.map(analysis => {
      let score = analysis.strength;

      // Adjust for RSI
      const rsi = analysis.technicalIndicators.rsi;
      if (rsi < 30) score *= 1.3; // Strong oversold bonus
      else if (rsi < 40) score *= 1.15; // Mild oversold bonus
      else if (rsi > 60) score *= 0.85; // Reduce if overbought

      // Adjust for price position in Bollinger Bands
      const { upper, middle, lower } = analysis.technicalIndicators.bollingerBands;
      const price = analysis.marketData.price;
      const bbPosition = (price - lower) / (upper - lower);
      
      if (bbPosition < 0.3) score *= 1.2; // Near lower band
      else if (bbPosition > 0.7) score *= 0.8; // Near upper band

      // Adjust for volatility (ATR)
      const atrRatio = analysis.technicalIndicators.atr / price;
      if (atrRatio < 0.02) score *= 1.1; // Low volatility bonus
      else if (atrRatio > 0.05) score *= 0.9; // High volatility penalty

      return score;
    });

    // Apply VIX-based adjustment
    const vixAdjustment = this.getVIXAdjustment(vix);
    const adjustedScores = scores.map(s => s * vixAdjustment);

    // Apply risk tolerance adjustment
    const riskAdjustment = this.getRiskAdjustment(riskTolerance);
    const finalScores = adjustedScores.map(s => s * riskAdjustment);

    // Normalize scores to percentages
    const totalScore = finalScores.reduce((a, b) => a + b, 0);
    const allocations: PortfolioAllocation[] = buyOpportunities.map((analysis, i) => {
      const percentage = (finalScores[i] / totalScore) * 100;
      const amount = Math.round((totalAmount * percentage) / 100);

      return {
        symbol: analysis.symbol,
        amount,
        percentage: Math.round(percentage * 100) / 100,
        reasoning: this.generateReasoning(analysis, vix)
      };
    });

    // Sort by amount descending
    return allocations.sort((a, b) => b.amount - a.amount);
  }

  /**
   * Get VIX-based adjustment factor
   */
  private getVIXAdjustment(vix: number): number {
    if (vix < 12) return 1.2; // Very low volatility - increase exposure
    if (vix < 15) return 1.1; // Low volatility
    if (vix < 20) return 1.0; // Normal
    if (vix < 25) return 0.9; // Elevated volatility
    if (vix < 30) return 0.8; // High volatility
    return 0.7; // Very high volatility - reduce exposure
  }

  /**
   * Get risk tolerance adjustment factor
   */
  private getRiskAdjustment(riskTolerance: 'conservative' | 'moderate' | 'aggressive'): number {
    switch (riskTolerance) {
      case 'conservative':
        return 0.8;
      case 'moderate':
        return 1.0;
      case 'aggressive':
        return 1.2;
    }
  }

  /**
   * Generate reasoning for allocation
   */
  private generateReasoning(analysis: StockAnalysis, vix: number): string {
    const reasons: string[] = [];
    const { rsi, bollingerBands, atr } = analysis.technicalIndicators;
    const price = analysis.marketData.price;

    if (rsi < 30) {
      reasons.push('RSI indicates oversold conditions');
    } else if (rsi < 40) {
      reasons.push('RSI shows potential buying opportunity');
    }

    const bbPosition = (price - bollingerBands.lower) / (bollingerBands.upper - bollingerBands.lower);
    if (bbPosition < 0.3) {
      reasons.push('Price near lower Bollinger Band');
    }

    if (atr / price < 0.02) {
      reasons.push('Low volatility environment');
    }

    if (analysis.marketData.changePercent > 2) {
      reasons.push('Strong positive momentum');
    }

    if (vix < 15) {
      reasons.push('Favorable market conditions');
    }

    return reasons.length > 0 ? reasons.join('; ') : 'Technical indicators show buy signal';
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    analyses: StockAnalysis[],
    vix: number,
    marketCondition: string,
    riskTolerance: string
  ): string[] {
    const recommendations: string[] = [];

    // Market condition recommendations
    if (marketCondition === 'BEARISH') {
      recommendations.push('⚠️ High market volatility detected. Consider reducing position sizes or waiting for stabilization.');
    } else if (marketCondition === 'BULLISH') {
      recommendations.push('✅ Favorable market conditions. Good time for systematic investments.');
    }

    // VIX-specific recommendations
    if (vix > 30) {
      recommendations.push('📉 VIX above 30 indicates extreme fear. This could be a buying opportunity for long-term investors.');
    } else if (vix < 12) {
      recommendations.push('📈 VIX below 12 indicates complacency. Markets may be due for a correction.');
    }

    // Stock-specific recommendations
    const strongBuys = analyses.filter(a => a.signal === 'BUY' && a.strength > 60);
    if (strongBuys.length > 0) {
      recommendations.push(`🎯 Strong buy signals detected for: ${strongBuys.map(a => a.symbol).join(', ')}`);
    }

    const oversold = analyses.filter(a => a.technicalIndicators.rsi < 30);
    if (oversold.length > 0) {
      recommendations.push(`💡 Oversold opportunities: ${oversold.map(a => a.symbol).join(', ')} (RSI < 30)`);
    }

    // Risk management
    recommendations.push('📊 Maintain disciplined investing regardless of market sentiment.');
    recommendations.push('⏰ Review and rebalance portfolio quarterly to maintain target allocation.');

    return recommendations;
  }
}
