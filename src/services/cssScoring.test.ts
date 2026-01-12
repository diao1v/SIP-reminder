import { describe, it, expect, beforeEach } from 'vitest';
import { CSSService } from './cssScoring';
import { BUDGET_CONSTRAINTS } from '../utils/multiplierThresholds';

describe('CSSService', () => {
  let service: CSSService;

  beforeEach(() => {
    service = new CSSService();
  });

  // ===========================================================================
  // VIX Score Tests
  // ===========================================================================
  describe('calculateVIXScore', () => {
    it('should return 20 for complacent VIX (VIX <= 15)', () => {
      expect(service.calculateVIXScore(10)).toBe(20);
      expect(service.calculateVIXScore(15)).toBe(20);
    });

    it('should return 40 for normal VIX (15 < VIX <= 20)', () => {
      expect(service.calculateVIXScore(16)).toBe(40);
      expect(service.calculateVIXScore(20)).toBe(40);
    });

    it('should return 60 for elevated anxiety (20 < VIX <= 25)', () => {
      expect(service.calculateVIXScore(21)).toBe(60);
      expect(service.calculateVIXScore(25)).toBe(60);
    });

    it('should return 75 for fearful market (25 < VIX <= 30)', () => {
      expect(service.calculateVIXScore(26)).toBe(75);
      expect(service.calculateVIXScore(30)).toBe(75);
    });

    it('should return 90 for very fearful market (30 < VIX <= 40)', () => {
      expect(service.calculateVIXScore(31)).toBe(90);
      expect(service.calculateVIXScore(40)).toBe(90);
    });

    it('should return 100 for panic (VIX > 40)', () => {
      expect(service.calculateVIXScore(41)).toBe(100);
      expect(service.calculateVIXScore(80)).toBe(100);
    });
  });

  // ===========================================================================
  // RSI Score Tests
  // ===========================================================================
  describe('calculateRSIScore', () => {
    it('should return 100 for oversold (RSI <= 30)', () => {
      expect(service.calculateRSIScore(20)).toBe(100);
      expect(service.calculateRSIScore(30)).toBe(100);
    });

    it('should return 80 for getting oversold (30 < RSI <= 40)', () => {
      expect(service.calculateRSIScore(31)).toBe(80);
      expect(service.calculateRSIScore(40)).toBe(80);
    });

    it('should return 60 for slightly bearish (40 < RSI <= 50)', () => {
      expect(service.calculateRSIScore(41)).toBe(60);
      expect(service.calculateRSIScore(50)).toBe(60);
    });

    it('should return 40 for slightly bullish (50 < RSI <= 60)', () => {
      expect(service.calculateRSIScore(51)).toBe(40);
      expect(service.calculateRSIScore(60)).toBe(40);
    });

    it('should return 20 for getting overbought (60 < RSI <= 70)', () => {
      expect(service.calculateRSIScore(61)).toBe(20);
      expect(service.calculateRSIScore(70)).toBe(20);
    });

    it('should return 0 for overbought (RSI > 70)', () => {
      expect(service.calculateRSIScore(71)).toBe(0);
      expect(service.calculateRSIScore(90)).toBe(0);
    });
  });

  // ===========================================================================
  // Bollinger Bands Width Score Tests
  // ===========================================================================
  describe('calculateBBWidthScore', () => {
    it('should return 30 for low volatility (width <= 5)', () => {
      expect(service.calculateBBWidthScore(3)).toBe(30);
      expect(service.calculateBBWidthScore(5)).toBe(30);
    });

    it('should return 50 for moderate volatility (5 < width <= 10)', () => {
      expect(service.calculateBBWidthScore(6)).toBe(50);
      expect(service.calculateBBWidthScore(10)).toBe(50);
    });

    it('should return 70 for high volatility (10 < width <= 15)', () => {
      expect(service.calculateBBWidthScore(11)).toBe(70);
      expect(service.calculateBBWidthScore(15)).toBe(70);
    });

    it('should return 90 for very high volatility (width > 15)', () => {
      expect(service.calculateBBWidthScore(16)).toBe(90);
      expect(service.calculateBBWidthScore(30)).toBe(90);
    });
  });

  // ===========================================================================
  // MA50 Score Tests
  // ===========================================================================
  describe('calculateMA50Score', () => {
    it('should return 90 for big discount (deviation <= -10%)', () => {
      expect(service.calculateMA50Score(-15)).toBe(90);
      expect(service.calculateMA50Score(-10)).toBe(90);
    });

    it('should return 70 for discount (-10% < deviation <= -5%)', () => {
      expect(service.calculateMA50Score(-9)).toBe(70);
      expect(service.calculateMA50Score(-5)).toBe(70);
    });

    it('should return 50 for fair value (-5% < deviation <= 5%)', () => {
      expect(service.calculateMA50Score(-4)).toBe(50);
      expect(service.calculateMA50Score(0)).toBe(50);
      expect(service.calculateMA50Score(5)).toBe(50);
    });

    it('should return 30 for slightly expensive (5% < deviation <= 10%)', () => {
      expect(service.calculateMA50Score(6)).toBe(30);
      expect(service.calculateMA50Score(10)).toBe(30);
    });

    it('should return 10 for expensive (deviation > 10%)', () => {
      expect(service.calculateMA50Score(11)).toBe(10);
      expect(service.calculateMA50Score(20)).toBe(10);
    });
  });

  // ===========================================================================
  // MA50 Slope Bonus Tests (v4.3)
  // ===========================================================================
  describe('calculateMA50SlopeBonus', () => {
    it('should return +15 for strong uptrend (slope > 1%)', () => {
      expect(service.calculateMA50SlopeBonus(0.015)).toBe(15);
      expect(service.calculateMA50SlopeBonus(0.020)).toBe(15);
    });

    it('should return +8 for moderate uptrend (0.3% < slope <= 1%)', () => {
      expect(service.calculateMA50SlopeBonus(0.005)).toBe(8);
      expect(service.calculateMA50SlopeBonus(0.010)).toBe(8);
    });

    it('should return 0 for flat (-0.3% < slope <= 0.3%)', () => {
      expect(service.calculateMA50SlopeBonus(0)).toBe(0);
      expect(service.calculateMA50SlopeBonus(0.003)).toBe(0);
      expect(service.calculateMA50SlopeBonus(-0.002)).toBe(0);
    });

    it('should return -8 for moderate downtrend (-1% < slope <= -0.3%)', () => {
      expect(service.calculateMA50SlopeBonus(-0.005)).toBe(-8);
      // Note: -0.010 is exactly at the boundary, so it's treated as strong downtrend
      expect(service.calculateMA50SlopeBonus(-0.009)).toBe(-8);
    });

    it('should return -15 for strong downtrend (slope <= -1%)', () => {
      expect(service.calculateMA50SlopeBonus(-0.015)).toBe(-15);
      expect(service.calculateMA50SlopeBonus(-0.030)).toBe(-15);
    });
  });

  describe('calculateMA50ScoreWithSlope', () => {
    it('should NOT apply slope bonus when price is above -10% discount', () => {
      const result = service.calculateMA50ScoreWithSlope(-5, 0.015);
      expect(result.slopeBonus).toBe(0);
      expect(result.adjustedScore).toBe(result.baseScore);
    });

    it('should apply slope bonus when price is below -10% discount', () => {
      const result = service.calculateMA50ScoreWithSlope(-15, 0.015);
      expect(result.slopeBonus).toBe(15);
      // Note: Base score is 90, +15 would be 105, but clamped to max 90
      expect(result.adjustedScore).toBe(90); // Clamped to max
    });

    it('should apply negative slope bonus for downtrend in discount zone', () => {
      const result = service.calculateMA50ScoreWithSlope(-15, -0.015);
      expect(result.slopeBonus).toBe(-15);
      expect(result.adjustedScore).toBe(result.baseScore - 15);
    });

    it('should clamp adjusted score to valid range (20-90)', () => {
      // Base score 90, strong uptrend bonus +15 = 105, clamped to 90
      const resultHigh = service.calculateMA50ScoreWithSlope(-15, 0.020);
      expect(resultHigh.adjustedScore).toBeLessThanOrEqual(90);

      // Base score 90, strong downtrend penalty -15 = 75, within range
      const resultLow = service.calculateMA50ScoreWithSlope(-15, -0.020);
      expect(resultLow.adjustedScore).toBeGreaterThanOrEqual(20);
    });
  });

  // ===========================================================================
  // Fear & Greed Score Tests
  // ===========================================================================
  describe('calculateFearGreedScore', () => {
    it('should return 100 for extreme fear (F&G <= 25)', () => {
      expect(service.calculateFearGreedScore(10)).toBe(100);
      expect(service.calculateFearGreedScore(25)).toBe(100);
    });

    it('should return 75 for fear (25 < F&G <= 45)', () => {
      expect(service.calculateFearGreedScore(26)).toBe(75);
      expect(service.calculateFearGreedScore(45)).toBe(75);
    });

    it('should return 50 for neutral (45 < F&G <= 55)', () => {
      expect(service.calculateFearGreedScore(46)).toBe(50);
      expect(service.calculateFearGreedScore(55)).toBe(50);
    });

    it('should return 25 for greed (55 < F&G <= 75)', () => {
      expect(service.calculateFearGreedScore(56)).toBe(25);
      expect(service.calculateFearGreedScore(75)).toBe(25);
    });

    it('should return 0 for extreme greed (F&G > 75)', () => {
      expect(service.calculateFearGreedScore(76)).toBe(0);
      expect(service.calculateFearGreedScore(100)).toBe(0);
    });
  });

  // ===========================================================================
  // CSS to Multiplier Tests
  // ===========================================================================
  describe('cssToMultiplier', () => {
    it('should return 0.5 for extreme greed (CSS <= 20)', () => {
      expect(service.cssToMultiplier(10)).toBe(0.5);
      expect(service.cssToMultiplier(20)).toBe(0.5);
    });

    it('should return 0.6 for greed (20 < CSS <= 35)', () => {
      expect(service.cssToMultiplier(21)).toBe(0.6);
      expect(service.cssToMultiplier(35)).toBe(0.6);
    });

    it('should return 0.8 for slightly greedy (35 < CSS <= 50)', () => {
      expect(service.cssToMultiplier(36)).toBe(0.8);
      expect(service.cssToMultiplier(50)).toBe(0.8);
    });

    it('should return 1.0 for neutral (50 < CSS <= 60)', () => {
      expect(service.cssToMultiplier(51)).toBe(1.0);
      expect(service.cssToMultiplier(60)).toBe(1.0);
    });

    it('should return 1.2 for fear (60 < CSS <= 75)', () => {
      expect(service.cssToMultiplier(61)).toBe(1.2);
      expect(service.cssToMultiplier(75)).toBe(1.2);
    });

    it('should return 1.2 for extreme fear (CSS > 75, capped)', () => {
      expect(service.cssToMultiplier(76)).toBe(1.2);
      expect(service.cssToMultiplier(100)).toBe(1.2);
    });

    it('should never exceed MAX_MULTIPLIER', () => {
      expect(service.cssToMultiplier(100)).toBeLessThanOrEqual(BUDGET_CONSTRAINTS.MAX_MULTIPLIER);
    });
  });

  // ===========================================================================
  // MA50 Deviation Calculation
  // ===========================================================================
  describe('calculateMA50Deviation', () => {
    it('should calculate positive deviation when price above MA50', () => {
      expect(service.calculateMA50Deviation(110, 100)).toBe(10);
    });

    it('should calculate negative deviation when price below MA50', () => {
      expect(service.calculateMA50Deviation(90, 100)).toBe(-10);
    });

    it('should return 0 when price equals MA50', () => {
      expect(service.calculateMA50Deviation(100, 100)).toBe(0);
    });

    it('should return 0 when MA50 is 0 (edge case)', () => {
      expect(service.calculateMA50Deviation(100, 0)).toBe(0);
    });
  });

  // ===========================================================================
  // CSS Interpretation Tests
  // ===========================================================================
  describe('getCSSInterpretation', () => {
    it('should return correct interpretation for each CSS range', () => {
      expect(service.getCSSInterpretation(15)).toBe('Extreme Greed - Minimum investment');
      expect(service.getCSSInterpretation(30)).toBe('Greed - Reduced investment');
      expect(service.getCSSInterpretation(45)).toBe('Slightly Greedy - Below average');
      expect(service.getCSSInterpretation(55)).toBe('Neutral - Standard investment');
      expect(service.getCSSInterpretation(70)).toBe('Fear - Increased investment');
      expect(service.getCSSInterpretation(85)).toBe('Extreme Fear - Maximum investment');
    });
  });

  // ===========================================================================
  // Signal from CSS Tests
  // ===========================================================================
  describe('getSignalFromCSS', () => {
    it('should return BUY when CSS >= 50', () => {
      expect(service.getSignalFromCSS(50)).toBe('BUY');
      expect(service.getSignalFromCSS(75)).toBe('BUY');
    });

    it('should return HOLD when CSS < 50', () => {
      expect(service.getSignalFromCSS(49)).toBe('HOLD');
      expect(service.getSignalFromCSS(20)).toBe('HOLD');
    });

    it('should never return SELL (strategy always invests)', () => {
      // Test edge cases - should always be BUY or HOLD
      const result = service.getSignalFromCSS(0);
      expect(['BUY', 'HOLD']).toContain(result);
    });
  });

  // ===========================================================================
  // Investment Amount Calculation
  // ===========================================================================
  describe('calculateInvestmentAmount', () => {
    it('should apply multiplier to base amount', () => {
      const result = service.calculateInvestmentAmount(100, 1.0);
      expect(result).toBe(100);
    });

    it('should increase amount for multiplier > 1', () => {
      const result = service.calculateInvestmentAmount(100, 1.2);
      expect(result).toBe(120);
    });

    it('should decrease amount for multiplier < 1', () => {
      const result = service.calculateInvestmentAmount(100, 0.5);
      expect(result).toBe(50);
    });

    it('should respect minimum budget constraint', () => {
      // With base 250, multiplier 0.3 would be 75, but min is 125
      const result = service.calculateInvestmentAmount(250, 0.3);
      expect(result).toBeGreaterThanOrEqual(BUDGET_CONSTRAINTS.MIN_BUDGET);
    });

    it('should respect maximum budget constraint', () => {
      // With base 250, multiplier 2.0 would be 500, but max is 300
      const result = service.calculateInvestmentAmount(250, 2.0);
      expect(result).toBeLessThanOrEqual(BUDGET_CONSTRAINTS.MAX_BUDGET);
    });
  });

  // ===========================================================================
  // Full CSS Breakdown Tests
  // ===========================================================================
  describe('calculateCSSBreakdown', () => {
    const mockTechnicalIndicators = {
      rsi: 45,
      ma20: 100,
      ma50: 100,
      atr: 5,
      bbWidth: 8,
      ma50Slope: 0.005, // Moderate uptrend
    };

    it('should calculate complete CSS breakdown with all indicators', () => {
      const result = service.calculateCSSBreakdown(
        20, // VIX - normal
        50, // F&G - neutral
        mockTechnicalIndicators,
        100 // Current price
      );

      expect(result).toHaveProperty('vixScore');
      expect(result).toHaveProperty('rsiScore');
      expect(result).toHaveProperty('bbWidthScore');
      expect(result).toHaveProperty('ma50Score');
      expect(result).toHaveProperty('fearGreedScore');
      expect(result).toHaveProperty('totalCSS');
      expect(result).toHaveProperty('multiplier');
      expect(result.fearGreedFailed).toBe(false);
      expect(result.weightsAdjusted).toBe(false);
    });

    it('should handle F&G failure with fallback weights', () => {
      const result = service.calculateCSSBreakdown(
        20,
        null, // F&G failed
        mockTechnicalIndicators,
        100
      );

      expect(result.fearGreedFailed).toBe(true);
      expect(result.weightsAdjusted).toBe(true);
      expect(result.fearGreedScore).toBeNull();
    });

    it('should clamp CSS to 0-100 range', () => {
      // Extreme fear scenario
      const fearResult = service.calculateCSSBreakdown(
        50, // Very high VIX
        10, // Extreme fear
        { ...mockTechnicalIndicators, rsi: 20 }, // Oversold
        80 // Price below MA50
      );

      expect(fearResult.totalCSS).toBeGreaterThanOrEqual(0);
      expect(fearResult.totalCSS).toBeLessThanOrEqual(100);
    });

    it('should return appropriate multiplier based on CSS', () => {
      const result = service.calculateCSSBreakdown(
        20,
        50,
        mockTechnicalIndicators,
        100
      );

      expect(result.multiplier).toBeGreaterThanOrEqual(BUDGET_CONSTRAINTS.MIN_MULTIPLIER);
      expect(result.multiplier).toBeLessThanOrEqual(BUDGET_CONSTRAINTS.MAX_MULTIPLIER);
    });
  });

  // ===========================================================================
  // Market CSS Tests
  // ===========================================================================
  describe('calculateMarketCSS', () => {
    it('should calculate market CSS from VIX and F&G', () => {
      const result = service.calculateMarketCSS(20, 50);
      // Note: marketCSS is scaled (normalized then * 100), used for display
      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });

    it('should return higher value for more fearful conditions', () => {
      const fearfulResult = service.calculateMarketCSS(35, 20); // High VIX, Extreme Fear
      const greedyResult = service.calculateMarketCSS(12, 80); // Low VIX, Extreme Greed
      expect(fearfulResult).toBeGreaterThan(greedyResult);
    });

    it('should return VIX score only when F&G is null', () => {
      const vixScore = service.calculateVIXScore(20);
      const marketCSS = service.calculateMarketCSS(20, null);
      expect(marketCSS).toBe(vixScore);
    });
  });

  // ===========================================================================
  // Edge Cases and Boundary Tests
  // ===========================================================================
  describe('Edge Cases', () => {
    it('should handle zero values gracefully', () => {
      expect(service.calculateVIXScore(0)).toBe(20);
      expect(service.calculateRSIScore(0)).toBe(100);
      expect(service.calculateBBWidthScore(0)).toBe(30);
      expect(service.calculateFearGreedScore(0)).toBe(100);
    });

    it('should handle extremely high values', () => {
      expect(service.calculateVIXScore(100)).toBe(100);
      expect(service.calculateRSIScore(100)).toBe(0);
      expect(service.calculateBBWidthScore(100)).toBe(90);
      expect(service.calculateFearGreedScore(100)).toBe(0);
    });

    it('should handle negative RSI (invalid but should not crash)', () => {
      const result = service.calculateRSIScore(-10);
      expect(result).toBe(100); // Treated as extremely oversold
    });
  });
});
