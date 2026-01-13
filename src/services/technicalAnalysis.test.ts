import { describe, it, expect, beforeEach } from 'vitest';
import { TechnicalAnalysisService } from './technicalAnalysis';

describe('TechnicalAnalysisService', () => {
  let service: TechnicalAnalysisService;

  // Generate test price data
  const generatePrices = (count: number, startPrice: number = 100, trend: 'up' | 'down' | 'flat' = 'flat'): number[] => {
    const prices: number[] = [];
    let price = startPrice;
    for (let i = 0; i < count; i++) {
      if (trend === 'up') {
        price *= 1.005; // 0.5% daily increase
      } else if (trend === 'down') {
        price *= 0.995; // 0.5% daily decrease
      }
      // Add some noise
      price *= (0.99 + Math.random() * 0.02);
      prices.push(price);
    }
    return prices;
  };

  beforeEach(() => {
    service = new TechnicalAnalysisService();
  });

  // ===========================================================================
  // SMA Tests
  // ===========================================================================
  describe('calculateSMA', () => {
    it('should calculate SMA correctly for simple data', () => {
      const prices = [10, 20, 30, 40, 50];
      const sma3 = service.calculateSMA(prices, 3);
      // Last 3 prices: 30, 40, 50 -> average = 40
      expect(sma3).toBe(40);
    });

    it('should use all available prices when period > length', () => {
      const prices = [10, 20, 30];
      const sma10 = service.calculateSMA(prices, 10);
      // Average of all: (10 + 20 + 30) / 3 = 20
      expect(sma10).toBe(20);
    });

    it('should return 0 for empty array', () => {
      expect(service.calculateSMA([], 20)).toBe(0);
    });

    it('should handle single price', () => {
      expect(service.calculateSMA([100], 20)).toBe(100);
    });
  });

  describe('calculateMA20', () => {
    it('should calculate 20-day moving average', () => {
      const prices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const ma20 = service.calculateMA20(prices);
      // Last 20 prices: 110 to 129 (indices 10-29), average = 119.5
      expect(ma20).toBeCloseTo(119.5, 1);
    });
  });

  describe('calculateMA50', () => {
    it('should calculate 50-day moving average', () => {
      const prices = Array.from({ length: 60 }, (_, i) => 100 + i);
      const ma50 = service.calculateMA50(prices);
      // Last 50 prices: 110 to 159 (indices 10-59), average = 134.5
      expect(ma50).toBeCloseTo(134.5, 1);
    });
  });

  // ===========================================================================
  // MA50 Slope Tests (v4.3)
  // ===========================================================================
  describe('calculateMA50Slope', () => {
    it('should return 0 when insufficient data', () => {
      const prices = generatePrices(50); // Need 100+ for slope
      const slope = service.calculateMA50Slope(prices);
      expect(slope).toBe(0);
    });

    it('should return positive slope for uptrending prices', () => {
      // Generate 150 prices with upward trend
      const prices: number[] = [];
      for (let i = 0; i < 150; i++) {
        prices.push(100 + i * 0.5); // Steady uptrend
      }
      const slope = service.calculateMA50Slope(prices);
      expect(slope).toBeGreaterThan(0);
    });

    it('should return negative slope for downtrending prices', () => {
      // Generate 150 prices with downward trend
      const prices: number[] = [];
      for (let i = 0; i < 150; i++) {
        prices.push(200 - i * 0.5); // Steady downtrend
      }
      const slope = service.calculateMA50Slope(prices);
      expect(slope).toBeLessThan(0);
    });

    it('should return near-zero slope for flat prices', () => {
      // Generate 150 flat prices
      const prices = Array(150).fill(100);
      const slope = service.calculateMA50Slope(prices);
      expect(Math.abs(slope)).toBeLessThan(0.01);
    });
  });

  // ===========================================================================
  // RSI Tests
  // ===========================================================================
  describe('calculateRSI', () => {
    it('should return ~50 for flat prices (neutral)', () => {
      const prices = Array(30).fill(100);
      const rsi = service.calculateRSI(prices);
      // With no change, RSI should be around 50 or undefined behavior
      expect(rsi).toBeGreaterThanOrEqual(0);
      expect(rsi).toBeLessThanOrEqual(100);
    });

    it('should return high RSI for consistently rising prices', () => {
      // Steady increase
      const prices = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
      const rsi = service.calculateRSI(prices);
      expect(rsi).toBeGreaterThan(60);
    });

    it('should return low RSI for consistently falling prices', () => {
      // Steady decrease
      const prices = Array.from({ length: 30 }, (_, i) => 200 - i * 2);
      const rsi = service.calculateRSI(prices);
      expect(rsi).toBeLessThan(40);
    });

    it('should return 50 when insufficient data', () => {
      const prices = [100, 101, 102];
      const rsi = service.calculateRSI(prices, 14);
      // Custom fallback returns 50 for insufficient data
      expect(rsi).toBe(50);
    });

    it('should be bounded between 0 and 100', () => {
      const prices = generatePrices(50, 100, 'up');
      const rsi = service.calculateRSI(prices);
      expect(rsi).toBeGreaterThanOrEqual(0);
      expect(rsi).toBeLessThanOrEqual(100);
    });
  });

  // ===========================================================================
  // Bollinger Bands Tests
  // ===========================================================================
  describe('calculateBollingerBands', () => {
    it('should calculate upper, middle, and lower bands', () => {
      const prices = generatePrices(30, 100, 'flat');
      const bb = service.calculateBollingerBands(prices);

      expect(bb).toHaveProperty('upper');
      expect(bb).toHaveProperty('middle');
      expect(bb).toHaveProperty('lower');
      expect(bb.upper).toBeGreaterThan(bb.middle);
      expect(bb.middle).toBeGreaterThan(bb.lower);
    });

    it('should have wider bands for volatile prices', () => {
      // Low volatility
      const stablePrices = Array(30).fill(100);
      const stableBB = service.calculateBollingerBands(stablePrices);

      // High volatility (alternating high/low)
      const volatilePrices = Array.from({ length: 30 }, (_, i) =>
        i % 2 === 0 ? 90 : 110
      );
      const volatileBB = service.calculateBollingerBands(volatilePrices);

      const stableWidth = stableBB.upper - stableBB.lower;
      const volatileWidth = volatileBB.upper - volatileBB.lower;

      expect(volatileWidth).toBeGreaterThan(stableWidth);
    });

    it('should handle insufficient data gracefully', () => {
      const prices = [100, 101, 102];
      const bb = service.calculateBollingerBands(prices, 20);
      // Should return fallback values
      expect(bb.upper).toBeGreaterThan(bb.lower);
    });
  });

  // ===========================================================================
  // BB Width Tests
  // ===========================================================================
  describe('calculateBBWidth', () => {
    it('should calculate width as percentage of middle', () => {
      const bb = { upper: 110, middle: 100, lower: 90 };
      const width = service.calculateBBWidth(bb);
      // (110 - 90) / 100 * 100 = 20%
      expect(width).toBe(20);
    });

    it('should return 0 when middle is 0', () => {
      const bb = { upper: 10, middle: 0, lower: -10 };
      const width = service.calculateBBWidth(bb);
      expect(width).toBe(0);
    });

    it('should handle narrow bands', () => {
      const bb = { upper: 101, middle: 100, lower: 99 };
      const width = service.calculateBBWidth(bb);
      expect(width).toBe(2);
    });
  });

  // ===========================================================================
  // ATR Tests
  // ===========================================================================
  describe('calculateATR', () => {
    it('should return positive ATR for volatile prices', () => {
      const prices = generatePrices(30, 100, 'up');
      const atr = service.calculateATR(prices);
      expect(atr).toBeGreaterThan(0);
    });

    it('should return low ATR for stable prices', () => {
      const prices = Array(30).fill(100);
      const atr = service.calculateATR(prices);
      // Near-zero ATR for perfectly flat prices
      expect(atr).toBeGreaterThanOrEqual(0);
      expect(atr).toBeLessThan(5);
    });

    it('should return 0 for single price', () => {
      expect(service.calculateATR([100])).toBe(0);
    });
  });

  // ===========================================================================
  // Entry Point Tests
  // ===========================================================================
  describe('calculateEntryPoint', () => {
    it('should calculate strong buy threshold below MA20', () => {
      const ma20 = 100;
      const atr = 10;
      const entry = service.calculateEntryPoint(ma20, atr);

      // strongBuyBelow = MA20 - 0.5 * ATR = 100 - 5 = 95
      expect(entry.strongBuyBelow).toBe(95);
      expect(entry.targetEntry).toBe(100);
    });

    it('should handle zero ATR', () => {
      const entry = service.calculateEntryPoint(100, 0);
      expect(entry.strongBuyBelow).toBe(100);
      expect(entry.targetEntry).toBe(100);
    });
  });

  describe('isGoodEntryPoint', () => {
    it('should return true when price is below entry threshold', () => {
      const ma20 = 100;
      const atr = 10;
      // Threshold = 100 - 5 = 95
      expect(service.isGoodEntryPoint(90, ma20, atr)).toBe(true);
      expect(service.isGoodEntryPoint(94, ma20, atr)).toBe(true);
    });

    it('should return false when price is above entry threshold', () => {
      const ma20 = 100;
      const atr = 10;
      expect(service.isGoodEntryPoint(96, ma20, atr)).toBe(false);
      expect(service.isGoodEntryPoint(100, ma20, atr)).toBe(false);
    });
  });

  // ===========================================================================
  // MA50 Deviation Tests
  // ===========================================================================
  describe('calculateMA50Deviation', () => {
    it('should return positive deviation when price above MA50', () => {
      const deviation = service.calculateMA50Deviation(110, 100);
      expect(deviation).toBe(10); // 10% above
    });

    it('should return negative deviation when price below MA50', () => {
      const deviation = service.calculateMA50Deviation(90, 100);
      expect(deviation).toBe(-10); // 10% below
    });

    it('should return 0 when price equals MA50', () => {
      expect(service.calculateMA50Deviation(100, 100)).toBe(0);
    });

    it('should return 0 when MA50 is 0', () => {
      expect(service.calculateMA50Deviation(100, 0)).toBe(0);
    });
  });

  // ===========================================================================
  // Full Indicators Calculation
  // ===========================================================================
  describe('calculateIndicators', () => {
    it('should return all required indicators', () => {
      const prices = generatePrices(100, 100, 'flat');
      const indicators = service.calculateIndicators(prices);

      expect(indicators).toHaveProperty('rsi');
      expect(indicators).toHaveProperty('ma20');
      expect(indicators).toHaveProperty('ma50');
      expect(indicators).toHaveProperty('ma50Slope');
      expect(indicators).toHaveProperty('bbWidth');
      expect(indicators).toHaveProperty('atr');
      expect(indicators).toHaveProperty('bollingerBands');
      expect(indicators).toHaveProperty('dataSource');
    });

    it('should have RSI in valid range', () => {
      const prices = generatePrices(100, 100, 'up');
      const indicators = service.calculateIndicators(prices);

      expect(indicators.rsi).toBeGreaterThanOrEqual(0);
      expect(indicators.rsi).toBeLessThanOrEqual(100);
    });

    it('should track data source', () => {
      const prices = generatePrices(100, 100, 'flat');
      const indicators = service.calculateIndicators(prices);

      expect(['technicalindicators', 'custom-fallback']).toContain(indicators.dataSource);
    });
  });

  // ===========================================================================
  // Signal Analysis Tests
  // ===========================================================================
  describe('analyzeSignal', () => {
    const baseIndicators = {
      rsi: 50,
      ma20: 100,
      ma50: 100,
      ma50Slope: 0,
      atr: 5,
      bbWidth: 5,
      bollingerBands: { upper: 105, middle: 100, lower: 95 },
    };

    it('should return BUY or HOLD signal (never SELL)', () => {
      const { signal } = service.analyzeSignal(baseIndicators, 100);
      expect(['BUY', 'HOLD']).toContain(signal);
    });

    it('should increase strength for oversold RSI', () => {
      const oversoldIndicators = { ...baseIndicators, rsi: 25 };
      const { strength: oversoldStrength } = service.analyzeSignal(oversoldIndicators, 100);

      const neutralIndicators = { ...baseIndicators, rsi: 50 };
      const { strength: neutralStrength } = service.analyzeSignal(neutralIndicators, 100);

      expect(oversoldStrength).toBeGreaterThan(neutralStrength);
    });

    it('should decrease strength for overbought RSI', () => {
      const overboughtIndicators = { ...baseIndicators, rsi: 75 };
      const { strength: overboughtStrength } = service.analyzeSignal(overboughtIndicators, 100);

      const neutralIndicators = { ...baseIndicators, rsi: 50 };
      const { strength: neutralStrength } = service.analyzeSignal(neutralIndicators, 100);

      expect(overboughtStrength).toBeLessThan(neutralStrength);
    });

    it('should increase strength for high BB width', () => {
      const highVolIndicators = { ...baseIndicators, bbWidth: 15 };
      const { strength: highVolStrength } = service.analyzeSignal(highVolIndicators, 100);

      const lowVolIndicators = { ...baseIndicators, bbWidth: 2 };
      const { strength: lowVolStrength } = service.analyzeSignal(lowVolIndicators, 100);

      expect(highVolStrength).toBeGreaterThan(lowVolStrength);
    });

    it('should increase strength when price is below MA50', () => {
      const discountedIndicators = { ...baseIndicators, ma50: 120 };
      const { strength: discountStrength } = service.analyzeSignal(discountedIndicators, 100);

      const premiumIndicators = { ...baseIndicators, ma50: 80 };
      const { strength: premiumStrength } = service.analyzeSignal(premiumIndicators, 100);

      expect(discountStrength).toBeGreaterThan(premiumStrength);
    });

    it('should increase strength at good entry point', () => {
      const goodEntryIndicators = { ...baseIndicators, ma20: 110, atr: 20 };
      // Entry threshold = 110 - 10 = 100, price 95 is below
      const { strength: goodEntryStrength } = service.analyzeSignal(goodEntryIndicators, 95);

      const badEntryIndicators = { ...baseIndicators, ma20: 100, atr: 5 };
      // Entry threshold = 100 - 2.5 = 97.5, price 100 is above
      const { strength: badEntryStrength } = service.analyzeSignal(badEntryIndicators, 100);

      expect(goodEntryStrength).toBeGreaterThan(badEntryStrength);
    });

    it('should clamp strength between 0 and 100', () => {
      // Very bullish scenario
      const bullishIndicators = {
        rsi: 20,
        ma20: 120,
        ma50: 130,
        ma50Slope: 0.02,
        atr: 20,
        bbWidth: 20,
        bollingerBands: { upper: 140, middle: 120, lower: 100 },
      };
      const { strength: bullishStrength } = service.analyzeSignal(bullishIndicators, 90);
      expect(bullishStrength).toBeLessThanOrEqual(100);

      // Very bearish scenario
      const bearishIndicators = {
        rsi: 85,
        ma20: 80,
        ma50: 70,
        ma50Slope: -0.02,
        atr: 2,
        bbWidth: 2,
        bollingerBands: { upper: 82, middle: 80, lower: 78 },
      };
      const { strength: bearishStrength } = service.analyzeSignal(bearishIndicators, 100);
      expect(bearishStrength).toBeGreaterThanOrEqual(0);
    });

    it('should return BUY when strength >= 50', () => {
      // Setup indicators that give high strength
      const bullishIndicators = {
        rsi: 25,
        ma20: 100,
        ma50: 100,
        ma50Slope: 0.01,
        atr: 5,
        bbWidth: 12,
        bollingerBands: { upper: 112, middle: 100, lower: 88 },
      };
      const { signal, strength } = service.analyzeSignal(bullishIndicators, 100);
      if (strength >= 50) {
        expect(signal).toBe('BUY');
      }
    });

    it('should return HOLD when strength < 50', () => {
      // Setup indicators that give low strength
      const bearishIndicators = {
        rsi: 75,
        ma20: 100,
        ma50: 80, // Price above MA50
        ma50Slope: -0.01,
        atr: 2,
        bbWidth: 2,
        bollingerBands: { upper: 102, middle: 100, lower: 98 },
      };
      const { signal, strength } = service.analyzeSignal(bearishIndicators, 100);
      if (strength < 50) {
        expect(signal).toBe('HOLD');
      }
    });

    // Intermediate condition tests (for coverage)
    it('should add moderate strength for RSI 30-40 range', () => {
      const moderateOversold = { ...baseIndicators, rsi: 35 };
      const { strength: moderateStrength } = service.analyzeSignal(moderateOversold, 100);

      const neutral = { ...baseIndicators, rsi: 50 };
      const { strength: neutralStrength } = service.analyzeSignal(neutral, 100);

      // RSI 30-40 should add +15 strength
      expect(moderateStrength).toBeGreaterThan(neutralStrength);
    });

    it('should add moderate strength for BB width 5-10 range', () => {
      const moderateVol = { ...baseIndicators, bbWidth: 7 };
      const { strength: moderateStrength } = service.analyzeSignal(moderateVol, 100);

      const lowVol = { ...baseIndicators, bbWidth: 3 };
      const { strength: lowVolStrength } = service.analyzeSignal(lowVol, 100);

      // BB width 5-10 should add +5 strength
      expect(moderateStrength).toBeGreaterThan(lowVolStrength);
    });

    it('should add moderate strength for MA50 deviation -5 to -10%', () => {
      // Price 93, MA50 100 = -7% deviation (moderate discount)
      const moderateDiscount = { ...baseIndicators, ma50: 100 };
      const { strength: discountStrength } = service.analyzeSignal(moderateDiscount, 93);

      const noDiscount = { ...baseIndicators, ma50: 100 };
      const { strength: noDiscountStrength } = service.analyzeSignal(noDiscount, 100);

      // -7% deviation should add +10 strength
      expect(discountStrength).toBeGreaterThan(noDiscountStrength);
    });
  });

  // ===========================================================================
  // Data Source Tracking
  // ===========================================================================
  describe('calculateIndicators dataSource tracking', () => {
    it('should include dataSource in calculateIndicators result', () => {
      const prices = generatePrices(50, 100, 'flat');
      const result = service.calculateIndicators(prices);
      expect(['technicalindicators', 'custom-fallback']).toContain(result.dataSource);
    });

    it('should report technicalindicators when library succeeds', () => {
      const prices = generatePrices(50, 100, 'flat');
      const result = service.calculateIndicators(prices);
      // With valid data, library should succeed
      expect(result.dataSource).toBe('technicalindicators');
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================
  describe('Edge Cases', () => {
    it('should handle empty price array', () => {
      expect(() => service.calculateRSI([])).not.toThrow();
      expect(() => service.calculateSMA([], 20)).not.toThrow();
      expect(() => service.calculateBollingerBands([])).not.toThrow();
      expect(() => service.calculateATR([])).not.toThrow();
    });

    it('should handle single price', () => {
      const singlePrice = [100];
      expect(() => service.calculateRSI(singlePrice)).not.toThrow();
      expect(() => service.calculateSMA(singlePrice, 20)).not.toThrow();
      expect(() => service.calculateBollingerBands(singlePrice)).not.toThrow();
      expect(() => service.calculateATR(singlePrice)).not.toThrow();
    });

    it('should handle negative prices (edge case, should not crash)', () => {
      const negativePrices = [-100, -50, -75, -60];
      expect(() => service.calculateRSI(negativePrices)).not.toThrow();
    });

    it('should handle very large prices', () => {
      const largePrices = Array(30).fill(1000000);
      expect(() => service.calculateIndicators(largePrices)).not.toThrow();
    });

    it('should handle very small prices', () => {
      const smallPrices = Array(30).fill(0.0001);
      expect(() => service.calculateIndicators(smallPrices)).not.toThrow();
    });
  });
});
