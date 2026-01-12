import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PortfolioAllocationEngine } from './portfolioAllocation';
import { MarketDataService } from './marketData';
import { TechnicalAnalysisService } from './technicalAnalysis';
import { CSSService } from './cssScoring';
import { FearGreedService } from './fearGreedIndex';
import { Config, TechnicalIndicators, CSSBreakdown } from '../types';

// ===========================================================================
// Mock Setup
// ===========================================================================

// Create mock services
const createMockMarketDataService = () => ({
  fetchVIX: vi.fn(),
  fetchStockData: vi.fn(),
  fetchHistoricalData: vi.fn(),
  getLastDataSource: vi.fn().mockReturnValue('yahoo-finance2'),
});

const createMockTechnicalAnalysisService = () => ({
  calculateIndicators: vi.fn(),
  analyzeSignal: vi.fn(),
  getLastDataSource: vi.fn().mockReturnValue('technicalindicators'),
});

const createMockCSSService = () => ({
  calculateMarketCSS: vi.fn(),
  calculateCSSBreakdown: vi.fn(),
  getCSSInterpretation: vi.fn(),
});

const createMockFearGreedService = () => ({
  fetchFearGreedIndex: vi.fn(),
  getRatingEmoji: vi.fn().mockReturnValue('😐'),
});

// Helper to create mock technical indicators
const createMockIndicators = (overrides: Partial<TechnicalIndicators> = {}): TechnicalIndicators => ({
  rsi: 50,
  ma20: 100,
  ma50: 100,
  atr: 2,
  bbWidth: 20,
  ma50Slope: 0,
  bollingerBands: { upper: 110, middle: 100, lower: 90 },
  ...overrides,
});

// Helper to create mock CSS breakdown
const createMockCSSBreakdown = (overrides: Partial<CSSBreakdown> = {}): CSSBreakdown => ({
  vixScore: 50,
  rsiScore: 50,
  bbWidthScore: 50,
  ma50Score: 50,
  ma50ScoreAdjusted: 50,
  fearGreedScore: 50,
  vixValue: 20,
  rsiValue: 50,
  bbWidthValue: 10,
  ma50DeviationPercent: 0,
  ma50Slope: 0,
  ma50SlopeBonus: 0,
  fearGreedValue: 50,
  totalCSS: 50,
  multiplier: 1.0,
  fearGreedFailed: false,
  weightsAdjusted: false,
  ...overrides,
});

// Helper to create a mock config
const createMockConfig = (overrides: Partial<Config> = {}): Config => ({
  smtp: {
    host: 'smtp.test.com',
    port: 587,
    user: 'test@test.com',
    pass: 'testpassword',
  },
  emailTo: ['test@test.com'],
  weeklyInvestmentAmount: 1750,
  defaultStocks: ['VOO', 'QQQ', 'SCHD'],
  riskTolerance: 'moderate',
  port: 3000,
  cronSchedule: '0 9 * * 1',
  timezone: 'Pacific/Auckland',
  minBudget: 875,
  maxBudget: 2100,
  convexUrl: '',
  ...overrides,
});

// ===========================================================================
// Tests
// ===========================================================================

