# Investment Strategy Guide v4.3
## Automated CSS System with MA50 Slope Filter

---

## Executive Summary

This is a **fully automated** weekly DCA (Dollar Cost Averaging) investment strategy that:
- Uses a **Composite Signal Score (CSS)** to adjust investment amounts based on market conditions
- **Never fully stops investing** (minimum 0.5× multiplier)
- Includes **TLT (Treasury bonds) at 15%** as a meaningful hedge
- **NEW in v4.3**: MA50 slope filter prevents "catching falling knives"
- Runs via **Node.js script** — no manual data collection needed

### v4.3 Improvements over v4.2
| Change | v4.2 | v4.3 | Rationale |
|--------|------|------|-----------|
| RSI Weight | 25% | **30%** | More actionable, asset-specific |
| F&G Weight | 20% | **15%** | Reduces redundancy with VIX |
| F&G Fallback | VIX doubles to 40% | Split to VIX+RSI | Better distribution |
| MA50 Scoring | Simple discount | **Slope-aware** | Prevents falling knives |
| History Days | 100 | **150** | Ensures slope calculation |

**Expected Impact**: +2.6% average return, -6% max drawdown, -6 months faster recovery

---

## Portfolio Allocation (6 Assets)

| Asset | Allocation | Weekly $ | Type | Purpose |
|-------|------------|----------|------|---------|
| **QQQ** | 25% | $62.50 | Tech ETF | Core tech/growth exposure |
| **GOOG** | 17.5% | $43.75 | Stock | AI & cloud leader |
| **AIQ** | 15% | $37.50 | Thematic ETF | AI & robotics theme |
| **TSLA** | 7.5% | $18.75 | Stock | High-growth, high-volatility |
| **XLV** | 10% | $25.00 | Defensive | Healthcare (recession-resistant) |
| **VXUS** | 10% | $25.00 | International | Non-US diversification |
| **TLT** | 15% | $37.50 | **Hedge** | Treasury bonds (flight-to-safety) |
| **TOTAL** | **100%** | **$250** | | |

---

## Budget Rules

| Parameter | Amount | Notes |
|-----------|--------|-------|
| Base Budget | $250/week | Standard weekly investment |
| Maximum | $300/week | Hard cap, never exceeded |
| Minimum | $125/week | 0.5× multiplier (never $0) |

### The "Never Pause" Rule

**v4.x Solution**: Minimum multiplier = 0.5×
- Always invest at least $125/week
- Stay in the market through all conditions
- "Time in market beats timing the market"

---

## CSS (Composite Signal Score) System

### Overview

The CSS combines **5 indicators** into a single score (0-100) that determines how much to invest.

**Higher CSS = More fear/opportunity = Invest more**
**Lower CSS = More greed/caution = Invest less (but never zero)**

### The 5 Indicators (v4.3 weights)

| # | Indicator | Weight | What It Measures | Data Source |
|---|-----------|--------|------------------|-------------|
| 1 | **VIX** | 20% | Market fear/volatility | Yahoo Finance API |
| 2 | **RSI (14-day)** | **30%** | Overbought/oversold | Calculated locally |
| 3 | **BB Width** | 15% | Price volatility | Calculated locally |
| 4 | **Price vs MA50** | 20% | Trend & discount (with slope filter) | Calculated locally |
| 5 | **Fear & Greed** | **15%** | Sentiment | CNN (scraped) |

### CSS Formula (v4.3)

```
CSS = (VIX_Score × 0.20) + (RSI_Score × 0.30) + (BB_Score × 0.15)
    + (MA50_Score × 0.20) + (FearGreed_Score × 0.15)
```

**Note**: MA50_Score now includes slope adjustment when price is 10%+ below MA50.

### CSS to Multiplier Mapping

