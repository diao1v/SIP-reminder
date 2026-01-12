import * as dotenv from 'dotenv';
import { Config } from '../types';
import { BUDGET_CONSTRAINTS } from './multiplierThresholds';

dotenv.config();

/**
 * Default portfolio per CSS Strategy v4.2:
 * QQQ 25% | GOOG 17.5% | AIQ 15% | TSLA 7.5% | XLV 10% | VXUS 10% | TLT 15%
 */
const DEFAULT_STOCKS = ['QQQ', 'GOOG', 'AIQ', 'TSLA', 'XLV', 'VXUS', 'TLT'];

/**
 * Default weekly investment amount (NZD)
 */
const DEFAULT_INVESTMENT_AMOUNT = BUDGET_CONSTRAINTS.BASE_BUDGET;

/**
 * Default server port
 */
const DEFAULT_PORT = 3002;

/**
 * Default cron schedule: Wednesday at 8pm NZST
 * Format: minute hour dayOfMonth month dayOfWeek
 */
const DEFAULT_CRON_SCHEDULE = '0 20 * * 3';

/**
 * Load configuration from environment variables
 */
export function loadConfig(): Config {
  const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_TO'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.warn(`⚠️  Warning: Missing environment variables: ${missing.join(', ')}`);
    console.warn('⚠️  Using default/test configuration. Please configure .env file for production use.');
  }

  // Convex URL is optional - database features disabled if not set
  const convexUrl = process.env.CONVEX_URL || '';
  if (!convexUrl) {
    console.warn('⚠️  CONVEX_URL not set - database features disabled');
  }

  const riskTolerance = parseRiskTolerance(process.env.RISK_TOLERANCE);
  const stocks = parseStockList(process.env.DEFAULT_STOCKS);
  const emails = parseEmailList(process.env.EMAIL_TO);

  const config: Config = {
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '', 10),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    },
    emailTo: emails,
    weeklyInvestmentAmount: parseFloat(process.env.WEEKLY_INVESTMENT_AMOUNT || String(DEFAULT_INVESTMENT_AMOUNT)),
    defaultStocks: stocks,
    riskTolerance,
    port: parseInt(process.env.PORT || String(DEFAULT_PORT), 10),
    cronSchedule: process.env.CRON_SCHEDULE || DEFAULT_CRON_SCHEDULE,
    // Budget constraints from strategy
    minBudget: BUDGET_CONSTRAINTS.MIN_BUDGET,
    maxBudget: BUDGET_CONSTRAINTS.MAX_BUDGET,
    // Convex database (optional)
    convexUrl
  };

  return config;
}

/**
 * Parse and validate risk tolerance value
 */
function parseRiskTolerance(value: string | undefined): 'conservative' | 'moderate' | 'aggressive' {
  const normalized = (value || 'moderate').toLowerCase();
  const validLevels = ['conservative', 'moderate', 'aggressive'] as const;
  
  if (validLevels.includes(normalized as typeof validLevels[number])) {
    return normalized as typeof validLevels[number];
  }
  
  return 'moderate';
}

/**
 * Parse stock list from environment variable or use defaults
 */
function parseStockList(value: string | undefined): string[] {
  if (!value) {
    return DEFAULT_STOCKS;
  }
  
  const stocks = value.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
  
  if (stocks.length === 0) {
    return DEFAULT_STOCKS;
  }
  
  return stocks;
}

/**
 * Parse email list from environment variable (comma-separated)
 */
function parseEmailList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  
  const emails = value.split(',')
    .map(e => e.trim())
    .filter(e => e.length > 0 && e.includes('@'));
  
  if (emails.length === 0) {
    return [];
  }
  
  return emails;
}

/**
 * Validate configuration
 */
export function validateConfig(config: Config): boolean {
  if (config.weeklyInvestmentAmount <= 0) {
    console.error('❌ Weekly investment amount must be positive');
    return false;
  }

  if (config.defaultStocks.length === 0) {
    console.error('❌ At least one stock symbol must be configured');
    return false;
  }

  if (!['conservative', 'moderate', 'aggressive'].includes(config.riskTolerance)) {
    console.error('❌ Risk tolerance must be conservative, moderate, or aggressive');
    return false;
  }

  if (config.emailTo.length === 0) {
    console.error('❌ At least one email recipient must be configured');
    return false;
  }

  return true;
}
