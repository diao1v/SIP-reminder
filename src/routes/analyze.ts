import { Hono } from 'hono';
import { PortfolioAllocationEngine } from '../services/portfolioAllocation';
import { EmailService } from '../services/email';
import { loadConfig } from '../utils/config';
import { AllocationReport, Config } from '../types';

const analyzeRouter = new Hono();

interface AnalyzeRequestBody {
  investmentAmount?: number;
  stocks?: string[];
  sendEmail?: boolean;
}

/**
 * GET /api/analyze
 * Returns the analysis without sending email (useful for previewing or debugging)
 */
analyzeRouter.get('/', async (c) => {
  try {
    const config = loadConfig();
    const engine = new PortfolioAllocationEngine();
    const report = await engine.generateAllocation(config);

    return c.json({
      success: true,
      report: formatReportForResponse(report),
      emailSent: false
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, 500);
  }
});

/**
 * POST /api/analyze
 * Manual trigger for one-off investment analysis
 * Accepts optional parameters to override config
 */
analyzeRouter.post('/', async (c) => {
  try {
    const body = await c.req.json<AnalyzeRequestBody>().catch((): AnalyzeRequestBody => ({}));
    const baseConfig = loadConfig();

    // Create config with overrides from request body
    const config: Config = {
      ...baseConfig,
      weeklyInvestmentAmount: body.investmentAmount ?? baseConfig.weeklyInvestmentAmount,
      defaultStocks: body.stocks ?? baseConfig.defaultStocks
    };

    const shouldSendEmail = body.sendEmail ?? true;

    const engine = new PortfolioAllocationEngine();
    const report = await engine.generateAllocation(config);

    let emailSent = false;

    if (shouldSendEmail && config.emailTo.length > 0) {
      try {
        const emailService = new EmailService(config);
        const connectionOk = await emailService.testConnection();
        
        if (connectionOk) {
          await emailService.sendReport(report, config.emailTo);
          emailSent = true;
        }
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Continue without failing the whole request
      }
    }

    return c.json({
      success: true,
      report: formatReportForResponse(report),
      emailSent
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, 500);
  }
});

/**
 * Format report for JSON response (convert Date to ISO string)
 */
function formatReportForResponse(report: AllocationReport) {
  return {
    ...report,
    date: report.date.toISOString()
  };
}

export { analyzeRouter };
