import * as dotenv from 'dotenv';
import { Config } from '../types';

dotenv.config();

/**
 * Default portfolio per specification:
 * QQQ 25% | GOOG 25% | TSLA 20% | AIQ 15% | Defensive (XLV or XLP) 15%
 */
const DEFAULT_STOCKS = ['QQQ', 'GOOG', 'TSLA', 'AIQ', 'XLV', 'XLP'];

/**
 * Default weekly investment amount (NZD)
 */
const DEFAULT_INVESTMENT_AMOUNT = 250;

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

  const riskTolerance = parseRiskTolerance(process.env.RISK_TOLERANCE);
  const stocks = parseStockList(process.env.DEFAULT_STOCKS);
  const emails = parseEmailList(process.env.EMAIL_TO);

  const config: Config = {
    smtp: {
      host: process.env.SMTP_HOST!,
      port: parseInt(process.env.SMTP_PORT!, 10),
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!
    },
    emailTo: emails,
    weeklyInvestmentAmount: parseFloat(process.env.WEEKLY_INVESTMENT_AMOUNT || String(DEFAULT_INVESTMENT_AMOUNT)),
    defaultStocks: stocks,
    riskTolerance,
    port: parseInt(process.env.PORT || String(DEFAULT_PORT), 10),
    cronSchedule: process.env.CRON_SCHEDULE || DEFAULT_CRON_SCHEDULE
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
