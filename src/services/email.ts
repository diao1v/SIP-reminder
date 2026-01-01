import * as nodemailer from 'nodemailer';
import { AllocationReport, Config, PortfolioAllocation, TechnicalDataRow } from '../types';

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
   * Send portfolio allocation report via email
   * Supports multiple recipients (array of email addresses)
   */
  async sendReport(report: AllocationReport, emailTo: string | string[]): Promise<void> {
    const html = this.generateHTML(report);
    const subject = `📊 Weekly Portfolio Allocation - ${this.formatDate(report.date)}`;
    
    // Convert array to comma-separated string for nodemailer
    const recipients = Array.isArray(emailTo) ? emailTo.join(', ') : emailTo;

    try {
      await this.transporter.sendMail({
        from: '"SIP Portfolio Advisor" <noreply@sip-reminder.com>',
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
  <title>Weekly Portfolio Allocation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 700px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          ${this.generateHeader(report)}
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
   * Generate header section
   */
  private generateHeader(report: AllocationReport): string {
    return `
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">📊 Weekly Portfolio Allocation</h1>
              <p style="margin: 10px 0 0; color: #e0e7ff; font-size: 16px;">${this.formatDate(report.date)}</p>
            </td>
          </tr>
    `;
  }

  /**
   * Generate market overview section
   */
  private generateMarketOverview(report: AllocationReport): string {
    const { marketConditionColor, marketConditionIcon } = this.getMarketConditionStyle(report.marketCondition);
    const vixMultiplierDisplay = report.vixMultiplier ? `${report.vixMultiplier}x` : '1.0x';

    return `
          <tr>
            <td style="padding: 30px 40px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 20px; font-weight: 600;">Market Environment</h2>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px; background-color: #f9fafb; border-radius: 6px;">
                    <table style="width: 100%;">
                      <tr>
                        <td style="width: 33%;">
                          <div style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">VIX Fear Index</div>
                          <div style="font-size: 24px; color: #1f2937; font-weight: 700;">${report.vix.toFixed(2)}</div>
                        </td>
                        <td style="width: 33%; text-align: center;">
                          <div style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">VIX Multiplier</div>
                          <div style="font-size: 20px; color: #10b981; font-weight: 600;">${vixMultiplierDisplay}</div>
                        </td>
                        <td style="width: 33%; text-align: right;">
                          <div style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">Market Condition</div>
                          <div style="font-size: 20px; font-weight: 600; color: ${marketConditionColor};">
                            ${marketConditionIcon} ${report.marketCondition}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
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
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 20px; font-weight: 600;">Investment Allocation Breakdown</h2>
              <div style="font-size: 14px; color: #6b7280; margin-bottom: 16px;">Weekly Total Budget: <strong style="color: #1f2937;">NZD ${report.totalAmount.toFixed(0)}</strong></div>
              
              ${this.generateAllocationsTable(report.allocations)}
            </td>
          </tr>
    `;
  }

  /**
   * Generate allocations table HTML
   */
  private generateAllocationsTable(allocations: PortfolioAllocation[]): string {
    if (allocations.length === 0) {
      return '<p style="color: #6b7280; font-style: italic;">No allocations recommended at this time.</p>';
    }

    let html = `
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Asset</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Base</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">BB×VIX×RSI</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Final</th>
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">RSI Status</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    allocations.forEach((allocation, index) => {
      const bgColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
      const multiplierDisplay = allocation.multiplier?.toFixed(3) || '1.000';
      const baseDisplay = allocation.baseAmount ? `NZD ${allocation.baseAmount}` : '-';
      
      html += `
          <tr style="background-color: ${bgColor};">
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">
              ${allocation.symbol}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280;">
              ${baseDisplay}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #6366f1; font-weight: 500;">
              ×${multiplierDisplay}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 700; color: #1f2937;">
              NZD ${allocation.amount.toFixed(0)}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px;">
              ${allocation.rsiRecommendation || allocation.reasoning}
            </td>
          </tr>
      `;
    });

    // Add total row
    const totalAmount = allocations.reduce((sum, a) => sum + a.amount, 0);
    html += `
          <tr style="background-color: #f3f4f6; font-weight: 700;">
            <td style="padding: 12px;" colspan="3">TOTAL WEEKLY</td>
            <td style="padding: 12px; text-align: right; color: #1f2937;">NZD ${totalAmount.toFixed(0)}</td>
            <td style="padding: 12px;"></td>
          </tr>
        </tbody>
      </table>
    `;

    return html;
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
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb;">Asset</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb;">Price</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb;">RSI(14)</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb;">MA20</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb;">ATR(14)</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb;">BB Width</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb;">Entry Point</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.forEach((row, index) => {
      const bgColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
      const entryStyle = row.isGoodEntry ? 'color: #10b981; font-weight: 600;' : 'color: #6b7280;';
      
      html += `
          <tr style="background-color: ${bgColor};">
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${row.symbol}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${row.price.toFixed(2)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; ${this.getRSIStyle(row.rsi)}">${row.rsi.toFixed(1)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${row.ma20.toFixed(2)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${row.atr.toFixed(2)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${row.bbWidth.toFixed(1)}%</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; ${entryStyle}">$${row.entryPoint.toFixed(2)}${row.isGoodEntry ? ' ✓' : ''}</td>
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
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 20px; font-weight: 600;">Actionable Guidance</h2>
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
      const bgColor = recommendation.includes('PRIORITY') || recommendation.includes('✅') 
        ? '#f0fdf4' 
        : recommendation.includes('PAUSE') || recommendation.includes('🔴') || recommendation.includes('⚠️')
        ? '#fef2f2'
        : '#f0f9ff';
      
      const borderColor = recommendation.includes('PRIORITY') || recommendation.includes('✅')
        ? '#10b981'
        : recommendation.includes('PAUSE') || recommendation.includes('🔴') || recommendation.includes('⚠️')
        ? '#ef4444'
        : '#3b82f6';

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
                Generated by SIP Portfolio Advisor • Five-Dimensional Dynamic Adjustment System
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
