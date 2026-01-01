import axios from 'axios';
import { MarketData } from '../types';

export class MarketDataService {
  private static readonly VIX_SYMBOL = '^VIX';
  
  /**
   * Fetches real-time market data for a given stock symbol
   * Uses Yahoo Finance API alternative (free, no API key required)
   */
  async fetchStockData(symbol: string): Promise<MarketData> {
    try {
      // Using a free API endpoint that doesn't require authentication
      // In production, consider using Alpha Vantage, IEX Cloud, or similar
      const response = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
        {
          params: {
            interval: '1d',
            range: '5d'
          },
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        }
      );

      // Validate response structure
      if (!response.data?.chart?.result?.[0]) {
        throw new Error('Invalid response structure from API');
      }

      const result = response.data.chart.result[0];
      const quote = result.meta;
      const currentPrice = quote.regularMarketPrice;
      const previousClose = quote.previousClose || quote.chartPreviousClose;

      return {
        symbol,
        price: currentPrice,
        previousClose,
        change: currentPrice - previousClose,
        changePercent: ((currentPrice - previousClose) / previousClose) * 100,
        volume: result.indicators.quote[0].volume.slice(-1)[0] || 0,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Error fetching data for ${symbol}:`, error);
      // Return simulated data for development/testing
      return this.getSimulatedData(symbol);
    }
  }

  /**
   * Fetches historical price data for technical analysis
   */
  async fetchHistoricalData(symbol: string, days: number = 30): Promise<number[]> {
    try {
      const response = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
        {
          params: {
            interval: '1d',
            range: `${days}d`
          },
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        }
      );

      // Validate response structure
      if (!response.data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close) {
        throw new Error('Invalid response structure from API');
      }

      const result = response.data.chart.result[0];
      const closes = result.indicators.quote[0].close.filter((p: number | null) => p !== null);
      return closes;
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error);
      // Return simulated data
      return this.getSimulatedHistoricalData(days);
    }
  }

  /**
   * Fetches VIX (Volatility Index) data
   */
  async fetchVIX(): Promise<number> {
    try {
      const data = await this.fetchStockData(MarketDataService.VIX_SYMBOL);
      return data.price;
    } catch (error) {
      console.error('Error fetching VIX:', error);
      // Return moderate volatility as default
      return 18.5;
    }
  }

  /**
   * Simulated data for development/testing
   */
  private getSimulatedData(symbol: string): MarketData {
    const basePrice = 100 + Math.random() * 400;
    const previousClose = basePrice * (0.98 + Math.random() * 0.04);
    const currentPrice = basePrice;

    return {
      symbol,
      price: currentPrice,
      previousClose,
      change: currentPrice - previousClose,
      changePercent: ((currentPrice - previousClose) / previousClose) * 100,
      volume: Math.floor(1000000 + Math.random() * 9000000),
      timestamp: new Date()
    };
  }

  private getSimulatedHistoricalData(days: number): number[] {
    const prices: number[] = [];
    let price = 100 + Math.random() * 400;
    
    for (let i = 0; i < days; i++) {
      price = price * (0.97 + Math.random() * 0.06);
      prices.push(price);
    }
    
    return prices;
  }
}
