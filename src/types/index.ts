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
  bbWidth?: number;  // Bollinger Bands Width percentage
  atr: number;
  ma20?: number;     // 20-day Moving Average
}

export interface StockAnalysis {
  symbol: string;
  marketData: MarketData;
  technicalIndicators: TechnicalIndicators;
  signal: 'BUY' | 'SELL' | 'HOLD';
  strength: number; // 0-100
}

export interface PortfolioAllocation {
  symbol: string;
  amount: number;
  percentage: number;
  reasoning: string;
  baseAmount?: number;        // Base allocation before adjustments
  multiplier?: number;        // Combined multiplier applied
  rsiRecommendation?: string; // RSI-based recommendation label
}

export interface AllocationReport {
  date: Date;
  totalAmount: number;
  vix: number;
  vixMultiplier?: number;     // VIX adjustment multiplier
  marketCondition: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  allocations: PortfolioAllocation[];
  recommendations: string[];
  technicalData?: TechnicalDataRow[];  // Detailed technical reference
}

export interface TechnicalDataRow {
  symbol: string;
  price: number;
  rsi: number;
  ma20: number;
  atr: number;
  bbWidth: number;
  entryPoint: number;
  isGoodEntry: boolean;
}

export interface Config {
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
  emailTo: string[];  // Support multiple recipients
  weeklyInvestmentAmount: number;
  defaultStocks: string[];
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  port: number;
  cronSchedule: string;
}

/**
 * Asset allocation configuration
 */
export interface AssetAllocationConfig {
  symbol: string;
  basePercentage: number;
  category: 'aggressive' | 'defensive';
}
