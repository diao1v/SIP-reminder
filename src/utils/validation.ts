import { z } from 'zod';

/**
 * Validation schemas for API request parameters
 */

// Stock symbol: 1-10 uppercase letters
const stockSymbolSchema = z
  .string()
  .min(1, 'Stock symbol cannot be empty')
  .max(10, 'Stock symbol too long')
  .regex(/^[A-Z]+$/, 'Stock symbol must be uppercase letters only')
  .transform(val => val.toUpperCase());

// Flexible stock symbol that accepts lowercase and transforms to uppercase
const flexibleStockSymbolSchema = z
  .string()
  .min(1, 'Stock symbol cannot be empty')
  .max(10, 'Stock symbol too long')
  .regex(/^[A-Za-z]+$/, 'Stock symbol must be letters only')
  .transform(val => val.toUpperCase());

/**
 * POST /api/analyze request body schema
 */
export const analyzeBodySchema = z.object({
  investmentAmount: z
    .number()
    .min(50, 'Investment amount must be at least $50')
    .max(10000, 'Investment amount cannot exceed $10,000')
    .optional(),
  stocks: z
    .array(flexibleStockSymbolSchema)
    .min(1, 'At least one stock is required')
    .max(20, 'Cannot analyze more than 20 stocks')
    .optional(),
  sendEmail: z.boolean().optional(),
  saveToDatabase: z.boolean().optional(),
});

export type AnalyzeBody = z.infer<typeof analyzeBodySchema>;

/**
 * GET /api/history query params schema
 */
export const historyQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/, 'Limit must be a number')
    .transform(Number)
    .pipe(z.number().min(1, 'Limit must be at least 1').max(1000, 'Limit cannot exceed 1000'))
    .optional()
    .default(20),
});

export type HistoryQuery = z.infer<typeof historyQuerySchema>;

/**
 * GET /api/history/stock/:symbol params schema
 */
export const stockParamSchema = z.object({
  symbol: flexibleStockSymbolSchema,
});

export type StockParam = z.infer<typeof stockParamSchema>;

/**
 * GET /api/history/stock/:symbol query params schema
 */
export const stockHistoryQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/, 'Limit must be a number')
    .transform(Number)
    .pipe(z.number().min(1, 'Limit must be at least 1').max(1000, 'Limit cannot exceed 1000'))
    .optional()
    .default(52),
});

export type StockHistoryQuery = z.infer<typeof stockHistoryQuerySchema>;

/**
 * GET /api/history/snapshot/:id params schema
 */
export const snapshotParamSchema = z.object({
  id: z
    .string()
    .min(1, 'Snapshot ID cannot be empty')
    .max(100, 'Snapshot ID too long'),
});

export type SnapshotParam = z.infer<typeof snapshotParamSchema>;

/**
 * GET /api/history/range query params schema
 */
export const dateRangeQuerySchema = z.object({
  start: z
    .string()
    .min(1, 'Start date is required')
    .refine(
      (val) => !isNaN(Date.parse(val)),
      'Start date must be a valid ISO date string'
    ),
  end: z
    .string()
    .min(1, 'End date is required')
    .refine(
      (val) => !isNaN(Date.parse(val)),
      'End date must be a valid ISO date string'
    ),
}).refine(
  (data) => new Date(data.start) <= new Date(data.end),
  { message: 'Start date must be before or equal to end date', path: ['start'] }
);

export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;

/**
 * Format Zod errors into a user-friendly object
 * Compatible with Zod v4 $ZodError
 */
export function formatZodError(error: z.core.$ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.map(String).join('.') : '_root';
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }

  return formatted;
}
