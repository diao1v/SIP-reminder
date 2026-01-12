import { RSI, BollingerBands, ATR, SMA } from 'technicalindicators';
import { TechnicalIndicators, TechnicalIndicatorsWithSource } from '../types';

/**
 * Technical Analysis Service
 * 
 * Uses technicalindicators library as primary calculation engine with
 * custom implementations as fallback for resilience.
 */
export class TechnicalAnalysisService {
  // Track which source was used
  private lastDataSource: 'technicalindicators' | 'custom-fallback' = 'technicalindicators';

  /**
   * Get the last used data source
   */
  getLastDataSource(): 'technicalindicators' | 'custom-fallback' {
    return this.lastDataSource;
  }

  /**
   * Calculate Relative Strength Index (RSI)
   * Primary: technicalindicators library
   * Fallback: Custom implementation
   */
  calculateRSI(prices: number[], period: number = 14): number {
    // Try technicalindicators library first
    try {
      const rsiResult = RSI.calculate({
        values: prices,
        period
      });

      if (rsiResult && rsiResult.length > 0) {
        const latestRSI = rsiResult[rsiResult.length - 1];
        if (typeof latestRSI === 'number' && !isNaN(latestRSI)) {
          this.lastDataSource = 'technicalindicators';
          return Math.round(latestRSI * 100) / 100;
        }
      }
      throw new Error('Invalid RSI result from library');
    } catch {
      console.warn(`⚠️ technicalindicators RSI failed, using custom fallback`);
      this.lastDataSource = 'custom-fallback';
      return this.calculateRSICustom(prices, period);
    }
  }

  /**
   * Custom RSI implementation (fallback)
   */
  private calculateRSICustom(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) {
      return 50; // Neutral if not enough data
    }

    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    let avgGain = 0;
    let avgLoss = 0;

