import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================================================
// MUTATIONS - Save data to database
// ============================================================================

/**
 * Save a weekly analysis snapshot
 * Returns the snapshot ID for linking stock analyses
 */
export const saveWeeklySnapshot = mutation({
  args: {
    timestamp: v.string(),
    vix: v.number(),
    fearGreedIndex: v.optional(v.number()),
    fearGreedLabel: v.optional(v.string()),
    fearGreedFailed: v.boolean(),
    marketCSS: v.number(),
    totalAmount: v.number(),
    baseBudget: v.number(),
    minBudget: v.number(),
    maxBudget: v.number(),
    marketCondition: v.string(),
    marketDataSource: v.string(),
    indicatorSource: v.string(),
    recommendations: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const snapshotId = await ctx.db.insert("weeklySnapshots", args);
    return snapshotId;
  },
});

/**
 * Save stock analyses for a snapshot (batch insert)
 */
export const saveStockAnalyses = mutation({
  args: {
    analyses: v.array(
      v.object({
        snapshotId: v.id("weeklySnapshots"),
        symbol: v.string(),
        price: v.number(),
        previousClose: v.number(),
        changePercent: v.number(),
        rsi: v.number(),
        ma20: v.number(),
        ma50: v.number(),
        bbWidth: v.number(),
        atr: v.number(),
        ma50Deviation: v.number(),
        cssScore: v.number(),
        multiplier: v.number(),
        vixScore: v.number(),
        rsiScore: v.number(),
        bbWidthScore: v.number(),
        ma50Score: v.number(),
        fearGreedScore: v.optional(v.number()),
        baseAllocationPercent: v.number(),
        baseAmount: v.number(),
        finalAmount: v.number(),
        signal: v.string(),
        reasoning: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const insertedIds: string[] = [];
    for (const analysis of args.analyses) {
      const id = await ctx.db.insert("stockAnalyses", analysis);
      insertedIds.push(id);
    }
    return insertedIds;
  },
});

// ============================================================================
// QUERIES - Read data from database
// ============================================================================

/**
 * Get recent snapshots with pagination
 */
export const getRecentSnapshots = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const snapshots = await ctx.db
      .query("weeklySnapshots")
      .order("desc")
      .take(limit);
    return snapshots;
  },
});

/**
 * Get a specific snapshot by ID with all stock analyses
 */
export const getSnapshotWithStocks = query({
  args: {
    snapshotId: v.id("weeklySnapshots"),
  },
  handler: async (ctx, args) => {
    const snapshot = await ctx.db.get(args.snapshotId);
    if (!snapshot) {
      return null;
    }

    const stocks = await ctx.db
      .query("stockAnalyses")
      .withIndex("by_snapshot", (q) => q.eq("snapshotId", args.snapshotId))
      .collect();

    return { snapshot, stocks };
  },
});

/**
 * Get all analyses for a specific stock symbol
 */
export const getStockHistory = query({
  args: {
    symbol: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 52; // Default to ~1 year of weekly data
    
    const analyses = await ctx.db
      .query("stockAnalyses")
      .withIndex("by_symbol", (q) => q.eq("symbol", args.symbol))
      .order("desc")
      .take(limit);

    // Fetch corresponding snapshots for context
    const enrichedAnalyses = await Promise.all(
      analyses.map(async (analysis) => {
        const snapshot = await ctx.db.get(analysis.snapshotId);
        return {
          ...analysis,
          snapshotTimestamp: snapshot?.timestamp,
          snapshotVix: snapshot?.vix,
          snapshotMarketCondition: snapshot?.marketCondition,
        };
      })
    );

    return enrichedAnalyses;
  },
});

/**
 * Get snapshots by date range
 */
export const getSnapshotsByDateRange = query({
  args: {
    startDate: v.string(), // ISO string
    endDate: v.string(),   // ISO string
  },
  handler: async (ctx, args) => {
    const snapshots = await ctx.db
      .query("weeklySnapshots")
      .withIndex("by_timestamp")
      .filter((q) =>
        q.and(
          q.gte(q.field("timestamp"), args.startDate),
          q.lte(q.field("timestamp"), args.endDate)
        )
      )
      .collect();

    return snapshots;
  },
});

/**
 * Get summary statistics
 */
export const getStatistics = query({
  args: {},
  handler: async (ctx) => {
    const allSnapshots = await ctx.db.query("weeklySnapshots").collect();
    
    if (allSnapshots.length === 0) {
      return {
        totalSnapshots: 0,
        totalInvested: 0,
        averageVix: 0,
        averageCSS: 0,
        marketConditionDistribution: {},
      };
    }

    const totalInvested = allSnapshots.reduce((sum, s) => sum + s.totalAmount, 0);
    const averageVix = allSnapshots.reduce((sum, s) => sum + s.vix, 0) / allSnapshots.length;
    const averageCSS = allSnapshots.reduce((sum, s) => sum + s.marketCSS, 0) / allSnapshots.length;

    const marketConditionDistribution: Record<string, number> = {};
    for (const snapshot of allSnapshots) {
      const condition = snapshot.marketCondition;
      marketConditionDistribution[condition] = (marketConditionDistribution[condition] || 0) + 1;
    }

    return {
      totalSnapshots: allSnapshots.length,
      totalInvested: Math.round(totalInvested * 100) / 100,
      averageVix: Math.round(averageVix * 100) / 100,
      averageCSS: Math.round(averageCSS * 100) / 100,
      marketConditionDistribution,
    };
  },
});

/**
 * Get the most recent snapshot
 */
export const getLatestSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const snapshot = await ctx.db
      .query("weeklySnapshots")
      .order("desc")
      .first();

    if (!snapshot) {
      return null;
    }

    const stocks = await ctx.db
      .query("stockAnalyses")
      .withIndex("by_snapshot", (q) => q.eq("snapshotId", snapshot._id))
      .collect();

    return { snapshot, stocks };
  },
});
