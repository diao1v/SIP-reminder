import axios, { AxiosRequestConfig } from 'axios';
import YahooFinance from 'yahoo-finance2';
import { MarketDataWithSource } from '../types';
import { HISTORY_DAYS } from '../utils/multiplierThresholds';

// Initialize yahoo-finance2 client
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey']  // Suppress non-critical survey notices
});

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
 * Type definition for yahoo-finance2 chart result
 */
interface YahooChartQuote {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjclose?: number;
}

interface YahooChartResult {
  meta: {
    regularMarketPrice: number;
    previousClose?: number;
    chartPreviousClose?: number;
  };
  quotes: YahooChartQuote[];
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
 *
 * ## Error Handling Strategy: NEVER THROWS
 *
 * This service uses a graceful degradation pattern:
 * 1. Try primary source (yahoo-finance2)
 * 2. On failure, try fallback source (direct axios API)
 * 3. On complete failure, return simulated/default data
 *
 * **Rationale:** Market data failures should never prevent the
 * investment analysis from completing. It's better to use slightly
 * stale or estimated data than to fail entirely.
 *
 * All methods track their data source via `getLastDataSource()`.
 */
export class MarketDataService {
  private static readonly VIX_SYMBOL = '^VIX';
  private static readonly BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
  private static readonly DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0'
  };

  // Track which source was used
  private lastDataSource: 'yahoo-finance2' | 'axios-fallback' | 'simulated' = 'yahoo-finance2';

  /**
   * Get the last used data source
   */
  getLastDataSource(): 'yahoo-finance2' | 'axios-fallback' | 'simulated' {
    return this.lastDataSource;
  }

  /**
   * Fetches real-time market data for a given stock symbol.
   *
   * @param symbol - Stock ticker symbol (e.g., "AAPL", "QQQ")
   * @returns Market data with source indicator - NEVER throws
   *
   * @remarks
   * Fallback chain: yahoo-finance2 → axios API → simulated data
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
   * Fetches historical price data for technical analysis.
   *
   * @param symbol - Stock ticker symbol
   * @param days - Number of days of history (default: 150 for MA50 slope)
   * @returns Array of closing prices with source indicator - NEVER throws
   *
   * @remarks
   * Fallback chain: yahoo-finance2 chart() → axios API → simulated data
   */
  async fetchHistoricalData(symbol: string, days: number = HISTORY_DAYS): Promise<{ prices: number[]; source: 'yahoo-finance2' | 'axios-fallback' | 'simulated' }> {
    // Try yahoo-finance2 chart() method (replaces deprecated historical())
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const result = await yahooFinance.chart(symbol, {
        period1: startDate,
        period2: endDate,
        interval: '1d'
      }) as YahooChartResult;

      if (!result || !result.quotes || result.quotes.length === 0) {
        throw new Error('No chart data returned from yahoo-finance2');
      }

      const prices = result.quotes
        .map((quote: YahooChartQuote) => quote.close)
        .filter((p): p is number => p !== null && p !== undefined);

      if (prices.length < 10) {
        throw new Error(`Insufficient historical data: only ${prices.length} points`);
      }

      this.lastDataSource = 'yahoo-finance2';
      console.log(`✅ ${symbol}: Historical data via yahoo-finance2 chart() (${prices.length} days)`);

      return { prices, source: 'yahoo-finance2' };
    } catch (libraryError) {
      console.warn(`⚠️ yahoo-finance2 chart() failed for ${symbol}:`, libraryError instanceof Error ? libraryError.message : libraryError);
      console.log(`   Falling back to axios API...`);

      // Fallback to direct axios call
      return this.fetchHistoricalDataAxios(symbol, days);
    }
  }

  /**
   * Fallback: Direct axios API call for historical data
   */
  private async fetchHistoricalDataAxios(symbol: string, days: number): Promise<{ prices: number[]; source: 'yahoo-finance2' | 'axios-fallback' | 'simulated' }> {
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
      console.warn(`🚨 ${symbol}: Using SIMULATED historical data - DO NOT USE FOR REAL INVESTMENTS`);
      this.lastDataSource = 'simulated';
      return { prices: this.getSimulatedHistoricalData(days), source: 'simulated' };
    }
  }

  /**
   * Fetches VIX (Volatility Index) data.
   *
   * @returns VIX value with source indicator - NEVER throws
   *
   * @remarks
   * Fallback chain: yahoo-finance2 → axios API → default value (18.5)
   * Default 18.5 represents moderate/neutral volatility.
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
   * WARNING: This returns FAKE data - clearly flagged as 'simulated'
   */
  private getSimulatedData(symbol: string): MarketDataWithSource {
    // Use consistent pseudo-random values based on symbol
    const seed = this.hashSymbol(symbol);
    const basePrice = 100 + (seed % 400);
    const previousClose = basePrice * (0.98 + (seed % 4) / 100);
    const currentPrice = basePrice;

    this.lastDataSource = 'simulated';
    console.warn(`🚨 ${symbol}: Using SIMULATED data (all API sources failed) - DO NOT USE FOR REAL INVESTMENTS`);

    return {
      symbol,
      price: currentPrice,
      previousClose,
      change: currentPrice - previousClose,
      changePercent: ((currentPrice - previousClose) / previousClose) * 100,
      volume: Math.floor(1000000 + (seed % 9000000)),
      timestamp: new Date(),
      dataSource: 'simulated'
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
