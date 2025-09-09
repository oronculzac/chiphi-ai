#!/usr/bin/env node

/**
 * SES Lambda Deployment Script
 * 
 * This script deploys the Lambda function for SES email processing
 * and validates the entire infrastructure setup using AWS CLI commands.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  region: 'ap-southeast-1',
  accountId: '741960641851',
  functionName: 'chiphi-email-processor',
  bucketName: 'chiphi-raw-emails',
  snsTopicArn: 'arn:aws:sns:ap-southeast-1:741960641851:chiphi-email-notifications',
  ruleSetName: 'SESReceiptRuleSet',
  ruleName: 'chiphi-inbound-rule',
  domain: 'chiphi.oronculzac.com',
  appBaseUrl: 'https://main.d327zsd1iynpzj.amplifyapp.com'
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function execCommand(command, description) {
  log(`\n${colors.blue}Executing: ${description}${colors.reset}`);
  log(`Command: ${command}`);
  
  try {
    const result = execSync(command, { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    log(`${colors.green}✓ Success${colors.reset}`);
    return result;
  } catch (error) {
    log(`${colors.red}✗ Failed: ${error.message}${colors.reset}`);
    throw error;
  }
}

function validateInfrastructure() {
  log(`${colors.yellow}=== Infrastructure Validation ===${colors.reset}`);
  
  // 1. Verify SES receipt rule set
  try {
    const ruleSetResult = execCommand(
      `aws ses describe-receipt-rule-set --rule-set-name ${CONFIG.ruleSetName} --region ${CONFIG.region}`,
      'Checking SES receipt rule set status'
    );
    const ruleSet = JSON.parse(ruleSetResult);
    log(`Receipt rule set status: ${ruleSet.Metadata?.Name ? 'Active' : 'Not found'}`);
  } catch (error) {
    log(`${colors.red}Warning: SES receipt rule set validation failed${colors.reset}`);
  }

  // 2. Verify specific receipt rule
  try {
    const ruleResult = execCommand(
      `aws ses describe-receipt-rule --rule-set-name ${CONFIG.ruleSetName} --rule-name ${CONFIG.ruleName} --region ${CONFIG.region}`,
      'Checking SES receipt rule configuration'
    );
    const rule = JSON.parse(ruleResult);
    log(`Receipt rule enabled: ${rule.Rule?.Enabled || false}`);
  } catch (error) {
    log(`${colors.red}Warning: SES receipt rule validation failed${colors.reset}`);
  }

  // 3. Verify domain verification
  try {
    const domainResult = execCommand(
      `aws ses get-identity-verification-attributes --identities ${CONFIG.domain} --region ${CONFIG.region}`,
      'Checking domain verification status'
    );
    const domain = JSON.parse(domainResult);
    const verificationStatus = domain.VerificationAttributes?.[CONFIG.domain]?.VerificationStatus;
    log(`Domain verification status: ${verificationStatus || 'Unknown'}`);
  } catch (error) {
    log(`${colors.red}Warning: Domain verification check failed${colors.reset}`);
  }

  // 4. Check S3 bucket accessibility
  try {
    execCommand(
      `aws s3api head-bucket --bucket ${CONFIG.bucketName} --region ${CONFIG.region}`,
      'Checking S3 bucket accessibility'
    );
    log(`S3 bucket accessible: Yes`);
  } catch (error) {
    log(`${colors.red}Warning: S3 bucket not accessible${colors.reset}`);
  }

  // 5. Check S3 bucket policy
  try {
    const policyResult = execCommand(
      `aws s3api get-bucket-policy --bucket ${CONFIG.bucketName} --region ${CONFIG.region}`,
      'Checking S3 bucket policy'
    );
    log(`S3 bucket policy: Configured`);
  } catch (error) {
    log(`${colors.yellow}Warning: S3 bucket policy not found or not accessible${colors.reset}`);
  }

  // 6. Verify SNS topic
  try {
    const topicResult = execCommand(
      `aws sns get-topic-attributes --topic-arn "${CONFIG.snsTopicArn}" --region ${CONFIG.region}`,
      'Checking SNS topic configuration'
    );
    log(`SNS topic: Active`);
  } catch (error) {
    log(`${colors.red}Warning: SNS topic validation failed${colors.reset}`);
  }

  // 7. Check SNS subscriptions
  try {
    const subscriptionsResult = execCommand(
      `aws sns list-subscriptions-by-topic --topic-arn "${CONFIG.snsTopicArn}" --region ${CONFIG.region}`,
      'Checking SNS topic subscriptions'
    );
    const subscriptions = JSON.parse(subscriptionsResult);
    const lambdaSubscriptions = subscriptions.Subscriptions?.filter(sub => 
      sub.Protocol === 'lambda' && sub.Endpoint?.includes(CONFIG.functionName)
    );
    log(`Lambda subscriptions: ${lambdaSubscriptions?.length || 0}`);
  } catch (error) {
    log(`${colors.red}Warning: SNS subscriptions check failed${colors.reset}`);
  }
}

function deployLambdaFunction() {
  log(`${colors.yellow}=== Lambda Function Deployment ===${colors.reset}`);
  
  const lambdaDir = path.join(__dirname, '..', 'lambda-email-processor');
  const zipFile = path.join(lambdaDir, 'lambda-deployment.zip');
  
  // 1. Check if Lambda function exists
  let functionExists = false;
  try {
    execCommand(
      `aws lambda get-function --function-name ${CONFIG.functionName} --region ${CONFIG.region}`,
      'Checking if Lambda function exists'
    );
    functionExists = true;
    log(`Lambda function exists: Yes`);
  } catch (error) {
    log(`Lambda function exists: No`);
  }

  // 2. Check if deployment package exists
  if (!fs.existsSync(zipFile)) {
    log(`${colors.red}Error: Lambda deployment package not found at ${zipFile}${colors.reset}`);
    log(`Please run the following commands to create the deployment package:`);
    log(`cd ${lambdaDir}`);
    log(`npm install`);
    log(`zip -r lambda-deployment.zip index.mjs node_modules/`);
    throw new Error('Deployment package not found');
  }

  // 3. Update or create Lambda function
  if (functionExists) {
    // Update existing function code
    execCommand(
      `aws lambda update-function-code --function-name ${CONFIG.functionName} --zip-file fileb://${zipFile} --region ${CONFIG.region}`,
      'Updating Lambda function code'
    );
  } else {
    log(`${colors.yellow}Function does not exist. Please create it manually first.${colors.reset}`);
    return;
  }

  // 4. Update environment variables
  const envVars = {
    RAW_BUCKET: CONFIG.bucketName,
    APP_BASE_URL: CONFIG.appBaseUrl,
    SHARED_SECRET: process.env.SHARED_SECRET || 'development-shared-secret-key'
  };

  const envVarsJson = JSON.stringify(envVars).replace(/"/g, '\\"');
  
  execCommand(
    `aws lambda update-function-configuration --function-name ${CONFIG.functionName} --environment "Variables=${envVarsJson}" --region ${CONFIG.region}`,
    'Updating Lambda environment variables'
  );

  // 5. Verify function configuration
  const configResult = execCommand(
    `aws lambda get-function-configuration --function-name ${CONFIG.functionName} --region ${CONFIG.region}`,
    'Verifying Lambda function configuration'
  );
  
  const config = JSON.parse(configResult);
  log(`Function runtime: ${config.Runtime}`);
  log(`Function memory: ${config.MemorySize}MB`);
  log(`Function timeout: ${config.Timeout}s`);
  log(`Environment variables configured: ${Object.keys(config.Environment?.Variables || {}).length}`);
}

function validateDeployment() {
  log(`${colors.yellow}=== Deployment Validation ===${colors.reset}`);
  
  // 1. Check Lambda function status
  try {
    const statusResult = execCommand(
      `aws lambda get-function --function-name ${CONFIG.functionName} --region ${CONFIG.region} --query 'Configuration.[State,LastUpdateStatus]' --output text`,
      'Checking Lambda function status'
    );
    log(`Lambda function status: ${statusResult.trim()}`);
  } catch (error) {
    log(`${colors.red}Error: Could not verify Lambda function status${colors.reset}`);
  }

  // 2. Check recent Lambda logs
  try {
    log(`\nChecking recent Lambda logs (last 5 minutes)...`);
    const logsResult = execCommand(
      `aws logs filter-log-events --log-group-name "/aws/lambda/${CONFIG.functionName}" --start-time ${Date.now() - 300000} --region ${CONFIG.region} --query 'events[*].message' --output text`,
      'Checking recent Lambda execution logs'
    );
    
    if (logsResult.trim()) {
      log(`Recent log entries found`);
    } else {
      log(`No recent log entries (function may not have been invoked recently)`);
    }
  } catch (error) {
    log(`${colors.yellow}Warning: Could not retrieve Lambda logs${colors.reset}`);
  }

  // 3. Verify all components are in the same region
  log(`\nVerifying regional alignment...`);
  log(`Target region: ${CONFIG.region}`);
  
  try {
    const bucketLocationResult = execCommand(
      `aws s3api get-bucket-location --bucket ${CONFIG.bucketName}`,
      'Checking S3 bucket region'
    );
    const bucketLocation = JSON.parse(bucketLocationResult);
    const bucketRegion = bucketLocation.LocationConstraint || 'us-east-1';
    log(`S3 bucket region: ${bucketRegion}`);
    
    if (bucketRegion !== CONFIG.region) {
      log(`${colors.red}Warning: S3 bucket region mismatch!${colors.reset}`);
    }
  } catch (error) {
    log(`${colors.yellow}Warning: Could not verify S3 bucket region${colors.reset}`);
  }
}

function main() {
  log(`${colors.blue}SES Lambda Deployment Script${colors.reset}`);
  log(`Target region: ${CONFIG.region}`);
  log(`Function name: ${CONFIG.functionName}`);
  log(`App URL: ${CONFIG.appBaseUrl}`);
  
  try {
    // Step 1: Validate existing infrastructure
    validateInfrastructure();
    
    // Step 2: Deploy Lambda function
    deployLambdaFunction();
    
    // Step 3: Validate deployment
    validateDeployment();
    
    log(`${colors.green}\n=== Deployment Complete ===${colors.reset}`);
    log(`Lambda function deployed successfully!`);
    log(`\nNext steps:`);
    log(`1. Test the deployment by sending an email to test@${CONFIG.domain}`);
    log(`2. Monitor Lambda logs: aws logs tail /aws/lambda/${CONFIG.functionName} --follow --region ${CONFIG.region}`);
    log(`3. Check application logs for successful email processing`);
    
  } catch (error) {
    log(`${colors.red}\n=== Deployment Failed ===${colors.reset}`);
    log(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the deployment if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  CONFIG,
  validateInfrastructure,
  deployLambdaFunction,
  validateDeployment
};