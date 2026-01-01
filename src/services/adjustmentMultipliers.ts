import {
  VIX_THRESHOLDS,
  RSI_THRESHOLDS,
  BB_WIDTH_THRESHOLDS,
  DEFENSIVE_ROTATION
} from '../utils/multiplierThresholds';
import { TechnicalIndicators } from '../types';

/**
 * AdjustmentMultiplierService
 * 
 * Implements the Five-Dimensional Dynamic Adjustment System:
 * Final Investment Amount = Base Amount × BB_Multiplier × VIX_Multiplier × RSI_Multiplier
 */
export class AdjustmentMultiplierService {
  /**
   * Calculate VIX-based multiplier
   * Higher VIX (fear) = Higher multiplier (buy more)
   * 
   * Strategy: "Buy when others are fearful"
   */
  calculateVIXMultiplier(vix: number): number {
    if (vix < VIX_THRESHOLDS.EXTREME_LOW.max) {
      return VIX_THRESHOLDS.EXTREME_LOW.multiplier;
    }
    if (vix < VIX_THRESHOLDS.NORMAL.max) {
      return VIX_THRESHOLDS.NORMAL.multiplier;
    }
    if (vix < VIX_THRESHOLDS.MODERATE_FEAR.max) {
      return VIX_THRESHOLDS.MODERATE_FEAR.multiplier;
    }
    if (vix < VIX_THRESHOLDS.SIGNIFICANT_FEAR.max) {
      return VIX_THRESHOLDS.SIGNIFICANT_FEAR.multiplier;
    }
    if (vix < VIX_THRESHOLDS.SEVERE_FEAR.max) {
      return VIX_THRESHOLDS.SEVERE_FEAR.multiplier;
    }
    return VIX_THRESHOLDS.EXTREME_CRISIS.multiplier;
  }

  /**
   * Calculate RSI-based multiplier
   * RSI < 30 (oversold) = 1.5x (premium buying opportunity)
   * RSI 30-70 (normal) = 1.0x (standard allocation)
   * RSI > 70 (overbought) = 0.0x (pause investment)
   */
  calculateRSIMultiplier(rsi: number): number {
    if (rsi < RSI_THRESHOLDS.OVERSOLD.max) {
      return RSI_THRESHOLDS.OVERSOLD.multiplier;
    }
    if (rsi < RSI_THRESHOLDS.OVERBOUGHT.min) {
      return RSI_THRESHOLDS.NORMAL.multiplier;
    }
    return RSI_THRESHOLDS.OVERBOUGHT.multiplier;
  }

  /**
   * Calculate Bollinger Bands Width multiplier
   * BB Width = (Upper - Lower) / Middle × 100%
   * 
   * Width < 5% (low) = 1.0x (stable market)
   * Width 5-10% (moderate) = 1.15x (moderate opportunities)
   * Width > 10% (high) = 1.35x (high volatility, more opportunities)
   */
  calculateBBWidthMultiplier(bollingerBands: TechnicalIndicators['bollingerBands']): number {
    const bbWidth = this.calculateBBWidth(bollingerBands);

    if (bbWidth < BB_WIDTH_THRESHOLDS.LOW.max) {
      return BB_WIDTH_THRESHOLDS.LOW.multiplier;
    }
    if (bbWidth < BB_WIDTH_THRESHOLDS.MODERATE.max) {
      return BB_WIDTH_THRESHOLDS.MODERATE.multiplier;
    }
    return BB_WIDTH_THRESHOLDS.HIGH.multiplier;
  }

  /**
   * Calculate Bollinger Bands Width percentage
   * BB Width = (Upper - Lower) / Middle × 100%
   */
  calculateBBWidth(bollingerBands: TechnicalIndicators['bollingerBands']): number {
    const { upper, middle, lower } = bollingerBands;
    if (middle === 0) return 0;
    return ((upper - lower) / middle) * 100;
  }

  /**
   * Calculate combined multiplier for an asset
   * Combined = BB_Multiplier × VIX_Multiplier × RSI_Multiplier
   */
  calculateCombinedMultiplier(
    vix: number,
    rsi: number,
    bollingerBands: TechnicalIndicators['bollingerBands']
  ): number {
    const vixMultiplier = this.calculateVIXMultiplier(vix);
    const rsiMultiplier = this.calculateRSIMultiplier(rsi);
    const bbWidthMultiplier = this.calculateBBWidthMultiplier(bollingerBands);

    return vixMultiplier * rsiMultiplier * bbWidthMultiplier;
  }

  /**
   * Check if defensive rotation should be triggered
   * Triggers when VIX > 30 OR average RSI > 75
   */
  shouldTriggerDefensiveRotation(vix: number, avgRsi: number): boolean {
    return vix > DEFENSIVE_ROTATION.VIX_THRESHOLD || 
           avgRsi > DEFENSIVE_ROTATION.AVG_RSI_THRESHOLD;
  }

  /**
   * Get defensive increase multiplier
   * 50% increase for defensive assets during rotation
   */
  getDefensiveIncreaseMultiplier(): number {
    return DEFENSIVE_ROTATION.DEFENSIVE_INCREASE;
  }

  /**
   * Get RSI recommendation label
   */
  getRSIRecommendation(rsi: number): string {
    if (rsi < 30) {
      return `Oversold (RSI=${rsi.toFixed(0)}) - PRIORITY BUY ✅`;
    }
    if (rsi > 70) {
      return `Overbought (RSI=${rsi.toFixed(0)}) - PAUSE 🔴`;
    }
    return `Normal (RSI=${rsi.toFixed(0)}) - Standard DCA 🟡`;
  }

  /**
   * Get multiplier breakdown for reporting
   */
  getMultiplierBreakdown(
    vix: number,
    rsi: number,
    bollingerBands: TechnicalIndicators['bollingerBands']
  ): {
    vixMultiplier: number;
    rsiMultiplier: number;
    bbWidthMultiplier: number;
    bbWidth: number;
    combined: number;
    rsiRecommendation: string;
  } {
    return {
      vixMultiplier: this.calculateVIXMultiplier(vix),
      rsiMultiplier: this.calculateRSIMultiplier(rsi),
      bbWidthMultiplier: this.calculateBBWidthMultiplier(bollingerBands),
      bbWidth: this.calculateBBWidth(bollingerBands),
      combined: this.calculateCombinedMultiplier(vix, rsi, bollingerBands),
      rsiRecommendation: this.getRSIRecommendation(rsi)
    };
  }
}
