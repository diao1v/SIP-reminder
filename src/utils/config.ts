import * as dotenv from 'dotenv';
import { z } from 'zod';
import { Config } from '../types';
import { BUDGET_CONSTRAINTS } from './multiplierThresholds';

// Load .env file once at module initialization
dotenv.config();

/**
 * Configuration Module
 *
 * ## Pattern: SINGLETON with FAIL-FAST validation
 *
 * Configuration is loaded and validated ONCE at startup.
 * - `getConfig()` returns the cached config (fast, no re-parsing)
 * - Invalid config throws immediately at startup (fail-fast)
 * - All callers get the same config instance (consistency)
 *
 * This prevents:
 * - Log spam from repeated warnings
 * - Inconsistent config if env vars change mid-execution
 * - Unnecessary parsing overhead
 */

// ============================================================================
// Defaults
// ============================================================================

/**
 * Default portfolio per CSS Strategy v4.3:
 * QQQ 25% | GOOG 17.5% | AIQ 15% | TSLA 7.5% | XLV 10% | VXUS 10% | TLT 15%
 */
const DEFAULT_STOCKS = ['QQQ', 'GOOG', 'AIQ', 'TSLA', 'XLV', 'VXUS', 'TLT'];
const DEFAULT_PORT = 3003;
const DEFAULT_CRON_SCHEDULE = '0 20 * * 3'; // Wednesday at 8pm
const DEFAULT_TIMEZONE = 'Pacific/Auckland'; // NZST timezone

// ============================================================================
// Zod Schema for Environment Variables
// ============================================================================

const envSchema = z.object({
  // SMTP Configuration (required for email)
  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
  SMTP_PORT: z.string().regex(/^\d+$/, 'SMTP_PORT must be a number').transform(Number),
  SMTP_USER: z.string().min(1, 'SMTP_USER is required'),
  SMTP_PASS: z.string().min(1, 'SMTP_PASS is required'),
  EMAIL_TO: z
    .string()
    .min(1, 'EMAIL_TO is required')
    .transform(val => val.split(',').map(e => e.trim()).filter(e => e.includes('@'))),

  // Investment Configuration (optional with defaults)
  WEEKLY_INVESTMENT_AMOUNT: z
    .string()
    .optional()
    .default(String(BUDGET_CONSTRAINTS.BASE_BUDGET))
    .transform(Number)
    .pipe(z.number().min(50, 'Investment amount must be at least $50')),
  DEFAULT_STOCKS: z
    .string()
    .optional()
    .default(DEFAULT_STOCKS.join(','))
    .transform(val => val.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0)),
  RISK_TOLERANCE: z
    .enum(['conservative', 'moderate', 'aggressive'])
    .optional()
    .default('moderate'),

  // Server Configuration (optional with defaults)
  PORT: z
    .string()
    .optional()
    .default(String(DEFAULT_PORT))
    .transform(Number),
  CRON_SCHEDULE: z.string().optional().default(DEFAULT_CRON_SCHEDULE),
  TIMEZONE: z.string().optional().default(DEFAULT_TIMEZONE),

  // Database Configuration (optional)
  CONVEX_URL: z.string().optional().default(''),
});

// ============================================================================
// Singleton Config
// ============================================================================

let cachedConfig: Config | null = null;
let configLoadAttempted = false;

/**
 * Load and validate configuration from environment variables.
 * Called once at startup - subsequent calls return cached config.
 *
 * @throws Error if required environment variables are missing or invalid
 */
function loadAndValidateConfig(): Config {
  // Parse environment variables with Zod
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Configuration validation failed:\n${errors}\n\n` +
      `Please check your .env file or environment variables.`
    );
  }

  const env = result.data;

  // Build config object
  const config: Config = {
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
    emailTo: env.EMAIL_TO,
    weeklyInvestmentAmount: env.WEEKLY_INVESTMENT_AMOUNT,
    defaultStocks: env.DEFAULT_STOCKS,
    riskTolerance: env.RISK_TOLERANCE,
    port: env.PORT,
    cronSchedule: env.CRON_SCHEDULE,
    timezone: env.TIMEZONE,
    minBudget: BUDGET_CONSTRAINTS.MIN_BUDGET,
    maxBudget: BUDGET_CONSTRAINTS.MAX_BUDGET,
    convexUrl: env.CONVEX_URL,
  };

  // Log configuration summary (once)
  console.log('✅ Configuration loaded and validated');
  if (!config.convexUrl) {
    console.log('   ℹ️  Database features disabled (CONVEX_URL not set)');
  }

  return config;
}

/**
 * Get the application configuration.
 *
 * @returns The validated configuration object
 * @throws Error on first call if config is invalid (fail-fast)
 *
 * @example
 * ```typescript
 * const config = getConfig();
 * console.log(config.port); // Always returns same instance
 * ```
 */
export function getConfig(): Config {
  if (!configLoadAttempted) {
    configLoadAttempted = true;
    cachedConfig = loadAndValidateConfig();
  }

  if (!cachedConfig) {
    throw new Error('Configuration failed to load. Check startup logs.');
  }

  return cachedConfig;
}

/**
 * @deprecated Use getConfig() instead. This function reloads config on every call.
 * Kept for backward compatibility during migration.
 */
export function loadConfig(): Config {
  return getConfig();
}

/**
 * @deprecated Validation is now automatic via Zod schema.
 * Kept for backward compatibility.
 */
export function validateConfig(_config: Config): boolean {
  // Validation happens in getConfig() via Zod
  // This function is kept for backward compatibility
  return true;
}

/**
 * Reset config cache (for testing only).
 * @internal
 */
export function resetConfigCache(): void {
  cachedConfig = null;
  configLoadAttempted = false;
}
