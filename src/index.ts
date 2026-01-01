import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import * as cron from 'node-cron';
import * as dotenv from 'dotenv';
import { analyzeRouter } from './routes/analyze';
import { loadConfig, validateConfig } from './utils/config';
import { PortfolioAllocationEngine } from './services/portfolioAllocation';
import { EmailService } from './services/email';

// Load environment variables
dotenv.config();

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

// Root endpoint with API info
app.get('/', (c) => {
  const config = loadConfig();
  return c.json({
    name: 'SIP Portfolio Advisor API',
    version: '1.0.0',
    description: 'AI-Powered Weekly Investment Allocation System',
    endpoints: {
      'GET /health': 'Health check for monitoring',
      'GET /api/analyze': 'Get latest analysis without sending email',
      'POST /api/analyze': 'Trigger analysis with optional parameters'
    },
    postBodyExample: {
      investmentAmount: 1500,
      stocks: ['QQQ', 'GOOG', 'TSLA'],
      sendEmail: true
    },
    configuration: {
      cronSchedule: config.cronSchedule,
      weeklyAmount: config.weeklyInvestmentAmount,
      stocks: config.defaultStocks,
      emailRecipients: config.emailTo.length
    }
  });
});

/**
 * Run the scheduled analysis job
 * Fetches market data, calculates allocations, and sends email report
 */
async function runScheduledAnalysis(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('⏰ SCHEDULED JOB TRIGGERED');
  console.log('='.repeat(60));
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    const config = loadConfig();
    
    if (!validateConfig(config)) {
      console.error('❌ Configuration validation failed');
      return;
    }

    console.log(`📧 Recipients: ${config.emailTo.join(', ')}`);
    console.log(`💰 Weekly Amount: $${config.weeklyInvestmentAmount}`);
    console.log(`📈 Stocks: ${config.defaultStocks.join(', ')}`);

    const engine = new PortfolioAllocationEngine();
    const report = await engine.generateAllocation(config);

    console.log('\n📊 Analysis complete!');
    console.log(`   VIX: ${report.vix.toFixed(2)} (${report.vixMultiplier}x)`);
    console.log(`   Market: ${report.marketCondition}`);
    console.log(`   Allocations: ${report.allocations.length}`);

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
const config = loadConfig();
const port = config.port;

console.log('🚀 SIP Portfolio Advisor - AI-Powered Weekly Allocation System');
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
  console.log('Configuration:');
  console.log(`  💰 Weekly Amount: $${config.weeklyInvestmentAmount}`);
  console.log(`  📈 Stocks: ${config.defaultStocks.join(', ')}`);
  console.log(`  📧 Email Recipients: ${config.emailTo.length}`);
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
