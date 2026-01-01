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
  atr: number;
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
}

export interface AllocationReport {
  date: Date;
  totalAmount: number;
  vix: number;
  marketCondition: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  allocations: PortfolioAllocation[];
  recommendations: string[];
}

export interface Config {
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
  emailTo: string;
  weeklyInvestmentAmount: number;
  defaultStocks: string[];
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
}
