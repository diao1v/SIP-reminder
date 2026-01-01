import * as nodemailer from 'nodemailer';
import { AllocationReport, Config } from '../types';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(config: Config) {
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465, // Use TLS for port 465
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass
      },
      // Enable STARTTLS for port 587
      requireTLS: config.smtp.port === 587
    });
  }

  /**
   * Send portfolio allocation report via email
   */
  async sendReport(report: AllocationReport, emailTo: string): Promise<void> {
    const html = this.generateHTML(report);
    const subject = `📊 Weekly Portfolio Allocation - ${this.formatDate(report.date)}`;

    try {
      await this.transporter.sendMail({
        from: '"SIP Portfolio Advisor" <noreply@sip-reminder.com>',
        to: emailTo,
        subject,
        html
      });
      console.log('✅ Email sent successfully!');
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Generate professional HTML email report
   */
  private generateHTML(report: AllocationReport): string {
    const marketConditionColor = 
      report.marketCondition === 'BULLISH' ? '#10b981' :
      report.marketCondition === 'BEARISH' ? '#ef4444' : '#f59e0b';

    const marketConditionIcon = 
      report.marketCondition === 'BULLISH' ? '📈' :
      report.marketCondition === 'BEARISH' ? '📉' : '➡️';

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
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">📊 Weekly Portfolio Allocation</h1>
              <p style="margin: 10px 0 0; color: #e0e7ff; font-size: 16px;">${this.formatDate(report.date)}</p>
            </td>
          </tr>

          <!-- Market Overview -->
          <tr>
            <td style="padding: 30px 40px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 20px; font-weight: 600;">Market Overview</h2>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px; background-color: #f9fafb; border-radius: 6px;">
                    <table style="width: 100%;">
                      <tr>
                        <td style="width: 50%;">
                          <div style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">VIX Index</div>
                          <div style="font-size: 24px; color: #1f2937; font-weight: 700;">${report.vix.toFixed(2)}</div>
                        </td>
                        <td style="width: 50%; text-align: right;">
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

          <!-- Portfolio Allocations -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 20px; font-weight: 600;">Recommended Allocations</h2>
              <div style="font-size: 14px; color: #6b7280; margin-bottom: 16px;">Total Investment: <strong style="color: #1f2937;">$${report.totalAmount.toFixed(2)}</strong></div>
              
              ${this.generateAllocationsTable(report)}
            </td>
          </tr>

          <!-- Recommendations -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 20px; font-weight: 600;">Expert Recommendations</h2>
              ${this.generateRecommendationsList(report)}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                <strong>Disclaimer:</strong> This report is for informational purposes only and does not constitute financial advice. 
                Always conduct your own research and consult with a financial advisor before making investment decisions.
              </p>
              <p style="margin: 16px 0 0; color: #9ca3af; font-size: 12px;">
                Generated by SIP Portfolio Advisor • AI-Powered Technical Analysis
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Generate allocations table HTML
   */
  private generateAllocationsTable(report: AllocationReport): string {
    if (report.allocations.length === 0) {
      return '<p style="color: #6b7280; font-style: italic;">No allocations recommended at this time.</p>';
    }

    let html = '<table style="width: 100%; border-collapse: collapse;">';
    
    report.allocations.forEach((allocation, index) => {
      const bgColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
      
      html += `
        <tr style="background-color: ${bgColor};">
          <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
            <div style="font-size: 16px; font-weight: 600; color: #1f2937; margin-bottom: 4px;">
              ${allocation.symbol}
            </div>
            <div style="font-size: 13px; color: #6b7280;">
              ${allocation.reasoning}
            </div>
          </td>
          <td style="padding: 16px; border-bottom: 1px solid #e5e7eb; text-align: right; white-space: nowrap;">
            <div style="font-size: 18px; font-weight: 700; color: #1f2937; margin-bottom: 4px;">
              $${allocation.amount.toFixed(2)}
            </div>
            <div style="font-size: 13px; color: #6b7280;">
              ${allocation.percentage.toFixed(1)}%
            </div>
          </td>
        </tr>
      `;
    });

    html += '</table>';
    return html;
  }

  /**
   * Generate recommendations list HTML
   */
  private generateRecommendationsList(report: AllocationReport): string {
    if (report.recommendations.length === 0) {
      return '<p style="color: #6b7280; font-style: italic;">No specific recommendations at this time.</p>';
    }

    let html = '<ul style="margin: 0; padding: 0; list-style: none;">';
    
    report.recommendations.forEach(recommendation => {
      html += `
        <li style="padding: 12px 16px; margin-bottom: 8px; background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
          <span style="font-size: 14px; color: #065f46; line-height: 1.5;">
            ${recommendation}
          </span>
        </li>
      `;
    });

    html += '</ul>';
    return html;
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