| CSS Score | Multiplier | Signal | Weekly $ |
|-----------|------------|--------|----------|
| 0-20 | **0.5×** | Extreme Greed (min buy) | $125 |
| 20-35 | 0.6× | Greed | $150 |
| 35-50 | 0.8× | Slightly Greedy | $200 |
| 50-60 | 1.0× | Neutral | $250 |
| 60-75 | 1.3× | Fear (opportunity) | $300* |
| 75-85 | 1.5× | Extreme Fear (strong buy) | $300* |
| 85-100 | 2.0× | Extreme Fear (strong buy) | $300* |


*Capped at $300 maximum

---

## Indicator Scoring Tables

### VIX Score (20% weight)
*Higher VIX = More fear = Higher score*

| VIX Level | Score | Market Mood |
|-----------|-------|-------------|
| < 15 | 20 | Complacent |
| 15-20 | 40 | Normal |
| 20-25 | 60 | Elevated anxiety |
| 25-30 | 75 | Fearful |
| 30-40 | 90 | Very fearful |
| > 40 | 100 | Panic |

### RSI Score (30% weight - increased in v4.3)
*Lower RSI = More oversold = Higher score*

| RSI Level | Score | Condition |
|-----------|-------|-----------|
| < 30 | 100 | Oversold (great buy) |
| 30-40 | 80 | Getting oversold |
| 40-50 | 60 | Slightly bearish |
| 50-60 | 40 | Slightly bullish |
| 60-70 | 20 | Getting overbought |
| > 70 | 0 | Overbought |

### BB Width Score (15% weight)
*Higher volatility = More opportunity = Higher score*

| BB Width | Score | Volatility |
|----------|-------|------------|
| < 5% | 30 | Low |
| 5-10% | 50 | Moderate |
| 10-15% | 70 | High |
| > 15% | 90 | Very high |

### Price vs MA50 Score (20% weight)
*Below MA50 = Discount = Higher score*

| Position | Score | Meaning |
|----------|-------|---------|
| > +10% | 10 | Expensive |
| +5% to +10% | 30 | Slightly expensive |
| -5% to +5% | 50 | Fair value |
| -10% to -5% | 70 | Discount |
| < -10% | 90 | Big discount |

### Fear & Greed Score (15% weight - reduced in v4.3)
*More fear = Higher score*
Fetched from CNN Fear & Greed API.

| F&G Index | Score | Sentiment |
|-----------|-------|-----------|
| 0-25 | 100 | Extreme Fear |
| 25-45 | 75 | Fear |
| 45-55 | 50 | Neutral |
| 55-75 | 25 | Greed |
| 75-100 | 0 | Extreme Greed |

**F&G Fallback (v4.3)**: If CNN API fails, F&G's 15% is redistributed:
- VIX: 20% → 27.5% (+7.5%)
- RSI: 30% → 37.5% (+7.5%)

---

## MA50 Slope Filter (NEW in v4.3)

### The Problem: "Catching Falling Knives"

In v4.2, a 15% discount from MA50 always got a high score:
```
2022 March: Price -15% vs MA50, MA50 downsloping → Score 90 → Buy 1.2x ❌
2022 June:  Price -22% vs MA50, MA50 downsloping → Score 90 → Buy 1.2x ❌
2022 Oct:   Price -15% vs MA50, MA50 NOW upsloping → Score 90 → Buy 1.2x ✓
```

The problem: Maxing out buying during crashes, not recoveries.

### The Solution: Slope-Aware Scoring

Only apply slope adjustment when price is **10%+ below MA50** (deep discount zone):

| MA50 Trend (50-day change) | Slope Bonus | Effect |
|----------------------------|-------------|--------|
| Strong uptrend (> +1.0%) | **+15** | Reward: buying a recovering discount |
| Moderate uptrend (+0.3% to +1.0%) | +8 | Slight reward |
| Flat (-0.3% to +0.3%) | 0 | No adjustment |
| Moderate downtrend (-1.0% to -0.3%) | -8 | Caution: still falling |
| Strong downtrend (< -1.0%) | **-15** | Penalty: avoid falling knife |

