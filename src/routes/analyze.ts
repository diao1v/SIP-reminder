import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PortfolioAllocationEngine } from '../services/portfolioAllocation';
import { EmailService } from '../services/email';
import { getDbService } from '../services/db.singleton';
import { getConfig } from '../utils/config';
import { analyzeBodySchema, formatZodError } from '../utils/validation';
import { AllocationReport, Config, DatabaseSaveResult } from '../types';

const analyzeRouter = new Hono();

/**
 * GET /api/analyze
 * Returns the analysis without sending email (useful for previewing or debugging)
 */
analyzeRouter.get('/', async (c) => {
  try {
    const config = getConfig();
    const engine = new PortfolioAllocationEngine();
    const report = await engine.generateAllocation(config);

    return c.json({
      success: true,
      report: formatReportForResponse(report),
      emailSent: false,
      savedToDatabase: false
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
analyzeRouter.post(
  '/',
  zValidator('json', analyzeBodySchema, (result, c) => {
    if (!result.success) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: formatZodError(result.error),
      }, 400);
    }
  }),
  async (c) => {
  try {
    const body = c.req.valid('json');
    const baseConfig = getConfig();

    // Create config with overrides from request body
    const config: Config = {
      ...baseConfig,
      weeklyInvestmentAmount: body.investmentAmount ?? baseConfig.weeklyInvestmentAmount,
      defaultStocks: body.stocks ?? baseConfig.defaultStocks
    };

    const shouldSendEmail = body.sendEmail ?? true;
    const shouldSaveToDatabase = body.saveToDatabase ?? true;

    const engine = new PortfolioAllocationEngine();
    const report = await engine.generateAllocation(config);

    let emailSent = false;
    let dbResult: DatabaseSaveResult = { success: false };

    // Send email if requested
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

    // Save to database if requested and configured
    if (shouldSaveToDatabase && config.convexUrl) {
      try {
        const db = getDbService(config.convexUrl);
        dbResult = await db.saveAnalysisReport(report);
      } catch (dbError) {
        console.error('Database save failed:', dbError);
        dbResult = { 
          success: false, 
          error: dbError instanceof Error ? dbError.message : 'Unknown error' 
        };
        // Continue without failing the whole request
      }
    }

    return c.json({
      success: true,
      report: formatReportForResponse(report),
      emailSent,
      savedToDatabase: dbResult.success,
      replacedExisting: dbResult.replaced ?? false,
      snapshotId: dbResult.snapshotId,
      databaseError: dbResult.success ? undefined : dbResult.error
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
