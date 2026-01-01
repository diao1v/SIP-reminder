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
   * Calculate all technical indicators for a stock
   */
  calculateIndicators(prices: number[]): TechnicalIndicators {
    return {
      rsi: this.calculateRSI(prices),
      bollingerBands: this.calculateBollingerBands(prices),
      atr: this.calculateATR(prices)
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

    // RSI Analysis
    if (indicators.rsi < 30) {
      buyScore += 30; // Oversold
    } else if (indicators.rsi > 70) {
      sellScore += 30; // Overbought
    } else if (indicators.rsi >= 40 && indicators.rsi <= 60) {
      buyScore += 10; // Neutral to bullish
    }

    // Bollinger Bands Analysis
    const { upper, middle, lower } = indicators.bollingerBands;
    const bbPosition = (currentPrice - lower) / (upper - lower);

    if (bbPosition < 0.2) {
      buyScore += 25; // Near lower band
    } else if (bbPosition > 0.8) {
      sellScore += 25; // Near upper band
    } else if (bbPosition >= 0.4 && bbPosition <= 0.6) {
      buyScore += 10; // Middle range
    }

    // ATR Analysis (volatility consideration)
    const priceATRRatio = indicators.atr / currentPrice;
    if (priceATRRatio < 0.02) {
      buyScore += 15; // Low volatility favors buying
    } else if (priceATRRatio > 0.05) {
      sellScore += 15; // High volatility suggests caution
    }

    const totalScore = buyScore - sellScore;
    
    let signal: 'BUY' | 'SELL' | 'HOLD';
    if (totalScore > 20) {
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
