/**
 * CSS Strategy v4.2 Configuration
 * 
 * Composite Signal Score (CSS) system with 5 weighted indicators:
 * CSS = (VIX × 0.20) + (RSI × 0.25) + (BB × 0.15) + (MA50 × 0.20) + (F&G × 0.20)
 */

/**
 * Base Allocation Percentages per Asset (v4.2)
 * Total: 100%
 * 
 * Growth: 65% (QQQ + GOOG + AIQ + TSLA)
 * International: 10% (VXUS)
 * Defensive: 10% (XLV)
 * Hedge: 15% (TLT)
 */
export const BASE_ALLOCATIONS: Record<string, number> = {
  'QQQ': 25,      // Tech ETF - Core tech/growth exposure
  'GOOG': 17.5,   // Stock - AI & cloud leader
  'AIQ': 15,      // Thematic ETF - AI & robotics theme
  'TSLA': 7.5,    // Stock - High-growth, high-volatility
  'XLV': 10,      // Defensive - Healthcare (recession-resistant)
  'VXUS': 10,     // International - Non-US diversification
  'TLT': 15       // Hedge - Treasury bonds (flight-to-safety)
} as const;

/**
 * Asset Categories
 */
export const ASSET_CATEGORIES = {
  GROWTH: ['QQQ', 'GOOG', 'AIQ', 'TSLA'],
  INTERNATIONAL: ['VXUS'],
  DEFENSIVE: ['XLV'],
  HEDGE: ['TLT']
} as const;

/**
 * Budget Constraints (v4.2)
 */
export const BUDGET_CONSTRAINTS = {
  MIN_MULTIPLIER: 0.5,    // Never invest less than 50% of base
  MAX_MULTIPLIER: 1.2,    // Never invest more than 120% of base
  BASE_BUDGET: 250,       // Base weekly budget
  MIN_BUDGET: 125,        // $250 × 0.5
  MAX_BUDGET: 300         // $250 × 1.2
} as const;

/**
 * CSS Indicator Weights (v4.2)
 * Total: 100%
 */
export const CSS_WEIGHTS = {
  VIX: 0.20,           // Market-wide fear indicator
  RSI: 0.25,           // Per-asset momentum
  BB_WIDTH: 0.15,      // Per-asset volatility
  MA50: 0.20,          // Per-asset trend/discount
  FEAR_GREED: 0.20     // Market-wide sentiment
} as const;

/**
 * CSS to Multiplier Mapping (v4.2)
 * Higher CSS = More fear/opportunity = Higher multiplier
 */
export const CSS_TO_MULTIPLIER: Array<{ maxCSS: number; multiplier: number }> = [
  { maxCSS: 20, multiplier: 0.5 },   // Extreme Greed - min buy
  { maxCSS: 35, multiplier: 0.6 },   // Greed
  { maxCSS: 50, multiplier: 0.8 },   // Slightly Greedy
  { maxCSS: 60, multiplier: 1.0 },   // Neutral
  { maxCSS: 75, multiplier: 1.2 },   // Fear - opportunity
  { maxCSS: 100, multiplier: 1.2 }   // Extreme Fear - capped at max
];

/**
 * VIX Score Thresholds (0-100 scale)
 * Higher VIX = Higher score
 */
export const VIX_SCORE_THRESHOLDS: Array<{ maxVIX: number; score: number }> = [
  { maxVIX: 15, score: 20 },    // Complacent
  { maxVIX: 20, score: 40 },    // Normal
  { maxVIX: 25, score: 60 },    // Elevated anxiety
  { maxVIX: 30, score: 75 },    // Fearful
  { maxVIX: 40, score: 90 },    // Very fearful
  { maxVIX: Infinity, score: 100 }  // Panic
];

/**
 * RSI Score Thresholds (0-100 scale)
 * Lower RSI = Higher score (oversold = opportunity)
 */
export const RSI_SCORE_THRESHOLDS: Array<{ maxRSI: number; score: number }> = [
  { maxRSI: 30, score: 100 },   // Oversold (great buy)
  { maxRSI: 40, score: 80 },    // Getting oversold
  { maxRSI: 50, score: 60 },    // Slightly bearish
  { maxRSI: 60, score: 40 },    // Slightly bullish
  { maxRSI: 70, score: 20 },    // Getting overbought
  { maxRSI: Infinity, score: 0 } // Overbought
];

/**
 * BB Width Score Thresholds (0-100 scale)
 * Higher volatility = Higher score (more opportunity)
 */
export const BB_WIDTH_SCORE_THRESHOLDS: Array<{ maxWidth: number; score: number }> = [
  { maxWidth: 5, score: 30 },     // Low volatility
  { maxWidth: 10, score: 50 },    // Moderate volatility
  { maxWidth: 15, score: 70 },    // High volatility
  { maxWidth: Infinity, score: 90 } // Very high volatility
];

/**
 * MA50 Score Thresholds (0-100 scale)
 * Based on price vs MA50 percentage deviation
 * Below MA50 = Discount = Higher score
 */
export const MA50_SCORE_THRESHOLDS: Array<{ maxDeviation: number; score: number }> = [
  { maxDeviation: -10, score: 90 },   // Big discount (price 10%+ below MA50)
  { maxDeviation: -5, score: 70 },    // Discount
  { maxDeviation: 5, score: 50 },     // Fair value
  { maxDeviation: 10, score: 30 },    // Slightly expensive
  { maxDeviation: Infinity, score: 10 } // Expensive
];

/**
 * Fear & Greed Index Score Thresholds (0-100 scale)
 * CNN F&G is 0-100 where low = fear, high = greed
 * We invert it: More fear = Higher score
 */
export const FEAR_GREED_SCORE_THRESHOLDS: Array<{ maxFG: number; score: number }> = [
  { maxFG: 25, score: 100 },    // Extreme Fear
  { maxFG: 45, score: 75 },     // Fear
  { maxFG: 55, score: 50 },     // Neutral
  { maxFG: 75, score: 25 },     // Greed
  { maxFG: 100, score: 0 }      // Extreme Greed
];

/**
 * History days needed for calculations
 */
export const HISTORY_DAYS = 100; // Enough for MA50 calculation (~70 trading days)
