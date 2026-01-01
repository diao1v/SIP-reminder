# SIP Portfolio Advisor 📊

AI-powered weekly portfolio allocation system with automated technical analysis and professional email reporting.

## 🌟 Features

- **Real-time Market Data**: Fetches VIX, stock prices, and market indicators
- **Technical Analysis**: Calculates RSI, Bollinger Bands, and ATR for each stock
- **AI-Powered Allocation**: Multi-dimensional adjustment system determines exact investment amounts
- **Professional Reports**: Sends beautifully formatted HTML email reports with actionable insights
- **Risk Management**: Adjusts allocations based on VIX levels and risk tolerance
- **Systematic Approach**: Emotion-free, disciplined portfolio management

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Email account with SMTP access (Gmail recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/diao1v/SIP-reminder.git
cd SIP-reminder

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your settings
```

### Configuration

Edit `.env` file with your settings:

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_TO=recipient@example.com

# Portfolio Configuration
WEEKLY_INVESTMENT_AMOUNT=1000
DEFAULT_STOCKS=AAPL,MSFT,GOOGL,AMZN,SPY
RISK_TOLERANCE=moderate
```

**For Gmail**: Generate an [App Password](https://support.google.com/accounts/answer/185833) instead of using your regular password.

### Build and Run

```bash
# Build the project
npm run build

# Run the application
npm start

# Or run directly with ts-node (development)
npm run dev
```

## 📖 How It Works

### 1. Market Data Collection
- Fetches real-time stock prices from Yahoo Finance API
- Retrieves VIX (Volatility Index) for market sentiment
- Collects historical data for technical analysis

### 2. Technical Analysis
For each stock, the system calculates:

- **RSI (Relative Strength Index)**: Identifies overbought/oversold conditions
  - < 30: Oversold (potential buy)
  - > 70: Overbought (potential sell)
  
- **Bollinger Bands**: Measures volatility and price extremes
  - Price near lower band: Potential buy
  - Price near upper band: Potential sell
  
- **ATR (Average True Range)**: Quantifies market volatility
  - Lower ATR: More stable, favorable for buying
  - Higher ATR: More volatile, proceed with caution

### 3. Multi-Dimensional Allocation System

The AI engine applies multiple adjustment layers:

1. **Signal Strength**: Base score from technical indicators
2. **RSI Adjustment**: Bonuses for oversold, penalties for overbought
3. **Bollinger Position**: Enhanced weighting for extreme positions
4. **Volatility Factor**: ATR-based risk adjustment
5. **VIX Adjustment**: Market-wide sentiment modifier
6. **Risk Tolerance**: User preference scaling

### 4. Report Generation

Generates a professional HTML email with:
- Market overview (VIX, market condition)
- Detailed allocations with reasoning
- Expert recommendations
- Risk disclaimers

## 📊 Example Output

```
🚀 SIP Portfolio Advisor - AI-Powered Weekly Allocation System
======================================================================

📋 Configuration:
   Investment Amount: $1000
   Stocks: AAPL, MSFT, GOOGL, AMZN, SPY
   Risk Tolerance: moderate
   Email: investor@example.com

🤖 Running AI-powered analysis...

🔍 Fetching market data and analyzing...
📊 VIX: 16.45 - Market: NEUTRAL
✓ Analyzed AAPL: BUY (strength: 65)
✓ Analyzed MSFT: BUY (strength: 72)
✓ Analyzed GOOGL: HOLD (strength: 45)

======================================================================
📊 ALLOCATION RESULTS
======================================================================
VIX: 16.45
Market Condition: NEUTRAL

Recommended Allocations:

  MSFT:
    Amount: $580.00 (58.0%)
    Reason: RSI shows potential buying opportunity; Price near lower Bollinger Band; Low volatility environment

  AAPL:
    Amount: $420.00 (42.0%)
    Reason: RSI shows potential buying opportunity; Low volatility environment

📝 Recommendations:
  • ✅ Favorable market conditions. Good time for systematic investments.
  • 🎯 Strong buy signals detected for: MSFT, AAPL
  • 📊 Maintain disciplined investing regardless of market sentiment.
  • ⏰ Review and rebalance portfolio quarterly to maintain target allocation.

======================================================================
📧 Sending email report...
✅ Email sent successfully!
✨ Process completed successfully!
```

## 🛠️ Technology Stack

- **Node.js/TypeScript**: Core application framework
- **Axios**: HTTP client for API requests
- **Nodemailer**: Email delivery system
- **dotenv**: Environment configuration

## ⚙️ Advanced Configuration

### Risk Tolerance Levels

- **Conservative** (0.8x): Reduced exposure, emphasis on stability
- **Moderate** (1.0x): Balanced approach (default)
- **Aggressive** (1.2x): Enhanced exposure for higher potential returns

### VIX-Based Adjustments

- < 12: Very low volatility (+20% exposure)
- 12-15: Low volatility (+10% exposure)
- 15-20: Normal (baseline)
- 20-25: Elevated (-10% exposure)
- 25-30: High volatility (-20% exposure)
- > 30: Extreme volatility (-30% exposure)

## 📅 Scheduling (Optional)

To run weekly automatically, use cron (Linux/Mac) or Task Scheduler (Windows):

```bash
# Run every Monday at 9 AM
0 9 * * 1 cd /path/to/SIP-reminder && npm start
```

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
