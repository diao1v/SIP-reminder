export interface MarketData {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: Date;
}

export interface TechnicalIndicators {
  rsi: number;
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  bbWidth: number;      // Bollinger Bands Width percentage
  atr: number;
  ma20: number;         // 20-day Moving Average
  ma50: number;         // 50-day Moving Average (for CSS)
  ma50Slope: number;    // MA50 trend slope (v4.3) - positive = uptrend, negative = downtrend
}

/**
 * CSS (Composite Signal Score) Breakdown
 * Shows individual indicator scores and final CSS
 */
export interface CSSBreakdown {
  // Individual indicator scores (0-100)
  vixScore: number;
  rsiScore: number;
  bbWidthScore: number;
  ma50Score: number;              // Base score before slope adjustment
  ma50ScoreAdjusted: number;      // Final score after slope bonus (v4.3)
  fearGreedScore: number | null;  // null if fetching failed

  // Raw indicator values for reference
  vixValue: number;
  rsiValue: number;
  bbWidthValue: number;
  ma50DeviationPercent: number;   // Price vs MA50 deviation %
  ma50Slope: number;              // MA50 trend slope (v4.3)
  ma50SlopeBonus: number;         // Slope bonus applied (-15 to +15) (v4.3)
  fearGreedValue: number | null;

  // Calculated values
  totalCSS: number;               // Weighted sum (0-100)
  multiplier: number;             // CSS mapped to 0.5-1.2

  // Status flags
  fearGreedFailed: boolean;       // True if CNN scraping failed
  weightsAdjusted: boolean;       // True if weights were adjusted due to F&G failure (v4.3)
}

export interface StockAnalysis {
  symbol: string;
  marketData: MarketData;
  technicalIndicators: TechnicalIndicators;
  cssBreakdown: CSSBreakdown;     // CSS scoring for this asset
  signal: 'BUY' | 'HOLD';         // No SELL - we never fully stop
  strength: number;               // 0-100
}

export interface PortfolioAllocation {
  symbol: string;
  amount: number;
  percentage: number;
  reasoning: string;
  baseAmount: number;             // Base allocation before CSS adjustment
  cssScore: number;               // Asset's CSS score
  multiplier: number;             // CSS-derived multiplier
}

export interface AllocationReport {
  date: Date;
  totalAmount: number;            // Actual total after CSS adjustment
  baseBudget: number;             // Base weekly budget ($250)
  minBudget: number;              // Minimum allowed ($125)
  maxBudget: number;              // Maximum allowed ($300)
  
  // Market-wide indicators
  vix: number;
  fearGreedIndex: number | null;
  fearGreedFailed: boolean;
  
  // Overall CSS (market-wide component)
  marketCSS: number;
  
  marketCondition: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  allocations: PortfolioAllocation[];
  recommendations: string[];
  technicalData?: TechnicalDataRow[];
  
  // Data source tracking
  dataSourceStatus?: DataSourceStatus;
}

export interface TechnicalDataRow {
  symbol: string;
  price: number;
  rsi: number;
  ma20: number;
  ma50: number;
  atr: number;
  bbWidth: number;
  ma50Deviation: number;          // Price vs MA50 deviation %
  cssScore: number;               // Asset's CSS score
  multiplier: number;             // CSS-derived multiplier
}

export interface Config {
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
  emailTo: string[];
  weeklyInvestmentAmount: number;
  defaultStocks: string[];
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  port: number;
  cronSchedule: string;
  minBudget: number;              // Minimum weekly budget ($125)
  maxBudget: number;              // Maximum weekly budget ($300)
  convexUrl: string;              // Convex database URL (optional)
}

/**
 * Asset allocation configuration
 */
export interface AssetAllocationConfig {
  symbol: string;
  basePercentage: number;
  category: 'growth' | 'international' | 'defensive' | 'hedge';
}

/**
 * Fear & Greed API response
 */
export interface FearGreedResponse {
  value: number;        // 0-100
  rating: string;       // "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"
  timestamp: Date;
  success: boolean;
}

/**
 * Data source status tracking
 * Shows which data sources were used (primary library or fallback)
 */
export interface DataSourceStatus {
  marketDataSource: 'yahoo-finance2' | 'axios-fallback';
  indicatorSource: 'technicalindicators' | 'custom-fallback';
}

/**
 * Extended market data with source tracking
 */
export interface MarketDataWithSource extends MarketData {
  dataSource: 'yahoo-finance2' | 'axios-fallback';
}

/**
 * Extended technical indicators with source tracking
 */
export interface TechnicalIndicatorsWithSource extends TechnicalIndicators {
  dataSource: 'technicalindicators' | 'custom-fallback';
}

/**
 * Database save result
 */
export interface DatabaseSaveResult {
  success: boolean;
  snapshotId?: string;
  stockAnalysesCount?: number;
  error?: string;
}

/**
 * Extended AllocationReport with optional database tracking
 */
export interface AllocationReportWithDb extends AllocationReport {
  snapshotId?: string;
  savedToDatabase?: boolean;
}
