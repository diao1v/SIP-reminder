import * as fs from 'fs';
import * as path from 'path';

/**
 * Structured Logging Utility with File Persistence
 *
 * Provides typed log levels with optional structured context.
 * Outputs to both console and file (if LOG_FILE is set).
 *
 * Environment variables:
 * - LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error' (default: 'info')
 * - LOG_FILE: Path to log file (optional, e.g., './logs/app.log')
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
  private logFilePath: string | null = null;
  private fileStream: fs.WriteStream | null = null;

  constructor() {
    const envLevel = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel;
    this.level = LOG_LEVELS[envLevel] !== undefined ? envLevel : 'info';

    // Initialize file logging if LOG_FILE is set
    const logFile = process.env.LOG_FILE;
    if (logFile) {
      this.initFileLogging(logFile);
    }
  }

  /**
   * Initialize file logging
   */
  private initFileLogging(filePath: string): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Open file stream in append mode
      this.logFilePath = filePath;
      this.fileStream = fs.createWriteStream(filePath, { flags: 'a' });

      console.log(`📁 Logging to file: ${filePath}`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to initialize file logging: ${errMsg}`);
    }
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

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Write to log file if enabled
   */
  private writeToFile(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.fileStream) return;

    const timestamp = this.formatTimestamp();
    const contextStr = this.formatContext(context);
    const line = `${timestamp} [${level.toUpperCase()}] ${message}${contextStr}\n`;

    this.fileStream.write(line);
  }

  /**
   * Debug level - verbose information for development
   */
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.log(`[DEBUG] ${message}${this.formatContext(context)}`);
      this.writeToFile('debug', message, context);
    }
  }

  /**
   * Info level - general operational information
   */
  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.log(`${message}${this.formatContext(context)}`);
      this.writeToFile('info', message, context);
    }
  }

  /**
   * Warn level - potential issues that don't prevent operation
   */
  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(`⚠️ ${message}${this.formatContext(context)}`);
      this.writeToFile('warn', message, context);
    }
  }

  /**
   * Error level - failures that need attention
   */
  error(message: string, context?: LogContext): void {
    if (this.shouldLog('error')) {
      console.error(`❌ ${message}${this.formatContext(context)}`);
      this.writeToFile('error', message, context);
    }
  }

  /**
   * Success indicator - always shown at info level
   */
  success(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.log(`✅ ${message}${this.formatContext(context)}`);
      this.writeToFile('info', `✅ ${message}`, context);
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

  /**
   * Get log file path (if file logging is enabled)
   */
  getLogFilePath(): string | null {
    return this.logFilePath;
  }

  /**
   * Close file stream (call on app shutdown)
   */
  close(): void {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = null;
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for context
export type { LogContext, LogLevel };