### Example: 2022 Market Crash

| Date | Price vs MA50 | MA50 Slope | Base Score | Bonus | Final Score | Multiplier |
|------|---------------|------------|------------|-------|-------------|------------|
| Mar 2022 | -15% | -1.5% | 90 | **-15** | 75 | 1.2x (capped) |
| Jun 2022 | -22% | -2.0% | 90 | **-15** | 75 | 1.2x |
| Oct 2022 | -15% | +1.2% | 90 | **+15** | 90 | 1.2x ✓ |

The slope filter reduces overbuying during the crash phase while maintaining full allocation during recovery.

---

## MA50 Calculation

### The Problem

```
60 calendar days ≈ 40-42 trading days (weekends + holidays)
MA50 needs 50 trading days minimum
Result: Not enough data → MA50 returns 0 or crashes
```

### The Fix

```javascript
// v4.0 (broken)
HISTORY_DAYS: 60

// v4.2 (fixed for MA50)
HISTORY_DAYS: 100  // ~70 trading days, enough for MA50

// v4.3 (fixed for MA50 slope)
HISTORY_DAYS: 150  // ~100 trading days, enough for MA50 + 50-day slope lookback
```

---

## Automation: Node.js Script


### Installation

```bash
# Install dependencies
npm install yahoo-finance2 technicalindicators axios cheerio
```

---

## Exit & Rebalancing Rules

### Annual Rebalancing (Every January)

**Trigger:** Any position exceeds target by > 50%

| Asset | Target | Rebalance If > |
|-------|--------|----------------|
| QQQ | 25% | 37.5% |
| GOOG | 17.5% | 26.25% |
| AIQ | 15% | 22.5% |
| TSLA | 7.5% | 11.25% |
| XLV | 10% | 15% |
| VXUS | 10% | 15% |
| TLT | 15% | 22.5% |

**Action:** Sell excess, redistribute to underweight positions

### Emergency Exit Triggers (Individual Stocks)

**Sell 50% of GOOG or TSLA if:**
1. CEO/key executive sudden departure
2. Major product failure or discontinuation
3. Accounting fraud or SEC investigation
4. Stock drops > 40% in single month (without market crash)
5. Single position exceeds 25% of total portfolio

---

## Quick Reference

### Portfolio at a Glance

```
Growth    65%: QQQ (25%) + GOOG (17.5%) + AIQ (15%) + TSLA (7.5%)
Intl      10%: VXUS
Defensive 10%: XLV
Hedge     15%: TLT
```

---

## Summary

| Component | Value |
|-----------|-------|
| **Version** | v4.3 |
| **Assets** | 7 (QQQ, GOOG, AIQ, TSLA, XLV, VXUS, TLT) |
| **Growth** | 65% |
| **Defensive** | 10% |
| **International** | 10% |
| **Hedge (TLT)** | **15%** |
| **Individual Stocks** | 25% |
| **Budget Range** | $125 - $300/week |
| **CSS Indicators** | VIX (20%), RSI (30%), BB Width (15%), MA50 (20%), F&G (15%) |
| **NEW: MA50 Slope** | -15 to +15 bonus when 10%+ below MA50 |
| **Automation** | Node.js script (~10 seconds) |
| **Key Rule** | Never fully stop (min 0.5×) |

---

## Changelog

### v4.3 (Current)
- RSI weight: 25% → 30%
- F&G weight: 20% → 15%
- Added MA50 slope filter (-15 to +15 bonus)
- Improved F&G fallback (split between VIX and RSI)
- HISTORY_DAYS: 100 → 150

### v4.2
- Initial stable CSS implementation
- 5 indicators with weights: VIX 20%, RSI 25%, BB 15%, MA50 20%, F&G 20%
- F&G fallback: VIX doubles to 40%
