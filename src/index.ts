import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import * as cron from 'node-cron';
import { analyzeRouter } from './routes/analyze';
import { historyRouter } from './routes/history';
import { getConfig } from './utils/config';
import { PortfolioAllocationEngine } from './services/portfolioAllocation';
import { EmailService } from './services/email';
import { DatabaseService } from './services/database';

// Load and validate config at startup (fail-fast)
// This will throw if required env vars are missing
const config = getConfig();

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'SIP Portfolio Advisor',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.route('/api/analyze', analyzeRouter);
app.route('/api/history', historyRouter);

// Root endpoint with API info
app.get('/', (c) => {
  return c.json({
    name: 'SIP Portfolio Advisor API',
    version: '4.3.0',
    description: 'CSS (Composite Signal Score) Weekly Investment System',
    strategy: 'CSS v4.3 - 5 weighted indicators with MA50 slope filter, never pause investing',
    endpoints: {
      'GET /health': 'Health check for monitoring',
      'GET /api/analyze': 'Get latest analysis without sending email',
      'POST /api/analyze': 'Trigger analysis with optional parameters',
      'GET /api/history': 'Get recent analysis snapshots',
      'GET /api/history/latest': 'Get most recent snapshot with stocks',
      'GET /api/history/stats': 'Get summary statistics',
      'GET /api/history/stock/:symbol': 'Get history for specific stock',
      'GET /api/history/snapshot/:id': 'Get specific snapshot by ID',
      'GET /api/history/range?start=&end=': 'Get snapshots by date range'
    },
    postBodyExample: {
      investmentAmount: 300,
      stocks: ['QQQ', 'GOOG', 'AIQ', 'TSLA', 'XLV', 'VXUS', 'TLT'],
      sendEmail: true,
      saveToDatabase: true
    },
    configuration: {
      cronSchedule: config.cronSchedule,
      baseBudget: config.weeklyInvestmentAmount,
      budgetRange: `$${config.minBudget} - $${config.maxBudget}`,
      stocks: config.defaultStocks,
      emailRecipients: config.emailTo.length,
      databaseEnabled: !!config.convexUrl
    }
  });
});

/**
 * Run the scheduled analysis job
 * Fetches market data, calculates allocations, sends email report, and saves to database
 */
async function runScheduledAnalysis(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('⏰ SCHEDULED JOB TRIGGERED');
  console.log('='.repeat(60));
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    // Config is already validated at startup, just use it
    console.log(`📧 Recipients: ${config.emailTo.join(', ')}`);
    console.log(`💰 Weekly Amount: $${config.weeklyInvestmentAmount}`);
    console.log(`📈 Stocks: ${config.defaultStocks.join(', ')}`);
    console.log(`📦 Database: ${config.convexUrl ? 'Enabled' : 'Disabled'}`);

    const engine = new PortfolioAllocationEngine();
    const report = await engine.generateAllocation(config);

    console.log('\n📊 Analysis complete (CSS v4.3)!');
    console.log(`   VIX: ${report.vix.toFixed(2)} | F&G: ${report.fearGreedIndex ?? 'FAILED'}`);
    console.log(`   Market CSS: ${report.marketCSS.toFixed(1)} | Condition: ${report.marketCondition}`);
    console.log(`   Total: $${report.totalAmount.toFixed(0)} (${report.allocations.length} assets)`);

    // Save to database
    if (config.convexUrl) {
      try {
        const dbService = new DatabaseService(config.convexUrl);
        const dbResult = await dbService.saveAnalysisReport(report);
        
        if (dbResult.success) {
          console.log(`✅ Saved to database (ID: ${dbResult.snapshotId})`);
        } else {
          console.warn(`⚠️ Database save failed: ${dbResult.error}`);
        }
      } catch (dbError) {
        console.error('❌ Database error:', dbError);
      }
    }

    // Send email
    if (config.emailTo.length > 0) {
      const emailService = new EmailService(config);
      const connectionOk = await emailService.testConnection();

      if (connectionOk) {
        await emailService.sendReport(report, config.emailTo);
        console.log('✅ Scheduled email sent successfully!');
      } else {
        console.error('❌ Email connection failed');
      }
    } else {
      console.log('⚠️ No email recipients configured');
    }

  } catch (error) {
    console.error('❌ Scheduled job error:', error);
  }

  console.log('='.repeat(60) + '\n');
}

// Start server and cron scheduler
const port = config.port;

console.log('🚀 SIP Portfolio Advisor - CSS Strategy v4.3');
console.log('='.repeat(60));
console.log(`📡 Server starting on port ${port}...`);

serve({
  fetch: app.fetch,
  port
}, (info) => {
  console.log(`✅ Server running at http://localhost:${info.port}`);
  console.log('');
  console.log('Available endpoints:');
  console.log(`  GET  http://localhost:${info.port}/health`);
  console.log(`  GET  http://localhost:${info.port}/api/analyze`);
  console.log(`  POST http://localhost:${info.port}/api/analyze`);
  console.log(`  GET  http://localhost:${info.port}/api/history`);
  console.log(`  GET  http://localhost:${info.port}/api/history/latest`);
  console.log(`  GET  http://localhost:${info.port}/api/history/stats`);
  console.log('');
  
  // Setup cron scheduler
  const cronSchedule = config.cronSchedule;
  
  if (cron.validate(cronSchedule)) {
    console.log(`⏰ Cron scheduler enabled: ${cronSchedule}`);
    console.log(`   (${describeCronSchedule(cronSchedule)})`);
    
    cron.schedule(cronSchedule, () => {
      runScheduledAnalysis();
    }, {
      timezone: 'Pacific/Auckland'  // NZST timezone
    });
    
    console.log('   Timezone: Pacific/Auckland (NZST)');
  } else {
    console.log(`⚠️ Invalid cron schedule: ${cronSchedule}`);
    console.log('   Cron scheduler disabled');
  }
  
  console.log('');
  console.log('Configuration (CSS v4.3):');
  console.log(`  💰 Base Budget: $${config.weeklyInvestmentAmount} (Range: $${config.minBudget} - $${config.maxBudget})`);
  console.log(`  📈 Stocks: ${config.defaultStocks.join(', ')}`);
  console.log(`  📧 Email Recipients: ${config.emailTo.length}`);
  console.log(`  📦 Database: ${config.convexUrl ? 'Enabled (Convex)' : 'Disabled'}`);
  console.log('='.repeat(60));
});

/**
 * Describe cron schedule in human-readable format
 */
function describeCronSchedule(schedule: string): string {
  const parts = schedule.split(' ');
  if (parts.length !== 5) return schedule;
  
  const [minute, hour, , , dayOfWeek] = parts;
  
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayOfWeek === '*' ? 'every day' : days[parseInt(dayOfWeek)] || dayOfWeek;
  
  const timeStr = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  
  return `${dayName} at ${timeStr}`;
}

export default app;
