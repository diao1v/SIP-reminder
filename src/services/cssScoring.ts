import {
  CSS_WEIGHTS,
  CSS_WEIGHTS_FG_FALLBACK,
  CSS_TO_MULTIPLIER,
  VIX_SCORE_THRESHOLDS,
  RSI_SCORE_THRESHOLDS,
  BB_WIDTH_SCORE_THRESHOLDS,
  MA50_SCORE_THRESHOLDS,
  FEAR_GREED_SCORE_THRESHOLDS,
  MA50_SLOPE_CONFIG,
  BUDGET_CONSTRAINTS
} from '../utils/multiplierThresholds';
import { CSSBreakdown, TechnicalIndicators } from '../types';

/**
 * CSS (Composite Signal Score) Scoring Service
 *
 * Implements the CSS formula from Strategy v4.3:
 * CSS = (VIX × 0.20) + (RSI × 0.30) + (BB × 0.15) + (MA50 × 0.20) + (F&G × 0.15)
 *
 * v4.3 Changes:
 * - RSI weight increased from 0.25 to 0.30 (more actionable, asset-specific)
 * - F&G weight reduced from 0.20 to 0.15 (reduces redundancy with VIX)
 * - MA50 slope filter added to prevent "catching falling knives"
 * - F&G fallback redistributes to both VIX and RSI (not just VIX)
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
   * Calculate MA50 base score (0-100)
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
   * Calculate MA50 slope bonus (v4.3)
   * Returns bonus points (-15 to +15) based on trend direction
   *
   * @param ma50Slope - MA50 slope as decimal (e.g., 0.015 = 1.5%)
   * @returns Bonus points to add to MA50 score
   */
  calculateMA50SlopeBonus(ma50Slope: number): number {
    if (ma50Slope > MA50_SLOPE_CONFIG.STRONG_UPTREND) {
      return MA50_SLOPE_CONFIG.BONUS_STRONG_UP;      // +15
    } else if (ma50Slope > MA50_SLOPE_CONFIG.MODERATE_UPTREND) {
      return MA50_SLOPE_CONFIG.BONUS_MODERATE_UP;    // +8
    } else if (ma50Slope > MA50_SLOPE_CONFIG.FLAT_THRESHOLD) {
      return MA50_SLOPE_CONFIG.BONUS_FLAT;           // 0
    } else if (ma50Slope > MA50_SLOPE_CONFIG.MODERATE_DOWNTREND) {
      return MA50_SLOPE_CONFIG.BONUS_MODERATE_DOWN;  // -8
    } else {
      return MA50_SLOPE_CONFIG.BONUS_STRONG_DOWN;    // -15
    }
  }

  /**
   * Calculate MA50 score with slope adjustment (v4.3)
   * Only applies slope bonus when price is significantly below MA50
   *
   * @param priceVsMA50Percent - Price deviation from MA50 as percentage
   * @param ma50Slope - MA50 trend slope as decimal
   * @returns Object with base score, adjusted score, and bonus applied
   */
  calculateMA50ScoreWithSlope(
    priceVsMA50Percent: number,
    ma50Slope: number
  ): { baseScore: number; adjustedScore: number; slopeBonus: number } {
    const baseScore = this.calculateMA50Score(priceVsMA50Percent);
    let adjustedScore = baseScore;
    let slopeBonus = 0;

    // Only apply slope bonus when price is in deep discount zone
    if (priceVsMA50Percent < MA50_SLOPE_CONFIG.APPLY_WHEN_DISCOUNT_BELOW) {
      slopeBonus = this.calculateMA50SlopeBonus(ma50Slope);
      adjustedScore = baseScore + slopeBonus;

      // Clamp to valid range
      adjustedScore = Math.max(
        MA50_SLOPE_CONFIG.MIN_SCORE,
        Math.min(MA50_SLOPE_CONFIG.MAX_SCORE, adjustedScore)
      );
    }

    return { baseScore, adjustedScore, slopeBonus };
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
   * Calculate complete CSS breakdown for an asset (v4.3)
   *
   * Hybrid approach:
   * - Market-wide: VIX (20%), Fear & Greed (15%)
   * - Per-asset: RSI (30%), BB Width (15%), MA50 (20%)
   *
   * v4.3 Changes:
   * - MA50 slope filter to prevent "catching falling knives"
   * - F&G fallback redistributes to VIX (+7.5%) and RSI (+7.5%)
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

    // v4.3: Calculate MA50 score with slope adjustment
    const ma50SlopeResult = this.calculateMA50ScoreWithSlope(
      ma50Deviation,
      technicalIndicators.ma50Slope
    );

    const fearGreedScore = fearGreedFailed ? null : this.calculateFearGreedScore(fearGreedIndex);

    // Select weights based on F&G availability
    let weights: typeof CSS_WEIGHTS | typeof CSS_WEIGHTS_FG_FALLBACK;
    let weightsAdjusted = false;

    if (fearGreedFailed) {
      // v4.3 Fallback: redistribute F&G's 15% to VIX (+7.5%) and RSI (+7.5%)
      weights = CSS_WEIGHTS_FG_FALLBACK;
      weightsAdjusted = true;
      console.log('⚠️ F&G unavailable - using fallback weights (VIX: 27.5%, RSI: 37.5%)');
    } else {
      weights = CSS_WEIGHTS;
    }

    // Calculate weighted CSS using adjusted MA50 score
    let totalCSS =
      (vixScore * weights.VIX) +
      (rsiScore * weights.RSI) +
      (bbWidthScore * weights.BB_WIDTH) +
      (ma50SlopeResult.adjustedScore * weights.MA50) +
      ((fearGreedScore ?? 0) * weights.FEAR_GREED);

    // Clamp CSS to 0-100
    totalCSS = Math.max(0, Math.min(100, totalCSS));

    const multiplier = this.cssToMultiplier(totalCSS);

    return {
      // Scores
      vixScore,
      rsiScore,
      bbWidthScore,
      ma50Score: ma50SlopeResult.baseScore,
      ma50ScoreAdjusted: ma50SlopeResult.adjustedScore,
      fearGreedScore,

      // Raw values
      vixValue: vix,
      rsiValue: technicalIndicators.rsi,
      bbWidthValue: technicalIndicators.bbWidth,
      ma50DeviationPercent: Math.round(ma50Deviation * 100) / 100,
      ma50Slope: technicalIndicators.ma50Slope,
      ma50SlopeBonus: ma50SlopeResult.slopeBonus,
      fearGreedValue: fearGreedIndex,

      // Calculated
      totalCSS: Math.round(totalCSS * 100) / 100,
      multiplier,

      // Status
      fearGreedFailed,
      weightsAdjusted
    };
  }

  /**
   * Calculate market-wide CSS component (VIX + Fear & Greed) (v4.3)
   * Used for overall market assessment
   */
  calculateMarketCSS(vix: number, fearGreedIndex: number | null): number {
    const vixScore = this.calculateVIXScore(vix);

    if (fearGreedIndex === null) {
      // F&G failed - VIX represents full market sentiment
      return vixScore;
    }

    const fearGreedScore = this.calculateFearGreedScore(fearGreedIndex);
    const marketWeight = CSS_WEIGHTS.VIX + CSS_WEIGHTS.FEAR_GREED; // 0.20 + 0.15 = 0.35

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
