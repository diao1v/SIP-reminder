import axios, { AxiosRequestConfig } from 'axios';
import { MarketData } from '../types';
import { HISTORY_DAYS } from '../utils/multiplierThresholds';

interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice: number;
        previousClose?: number;
        chartPreviousClose?: number;
      };
      indicators: {
        quote: Array<{
          close: (number | null)[];
          volume: (number | null)[];
        }>;
      };
    }>;
  };
}

export class MarketDataService {
  private static readonly VIX_SYMBOL = '^VIX';
  private static readonly BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
  private static readonly DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0'
  };

  /**
   * Make a request to Yahoo Finance API
   * Centralized API call logic to avoid duplication
   */
  private async fetchFromYahoo<T>(
    symbol: string,
    params: Record<string, string>
  ): Promise<T> {
    const config: AxiosRequestConfig = {
      params,
      headers: MarketDataService.DEFAULT_HEADERS
    };

    const response = await axios.get<T>(
      `${MarketDataService.BASE_URL}/${symbol}`,
      config
    );

    return response.data;
  }

  /**
   * Validate Yahoo Finance response structure
   */
  private validateChartResponse(data: YahooChartResponse): boolean {
    return !!(data?.chart?.result?.[0]);
  }

  /**
   * Fetches real-time market data for a given stock symbol
   * Uses Yahoo Finance API (free, ~15min delay)
   */
  async fetchStockData(symbol: string): Promise<MarketData> {
    try {
      const data = await this.fetchFromYahoo<YahooChartResponse>(symbol, {
        interval: '1d',
        range: '5d'
      });

      if (!this.validateChartResponse(data)) {
        throw new Error('Invalid response structure from API');
      }

      const result = data.chart.result[0];
      const quote = result.meta;
      const currentPrice = quote.regularMarketPrice;
      const previousClose = quote.previousClose || quote.chartPreviousClose || currentPrice;

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
      return this.getSimulatedData(symbol);
    }
  }

  /**
   * Fetches historical price data for technical analysis
   * Default 100 days for MA50 calculation (CSS v4.2)
   */
  async fetchHistoricalData(symbol: string, days: number = HISTORY_DAYS): Promise<number[]> {
    try {
      const data = await this.fetchFromYahoo<YahooChartResponse>(symbol, {
        interval: '1d',
        range: `${days}d`
      });

      if (!data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close) {
        throw new Error('Invalid response structure from API');
      }

      const result = data.chart.result[0];
      const closes = result.indicators.quote[0].close
        .filter((p): p is number => p !== null);
      
      return closes;
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error);
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
   * Simulated data for development/testing when API is unavailable
   */
  private getSimulatedData(symbol: string): MarketData {
    // Use consistent pseudo-random values based on symbol
    const seed = this.hashSymbol(symbol);
    const basePrice = 100 + (seed % 400);
    const previousClose = basePrice * (0.98 + (seed % 4) / 100);
    const currentPrice = basePrice;

    return {
      symbol,
      price: currentPrice,
      previousClose,
      change: currentPrice - previousClose,
      changePercent: ((currentPrice - previousClose) / previousClose) * 100,
      volume: Math.floor(1000000 + (seed % 9000000)),
      timestamp: new Date()
    };
  }

  /**
   * Generate simulated historical data
   */
  private getSimulatedHistoricalData(days: number): number[] {
    const prices: number[] = [];
    let price = 100 + Math.random() * 400;
    
    for (let i = 0; i < days; i++) {
      price = price * (0.97 + Math.random() * 0.06);
      prices.push(price);
    }
    
    return prices;
  }

  /**
   * Simple hash function for consistent pseudo-random values
   */
  private hashSymbol(symbol: string): number {
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
      hash = ((hash << 5) - hash) + symbol.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
