# SIP Portfolio Reminder Bot 📊

Weekly portfolio allocation system using **CSS (Composite Signal Score) v4.2** strategy with automated technical analysis and professional email reporting.

## 🌟 Features

- **CSS Strategy v4.2**: 5-indicator weighted scoring system that never pauses investing
- **Real-time Market Data**: Fetches VIX, stock prices, and Fear & Greed Index from CNN
- **Technical Analysis**: Calculates RSI, Bollinger Bands, ATR, MA20, and MA50
- **Smart Allocation**: CSS score determines investment multiplier (0.5x - 1.2x)
- **Professional Reports**: Beautifully formatted HTML email with CSS breakdown
- **Fallback Safety**: VIX weight doubles if Fear & Greed scraping fails
- **Budget Caps**: Never invest less than 50% or more than 120% of base budget

## 📈 CSS Strategy v4.2

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

### CSS Formula
```
CSS = (VIX × 20%) + (RSI × 25%) + (BB Width × 15%) + (MA50 × 20%) + (Fear & Greed × 20%)
```

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
```

**For Gmail**: Generate an [App Password](https://support.google.com/accounts/answer/185833) instead of using your regular password.

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

### POST /api/analyze

```json
{
  "investmentAmount": 300,
  "stocks": ["QQQ", "GOOG", "TSLA"],
  "sendEmail": true
}
```

## 📊 Example Output

```
🚀 SIP Portfolio Reminder Bot - CSS Strategy v4.2
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

Configuration:
  💰 Base Budget: $250 (Range: $125 - $300)
  📈 Stocks: QQQ, GOOG, AIQ, TSLA, XLV, VXUS, TLT
  📧 Email Recipients: 2
============================================================

--- Analysis triggered ---
📊 Fetching Fear & Greed Index from CNN...
✅ Fear & Greed Index: 44 (Fear)
📈 Fetching market data...
✅ VIX: 14.95

📊 Analysis complete (CSS v4.2)!
   VIX: 14.95 | F&G: 44
   Market CSS: 52.3 | Condition: NEUTRAL
   Total: $248 (7 assets)
```

## 🛠️ Technology Stack

- **Hono**: Fast, lightweight web framework
- **Node.js/TypeScript**: Core application
- **Axios**: HTTP client for market data
- **Nodemailer**: Email delivery
- **node-cron**: Scheduled execution
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

### Fear & Greed Fallback

If CNN Fear & Greed Index scraping fails:
- VIX weight automatically doubles from 20% to 40%
- Email report shows ⚠️ warning indicator
- Analysis continues with adjusted CSS calculation

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
