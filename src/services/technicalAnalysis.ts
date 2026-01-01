import { TechnicalIndicators } from '../types';

export class TechnicalAnalysisService {
  /**
   * Calculate Relative Strength Index (RSI)
   * RSI measures the speed and magnitude of price changes
   * Values: 0-100, where >70 = overbought, <30 = oversold
   */
  calculateRSI(prices: number[], period: number = 14): number {
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
   * MA20 is used for entry point optimization
   */
  calculateSMA(prices: number[], period: number = 20): number {
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
   * Calculate Bollinger Bands
   * Measures volatility and potential price reversal points
   */
  calculateBollingerBands(
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
   * Measures market volatility
   */
  calculateATR(prices: number[], period: number = 14): number {
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
   * Calculate all technical indicators for a stock
   */
  calculateIndicators(prices: number[]): TechnicalIndicators {
    const bollingerBands = this.calculateBollingerBands(prices);
    const ma20 = this.calculateMA20(prices);
    const atr = this.calculateATR(prices);
    
    return {
      rsi: this.calculateRSI(prices),
      bollingerBands,
      bbWidth: this.calculateBBWidth(bollingerBands),
      atr,
      ma20
    };
  }

  /**
   * Determine trading signal based on technical indicators
   */
  analyzeSignal(indicators: TechnicalIndicators, currentPrice: number): {
    signal: 'BUY' | 'SELL' | 'HOLD';
    strength: number;
  } {
    let buyScore = 0;
    let sellScore = 0;

    // RSI Analysis (per spec)
    if (indicators.rsi < 30) {
      buyScore += 40; // Oversold - strong buy signal
    } else if (indicators.rsi > 70) {
      sellScore += 50; // Overbought - pause/skip
    } else if (indicators.rsi >= 30 && indicators.rsi <= 70) {
      buyScore += 15; // Normal range - standard DCA
    }

    // Bollinger Bands Width Analysis
    const bbWidth = indicators.bbWidth ?? this.calculateBBWidth(indicators.bollingerBands);
    if (bbWidth > 10) {
      buyScore += 20; // High volatility = more opportunities
    } else if (bbWidth > 5) {
      buyScore += 10; // Moderate opportunities
    }

    // Entry Point Analysis (if MA20 available)
    if (indicators.ma20 && indicators.atr) {
      if (this.isGoodEntryPoint(currentPrice, indicators.ma20, indicators.atr)) {
        buyScore += 25; // Strong discount entry
      }
    }

    // ATR Analysis (volatility consideration)
    const priceATRRatio = indicators.atr / currentPrice;
    if (priceATRRatio < 0.02) {
      buyScore += 10; // Low volatility favors buying
    } else if (priceATRRatio > 0.05) {
      sellScore += 10; // High volatility suggests caution
    }

    const totalScore = buyScore - sellScore;
    
    let signal: 'BUY' | 'SELL' | 'HOLD';
    if (indicators.rsi > 70) {
      // Per spec: RSI > 70 = PAUSE (0.0x multiplier)
      signal = 'HOLD';
    } else if (totalScore > 20) {
      signal = 'BUY';
    } else if (totalScore < -20) {
      signal = 'SELL';
    } else {
      signal = 'HOLD';
    }

    const strength = Math.min(100, Math.abs(totalScore));

    return { signal, strength };
  }
}
