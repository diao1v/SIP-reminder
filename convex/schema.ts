import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex Database Schema for SIP-Reminder
 * 
 * Two main tables:
 * - weeklySnapshots: Main analysis record per week
 * - stockAnalyses: Per-stock details linked to snapshots
 */
export default defineSchema({
  /**
   * Weekly analysis snapshots
   * Stores market conditions, CSS scores, and investment decisions
   */
  weeklySnapshots: defineTable({
    // Date & Timestamp
    date: v.string(),      // "YYYY-MM-DD" - one record per day
    timestamp: v.string(), // Full ISO string

    // Market Conditions
    vix: v.number(),
    fearGreedIndex: v.optional(v.number()),
    fearGreedLabel: v.optional(v.string()),
    fearGreedFailed: v.boolean(),
    
    // CSS Scores
    marketCSS: v.number(),
    
    // Investment Decision
    totalAmount: v.number(),      // Actual total after CSS adjustment
    baseBudget: v.number(),       // Base weekly budget ($250)
    minBudget: v.number(),        // Minimum allowed ($125)
    maxBudget: v.number(),        // Maximum allowed ($300)
    
    // Market Assessment
    marketCondition: v.string(),  // "BULLISH" | "BEARISH" | "NEUTRAL"
    
    // Data Source Status
    marketDataSource: v.string(), // "yahoo-finance2" | "axios-fallback"
    indicatorSource: v.string(),  // "technicalindicators" | "custom-fallback"
    
    // Recommendations (stored as JSON string)
    recommendations: v.array(v.string()),
  })
    .index("by_date", ["date"])
    .index("by_timestamp", ["timestamp"])
    .index("by_marketCondition", ["marketCondition"]),

  /**
   * Per-stock analysis details
   * Linked to weeklySnapshots via snapshotId
   */
  stockAnalyses: defineTable({
    snapshotId: v.id("weeklySnapshots"),
    symbol: v.string(),
    
    // Price Data
    price: v.number(),
    previousClose: v.number(),
    changePercent: v.number(),
    
    // Technical Indicators
    rsi: v.number(),
    ma20: v.number(),
    ma50: v.number(),
    bbWidth: v.number(),
    atr: v.number(),
    ma50Deviation: v.number(),    // Price vs MA50 deviation %
    
    // CSS Scoring
    cssScore: v.number(),
    multiplier: v.number(),
    
    // CSS Breakdown (individual scores)
    vixScore: v.number(),
    rsiScore: v.number(),
    bbWidthScore: v.number(),
    ma50Score: v.number(),
    fearGreedScore: v.optional(v.number()),
    
    // Allocation
    baseAllocationPercent: v.number(),
    baseAmount: v.number(),
    finalAmount: v.number(),
    
    // Signal
    signal: v.string(),           // "BUY" | "HOLD"
    reasoning: v.string(),
  })
    .index("by_snapshot", ["snapshotId"])
    .index("by_symbol", ["symbol"])
    .index("by_symbol_timestamp", ["symbol", "snapshotId"]),
});
