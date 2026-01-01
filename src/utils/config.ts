import * as dotenv from 'dotenv';
import { Config } from '../types';

dotenv.config();

export function loadConfig(): Config {
  // Validate required environment variables
  const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_TO'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.warn(`⚠️  Warning: Missing environment variables: ${missing.join(', ')}`);
    console.warn('⚠️  Using default/test configuration. Please configure .env file for production use.');
  }

  const config: Config = {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER || 'test@example.com',
      pass: process.env.SMTP_PASS || 'password'
    },
    emailTo: process.env.EMAIL_TO || 'recipient@example.com',
    weeklyInvestmentAmount: parseFloat(process.env.WEEKLY_INVESTMENT_AMOUNT || '1000'),
    defaultStocks: (process.env.DEFAULT_STOCKS || 'AAPL,MSFT,GOOGL,AMZN,SPY').split(',').map(s => s.trim()),
    riskTolerance: (process.env.RISK_TOLERANCE || 'moderate') as 'conservative' | 'moderate' | 'aggressive'
  };

  return config;
}

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

  return true;
}
