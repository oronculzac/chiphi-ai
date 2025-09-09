#!/usr/bin/env node

/**
 * Lambda Configuration Deployment Script
 * 
 * This script updates the Lambda function environment variables
 * based on the current configuration settings.
 */

const { execSync } = require('child_process');
const path = require('path');

// Load configuration from environment
const config = {
  aws: {
    region: process.env.AWS_REGION || 'ap-southeast-1',
    lambda: {
      emailProcessorName: process.env.LAMBDA_EMAIL_PROCESSOR_NAME || 'chiphi-email-processor',
    },
  },
  s3: {
    rawEmailsBucket: process.env.S3_RAW_EMAILS_BUCKET || 'chiphi-raw-emails',
  },
  app: {
    baseUrl: process.env.DEPLOYED_APP_URL || 'https://main.d327zsd1iynpzj.amplifyapp.com',
  },
  sharedSecret: process.env.SHARED_SECRET || 'development-shared-secret-key',
};

console.log('🚀 Lambda Configuration Deployment\n');

// Validate required environment variables
const requiredVars = [
  'AWS_REGION',
  'LAMBDA_EMAIL_PROCESSOR_NAME',
  'S3_RAW_EMAILS_BUCKET',
  'SHARED_SECRET',
];

const missing = requiredVars.filter(varName => !process.env[varName]);
if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(varName => console.error(`   - ${varName}`));
  console.error('\nPlease set these variables and try again.');
  process.exit(1);
}

// Prepare Lambda environment variables
const lambdaEnvVars = {
  RAW_BUCKET: config.s3.rawEmailsBucket,
  APP_BASE_URL: config.app.baseUrl,
  SHARED_SECRET: config.sharedSecret,
};

console.log('📋 Lambda Environment Variables:');
Object.entries(lambdaEnvVars).forEach(([key, value]) => {
  const displayValue = key === 'SHARED_SECRET' ? '***REDACTED***' : value;
  console.log(`   ${key}=${displayValue}`);
});
console.log();

// Update Lambda function environment variables
try {
  console.log('🔄 Updating Lambda function environment variables...');
  
  const varsJson = JSON.stringify(lambdaEnvVars);
  const command = `aws lambda update-function-configuration --function-name ${config.aws.lambda.emailProcessorName} --environment Variables='${varsJson}' --region ${config.aws.region}`;
  
  const result = execSync(command, { encoding: 'utf8' });
  const response = JSON.parse(result);
  
  console.log('✅ Lambda function updated successfully');
  console.log(`   Function Name: ${response.FunctionName}`);
  console.log(`   Runtime: ${response.Runtime}`);
  console.log(`   Last Modified: ${response.LastModified}`);
  console.log(`   Memory Size: ${response.MemorySize} MB`);
  console.log(`   Timeout: ${response.Timeout} seconds`);
  
} catch (error) {
  console.error('❌ Failed to update Lambda function:');
  console.error(error.message);
  process.exit(1);
}

// Verify the update
try {
  console.log('\n🔍 Verifying Lambda configuration...');
  
  const verifyCommand = `aws lambda get-function --function-name ${config.aws.lambda.emailProcessorName} --region ${config.aws.region} --query 'Configuration.Environment.Variables'`;
  const verifyResult = execSync(verifyCommand, { encoding: 'utf8' });
  const currentEnvVars = JSON.parse(verifyResult);
  
  console.log('📋 Current Lambda Environment Variables:');
  Object.entries(currentEnvVars).forEach(([key, value]) => {
    const displayValue = key === 'SHARED_SECRET' ? '***REDACTED***' : value;
    const status = lambdaEnvVars[key] === value ? '✅' : '❌';
    console.log(`   ${status} ${key}=${displayValue}`);
  });
  
  // Check for mismatches
  const mismatches = Object.entries(lambdaEnvVars).filter(([key, expectedValue]) => 
    currentEnvVars[key] !== expectedValue
  );
  
  if (mismatches.length > 0) {
    console.log('\n⚠️  Environment variable mismatches detected:');
    mismatches.forEach(([key, expectedValue]) => {
      console.log(`   ${key}: expected '${expectedValue}', got '${currentEnvVars[key]}'`);
    });
  } else {
    console.log('\n🎉 All environment variables are correctly configured!');
  }
  
} catch (error) {
  console.error('\n❌ Failed to verify Lambda configuration:');
  console.error(error.message);
}

// Run infrastructure validation
try {
  console.log('\n🔍 Running infrastructure validation...');
  
  // Import and run validation functions
  const validationScript = path.join(__dirname, 'validate-ses-infrastructure.js');
  const validationCommand = `node "${validationScript}"`;
  
  execSync(validationCommand, { stdio: 'inherit' });
  console.log('\n✅ Infrastructure validation completed successfully!');
  
} catch (error) {
  console.log('\n⚠️  Infrastructure validation found issues. Check the output above for details.');
  console.log('   Run: node scripts/validate-ses-infrastructure.js for detailed validation');
}

console.log('\n📚 Next steps:');
console.log('   1. Test the Lambda function with a sample email');
console.log('   2. Check CloudWatch logs for any errors');
console.log('   3. Run npm run validate:ses-config to verify full setup');
console.log('   4. Send a test email to verify end-to-end processing');
console.log('   5. Review docs/ses-troubleshooting-guide.md if issues occur');

console.log('\n✅ Lambda configuration deployment completed!');