import { loadConfig, validateConfig } from './utils/config';
import { PortfolioAllocationEngine } from './services/portfolioAllocation';
import { EmailService } from './services/email';

async function main() {
  console.log('🚀 SIP Portfolio Advisor - AI-Powered Weekly Allocation System');
  console.log('='.repeat(70));
  
  // Load configuration
  const config = loadConfig();
  
  if (!validateConfig(config)) {
    console.error('❌ Configuration validation failed. Please check your .env file.');
    process.exit(1);
  }

  console.log('\n📋 Configuration:');
  console.log(`   Investment Amount: $${config.weeklyInvestmentAmount}`);
  console.log(`   Stocks: ${config.defaultStocks.join(', ')}`);
  console.log(`   Risk Tolerance: ${config.riskTolerance}`);
  console.log(`   Email: ${config.emailTo}`);
  console.log('='.repeat(70));

  try {
    // Generate portfolio allocation
    console.log('\n🤖 Running AI-powered analysis...\n');
    const engine = new PortfolioAllocationEngine();
    const report = await engine.generateAllocation(config);

    console.log('\n='.repeat(70));
    console.log('📊 ALLOCATION RESULTS');
    console.log('='.repeat(70));
    console.log(`VIX: ${report.vix.toFixed(2)}`);
    console.log(`Market Condition: ${report.marketCondition}`);
    console.log(`\nRecommended Allocations:`);
    
    if (report.allocations.length === 0) {
      console.log('  No allocations recommended at this time.');
    } else {
      report.allocations.forEach(allocation => {
        console.log(`\n  ${allocation.symbol}:`);
        console.log(`    Amount: $${allocation.amount.toFixed(2)} (${allocation.percentage.toFixed(1)}%)`);
        console.log(`    Reason: ${allocation.reasoning}`);
      });
    }

    console.log(`\n📝 Recommendations:`);
    report.recommendations.forEach(rec => {
      console.log(`  • ${rec}`);
    });

    // Send email report
    console.log('\n='.repeat(70));
    console.log('📧 Sending email report...');
    
    const emailService = new EmailService(config);
    
    // Test connection first
    const connectionOk = await emailService.testConnection();
    
    if (connectionOk) {
      await emailService.sendReport(report, config.emailTo);
      console.log('✅ Report sent successfully!');
    } else {
      console.log('⚠️  Email not sent due to configuration issues.');
      console.log('💡 Please configure SMTP settings in .env file.');
      console.log('📄 Report generated successfully and displayed above.');
    }

    console.log('\n='.repeat(70));
    console.log('✨ Process completed successfully!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ Error occurred:', error);
    process.exit(1);
  }
}

// Run the application
main();
