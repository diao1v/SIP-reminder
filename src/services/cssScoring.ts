import {
  CSS_WEIGHTS,
  CSS_TO_MULTIPLIER,
  VIX_SCORE_THRESHOLDS,
  RSI_SCORE_THRESHOLDS,
  BB_WIDTH_SCORE_THRESHOLDS,
  MA50_SCORE_THRESHOLDS,
  FEAR_GREED_SCORE_THRESHOLDS,
  BUDGET_CONSTRAINTS
} from '../utils/multiplierThresholds';
import { CSSBreakdown, TechnicalIndicators } from '../types';

/**
 * CSS (Composite Signal Score) Scoring Service
 * 
 * Implements the CSS formula from Strategy v4.2:
 * CSS = (VIX × 0.20) + (RSI × 0.25) + (BB × 0.15) + (MA50 × 0.20) + (F&G × 0.20)
 * 
 * Higher CSS = More fear/opportunity = Invest more
 */
export class CSSService {
  /**
   * Calculate VIX score (0-100)
   * Higher VIX = Higher score (more fear = opportunity)
   */
  calculateVIXScore(vix: number): number {
    for (const threshold of VIX_SCORE_THRESHOLDS) {
      if (vix <= threshold.maxVIX) {
        return threshold.score;
      }
    }
    return 100; // Default to max if above all thresholds
  }

  /**
   * Calculate RSI score (0-100)
   * Lower RSI = Higher score (oversold = opportunity)
   */
  calculateRSIScore(rsi: number): number {
    for (const threshold of RSI_SCORE_THRESHOLDS) {
      if (rsi <= threshold.maxRSI) {
        return threshold.score;
      }
    }
    return 0; // Default to min if above all thresholds (overbought)
  }

  /**
   * Calculate Bollinger Bands Width score (0-100)
   * Higher width = Higher score (more volatility = opportunity)
   */
  calculateBBWidthScore(bbWidth: number): number {
    for (const threshold of BB_WIDTH_SCORE_THRESHOLDS) {
      if (bbWidth <= threshold.maxWidth) {
        return threshold.score;
      }
    }
    return 90; // Default to high if above all thresholds
  }

  /**
   * Calculate MA50 score (0-100)
   * Based on price vs MA50 percentage deviation
   * Below MA50 (negative deviation) = Higher score (discount)
   */
  calculateMA50Score(priceVsMA50Percent: number): number {
    for (const threshold of MA50_SCORE_THRESHOLDS) {
      if (priceVsMA50Percent <= threshold.maxDeviation) {
        return threshold.score;
      }
    }
    return 10; // Default to low if price way above MA50
  }

  /**
   * Calculate Fear & Greed score (0-100)
   * CNN F&G: 0 = Extreme Fear, 100 = Extreme Greed
   * We invert: More fear = Higher score
   */
  calculateFearGreedScore(fearGreedIndex: number): number {
    for (const threshold of FEAR_GREED_SCORE_THRESHOLDS) {
      if (fearGreedIndex <= threshold.maxFG) {
        return threshold.score;
      }
    }
    return 0; // Default if extreme greed
  }

  /**
   * Calculate price vs MA50 deviation percentage
   */
  calculateMA50Deviation(currentPrice: number, ma50: number): number {
    if (ma50 === 0) return 0;
    return ((currentPrice - ma50) / ma50) * 100;
  }

  /**
   * Map CSS score to multiplier (0.5 - 1.2)
   */
  cssToMultiplier(css: number): number {
    for (const mapping of CSS_TO_MULTIPLIER) {
      if (css <= mapping.maxCSS) {
        return mapping.multiplier;
      }
    }
    return BUDGET_CONSTRAINTS.MAX_MULTIPLIER; // Default to max
  }

