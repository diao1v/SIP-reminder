import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { DatabaseService } from '../services/database';
import { getConfig } from '../utils/config';
import {
  historyQuerySchema,
  stockParamSchema,
  stockHistoryQuerySchema,
  snapshotParamSchema,
  dateRangeQuerySchema,
  formatZodError,
} from '../utils/validation';

const historyRouter = new Hono();

// Initialize database service
let dbService: DatabaseService | null = null;

function getDbService(): DatabaseService {
  if (!dbService) {
    const config = getConfig();
    dbService = new DatabaseService(config.convexUrl);
  }
  return dbService;
}

/**
 * GET /api/history
 * Get recent analysis snapshots with pagination
 */
historyRouter.get(
  '/',
  zValidator('query', historyQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: formatZodError(result.error),
      }, 400);
    }
  }),
  async (c) => {
    const db = getDbService();

    if (!db.isEnabled()) {
      return c.json({
        success: false,
        error: 'Database not configured. Set CONVEX_URL in environment.',
      }, 503);
    }

    try {
      const { limit } = c.req.valid('query');
      const snapshots = await db.getRecentSnapshots(limit);

      return c.json({
        success: true,
        count: snapshots.length,
        snapshots,
      });
    } catch (error) {
      console.error('History fetch error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }
);

/**
 * GET /api/history/latest
 * Get the most recent snapshot with stock details
 */
historyRouter.get('/latest', async (c) => {
  const db = getDbService();
  
  if (!db.isEnabled()) {
    return c.json({
      success: false,
      error: 'Database not configured. Set CONVEX_URL in environment.',
    }, 503);
  }

  try {
    const result = await db.getLatestSnapshot();

    if (!result) {
      return c.json({
        success: false,
        error: 'No snapshots found',
      }, 404);
    }

    return c.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Latest snapshot fetch error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/history/stats
 * Get summary statistics
 */
historyRouter.get('/stats', async (c) => {
  const db = getDbService();
  
  if (!db.isEnabled()) {
    return c.json({
      success: false,
      error: 'Database not configured. Set CONVEX_URL in environment.',
    }, 503);
  }

  try {
    const stats = await db.getStatistics();

    if (!stats) {
      return c.json({
        success: false,
        error: 'Failed to fetch statistics',
      }, 500);
    }

    return c.json({
      success: true,
      statistics: stats,
    });
  } catch (error) {
    console.error('Statistics fetch error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/history/stock/:symbol
 * Get analysis history for a specific stock
 */
historyRouter.get(
  '/stock/:symbol',
  zValidator('param', stockParamSchema, (result, c) => {
    if (!result.success) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: formatZodError(result.error),
      }, 400);
    }
  }),
  zValidator('query', stockHistoryQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: formatZodError(result.error),
      }, 400);
    }
  }),
  async (c) => {
    const db = getDbService();

    if (!db.isEnabled()) {
      return c.json({
        success: false,
        error: 'Database not configured. Set CONVEX_URL in environment.',
      }, 503);
    }

    try {
      const { symbol } = c.req.valid('param');
      const { limit } = c.req.valid('query');

      const history = await db.getStockHistory(symbol, limit);

      return c.json({
        success: true,
        symbol,
        count: history.length,
        history,
      });
    } catch (error) {
      console.error('Stock history fetch error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }
);

/**
 * GET /api/history/snapshot/:id
 * Get a specific snapshot by ID with all stock details
 */
historyRouter.get(
  '/snapshot/:id',
  zValidator('param', snapshotParamSchema, (result, c) => {
    if (!result.success) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: formatZodError(result.error),
      }, 400);
    }
  }),
  async (c) => {
    const db = getDbService();

    if (!db.isEnabled()) {
      return c.json({
        success: false,
        error: 'Database not configured. Set CONVEX_URL in environment.',
      }, 503);
    }

    try {
      const { id } = c.req.valid('param');
      const result = await db.getSnapshotWithStocks(id);

      if (!result) {
        return c.json({
          success: false,
          error: 'Snapshot not found',
        }, 404);
      }

      return c.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error('Snapshot fetch error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }
);

/**
 * GET /api/history/range
 * Get snapshots within a date range
 */
historyRouter.get(
  '/range',
  zValidator('query', dateRangeQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: formatZodError(result.error),
      }, 400);
    }
  }),
  async (c) => {
    const db = getDbService();

    if (!db.isEnabled()) {
      return c.json({
        success: false,
        error: 'Database not configured. Set CONVEX_URL in environment.',
      }, 503);
    }

    try {
      const { start, end } = c.req.valid('query');
      const snapshots = await db.getSnapshotsByDateRange(start, end);

      return c.json({
        success: true,
        startDate: start,
        endDate: end,
        count: snapshots.length,
        snapshots,
      });
    } catch (error) {
      console.error('Date range fetch error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }
);

export { historyRouter };
