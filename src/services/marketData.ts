import axios, { AxiosRequestConfig } from 'axios';
import YahooFinance from 'yahoo-finance2';
import { MarketDataWithSource } from '../types';
import { HISTORY_DAYS } from '../utils/multiplierThresholds';

// Initialize yahoo-finance2 client
const yahooFinance = new YahooFinance();

/**
 * Type definition for yahoo-finance2 quote result
 */
interface YahooQuoteResult {
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  symbol?: string;
  [key: string]: unknown;
}

/**
 * Type definition for yahoo-finance2 historical result
 */
interface YahooHistoricalRow {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose?: number;
}

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

/**
 * Market Data Service
 * 
 * Uses yahoo-finance2 library as primary data source with
 * direct axios API calls as fallback for resilience.
 */
export class MarketDataService {
  private static readonly VIX_SYMBOL = '^VIX';
  private static readonly BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
  private static readonly DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0'
  };

  // Track which source was used
  private lastDataSource: 'yahoo-finance2' | 'axios-fallback' = 'yahoo-finance2';

  /**
   * Get the last used data source
   */
  getLastDataSource(): 'yahoo-finance2' | 'axios-fallback' {
    return this.lastDataSource;
  }

  /**
   * Fetches real-time market data for a given stock symbol
   * Primary: yahoo-finance2 library
   * Fallback: Direct axios API call
   */
  async fetchStockData(symbol: string): Promise<MarketDataWithSource> {
    // Try yahoo-finance2 first
    try {
      const quote = await yahooFinance.quote(symbol) as YahooQuoteResult;
      
      if (!quote || typeof quote.regularMarketPrice !== 'number') {
        throw new Error('Invalid quote response from yahoo-finance2');
      }

      const currentPrice = quote.regularMarketPrice;
      const previousClose = quote.regularMarketPreviousClose || currentPrice;

      this.lastDataSource = 'yahoo-finance2';
      console.log(`✅ ${symbol}: Fetched via yahoo-finance2`);

      return {
        symbol,
        price: currentPrice,
        previousClose,
        change: currentPrice - previousClose,
        changePercent: quote.regularMarketChangePercent || ((currentPrice - previousClose) / previousClose) * 100,
        volume: quote.regularMarketVolume || 0,
        timestamp: new Date(),
        dataSource: 'yahoo-finance2'
      };
    } catch (libraryError) {
      console.warn(`⚠️ yahoo-finance2 failed for ${symbol}:`, libraryError instanceof Error ? libraryError.message : libraryError);
      console.log(`   Falling back to axios API...`);
      
      // Fallback to direct axios call
      return this.fetchStockDataAxios(symbol);
    }
  }

  /**
   * Fallback: Direct axios API call to Yahoo Finance
   */
  private async fetchStockDataAxios(symbol: string): Promise<MarketDataWithSource> {
    try {
      const data = await this.fetchFromYahooAxios<YahooChartResponse>(symbol, {
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

      this.lastDataSource = 'axios-fallback';
      console.log(`✅ ${symbol}: Fetched via axios fallback`);

      return {
        symbol,
        price: currentPrice,
        previousClose,
        change: currentPrice - previousClose,
        changePercent: ((currentPrice - previousClose) / previousClose) * 100,
        volume: result.indicators.quote[0].volume.slice(-1)[0] || 0,
        timestamp: new Date(),
        dataSource: 'axios-fallback'
      };
    } catch (error) {
      console.error(`❌ Both sources failed for ${symbol}:`, error);
      return this.getSimulatedData(symbol);
    }
  }

  /**
   * Fetches historical price data for technical analysis
   * Primary: yahoo-finance2 library
   * Fallback: Direct axios API call
   * Default 100 days for MA50 calculation (CSS v4.2)
   */
  async fetchHistoricalData(symbol: string, days: number = HISTORY_DAYS): Promise<{ prices: number[]; source: 'yahoo-finance2' | 'axios-fallback' }> {
    // Try yahoo-finance2 first
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const result = await yahooFinance.historical(symbol, {
        period1: startDate,
        period2: endDate,
        interval: '1d'
      }) as YahooHistoricalRow[];

      if (!result || result.length === 0) {
        throw new Error('No historical data returned from yahoo-finance2');
      }

      const prices = result.map((row: YahooHistoricalRow) => row.close).filter((p): p is number => p !== null && p !== undefined);
      
      if (prices.length < 10) {
        throw new Error(`Insufficient historical data: only ${prices.length} points`);
      }

      this.lastDataSource = 'yahoo-finance2';
      console.log(`✅ ${symbol}: Historical data via yahoo-finance2 (${prices.length} days)`);

      return { prices, source: 'yahoo-finance2' };
    } catch (libraryError) {
      console.warn(`⚠️ yahoo-finance2 historical failed for ${symbol}:`, libraryError instanceof Error ? libraryError.message : libraryError);
      console.log(`   Falling back to axios API...`);

      // Fallback to direct axios call
      return this.fetchHistoricalDataAxios(symbol, days);
    }
  }

  /**
   * Fallback: Direct axios API call for historical data
   */
  private async fetchHistoricalDataAxios(symbol: string, days: number): Promise<{ prices: number[]; source: 'yahoo-finance2' | 'axios-fallback' }> {
    try {
      const data = await this.fetchFromYahooAxios<YahooChartResponse>(symbol, {
        interval: '1d',
        range: `${days}d`
      });

      if (!data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close) {
        throw new Error('Invalid response structure from API');
      }

      const result = data.chart.result[0];
      const prices = result.indicators.quote[0].close
        .filter((p): p is number => p !== null);

      this.lastDataSource = 'axios-fallback';
      console.log(`✅ ${symbol}: Historical data via axios fallback (${prices.length} days)`);

      return { prices, source: 'axios-fallback' };
    } catch (error) {
      console.error(`❌ Both sources failed for ${symbol} historical:`, error);
      return { prices: this.getSimulatedHistoricalData(days), source: 'axios-fallback' };
    }
  }

  /**
   * Fetches VIX (Volatility Index) data
   * Primary: yahoo-finance2 library
   * Fallback: Direct axios API call
   */
  async fetchVIX(): Promise<{ vix: number; source: 'yahoo-finance2' | 'axios-fallback' }> {
    // Try yahoo-finance2 first
    try {
      const quote = await yahooFinance.quote(MarketDataService.VIX_SYMBOL) as YahooQuoteResult;
      
      if (!quote || typeof quote.regularMarketPrice !== 'number') {
        throw new Error('Invalid VIX quote from yahoo-finance2');
      }

      this.lastDataSource = 'yahoo-finance2';
      console.log(`✅ VIX: ${quote.regularMarketPrice.toFixed(2)} via yahoo-finance2`);

      return { vix: quote.regularMarketPrice, source: 'yahoo-finance2' };
    } catch (libraryError) {
      console.warn(`⚠️ yahoo-finance2 failed for VIX:`, libraryError instanceof Error ? libraryError.message : libraryError);
      console.log(`   Falling back to axios API...`);

      // Fallback to direct axios call
      return this.fetchVIXAxios();
    }
  }

  /**
   * Fallback: Direct axios API call for VIX
   */
  private async fetchVIXAxios(): Promise<{ vix: number; source: 'yahoo-finance2' | 'axios-fallback' }> {
    try {
      const data = await this.fetchStockDataAxios(MarketDataService.VIX_SYMBOL);
      this.lastDataSource = 'axios-fallback';
      console.log(`✅ VIX: ${data.price.toFixed(2)} via axios fallback`);
      return { vix: data.price, source: 'axios-fallback' };
    } catch (error) {
      console.error('❌ Both sources failed for VIX:', error);
      // Return moderate volatility as default
      return { vix: 18.5, source: 'axios-fallback' };
    }
  }

  /**
   * Make a request to Yahoo Finance API via axios
   * Kept as fallback method
   */
  private async fetchFromYahooAxios<T>(
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
   * Simulated data for development/testing when API is unavailable
   */
  private getSimulatedData(symbol: string): MarketDataWithSource {
    // Use consistent pseudo-random values based on symbol
    const seed = this.hashSymbol(symbol);
    const basePrice = 100 + (seed % 400);
    const previousClose = basePrice * (0.98 + (seed % 4) / 100);
    const currentPrice = basePrice;

    console.warn(`⚠️ ${symbol}: Using simulated data (all sources failed)`);

    return {
      symbol,
      price: currentPrice,
      previousClose,
      change: currentPrice - previousClose,
      changePercent: ((currentPrice - previousClose) / previousClose) * 100,
      volume: Math.floor(1000000 + (seed % 9000000)),
      timestamp: new Date(),
      dataSource: 'axios-fallback'
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
