# SIP Portfolio Reminder Bot 📊

Weekly portfolio allocation system using **CSS (Composite Signal Score) v4.3** strategy with automated technical analysis and professional email reporting.

## 🌟 Features

- **CSS Strategy v4.3**: 5-indicator weighted scoring system that never pauses investing
- **MA50 Slope Filter**: Trend-aware scoring to prevent "catching falling knives"
- **Real-time Market Data**: Fetches VIX, stock prices, and Fear & Greed Index from CNN
- **Technical Analysis**: Calculates RSI, Bollinger Bands, ATR, MA20, MA50, and MA50 slope
- **Smart Allocation**: CSS score determines investment multiplier (0.5x - 1.2x)
- **Professional Reports**: Beautifully formatted HTML email with CSS breakdown
- **Intelligent Fallback**: F&G failure redistributes weight to VIX and RSI
- **Budget Caps**: Never invest less than 50% or more than 120% of base budget

## 📈 CSS Strategy v4.3

### Portfolio Allocation
| Asset | Allocation | Category |
|-------|------------|----------|
| QQQ   | 25%        | Growth - Tech ETF |
| GOOG  | 17.5%      | Growth - AI/Cloud leader |
| AIQ   | 15%        | Growth - AI/Robotics theme |
| TSLA  | 7.5%       | Growth - High-volatility |
| XLV   | 10%        | Defensive - Healthcare |
| VXUS  | 10%        | International - Non-US |
| TLT   | 15%        | Hedge - Treasury bonds |

### CSS Formula (v4.3)
```
CSS = (VIX × 20%) + (RSI × 30%) + (BB Width × 15%) + (MA50 × 20%) + (Fear & Greed × 15%)
```

**v4.3 Changes from v4.2:**
- RSI weight increased from 25% → 30% (more actionable, asset-specific)
- Fear & Greed weight reduced from 20% → 15% (reduces redundancy with VIX)
- MA50 slope filter added to prevent buying in downtrends

### CSS to Multiplier Mapping
| CSS Score | Interpretation | Multiplier |
|-----------|----------------|------------|
| 0-20      | Extreme Greed  | 0.5x (minimum) |
| 21-35     | Greed          | 0.6x |
| 36-50     | Slightly Greedy | 0.8x |
| 51-60     | Neutral        | 1.0x |
| 61-75     | Fear           | 1.2x |
| 76-100    | Extreme Fear   | 1.2x (capped) |

**Key Principle**: Never pause investing. Even in extreme greed, invest at 50% of base.

### MA50 Slope Filter (v4.3)

When an asset is **10%+ below its MA50**, the slope filter adjusts the score:

| MA50 Trend | Slope Bonus | Effect |
|------------|-------------|--------|
| Strong uptrend (>1%) | +15 | Reward: discount in recovering market |
| Moderate uptrend | +8 | Slight reward |
| Flat | 0 | No adjustment |
| Moderate downtrend | -8 | Caution: still falling |
| Strong downtrend (<-1%) | -15 | Penalty: avoid falling knife |

