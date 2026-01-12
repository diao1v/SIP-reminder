import * as nodemailer from 'nodemailer';
import { AllocationReport, Config, PortfolioAllocation, TechnicalDataRow } from '../types';

/**
 * Email Service
 *
 * Sends HTML portfolio allocation reports via SMTP.
 *
 * ## Error Handling Strategy: THROWS ON FAILURE
 *
 * Unlike other services, email failures are re-thrown because:
 * - Email is an explicit user action, not background data fetching
 * - Users should know if their report wasn't delivered
 * - Callers can catch and handle gracefully (e.g., retry, notify)
 *
 * Use `testConnection()` to verify SMTP config before sending.
 */
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(config: Config) {
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass
      },
      requireTLS: config.smtp.port === 587
    });
  }

  /**
   * Send portfolio allocation report via email.
   *
   * @param report - The allocation report to send
   * @param emailTo - Single email or array of recipients
   * @throws Error if sending fails (SMTP error, auth failure, etc.)
   *
   * @remarks
   * This method THROWS on failure - wrap in try/catch if graceful handling needed.
   */
  async sendReport(report: AllocationReport, emailTo: string | string[]): Promise<void> {
    const html = this.generateHTML(report);
    const subject = `📊 Weekly Portfolio Allocation (CSS v4.3) - ${this.formatDate(report.date)}`;
    
    // Convert array to comma-separated string for nodemailer
    const recipients = Array.isArray(emailTo) ? emailTo.join(', ') : emailTo;

    try {
      await this.transporter.sendMail({
        from: '"SIP Portfolio Reminder Bot" <sip_reminder@mail.diaoev.com>',
        to: recipients,
        subject,
        html
      });
      const recipientCount = Array.isArray(emailTo) ? emailTo.length : 1;
      console.log(`✅ Email sent successfully to ${recipientCount} recipient(s)!`);
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Generate professional HTML email report
   */
  private generateHTML(report: AllocationReport): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Portfolio Allocation (CSS v4.3)</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 700px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          ${this.generateHeader(report)}
          ${this.generateDataSourceWarnings(report)}
          ${report.fearGreedFailed ? this.generateFearGreedWarning() : ''}
          ${this.generateMarketOverview(report)}
          ${this.generateAllocationsSection(report)}
          ${this.generateTechnicalDataSection(report)}
          ${this.generateRecommendationsSection(report)}
          ${this.generateFooter()}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Generate data source fallback warnings
   */
  private generateDataSourceWarnings(report: AllocationReport): string {
    const warnings: string[] = [];
    
    if (report.dataSourceStatus) {
      if (report.dataSourceStatus.marketDataSource === 'axios-fallback') {
        warnings.push('Market data fetched via axios fallback (yahoo-finance2 library failed)');
      }
      if (report.dataSourceStatus.indicatorSource === 'custom-fallback') {
        warnings.push('Technical indicators calculated via custom fallback (technicalindicators library failed)');
      }
    }

    if (warnings.length === 0) {
      return '';
    }

    return `
          <tr>
            <td style="padding: 0;">
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 40px; margin: 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">
                  ⚠️ Data Source Fallback Active
                </p>
                ${warnings.map(w => `<p style="margin: 8px 0 0; color: #b45309; font-size: 13px;">• ${w}</p>`).join('')}
              </div>
            </td>
          </tr>
    `;
  }

  /**
   * Generate header section
   */
  private generateHeader(report: AllocationReport): string {
    return `
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">📊 Weekly Portfolio Allocation</h1>
              <p style="margin: 10px 0 0; color: #e0e7ff; font-size: 16px;">${this.formatDate(report.date)}</p>
              <p style="margin: 5px 0 0; color: #c4b5fd; font-size: 12px;">CSS Strategy v4.3</p>
            </td>
          </tr>
    `;
  }

  /**
   * Generate Fear & Greed failure warning banner
   */
  private generateFearGreedWarning(): string {
    return `
          <tr>
            <td style="padding: 0;">
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 40px; margin: 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">
                  ⚠️ Fear & Greed Index Fetch Failed
                </p>
                <p style="margin: 8px 0 0; color: #b45309; font-size: 13px;">
                  CNN Fear & Greed data could not be retrieved. VIX weight has been doubled to 40% as fallback.
                </p>
              </div>
            </td>
          </tr>
    `;
  }

  /**
   * Generate market overview section
   */
  private generateMarketOverview(report: AllocationReport): string {
    const { marketConditionColor, marketConditionIcon } = this.getMarketConditionStyle(report.marketCondition);
    const fearGreedDisplay = report.fearGreedIndex !== null 
      ? `${report.fearGreedIndex}` 
      : '<span style="color: #f59e0b;">N/A</span>';

    return `
          <tr>
            <td style="padding: 30px 40px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 20px; font-weight: 600;">Market Environment</h2>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px; background-color: #f9fafb; border-radius: 6px;">
                    <table style="width: 100%;">
                      <tr>
                        <td style="width: 25%;">
                          <div style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">VIX</div>
                          <div style="font-size: 24px; color: #1f2937; font-weight: 700;">${report.vix.toFixed(2)}</div>
                        </td>
                        <td style="width: 25%; text-align: center;">
                          <div style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">Fear & Greed</div>
                          <div style="font-size: 20px; color: #1f2937; font-weight: 600;">${fearGreedDisplay}</div>
                        </td>
                        <td style="width: 25%; text-align: center;">
                          <div style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">Market CSS</div>
                          <div style="font-size: 20px; color: #6366f1; font-weight: 600;">${report.marketCSS.toFixed(0)}</div>
                        </td>
                        <td style="width: 25%; text-align: right;">
                          <div style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">Condition</div>
                          <div style="font-size: 18px; font-weight: 600; color: ${marketConditionColor};">
                            ${marketConditionIcon} ${report.marketCondition}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <div style="margin-top: 16px; padding: 12px; background-color: #eff6ff; border-radius: 6px;">
                <table style="width: 100%;">
                  <tr>
                    <td style="font-size: 13px; color: #1e40af;">
                      <strong>Budget Range:</strong> $${report.minBudget} - $${report.maxBudget}
                    </td>
                    <td style="text-align: right; font-size: 13px; color: #1e40af;">
                      <strong>This Week:</strong> $${report.totalAmount.toFixed(0)} (${(report.totalAmount / report.baseBudget * 100).toFixed(0)}% of base)
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
    `;
  }

  /**
   * Generate allocations section
   */
  private generateAllocationsSection(report: AllocationReport): string {
    return `
          <tr>
            <td style="padding: 0 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 20px; font-weight: 600;">Investment Allocation (CSS v4.3)</h2>
              
              ${this.generateAllocationsTable(report.allocations, report.baseBudget)}
            </td>
          </tr>
    `;
  }

  /**
   * Generate allocations table HTML
   */
  private generateAllocationsTable(allocations: PortfolioAllocation[], baseBudget: number): string {
    if (allocations.length === 0) {
      return '<p style="color: #6b7280; font-style: italic;">No allocations calculated.</p>';
    }

    let html = `
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Asset</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Base</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">CSS</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Multi</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Final</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    allocations.forEach((allocation, index) => {
      const bgColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
      const cssColor = this.getCSSColor(allocation.cssScore);
      
      html += `
          <tr style="background-color: ${bgColor};">
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
              <div style="font-weight: 600;">${allocation.symbol}</div>
              <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">${allocation.reasoning}</div>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280;">
              $${allocation.baseAmount}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
              <span style="background-color: ${cssColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                ${allocation.cssScore.toFixed(0)}
              </span>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #6366f1; font-weight: 500;">
              ${allocation.multiplier}×
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 700; color: #1f2937;">
              $${allocation.amount}
            </td>
          </tr>
      `;
    });

    // Add total row
    const totalAmount = allocations.reduce((sum, a) => sum + a.amount, 0);
    const totalMultiplier = totalAmount / baseBudget;
    
    html += `
          <tr style="background-color: #f3f4f6; font-weight: 700;">
            <td style="padding: 12px;" colspan="2">TOTAL</td>
            <td style="padding: 12px; text-align: center;"></td>
            <td style="padding: 12px; text-align: center; color: #6366f1;">${totalMultiplier.toFixed(2)}×</td>
            <td style="padding: 12px; text-align: right; color: #1f2937;">$${totalAmount.toFixed(0)}</td>
          </tr>
        </tbody>
      </table>
    `;

    return html;
  }

  /**
   * Get CSS score color
   */
  private getCSSColor(css: number): string {
    if (css <= 20) return '#ef4444'; // Red - Extreme Greed
    if (css <= 35) return '#f97316'; // Orange - Greed
    if (css <= 50) return '#eab308'; // Yellow - Slightly Greedy
    if (css <= 60) return '#22c55e'; // Green - Neutral
    if (css <= 75) return '#3b82f6'; // Blue - Fear
    return '#8b5cf6'; // Purple - Extreme Fear
  }

  /**
   * Generate technical data section
   */
  private generateTechnicalDataSection(report: AllocationReport): string {
    if (!report.technicalData || report.technicalData.length === 0) {
      return '';
    }

    return `
          <tr>
            <td style="padding: 0 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 20px; font-weight: 600;">Technical Reference Data</h2>
              ${this.generateTechnicalTable(report.technicalData)}
            </td>
          </tr>
    `;
  }

  /**
   * Generate technical data table
   */
  private generateTechnicalTable(data: TechnicalDataRow[]): string {
    let html = `
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Asset</th>
            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">Price</th>
            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">RSI</th>
            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">MA50</th>
            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">vs MA50</th>
            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">BB Width</th>
            <th style="padding: 8px; text-align: center; border-bottom: 2px solid #e5e7eb;">CSS</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.forEach((row, index) => {
      const bgColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
      const ma50Color = row.ma50Deviation < -5 ? '#10b981' : row.ma50Deviation > 5 ? '#ef4444' : '#6b7280';
      const cssColor = this.getCSSColor(row.cssScore);
      
      html += `
          <tr style="background-color: ${bgColor};">
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${row.symbol}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${row.price.toFixed(2)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; ${this.getRSIStyle(row.rsi)}">${row.rsi.toFixed(1)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${row.ma50.toFixed(2)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: ${ma50Color}; font-weight: 500;">${row.ma50Deviation > 0 ? '+' : ''}${row.ma50Deviation.toFixed(1)}%</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${row.bbWidth.toFixed(1)}%</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">
              <span style="background-color: ${cssColor}; color: white; padding: 2px 6px; border-radius: 10px; font-size: 11px; font-weight: 600;">
                ${row.cssScore.toFixed(0)}
              </span>
            </td>
          </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    return html;
  }

  /**
   * Generate recommendations section
   */
  private generateRecommendationsSection(report: AllocationReport): string {
    return `
          <tr>
            <td style="padding: 0 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 20px; font-weight: 600;">Recommendations</h2>
              ${this.generateRecommendationsList(report.recommendations)}
            </td>
          </tr>
    `;
  }

  /**
   * Generate recommendations list HTML
   */
  private generateRecommendationsList(recommendations: string[]): string {
    if (recommendations.length === 0) {
      return '<p style="color: #6b7280; font-style: italic;">No specific recommendations at this time.</p>';
    }

    let html = '<ul style="margin: 0; padding: 0; list-style: none;">';
    
    recommendations.forEach(recommendation => {
      const { bgColor, borderColor } = this.getRecommendationStyle(recommendation);

      html += `
        <li style="padding: 12px 16px; margin-bottom: 8px; background-color: ${bgColor}; border-left: 4px solid ${borderColor}; border-radius: 4px;">
          <span style="font-size: 14px; color: #1f2937; line-height: 1.5;">
            ${recommendation}
          </span>
        </li>
      `;
    });

    html += '</ul>';
    return html;
  }

  /**
   * Get recommendation styling based on content
   */
  private getRecommendationStyle(recommendation: string): { bgColor: string; borderColor: string } {
    if (recommendation.includes('⚠️') || recommendation.includes('FAILED')) {
      return { bgColor: '#fef3c7', borderColor: '#f59e0b' };
    }
    if (recommendation.includes('🎯') || recommendation.includes('💡')) {
      return { bgColor: '#f0fdf4', borderColor: '#10b981' };
    }
    if (recommendation.includes('📉') || recommendation.includes('🔥')) {
      return { bgColor: '#fef2f2', borderColor: '#ef4444' };
    }
    return { bgColor: '#f0f9ff', borderColor: '#3b82f6' };
  }

  /**
   * Generate footer section
   */
  private generateFooter(): string {
    return `
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                <strong>Disclaimer:</strong> This report is for informational purposes only and does not constitute financial advice. 
                Always conduct your own research and consult with a financial advisor before making investment decisions.
              </p>
              <p style="margin: 16px 0 0; color: #9ca3af; font-size: 12px;">
                Generated by SIP Portfolio Advisor • CSS Strategy v4.3
              </p>
            </td>
          </tr>
    `;
  }

  /**
   * Get market condition styling
   */
  private getMarketConditionStyle(condition: string): { marketConditionColor: string; marketConditionIcon: string } {
    switch (condition) {
      case 'BULLISH':
        return { marketConditionColor: '#10b981', marketConditionIcon: '📈' };
      case 'BEARISH':
        return { marketConditionColor: '#ef4444', marketConditionIcon: '📉' };
      default:
        return { marketConditionColor: '#f59e0b', marketConditionIcon: '➡️' };
    }
  }

  /**
   * Get RSI styling based on value
   */
  private getRSIStyle(rsi: number): string {
    if (rsi < 30) return 'color: #10b981; font-weight: 600;'; // Oversold - green
    if (rsi > 70) return 'color: #ef4444; font-weight: 600;'; // Overbought - red
    return 'color: #6b7280;'; // Normal
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('✅ Email configuration verified successfully');
      return true;
    } catch (error) {
      console.error('❌ Email configuration error:', error);
      return false;
    }
  }
}
