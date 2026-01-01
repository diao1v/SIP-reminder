/**
 * Multiplier Thresholds Configuration
 * 
 * Based on the Five-Dimensional Dynamic Adjustment System specification:
 * Final Investment Amount = Base Amount × BB_Multiplier × VIX_Multiplier × RSI_Multiplier
 */

/**
 * VIX (Market Fear) Adjustment Thresholds
 * Higher VIX = More fear = Better buying opportunity
 * 
 * Strategy: "Buy when others are fearful"
 */
export const VIX_THRESHOLDS = {
  EXTREME_LOW: { max: 15, multiplier: 1.0 },      // Extreme confidence
  NORMAL: { min: 15, max: 20, multiplier: 1.0 },  // Normal market
  MODERATE_FEAR: { min: 20, max: 30, multiplier: 1.3 },  // Moderate fear, 30% increase
  SIGNIFICANT_FEAR: { min: 30, max: 40, multiplier: 1.8 },  // Significant fear, 80% increase
  SEVERE_FEAR: { min: 40, max: 50, multiplier: 2.3 },  // Severe fear, 130% increase
  EXTREME_CRISIS: { min: 50, multiplier: 3.0 }  // Extreme crisis, cautious doubling
} as const;

/**
 * RSI (Momentum) Adjustment Thresholds
 * Lower RSI = Oversold = Better buying opportunity
 * Higher RSI = Overbought = Pause investment
 */
export const RSI_THRESHOLDS = {
  OVERSOLD: { max: 30, multiplier: 1.5 },      // Premium buying opportunity
  NORMAL: { min: 30, max: 70, multiplier: 1.0 },  // Standard allocation
  OVERBOUGHT: { min: 70, multiplier: 0.0 }     // Pause/reduce (0x = skip)
} as const;

/**
 * Bollinger Bands Width Adjustment Thresholds
 * BB Width = (Upper - Lower) / Middle × 100%
 * Higher width = More volatility = More opportunities
 */
export const BB_WIDTH_THRESHOLDS = {
  LOW: { max: 5, multiplier: 1.0 },          // Stable market, normal allocation
  MODERATE: { min: 5, max: 10, multiplier: 1.15 },  // Moderate opportunities
  HIGH: { min: 10, multiplier: 1.35 }        // High volatility, more opportunities
} as const;

/**
 * Base Allocation Percentages per Asset
 * Total must equal 100%
 * Note: XLV and XLP share the 15% defensive allocation - only one is selected per week
 */
export const BASE_ALLOCATIONS: Record<string, number> = {
  'QQQ': 25,   // Tech ETF
  'GOOG': 25,  // Google
  'TSLA': 20,  // Tesla
  'AIQ': 15,   // AI ETF
  'XLV': 15,   // Defensive option 1 (Healthcare ETF)
  'XLP': 15    // Defensive option 2 (Consumer Staples ETF)
} as const;

/**
 * Defensive allocation percentage
 */
export const DEFENSIVE_ALLOCATION_PERCENTAGE = 15;

/**
 * Asset Categories for Rotation
 */
export const ASSET_CATEGORIES = {
  AGGRESSIVE: ['QQQ', 'GOOG', 'TSLA', 'AIQ'],
  DEFENSIVE: ['XLV', 'XLP']  // Healthcare or Consumer Staples - choose one based on indicators
} as const;

/**
 * Defensive Rotation Thresholds
 * When to increase defensive allocation
 */
export const DEFENSIVE_ROTATION = {
  VIX_THRESHOLD: 30,           // VIX > 30 triggers defensive rotation
  AVG_RSI_THRESHOLD: 75,       // Average RSI > 75 triggers defensive rotation
  DEFENSIVE_INCREASE: 1.5      // 50% increase to defensive assets
} as const;