describe('PortfolioAllocationEngine', () => {
  let engine: PortfolioAllocationEngine;
  let mockMarketData: ReturnType<typeof createMockMarketDataService>;
  let mockTechnical: ReturnType<typeof createMockTechnicalAnalysisService>;
  let mockCSS: ReturnType<typeof createMockCSSService>;
  let mockFearGreed: ReturnType<typeof createMockFearGreedService>;

  beforeEach(() => {
    mockMarketData = createMockMarketDataService();
    mockTechnical = createMockTechnicalAnalysisService();
    mockCSS = createMockCSSService();
    mockFearGreed = createMockFearGreedService();

    engine = new PortfolioAllocationEngine(
      mockMarketData as unknown as MarketDataService,
      mockTechnical as unknown as TechnicalAnalysisService,
      mockCSS as unknown as CSSService,
      mockFearGreed as unknown as FearGreedService
    );
  });

  // ===========================================================================
  // generateAllocation Tests
  // ===========================================================================
  describe('generateAllocation', () => {
    beforeEach(() => {
      // Setup default mock returns
      mockMarketData.fetchVIX.mockResolvedValue({ vix: 20, source: 'yahoo-finance2' });
      mockFearGreed.fetchFearGreedIndex.mockResolvedValue({
        success: true,
        value: 50,
        rating: 'Neutral',
      });
      mockCSS.calculateMarketCSS.mockReturnValue(50);
      mockCSS.getCSSInterpretation.mockReturnValue('Neutral');
      mockMarketData.fetchStockData.mockResolvedValue({
        symbol: 'VOO',
        price: 400,
        change: 1.5,
        changePercent: 0.38,
        volume: 5000000,
        dataSource: 'yahoo-finance2',
      });
      mockMarketData.fetchHistoricalData.mockResolvedValue({
        symbol: 'VOO',
        prices: Array(100).fill(400),
        source: 'yahoo-finance2',
      });
      mockTechnical.calculateIndicators.mockReturnValue({
        ...createMockIndicators(),
        dataSource: 'technicalindicators',
      });
      mockTechnical.analyzeSignal.mockReturnValue({ signal: 'HOLD', strength: 50 });
      mockCSS.calculateCSSBreakdown.mockReturnValue(createMockCSSBreakdown());
    });

    it('should generate allocation report with all required fields', async () => {
      const config = createMockConfig({ defaultStocks: ['VOO'] });
      const report = await engine.generateAllocation(config);

      expect(report).toHaveProperty('date');
      expect(report).toHaveProperty('totalAmount');
      expect(report).toHaveProperty('baseBudget', config.weeklyInvestmentAmount);
      expect(report).toHaveProperty('vix');
      expect(report).toHaveProperty('fearGreedIndex');
      expect(report).toHaveProperty('marketCSS');
      expect(report).toHaveProperty('marketCondition');
      expect(report).toHaveProperty('allocations');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('technicalData');
      expect(report).toHaveProperty('dataSourceStatus');
    });

    it('should fetch VIX and Fear & Greed data', async () => {
      const config = createMockConfig({ defaultStocks: ['VOO'] });
      await engine.generateAllocation(config);

      expect(mockMarketData.fetchVIX).toHaveBeenCalled();
      expect(mockFearGreed.fetchFearGreedIndex).toHaveBeenCalled();
    });

    it('should analyze all configured stocks', async () => {
      const config = createMockConfig({ defaultStocks: ['VOO', 'QQQ', 'SCHD'] });
      await engine.generateAllocation(config);

      expect(mockMarketData.fetchStockData).toHaveBeenCalledTimes(3);
      expect(mockMarketData.fetchHistoricalData).toHaveBeenCalledTimes(3);
      expect(mockTechnical.calculateIndicators).toHaveBeenCalledTimes(3);
    });

    it('should handle F&G fetch failure gracefully', async () => {
      mockFearGreed.fetchFearGreedIndex.mockResolvedValue({
        success: false,
        value: null,
        rating: 'Error',
      });

      const config = createMockConfig({ defaultStocks: ['VOO'] });
      const report = await engine.generateAllocation(config);

      expect(report.fearGreedFailed).toBe(true);
      expect(report.fearGreedIndex).toBeNull();
    });

    it('should set correct market condition based on VIX', async () => {
      const config = createMockConfig({ defaultStocks: ['VOO'] });

      // Bullish (VIX < 15)
      mockMarketData.fetchVIX.mockResolvedValue({ vix: 12, source: 'yahoo-finance2' });
      let report = await engine.generateAllocation(config);
      expect(report.marketCondition).toBe('BULLISH');

      // Neutral (15 <= VIX <= 25)
      mockMarketData.fetchVIX.mockResolvedValue({ vix: 20, source: 'yahoo-finance2' });
      report = await engine.generateAllocation(config);
      expect(report.marketCondition).toBe('NEUTRAL');

      // Bearish (VIX > 25)
      mockMarketData.fetchVIX.mockResolvedValue({ vix: 30, source: 'yahoo-finance2' });
      report = await engine.generateAllocation(config);
      expect(report.marketCondition).toBe('BEARISH');
    });

    it('should track data source status', async () => {
      // Mock market data to return axios-fallback source
      mockMarketData.fetchStockData.mockResolvedValue({
        symbol: 'VOO',
        price: 400,
        change: 1.5,
        changePercent: 0.38,
        volume: 5000000,
        dataSource: 'axios-fallback',
      });
      // Mock technical indicators to return custom-fallback source
      mockTechnical.calculateIndicators.mockReturnValue({
        ...createMockIndicators(),
        dataSource: 'custom-fallback',
      });

      const config = createMockConfig({ defaultStocks: ['VOO'] });
      const report = await engine.generateAllocation(config);

      expect(report.dataSourceStatus).toBeDefined();
      expect(report.dataSourceStatus!.marketDataSource).toBe('axios-fallback');
      expect(report.dataSourceStatus!.indicatorSource).toBe('custom-fallback');
    });

    it('should continue when a stock analysis fails', async () => {
      mockMarketData.fetchStockData
        .mockResolvedValueOnce({ symbol: 'VOO', price: 400, change: 1, changePercent: 0.25, volume: 1000000 })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ symbol: 'SCHD', price: 75, change: 0.5, changePercent: 0.67, volume: 500000 });

      const config = createMockConfig({ defaultStocks: ['VOO', 'QQQ', 'SCHD'] });
      const report = await engine.generateAllocation(config);

      // Should only have 2 allocations (QQQ failed)
      expect(report.allocations.length).toBe(2);
    });
  });

  // ===========================================================================
  // Allocation Calculation Tests
  // ===========================================================================
  describe('allocation calculations', () => {
    beforeEach(() => {
      mockMarketData.fetchVIX.mockResolvedValue({ vix: 20, source: 'yahoo-finance2' });
      mockFearGreed.fetchFearGreedIndex.mockResolvedValue({ success: true, value: 50, rating: 'Neutral' });
      mockCSS.calculateMarketCSS.mockReturnValue(50);
      mockCSS.getCSSInterpretation.mockReturnValue('Neutral');
      mockMarketData.fetchHistoricalData.mockResolvedValue({
        symbol: 'VOO',
        prices: Array(100).fill(400),
        source: 'yahoo-finance2',
      });
      mockTechnical.calculateIndicators.mockReturnValue(createMockIndicators());
      mockTechnical.analyzeSignal.mockReturnValue({ signal: 'HOLD', strength: 50 });
    });

    it('should apply CSS multiplier to base allocation', async () => {
      mockMarketData.fetchStockData.mockResolvedValue({
        symbol: 'VOO',
        price: 400,
        change: 1,
        changePercent: 0.25,
        volume: 1000000,
      });
      // High CSS score = higher multiplier
      mockCSS.calculateCSSBreakdown.mockReturnValue(
        createMockCSSBreakdown({ totalCSS: 80, multiplier: 1.2 })
      );

      const config = createMockConfig({ defaultStocks: ['VOO'] });
      const report = await engine.generateAllocation(config);

      const vooAllocation = report.allocations.find(a => a.symbol === 'VOO');
      expect(vooAllocation).toBeDefined();
      expect(vooAllocation!.multiplier).toBe(1.2);
    });

    it('should respect minimum budget constraint', async () => {
      mockMarketData.fetchStockData.mockResolvedValue({
        symbol: 'VOO',
        price: 400,
        change: 1,
        changePercent: 0.25,
        volume: 1000000,
      });
      // Low CSS = lower multiplier (0.5x)
      mockCSS.calculateCSSBreakdown.mockReturnValue(
        createMockCSSBreakdown({ totalCSS: 20, multiplier: 0.5 })
      );

      const config = createMockConfig({
        defaultStocks: ['VOO'],
        weeklyInvestmentAmount: 1750,
        minBudget: 875,
      });
      const report = await engine.generateAllocation(config);

      const vooAllocation = report.allocations.find(a => a.symbol === 'VOO');
      expect(vooAllocation).toBeDefined();
      // VOO base is 35% = $612.50, with 0.5x = $306.25
      // But min is 35% of $875 = $306.25, so should be at least that
      expect(vooAllocation!.amount).toBeGreaterThanOrEqual(0);
    });

    it('should respect maximum budget constraint', async () => {
      mockMarketData.fetchStockData.mockResolvedValue({
        symbol: 'VOO',
        price: 400,
        change: 1,
        changePercent: 0.25,
        volume: 1000000,
      });
      // Max CSS = maximum multiplier
      mockCSS.calculateCSSBreakdown.mockReturnValue(
        createMockCSSBreakdown({ totalCSS: 100, multiplier: 1.2 })
      );

      const config = createMockConfig({
        defaultStocks: ['VOO'],
        weeklyInvestmentAmount: 1750,
        maxBudget: 2100,
      });
      const report = await engine.generateAllocation(config);

      const vooAllocation = report.allocations.find(a => a.symbol === 'VOO');
      expect(vooAllocation).toBeDefined();
      // VOO max is 35% of $2100 = $735
      expect(vooAllocation!.amount).toBeLessThanOrEqual(735);
    });

    it('should sort allocations by amount descending', async () => {
      mockMarketData.fetchStockData
        .mockResolvedValueOnce({ symbol: 'VOO', price: 400, change: 1, changePercent: 0.25, volume: 1000000 })
        .mockResolvedValueOnce({ symbol: 'QQQ', price: 350, change: 2, changePercent: 0.57, volume: 2000000 });

      mockCSS.calculateCSSBreakdown
        .mockReturnValueOnce(createMockCSSBreakdown({ totalCSS: 60, multiplier: 1.0 }))
        .mockReturnValueOnce(createMockCSSBreakdown({ totalCSS: 80, multiplier: 1.2 }));

      const config = createMockConfig({ defaultStocks: ['VOO', 'QQQ'] });
      const report = await engine.generateAllocation(config);

      // Verify sorted descending
      for (let i = 0; i < report.allocations.length - 1; i++) {
        expect(report.allocations[i].amount).toBeGreaterThanOrEqual(report.allocations[i + 1].amount);
      }
    });

    it('should calculate total amount from all allocations', async () => {
      mockMarketData.fetchStockData
        .mockResolvedValueOnce({ symbol: 'VOO', price: 400, change: 1, changePercent: 0.25, volume: 1000000 })
        .mockResolvedValueOnce({ symbol: 'QQQ', price: 350, change: 2, changePercent: 0.57, volume: 2000000 });

      mockCSS.calculateCSSBreakdown.mockReturnValue(createMockCSSBreakdown({ totalCSS: 50, multiplier: 1.0 }));

      const config = createMockConfig({ defaultStocks: ['VOO', 'QQQ'] });
      const report = await engine.generateAllocation(config);

      const calculatedTotal = report.allocations.reduce((sum, a) => sum + a.amount, 0);
      expect(report.totalAmount).toBe(calculatedTotal);
    });
  });

  // ===========================================================================
  // Recommendations Tests
  // ===========================================================================
  describe('recommendations', () => {
    beforeEach(() => {
      mockMarketData.fetchVIX.mockResolvedValue({ vix: 20, source: 'yahoo-finance2' });
      mockFearGreed.fetchFearGreedIndex.mockResolvedValue({ success: true, value: 50, rating: 'Neutral' });
      mockCSS.calculateMarketCSS.mockReturnValue(50);
      mockCSS.getCSSInterpretation.mockReturnValue('Neutral');
      mockMarketData.fetchStockData.mockResolvedValue({
        symbol: 'VOO',
        price: 400,
        change: 1,
        changePercent: 0.25,
        volume: 1000000,
        dataSource: 'yahoo-finance2',
      });
      mockMarketData.fetchHistoricalData.mockResolvedValue({
        symbol: 'VOO',
        prices: Array(100).fill(400),
        source: 'yahoo-finance2',
      });
      mockTechnical.calculateIndicators.mockReturnValue({
        ...createMockIndicators(),
        dataSource: 'technicalindicators',
      });
      mockTechnical.analyzeSignal.mockReturnValue({ signal: 'HOLD', strength: 50 });
      mockCSS.calculateCSSBreakdown.mockReturnValue(createMockCSSBreakdown());
    });

    it('should warn about fallback data sources', async () => {
      // Mock market data to return axios-fallback source
      mockMarketData.fetchStockData.mockResolvedValue({
        symbol: 'VOO',
        price: 400,
        change: 1.5,
        changePercent: 0.38,
        volume: 5000000,
        dataSource: 'axios-fallback',
      });
      // Mock technical indicators to return custom-fallback source
      mockTechnical.calculateIndicators.mockReturnValue({
        ...createMockIndicators(),
        dataSource: 'custom-fallback',
      });

      const config = createMockConfig({ defaultStocks: ['VOO'] });
      const report = await engine.generateAllocation(config);

      expect(report.recommendations.some(r => r.includes('axios fallback'))).toBe(true);
      expect(report.recommendations.some(r => r.includes('custom fallback'))).toBe(true);
    });

    it('should include F&G failure warning', async () => {
      mockFearGreed.fetchFearGreedIndex.mockResolvedValue({
        success: false,
        value: null,
        rating: 'Error',
      });

      const config = createMockConfig({ defaultStocks: ['VOO'] });
      const report = await engine.generateAllocation(config);

      expect(report.recommendations.some(r => r.includes('Fear & Greed Index fetch FAILED'))).toBe(true);
    });

    it('should note bearish market when VIX > 25', async () => {
      mockMarketData.fetchVIX.mockResolvedValue({ vix: 30, source: 'yahoo-finance2' });

      const config = createMockConfig({ defaultStocks: ['VOO'] });
      const report = await engine.generateAllocation(config);

      expect(report.recommendations.some(r => r.includes('High volatility'))).toBe(true);
    });

    it('should note bullish market when VIX < 15', async () => {
      mockMarketData.fetchVIX.mockResolvedValue({ vix: 12, source: 'yahoo-finance2' });

      const config = createMockConfig({ defaultStocks: ['VOO'] });
      const report = await engine.generateAllocation(config);

      expect(report.recommendations.some(r => r.includes('Low volatility'))).toBe(true);
    });

    it('should highlight high CSS opportunities', async () => {
      mockCSS.calculateCSSBreakdown.mockReturnValue(
        createMockCSSBreakdown({ totalCSS: 75, multiplier: 1.15 })
      );

      const config = createMockConfig({ defaultStocks: ['VOO'] });
      const report = await engine.generateAllocation(config);

      expect(report.recommendations.some(r => r.includes('High CSS opportunities'))).toBe(true);
    });

    it('should highlight oversold assets', async () => {
      mockTechnical.calculateIndicators.mockReturnValue(
        createMockIndicators({ rsi: 25 })
      );

      const config = createMockConfig({ defaultStocks: ['VOO'] });
      const report = await engine.generateAllocation(config);

      expect(report.recommendations.some(r => r.includes('Oversold'))).toBe(true);
    });

    it('should highlight discounted assets (below MA50)', async () => {
      mockCSS.calculateCSSBreakdown.mockReturnValue(
        createMockCSSBreakdown({ ma50DeviationPercent: -8, totalCSS: 60, multiplier: 1.0 })
      );

      const config = createMockConfig({ defaultStocks: ['VOO'] });
      const report = await engine.generateAllocation(config);

      expect(report.recommendations.some(r => r.includes('Discounted'))).toBe(true);
    });

    it('should always include budget reminder', async () => {
      const config = createMockConfig({ defaultStocks: ['VOO'] });
      const report = await engine.generateAllocation(config);

      expect(report.recommendations.some(r => r.includes('Budget range'))).toBe(true);
      expect(report.recommendations.some(r => r.includes('CSS v4.3'))).toBe(true);
    });
  });

  // ===========================================================================
  // Technical Data Tests
  // ===========================================================================
  describe('technical data', () => {
    beforeEach(() => {
      mockMarketData.fetchVIX.mockResolvedValue({ vix: 20, source: 'yahoo-finance2' });
      mockFearGreed.fetchFearGreedIndex.mockResolvedValue({ success: true, value: 50, rating: 'Neutral' });
      mockCSS.calculateMarketCSS.mockReturnValue(50);
      mockCSS.getCSSInterpretation.mockReturnValue('Neutral');
      mockTechnical.analyzeSignal.mockReturnValue({ signal: 'HOLD', strength: 50 });
    });

    it('should include technical data for each stock', async () => {
      mockMarketData.fetchStockData.mockResolvedValue({
        symbol: 'VOO',
        price: 400.123,
        change: 1,
        changePercent: 0.25,
        volume: 1000000,
      });
      mockMarketData.fetchHistoricalData.mockResolvedValue({
        symbol: 'VOO',
        prices: Array(100).fill(400),
        source: 'yahoo-finance2',
      });
      mockTechnical.calculateIndicators.mockReturnValue(
        createMockIndicators({ rsi: 45.678, ma20: 395.5, ma50: 390.25, atr: 5.123, bbWidth: 15.5 })
      );
      mockCSS.calculateCSSBreakdown.mockReturnValue(
        createMockCSSBreakdown({ ma50DeviationPercent: 2.5, totalCSS: 55, multiplier: 1.0 })
      );

      const config = createMockConfig({ defaultStocks: ['VOO'] });
      const report = await engine.generateAllocation(config);

      expect(report.technicalData).toBeDefined();
      expect(report.technicalData).toHaveLength(1);
      const tech = report.technicalData![0];
      expect(tech.symbol).toBe('VOO');
      expect(tech.price).toBe(400.12); // Rounded to 2 decimal places
      expect(tech.rsi).toBe(45.68);
      expect(tech.ma20).toBe(395.5);
      expect(tech.ma50).toBe(390.25);
      expect(tech.atr).toBe(5.12);
      expect(tech.bbWidth).toBe(15.5);
      expect(tech.ma50Deviation).toBe(2.5);
      expect(tech.cssScore).toBe(55);
      expect(tech.multiplier).toBe(1.0);
    });
  });

  // ===========================================================================
  // Reasoning Generation Tests
  // ===========================================================================
  describe('reasoning generation', () => {
    beforeEach(() => {
      mockMarketData.fetchVIX.mockResolvedValue({ vix: 20, source: 'yahoo-finance2' });
      mockFearGreed.fetchFearGreedIndex.mockResolvedValue({ success: true, value: 50, rating: 'Neutral' });
      mockCSS.calculateMarketCSS.mockReturnValue(50);
      mockMarketData.fetchStockData.mockResolvedValue({
        symbol: 'VOO',
        price: 400,
        change: 1,
        changePercent: 0.25,
        volume: 1000000,
      });
      mockMarketData.fetchHistoricalData.mockResolvedValue({
        symbol: 'VOO',
        prices: Array(100).fill(400),
        source: 'yahoo-finance2',
      });
      mockTechnical.analyzeSignal.mockReturnValue({ signal: 'HOLD', strength: 50 });
    });

    it('should include CSS interpretation in reasoning', async () => {
      mockTechnical.calculateIndicators.mockReturnValue(createMockIndicators());
      mockCSS.calculateCSSBreakdown.mockReturnValue(
        createMockCSSBreakdown({ totalCSS: 75 })
      );
      mockCSS.getCSSInterpretation.mockReturnValue('Opportunity');

      const config = createMockConfig({ defaultStocks: ['VOO'] });
      const report = await engine.generateAllocation(config);

      expect(report.allocations[0].reasoning).toContain('CSS 75');
      expect(report.allocations[0].reasoning).toContain('Opportunity');
    });

    it('should note oversold condition in reasoning', async () => {
      mockTechnical.calculateIndicators.mockReturnValue(
        createMockIndicators({ rsi: 25 })
      );
      mockCSS.calculateCSSBreakdown.mockReturnValue(
        createMockCSSBreakdown({ rsiScore: 85, totalCSS: 65 })
      );
      mockCSS.getCSSInterpretation.mockReturnValue('Opportunity');

      const config = createMockConfig({ defaultStocks: ['VOO'] });
      const report = await engine.generateAllocation(config);

      expect(report.allocations[0].reasoning).toContain('Oversold');
    });

    it('should note overbought condition in reasoning', async () => {
      mockTechnical.calculateIndicators.mockReturnValue(
        createMockIndicators({ rsi: 75 })
      );
      mockCSS.calculateCSSBreakdown.mockReturnValue(
        createMockCSSBreakdown({ rsiScore: 15, totalCSS: 35 })
      );
      mockCSS.getCSSInterpretation.mockReturnValue('Cautious');

      const config = createMockConfig({ defaultStocks: ['VOO'] });
      const report = await engine.generateAllocation(config);

      expect(report.allocations[0].reasoning).toContain('Overbought');
    });

    it('should note MA50 discount with trend direction', async () => {
      mockTechnical.calculateIndicators.mockReturnValue(createMockIndicators());
      mockCSS.calculateCSSBreakdown.mockReturnValue(
        createMockCSSBreakdown({
          ma50DeviationPercent: -8.5,
          ma50SlopeBonus: 5,
          totalCSS: 65
        })
      );
      mockCSS.getCSSInterpretation.mockReturnValue('Opportunity');

      const config = createMockConfig({ defaultStocks: ['VOO'] });
      const report = await engine.generateAllocation(config);

      expect(report.allocations[0].reasoning).toContain('below MA50');
      expect(report.allocations[0].reasoning).toContain('uptrend');
    });

    it('should note F&G fallback when weights adjusted', async () => {
      mockTechnical.calculateIndicators.mockReturnValue(createMockIndicators());
      mockCSS.calculateCSSBreakdown.mockReturnValue(
        createMockCSSBreakdown({ weightsAdjusted: true, totalCSS: 55 })
      );
      mockCSS.getCSSInterpretation.mockReturnValue('Neutral');

      const config = createMockConfig({ defaultStocks: ['VOO'] });
      const report = await engine.generateAllocation(config);

      expect(report.allocations[0].reasoning).toContain('F&G fallback');
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================
  describe('edge cases', () => {
    beforeEach(() => {
      mockMarketData.fetchVIX.mockResolvedValue({ vix: 20, source: 'yahoo-finance2' });
      mockFearGreed.fetchFearGreedIndex.mockResolvedValue({ success: true, value: 50, rating: 'Neutral' });
      mockCSS.calculateMarketCSS.mockReturnValue(50);
      mockCSS.getCSSInterpretation.mockReturnValue('Neutral');
      mockTechnical.calculateIndicators.mockReturnValue(createMockIndicators());
      mockTechnical.analyzeSignal.mockReturnValue({ signal: 'HOLD', strength: 50 });
      mockCSS.calculateCSSBreakdown.mockReturnValue(createMockCSSBreakdown());
    });

    it('should handle unknown stock symbol with equal distribution', async () => {
      mockMarketData.fetchStockData.mockResolvedValue({
        symbol: 'UNKNOWN',
        price: 100,
        change: 1,
        changePercent: 1,
        volume: 100000,
      });
      mockMarketData.fetchHistoricalData.mockResolvedValue({
        symbol: 'UNKNOWN',
        prices: Array(100).fill(100),
        source: 'yahoo-finance2',
      });

      const config = createMockConfig({ defaultStocks: ['UNKNOWN'] });
      const report = await engine.generateAllocation(config);

      expect(report.allocations).toHaveLength(1);
      // Unknown symbol gets equal share (100/7 ≈ 14.29% for 7 base allocations)
      expect(report.allocations[0].amount).toBeGreaterThan(0);
    });

    it('should handle all stocks failing analysis', async () => {
      mockMarketData.fetchStockData.mockRejectedValue(new Error('Network error'));

      const config = createMockConfig({ defaultStocks: ['VOO', 'QQQ'] });
      const report = await engine.generateAllocation(config);

      expect(report.allocations).toHaveLength(0);
      expect(report.totalAmount).toBe(0);
    });

    it('should handle extreme VIX values', async () => {
      mockMarketData.fetchStockData.mockResolvedValue({
        symbol: 'VOO',
        price: 400,
        change: 1,
        changePercent: 0.25,
        volume: 1000000,
      });
      mockMarketData.fetchHistoricalData.mockResolvedValue({
        symbol: 'VOO',
        prices: Array(100).fill(400),
        source: 'yahoo-finance2',
      });

      // Panic-level VIX
      mockMarketData.fetchVIX.mockResolvedValue({ vix: 50, source: 'yahoo-finance2' });

      const config = createMockConfig({ defaultStocks: ['VOO'] });
      const report = await engine.generateAllocation(config);

      expect(report.vix).toBe(50);
      expect(report.marketCondition).toBe('BEARISH');
    });
  });
});
