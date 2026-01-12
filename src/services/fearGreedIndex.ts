import axios from 'axios';
import { FearGreedResponse } from '../types';

/**
 * Fear & Greed Index Service
 *
 * Fetches the CNN Fear & Greed Index which measures market sentiment on a 0-100 scale:
 * - 0-25: Extreme Fear
 * - 25-45: Fear
 * - 45-55: Neutral
 * - 55-75: Greed
 * - 75-100: Extreme Greed
 *
 * ## Error Handling Strategy: SUCCESS FLAG PATTERN
 *
 * This service returns a response object with a `success` boolean:
 * - `success: true` - Valid data fetched from CNN API
 * - `success: false` - Fetch failed, returns neutral default (50)
 *
 * **Rationale:** F&G is supplementary data. When unavailable, CSS scoring
 * redistributes its 15% weight to VIX (+7.5%) and RSI (+7.5%).
 * The caller decides how to handle failures via the success flag.
 */
export class FearGreedService {
  private static readonly CNN_API_URL = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
  private static readonly TIMEOUT_MS = 10000;

  /**
   * Fetch Fear & Greed Index from CNN.
   *
   * @returns Response with `success` flag - NEVER throws
   *
   * @remarks
   * On failure: returns `{ success: false, value: 50 }` (neutral default).
   * Caller should check `success` flag to detect failures.
   */
  async fetchFearGreedIndex(): Promise<FearGreedResponse> {
    try {
      console.log('📊 Fetching Fear & Greed Index from CNN...');
      
      const response = await axios.get(this.getAPIUrl(), {
        timeout: FearGreedService.TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://edition.cnn.com/markets/fear-and-greed'
        }
      });

      const data = this.parseResponse(response.data);
      
      if (data) {
        console.log(`✅ Fear & Greed Index: ${data.value} (${data.rating})`);
        return {
          value: data.value,
          rating: data.rating,
          timestamp: new Date(),
          success: true
        };
      }

      throw new Error('Failed to parse Fear & Greed response');
    } catch (error) {
      console.error('❌ Failed to fetch Fear & Greed Index:', error instanceof Error ? error.message : error);
      console.warn('⚠️  Will use VIX fallback (VIX weight doubled to 40%)');
      
      return {
        value: 50, // Neutral default
        rating: 'Unknown',
        timestamp: new Date(),
        success: false
      };
    }
  }

  /**
   * Get the API URL
   */
  private getAPIUrl(): string {
    // Add timestamp to prevent caching
    return `${FearGreedService.CNN_API_URL}?_=${Date.now()}`;
  }

  /**
   * Parse the CNN API response
   * The response structure may vary, so we handle multiple formats
   */
  private parseResponse(data: unknown): { value: number; rating: string } | null {
    try {
      // Format 1: Direct response with fear_and_greed object
      if (this.isObjectWithProperty(data, 'fear_and_greed')) {
        const fg = (data as { fear_and_greed: { score: number; rating: string } }).fear_and_greed;
        if (typeof fg.score === 'number') {
          return {
            value: Math.round(fg.score),
            rating: this.getRatingFromScore(fg.score)
          };
        }
      }

      // Format 2: Array with score in first element
      if (Array.isArray(data) && data.length > 0) {
        const firstItem = data[0];
        if (this.isObjectWithProperty(firstItem, 'x') && this.isObjectWithProperty(firstItem, 'y')) {
          const score = (firstItem as { y: number }).y;
          return {
            value: Math.round(score),
            rating: this.getRatingFromScore(score)
          };
        }
      }

      // Format 3: Direct score value
      if (this.isObjectWithProperty(data, 'score')) {
        const score = (data as { score: number }).score;
        return {
          value: Math.round(score),
          rating: this.getRatingFromScore(score)
        };
      }

      // Format 4: Nested data structure
      if (this.isObjectWithProperty(data, 'fear_and_greed_historical')) {
        const historical = (data as { fear_and_greed_historical: { data: Array<{ x: number; y: number; rating: string }> } }).fear_and_greed_historical;
        if (historical.data && historical.data.length > 0) {
          const latest = historical.data[historical.data.length - 1];
          return {
            value: Math.round(latest.y),
            rating: latest.rating || this.getRatingFromScore(latest.y)
          };
        }
      }

      console.warn('⚠️  Unknown Fear & Greed response format:', JSON.stringify(data).substring(0, 200));
      return null;
    } catch (parseError) {
      console.error('❌ Error parsing Fear & Greed response:', parseError);
      return null;
    }
  }

  /**
   * Type guard for checking if object has a property
   */
  private isObjectWithProperty(obj: unknown, prop: string): boolean {
    return typeof obj === 'object' && obj !== null && prop in obj;
  }

  /**
   * Convert numeric score to rating text
   */
  private getRatingFromScore(score: number): string {
    if (score <= 25) return 'Extreme Fear';
    if (score <= 45) return 'Fear';
    if (score <= 55) return 'Neutral';
    if (score <= 75) return 'Greed';
    return 'Extreme Greed';
  }

  /**
   * Check if Fear & Greed fetch was successful
   */
  isSuccessful(response: FearGreedResponse): boolean {
    return response.success;
  }

  /**
   * Get emoji for Fear & Greed rating
   */
  getRatingEmoji(rating: string): string {
    switch (rating) {
      case 'Extreme Fear':
        return '😱';
      case 'Fear':
        return '😰';
      case 'Neutral':
        return '😐';
      case 'Greed':
        return '😏';
      case 'Extreme Greed':
        return '🤑';
      default:
        return '❓';
    }
  }
}