This prevents max-buying during market crashes while rewarding true recovery opportunities.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Email account with SMTP access (Gmail recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/diao1v/SIP-reminder.git
cd SIP-reminder

# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env
# Edit .env with your settings
```

### Configuration

Create a `.env` file with your settings:

```env
# Email Configuration (Required)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_TO=recipient1@example.com,recipient2@example.com

# Portfolio Configuration (Optional - defaults shown)
WEEKLY_INVESTMENT_AMOUNT=250
DEFAULT_STOCKS=QQQ,GOOG,AIQ,TSLA,XLV,VXUS,TLT
RISK_TOLERANCE=moderate

# Server Configuration (Optional)
PORT=3002
CRON_SCHEDULE=0 20 * * 3

# Database Configuration (Optional - for historical data)
CONVEX_URL=https://your-convex-deployment.convex.cloud
```

**For Gmail**: Generate an [App Password](https://support.google.com/accounts/answer/185833) instead of using your regular password.

### Database Setup (Optional)

To enable historical data tracking with Convex:

```bash
# Initialize Convex (follow prompts to create account/project)
pnpm exec convex dev

# This will generate the API files and deploy your schema
# Copy the deployment URL to CONVEX_URL in your .env
```

The database stores weekly analysis snapshots for strategy review and backtesting.

### Build and Run

```bash
# Build the project
pnpm build

# Run in development mode (with hot reload)
pnpm dev

# Run production build
pnpm start
```

## 🔌 API Endpoints

Once running, the server exposes:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API info and configuration |
| `/health` | GET | Health check for monitoring |
| `/api/analyze` | GET | Get latest analysis without email |
| `/api/analyze` | POST | Trigger analysis with options |
| `/api/history` | GET | Get recent analysis snapshots |
| `/api/history/latest` | GET | Get most recent snapshot with stocks |
| `/api/history/stats` | GET | Get summary statistics |
| `/api/history/stock/:symbol` | GET | Get history for specific stock |
| `/api/history/snapshot/:id` | GET | Get specific snapshot by ID |
| `/api/history/range` | GET | Get snapshots by date range |

### POST /api/analyze

```json
{
  "investmentAmount": 300,
  "stocks": ["QQQ", "GOOG", "TSLA"],
  "sendEmail": true,
  "saveToDatabase": true
}
```

### GET /api/history/range

```
GET /api/history/range?start=2025-01-01T00:00:00.000Z&end=2025-12-31T23:59:59.999Z
```

## 📊 Example Output

```
🚀 SIP Portfolio Advisor - CSS Strategy v4.3
============================================================
📡 Server starting on port 3002...
✅ Server running at http://localhost:3002

Available endpoints:
  GET  http://localhost:3002/health
  GET  http://localhost:3002/api/analyze
  POST http://localhost:3002/api/analyze

⏰ Cron scheduler enabled: 0 20 * * 3
   (Wednesday at 20:00)
   Timezone: Pacific/Auckland (NZST)

Configuration (CSS v4.3):
  💰 Base Budget: $250 (Range: $125 - $300)
  📈 Stocks: QQQ, GOOG, AIQ, TSLA, XLV, VXUS, TLT
  📧 Email Recipients: 2
============================================================

--- Analysis triggered ---
🔍 Fetching market data and analyzing (CSS v4.3)...
📊 Fetching Fear & Greed Index from CNN...
✅ Fear & Greed Index: 51 (Neutral)
✅ VIX: 16.52 via yahoo-finance2

📊 Analysis complete (CSS v4.3)!
   VIX: 16.52 | F&G: 51
   Market CSS: 44.3 | Condition: NEUTRAL
   Total: $195 (7 assets)
```

## 🛠️ Technology Stack

- **Hono**: Fast, lightweight web framework
- **Node.js/TypeScript**: Core application
- **Axios**: HTTP client for market data
- **yahoo-finance2**: Financial data library (with fallback)
- **technicalindicators**: Technical analysis library (with fallback)
- **Nodemailer**: Email delivery
- **node-cron**: Scheduled execution
- **Convex**: Real-time database for historical data (optional)
- **dotenv**: Environment configuration

## ⚙️ Advanced Configuration

### Risk Tolerance Levels

- **Conservative** (0.8x): Reduced exposure, emphasis on stability
- **Moderate** (1.0x): Balanced approach (default)
- **Aggressive** (1.2x): Enhanced exposure for higher potential returns

### Cron Schedule Format

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday = 0)
│ │ │ │ │
0 20 * * 3   = Every Wednesday at 8:00 PM
```

### Fear & Greed Fallback (v4.3)

If CNN Fear & Greed Index scraping fails:
- F&G's 15% weight is redistributed: VIX (+7.5%) and RSI (+7.5%)
- Fallback weights: VIX 27.5%, RSI 37.5%, BB 15%, MA50 20%
- Email report shows ⚠️ warning indicator
- Analysis continues with adjusted CSS calculation
- Returns to normal weights when F&G comes back online

## 🔒 Security Best Practices

- Never commit `.env` file to version control
- Use app-specific passwords for email
- Review allocations before executing trades
- This tool provides recommendations, not automatic trading

## ⚠️ Disclaimer

This software is for informational and educational purposes only. It does not constitute financial advice, investment advice, trading advice, or any other advice. Always conduct your own research and consult with a licensed financial advisor before making investment decisions.

Past performance does not guarantee future results. Investing involves risk, including the possible loss of principal.

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions, please open an issue on GitHub.
