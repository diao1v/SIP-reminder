/**
 * Structured Logging Utility
 *
 * Provides typed log levels with optional structured context.
 * Configure via LOG_LEVEL env var: 'debug' | 'info' | 'warn' | 'error'
 *
 * @example
 * ```typescript
 * import { logger } from './utils/logger';
 *
 * logger.info('Processing stock', { symbol: 'VOO', price: 400 });
 * logger.warn('Fallback triggered', { source: 'axios' });
 * logger.error('Failed to fetch', { error: err.message });
 * ```
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: string | number | boolean | null | undefined;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: LogLevel;

  constructor() {
    const envLevel = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel;
    this.level = LOG_LEVELS[envLevel] !== undefined ? envLevel : 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatContext(context?: LogContext): string {
    if (!context || Object.keys(context).length === 0) return '';

    const pairs = Object.entries(context)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');

    return pairs ? ` [${pairs}]` : '';
  }

  /**
   * Debug level - verbose information for development
   */
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.log(`[DEBUG] ${message}${this.formatContext(context)}`);
    }
  }

  /**
   * Info level - general operational information
   */
  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.log(`${message}${this.formatContext(context)}`);
    }
  }

  /**
   * Warn level - potential issues that don't prevent operation
   */
  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(`⚠️ ${message}${this.formatContext(context)}`);
    }
  }

  /**
   * Error level - failures that need attention
   */
  error(message: string, context?: LogContext): void {
    if (this.shouldLog('error')) {
      console.error(`❌ ${message}${this.formatContext(context)}`);
    }
  }

  /**
   * Success indicator - always shown at info level
   */
  success(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.log(`✅ ${message}${this.formatContext(context)}`);
    }
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Set log level dynamically (for testing)
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for context
export type { LogContext, LogLevel };