    // Initial average
    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) {
        avgGain += changes[i];
      } else {
        avgLoss += Math.abs(changes[i]);
      }
    }

    avgGain /= period;
    avgLoss /= period;

    // Apply Wilder's smoothing method for remaining data
    for (let i = period; i < changes.length; i++) {
      const currentGain = changes[i] > 0 ? changes[i] : 0;
      const currentLoss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
      
      avgGain = ((avgGain * (period - 1)) + currentGain) / period;
      avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return Math.round(rsi * 100) / 100;
  }

  /**
   * Calculate Simple Moving Average (SMA)
   * Primary: technicalindicators library
   * Fallback: Custom implementation
   */
  calculateSMA(prices: number[], period: number): number {
    // Try technicalindicators library first
    try {
      const smaResult = SMA.calculate({
        values: prices,
        period
      });

      if (smaResult && smaResult.length > 0) {
        const latestSMA = smaResult[smaResult.length - 1];
        if (typeof latestSMA === 'number' && !isNaN(latestSMA)) {
          this.lastDataSource = 'technicalindicators';
          return Math.round(latestSMA * 100) / 100;
        }
      }
      throw new Error('Invalid SMA result from library');
    } catch {
      this.lastDataSource = 'custom-fallback';
      return this.calculateSMACustom(prices, period);
    }
  }

  /**
   * Custom SMA implementation (fallback)
   */
  private calculateSMACustom(prices: number[], period: number): number {
    if (prices.length < period) {
      // Return average of available prices if not enough data
      if (prices.length === 0) return 0;
      return prices.reduce((a, b) => a + b, 0) / prices.length;
    }

    const relevantPrices = prices.slice(-period);
    return Math.round((relevantPrices.reduce((a, b) => a + b, 0) / period) * 100) / 100;
  }

  /**
   * Calculate MA20 (20-day Moving Average)
   * Used for trend baseline and entry point optimization
   */
  calculateMA20(prices: number[]): number {
    return this.calculateSMA(prices, 20);
  }

  /**
   * Calculate MA50 (50-day Moving Average)
   * Used for CSS price vs MA50 scoring
   */
  calculateMA50(prices: number[]): number {
    return this.calculateSMA(prices, 50);
  }

  /**
   * Calculate MA50 Slope (v4.3)
   * Measures the trend direction of MA50 over a lookback period
   *
   * @param prices - Array of historical prices (oldest to newest)
   * @param lookbackDays - Number of days to calculate slope over (default 50)
   * @returns Slope as decimal (e.g., 0.015 = 1.5% increase)
   */
  calculateMA50Slope(prices: number[], lookbackDays: number = 50): number {
    // Need at least lookbackDays + 50 prices to calculate two MA50 values
    const minRequired = lookbackDays + 50;
    if (prices.length < minRequired) {
      console.warn(`⚠️ Not enough data for MA50 slope (have ${prices.length}, need ${minRequired})`);
      return 0; // Neutral if not enough data
    }

    // Calculate current MA50 (using most recent 50 prices)
    const currentMA50 = this.calculateSMA(prices, 50);

    // Calculate MA50 from lookbackDays ago
    // Get prices up to lookbackDays ago
    const historicalPrices = prices.slice(0, prices.length - lookbackDays);
    const historicalMA50 = this.calculateSMA(historicalPrices, 50);

    if (historicalMA50 === 0) {
      return 0; // Avoid division by zero
    }

    // Calculate slope as percentage change
    const slope = (currentMA50 - historicalMA50) / historicalMA50;

    return Math.round(slope * 10000) / 10000; // Round to 4 decimal places
  }

  /**
   * Calculate Bollinger Bands
   * Primary: technicalindicators library
   * Fallback: Custom implementation
   */
  calculateBollingerBands(
    prices: number[],
    period: number = 20,
    stdDev: number = 2
  ): { upper: number; middle: number; lower: number } {
    // Try technicalindicators library first
    try {
      const bbResult = BollingerBands.calculate({
        values: prices,
        period,
        stdDev
      });

      if (bbResult && bbResult.length > 0) {
        const latestBB = bbResult[bbResult.length - 1];
        if (latestBB && typeof latestBB.upper === 'number' && typeof latestBB.middle === 'number' && typeof latestBB.lower === 'number') {
          this.lastDataSource = 'technicalindicators';
          return {
            upper: Math.round(latestBB.upper * 100) / 100,
            middle: Math.round(latestBB.middle * 100) / 100,
            lower: Math.round(latestBB.lower * 100) / 100
          };
        }
      }
      throw new Error('Invalid Bollinger Bands result from library');
    } catch {
      console.warn(`⚠️ technicalindicators Bollinger Bands failed, using custom fallback`);
      this.lastDataSource = 'custom-fallback';
      return this.calculateBollingerBandsCustom(prices, period, stdDev);
    }
  }

  /**
   * Custom Bollinger Bands implementation (fallback)
   */
  private calculateBollingerBandsCustom(
    prices: number[],
    period: number = 20,
    stdDev: number = 2
  ): { upper: number; middle: number; lower: number } {
    if (prices.length < period) {
      const lastPrice = prices[prices.length - 1] || 100;
      return {
        upper: lastPrice * 1.05,
        middle: lastPrice,
        lower: lastPrice * 0.95
      };
    }

    const relevantPrices = prices.slice(-period);
    const middle = relevantPrices.reduce((a, b) => a + b, 0) / period;

    const squaredDiffs = relevantPrices.map(price => Math.pow(price - middle, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const standardDeviation = Math.sqrt(variance);

    return {
      upper: Math.round((middle + stdDev * standardDeviation) * 100) / 100,
      middle: Math.round(middle * 100) / 100,
      lower: Math.round((middle - stdDev * standardDeviation) * 100) / 100
    };
  }

  /**
   * Calculate Bollinger Bands Width
   * BB Width = (Upper - Lower) / Middle × 100%
   */
  calculateBBWidth(bollingerBands: { upper: number; middle: number; lower: number }): number {
    const { upper, middle, lower } = bollingerBands;
    if (middle === 0) return 0;
    return Math.round(((upper - lower) / middle) * 100 * 100) / 100;
  }

  /**
   * Calculate Average True Range (ATR)
   * Primary: technicalindicators library
   * Fallback: Custom implementation
   * Note: Library requires high/low/close arrays; we approximate from close prices
   */
  calculateATR(prices: number[], period: number = 14): number {
    // Try technicalindicators library first
    try {
      // Convert close prices to high/low/close approximation
      const high: number[] = [];
      const low: number[] = [];
      const close: number[] = [];

      for (let i = 0; i < prices.length; i++) {
        const price = prices[i];
        // Approximate high/low from close (±1%)
        high.push(price * 1.01);
        low.push(price * 0.99);
        close.push(price);
      }

      const atrResult = ATR.calculate({
        high,
        low,
        close,
        period
      });

      if (atrResult && atrResult.length > 0) {
        const latestATR = atrResult[atrResult.length - 1];
        if (typeof latestATR === 'number' && !isNaN(latestATR)) {
          this.lastDataSource = 'technicalindicators';
          return Math.round(latestATR * 100) / 100;
        }
      }
      throw new Error('Invalid ATR result from library');
    } catch {
      console.warn(`⚠️ technicalindicators ATR failed, using custom fallback`);
      this.lastDataSource = 'custom-fallback';
      return this.calculateATRCustom(prices, period);
    }
  }

  /**
   * Custom ATR implementation (fallback)
   */
  private calculateATRCustom(prices: number[], period: number = 14): number {
    if (prices.length < 2) {
      return 0;
    }

    const trueRanges: number[] = [];

    for (let i = 1; i < prices.length; i++) {
      const high = Math.max(prices[i], prices[i - 1]);
      const low = Math.min(prices[i], prices[i - 1]);
      const tr = high - low;
      trueRanges.push(tr);
    }

    const relevantTRs = trueRanges.slice(-period);
    const atr = relevantTRs.reduce((a, b) => a + b, 0) / relevantTRs.length;

    return Math.round(atr * 100) / 100;
  }

  /**
   * Calculate entry point optimization
   * Buy signal: Price < MA20 - 0.5×ATR (strong discount)
   */
  calculateEntryPoint(ma20: number, atr: number): {
    strongBuyBelow: number;
    targetEntry: number;
  } {
    const strongBuyBelow = Math.round((ma20 - 0.5 * atr) * 100) / 100;
    return {
      strongBuyBelow,
      targetEntry: ma20
    };
  }

  /**
   * Check if current price is at a good entry point
   */
  isGoodEntryPoint(currentPrice: number, ma20: number, atr: number): boolean {
    const entryThreshold = ma20 - 0.5 * atr;
    return currentPrice < entryThreshold;
  }

  /**
   * Calculate price vs MA50 deviation percentage
   * Negative = price below MA50 (discount)
   * Positive = price above MA50 (premium)
   */
  calculateMA50Deviation(currentPrice: number, ma50: number): number {
    if (ma50 === 0) return 0;
    return Math.round(((currentPrice - ma50) / ma50) * 100 * 100) / 100;
  }

  /**
   * Calculate all technical indicators for a stock
   * Returns indicators with source tracking
   */
  calculateIndicators(prices: number[]): TechnicalIndicatorsWithSource {
    const bollingerBands = this.calculateBollingerBands(prices);
    const ma20 = this.calculateMA20(prices);
    const ma50 = this.calculateMA50(prices);
    const ma50Slope = this.calculateMA50Slope(prices); // v4.3
    const atr = this.calculateATR(prices);
    const rsi = this.calculateRSI(prices);

    return {
      rsi,
      bollingerBands,
      bbWidth: this.calculateBBWidth(bollingerBands),
      atr,
      ma20,
      ma50,
      ma50Slope,
      dataSource: this.lastDataSource
    };
  }

  /**
   * Determine trading signal based on CSS score
   * In CSS v4.2, we never fully stop - always BUY or HOLD
   */
  analyzeSignal(indicators: TechnicalIndicators, currentPrice: number): {
    signal: 'BUY' | 'HOLD';
    strength: number;
  } {
    let strength = 50; // Base strength

    // RSI contribution
    if (indicators.rsi < 30) {
      strength += 25; // Oversold bonus
    } else if (indicators.rsi < 40) {
      strength += 15;
    } else if (indicators.rsi > 70) {
      strength -= 15; // Overbought penalty (but never stops)
    }

    // BB Width contribution
    if (indicators.bbWidth > 10) {
      strength += 15; // High volatility = opportunity
    } else if (indicators.bbWidth > 5) {
      strength += 5;
    }

    // MA50 contribution
    const ma50Deviation = this.calculateMA50Deviation(currentPrice, indicators.ma50);
    if (ma50Deviation < -10) {
      strength += 20; // Big discount
    } else if (ma50Deviation < -5) {
      strength += 10;
    } else if (ma50Deviation > 10) {
      strength -= 10; // Expensive
    }

    // Entry point contribution
    if (this.isGoodEntryPoint(currentPrice, indicators.ma20, indicators.atr)) {
      strength += 10;
    }

    // Clamp strength to 0-100
    strength = Math.max(0, Math.min(100, strength));

    // Signal based on strength
    const signal: 'BUY' | 'HOLD' = strength >= 50 ? 'BUY' : 'HOLD';

    return { signal, strength };
  }
}