  /**
   * Calculate complete CSS breakdown for an asset
   * 
   * Hybrid approach:
   * - Market-wide: VIX (20%), Fear & Greed (20%)
   * - Per-asset: RSI (25%), BB Width (15%), MA50 (20%)
   */
  calculateCSSBreakdown(
    vix: number,
    fearGreedIndex: number | null,
    technicalIndicators: TechnicalIndicators,
    currentPrice: number
  ): CSSBreakdown {
    const fearGreedFailed = fearGreedIndex === null;
    
    // Calculate individual scores
    const vixScore = this.calculateVIXScore(vix);
    const rsiScore = this.calculateRSIScore(technicalIndicators.rsi);
    const bbWidthScore = this.calculateBBWidthScore(technicalIndicators.bbWidth);
    const ma50Deviation = this.calculateMA50Deviation(currentPrice, technicalIndicators.ma50);
    const ma50Score = this.calculateMA50Score(ma50Deviation);
    const fearGreedScore = fearGreedFailed ? null : this.calculateFearGreedScore(fearGreedIndex);

    // Calculate weighted CSS
    let totalCSS: number;
    let vixWeightAdjusted = false;

    if (fearGreedFailed) {
      // Fallback: redistribute F&G weight (20%) to VIX (becomes 40%)
      vixWeightAdjusted = true;
      const adjustedVixWeight = CSS_WEIGHTS.VIX + CSS_WEIGHTS.FEAR_GREED;
      
      totalCSS = 
        (vixScore * adjustedVixWeight) +
        (rsiScore * CSS_WEIGHTS.RSI) +
        (bbWidthScore * CSS_WEIGHTS.BB_WIDTH) +
        (ma50Score * CSS_WEIGHTS.MA50);
    } else {
      totalCSS = 
        (vixScore * CSS_WEIGHTS.VIX) +
        (rsiScore * CSS_WEIGHTS.RSI) +
        (bbWidthScore * CSS_WEIGHTS.BB_WIDTH) +
        (ma50Score * CSS_WEIGHTS.MA50) +
        (fearGreedScore! * CSS_WEIGHTS.FEAR_GREED);
    }

    // Clamp CSS to 0-100
    totalCSS = Math.max(0, Math.min(100, totalCSS));

    const multiplier = this.cssToMultiplier(totalCSS);

    return {
      // Scores
      vixScore,
      rsiScore,
      bbWidthScore,
      ma50Score,
      fearGreedScore,
      
      // Raw values
      vixValue: vix,
      rsiValue: technicalIndicators.rsi,
      bbWidthValue: technicalIndicators.bbWidth,
      ma50DeviationPercent: Math.round(ma50Deviation * 100) / 100,
      fearGreedValue: fearGreedIndex,
      
      // Calculated
      totalCSS: Math.round(totalCSS * 100) / 100,
      multiplier,
      
      // Status
      fearGreedFailed,
      vixWeightAdjusted
    };
  }

  /**
   * Calculate market-wide CSS component (VIX + Fear & Greed)
   * Used for overall market assessment
   */
  calculateMarketCSS(vix: number, fearGreedIndex: number | null): number {
    const vixScore = this.calculateVIXScore(vix);
    
    if (fearGreedIndex === null) {
      // F&G failed - VIX gets full 40% weight
      return vixScore * (CSS_WEIGHTS.VIX + CSS_WEIGHTS.FEAR_GREED) / (CSS_WEIGHTS.VIX + CSS_WEIGHTS.FEAR_GREED);
    }
    
    const fearGreedScore = this.calculateFearGreedScore(fearGreedIndex);
    const marketWeight = CSS_WEIGHTS.VIX + CSS_WEIGHTS.FEAR_GREED;
    
    return ((vixScore * CSS_WEIGHTS.VIX) + (fearGreedScore * CSS_WEIGHTS.FEAR_GREED)) / marketWeight * 100;
  }

  /**
   * Get CSS interpretation text
   */
  getCSSInterpretation(css: number): string {
    if (css <= 20) return 'Extreme Greed - Minimum investment';
    if (css <= 35) return 'Greed - Reduced investment';
    if (css <= 50) return 'Slightly Greedy - Below average';
    if (css <= 60) return 'Neutral - Standard investment';
    if (css <= 75) return 'Fear - Increased investment';
    return 'Extreme Fear - Maximum investment';
  }

  /**
   * Get signal based on CSS
   * Never returns SELL - we always invest at least the minimum
   */
  getSignalFromCSS(css: number): 'BUY' | 'HOLD' {
    if (css >= 50) return 'BUY';
    return 'HOLD';
  }

  /**
   * Calculate investment amount based on CSS multiplier
   * Clamps to min/max budget constraints
   */
  calculateInvestmentAmount(baseAmount: number, multiplier: number): number {
    const rawAmount = baseAmount * multiplier;
    return Math.round(Math.max(
      BUDGET_CONSTRAINTS.MIN_BUDGET * (baseAmount / BUDGET_CONSTRAINTS.BASE_BUDGET),
      Math.min(
        BUDGET_CONSTRAINTS.MAX_BUDGET * (baseAmount / BUDGET_CONSTRAINTS.BASE_BUDGET),
        rawAmount
      )
    ));
  }
}
