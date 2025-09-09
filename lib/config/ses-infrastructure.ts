import { config } from '../config';

/**
 * SES Infrastructure Configuration and AWS CLI Commands
 * 
 * This module provides configuration and utilities for managing
 * AWS SES email processing infrastructure.
 */

export interface SESInfrastructureStatus {
  sesReceiptRule: {
    active: boolean;
    enabled: boolean;
    recipients: string[];
    scanEnabled: boolean;
  };
  s3Bucket: {
    exists: boolean;
    region: string;
    accessible: boolean;
  };
  snsTopicArn: string;
  lambdaFunction: {
    name: string;
    status: string;
    lastModified: string;
    environmentVariables: Record<string, string>;
  };
}

/**
 * AWS CLI commands for SES infrastructure management
 */
export const SES_CLI_COMMANDS = {
  // SES Configuration Verification
  describeReceiptRuleSet: () => 
    `aws ses describe-receipt-rule-set --rule-set-name ${config.aws.ses.receiptRuleSet} --region ${config.aws.region}`,
  
  describeReceiptRule: () =>
    `aws ses describe-receipt-rule --rule-set-name ${config.aws.ses.receiptRuleSet} --rule-name ${config.aws.ses.receiptRuleName} --region ${config.aws.region}`,
  
  getIdentityVerificationAttributes: () =>
    `aws ses get-identity-verification-attributes --identities ${config.aws.ses.emailDomain} --region ${config.aws.region}`,
  
  // S3 Bucket Management
  getBucketPolicy: () =>
    `aws s3api get-bucket-policy --bucket ${config.aws.s3.rawEmailsBucket} --region ${config.aws.region}`,
  
  getBucketLocation: () =>
    `aws s3api get-bucket-location --bucket ${config.aws.s3.rawEmailsBucket}`,
  
  listRecentEmails: () =>
    `aws s3 ls s3://${config.aws.s3.rawEmailsBucket}/${config.aws.s3.emailPrefix} --recursive --human-readable`,
  
  // Lambda Function Management
  getLambdaFunction: () =>
    `aws lambda get-function --function-name ${config.aws.lambda.emailProcessorName} --region ${config.aws.region}`,
  
  getLambdaEnvironmentVariables: () =>
    `aws lambda get-function --function-name ${config.aws.lambda.emailProcessorName} --region ${config.aws.region} --query 'Configuration.Environment.Variables'`,
  
  updateLambdaEnvironmentVariables: (variables: Record<string, string>) => {
    const varsJson = JSON.stringify(variables).replace(/"/g, '\\"');
    return `aws lambda update-function-configuration --function-name ${config.aws.lambda.emailProcessorName} --environment Variables='${varsJson}' --region ${config.aws.region}`;
  },
  
  deployLambdaCode: (zipFilePath: string) =>
    `aws lambda update-function-code --function-name ${config.aws.lambda.emailProcessorName} --zip-file fileb://${zipFilePath} --region ${config.aws.region}`,
  
  getLambdaLogs: () =>
    `aws logs tail /aws/lambda/${config.aws.lambda.emailProcessorName} --follow --region ${config.aws.region}`,
  
  // SNS Topic Verification
  getSNSTopicAttributes: () =>
    `aws sns get-topic-attributes --topic-arn "${config.aws.sns.emailTopicArn}" --region ${config.aws.region}`,
  
  listSNSSubscriptions: () =>
    `aws sns list-subscriptions-by-topic --topic-arn "${config.aws.sns.emailTopicArn}" --region ${config.aws.region}`,
  
  // Health Check Commands
  verifyAllComponents: () => [
    `aws ses describe-configuration-set --configuration-set-name default --region ${config.aws.region}`,
    `aws s3api get-bucket-location --bucket ${config.aws.s3.rawEmailsBucket}`,
    `aws lambda get-function --function-name ${config.aws.lambda.emailProcessorName} --region ${config.aws.region} --query 'Configuration.Environment.Variables'`,
  ],
} as const;

/**
 * Expected Lambda environment variables for SES processing
 */
export const LAMBDA_ENVIRONMENT_VARIABLES = {
  RAW_BUCKET: config.aws.s3.rawEmailsBucket,
  APP_BASE_URL: process.env.DEPLOYED_APP_URL || 'https://main.d327zsd1iynpzj.amplifyapp.com',
  SHARED_SECRET: config.inboundProvider.sharedSecret || 'development-shared-secret-key',
} as const;

/**
 * S3 bucket policy template for SES access restriction
 */
export const S3_BUCKET_POLICY_TEMPLATE = {
  Version: '2012-10-17',
  Statement: [
    {
      Sid: 'AllowSESPutObject',
      Effect: 'Allow',
      Principal: {
        Service: 'ses.amazonaws.com',
      },
      Action: 's3:PutObject',
      Resource: `arn:aws:s3:::${config.aws.s3.rawEmailsBucket}/${config.aws.s3.emailPrefix}*`,
      Condition: {
        StringEquals: {
          'aws:SourceAccount': config.aws.accountId,
        },
        StringLike: {
          'aws:SourceArn': `arn:aws:ses:${config.aws.region}:${config.aws.accountId}:receipt-rule-set/${config.aws.ses.receiptRuleSet}:receipt-rule/${config.aws.ses.receiptRuleName}`,
        },
      },
    },
  ],
};

/**
 * Validate SES infrastructure configuration against AWS CLI output
 */
export function validateSESInfrastructure(cliOutput: {
  receiptRuleSet?: any;
  s3BucketLocation?: any;
  lambdaFunction?: any;
  snsTopicAttributes?: any;
}): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate receipt rule set
  if (cliOutput.receiptRuleSet) {
    const ruleSet = cliOutput.receiptRuleSet;
    const rule = ruleSet.Rules?.find((r: any) => r.Name === config.aws.ses.receiptRuleName);
    
    if (!rule) {
      errors.push(`Receipt rule '${config.aws.ses.receiptRuleName}' not found in rule set`);
    } else {
      if (!rule.Enabled) {
        errors.push('Receipt rule is not enabled');
      }
      if (!rule.ScanEnabled) {
        warnings.push('Spam and virus scanning is not enabled');
      }
      if (!rule.Recipients?.includes(`*@${config.aws.ses.emailDomain}`)) {
        errors.push(`Receipt rule does not include recipient pattern *@${config.aws.ses.emailDomain}`);
      }
    }
  }

  // Validate S3 bucket location
  if (cliOutput.s3BucketLocation) {
    const location = cliOutput.s3BucketLocation.LocationConstraint;
    if (location !== config.aws.region) {
      errors.push(`S3 bucket region mismatch: expected ${config.aws.region}, got ${location}`);
    }
  }

  // Validate Lambda function
  if (cliOutput.lambdaFunction) {
    const lambda = cliOutput.lambdaFunction;
    const envVars = lambda.Configuration?.Environment?.Variables || {};
    
    Object.entries(LAMBDA_ENVIRONMENT_VARIABLES).forEach(([key, expectedValue]) => {
      if (envVars[key] !== expectedValue) {
        warnings.push(`Lambda environment variable ${key} mismatch: expected '${expectedValue}', got '${envVars[key]}'`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Generate deployment script for Lambda function
 */
export function generateLambdaDeploymentScript(zipFilePath: string): string {
  return `#!/bin/bash
set -e

echo "Deploying Lambda function: ${config.aws.lambda.emailProcessorName}"

# Update environment variables
${SES_CLI_COMMANDS.updateLambdaEnvironmentVariables(LAMBDA_ENVIRONMENT_VARIABLES)}

# Deploy function code
${SES_CLI_COMMANDS.deployLambdaCode(zipFilePath)}

# Verify deployment
${SES_CLI_COMMANDS.getLambdaFunction()}

echo "Lambda deployment completed successfully"
`;
}

/**
 * Generate health check script for SES infrastructure
 */
export function generateHealthCheckScript(): string {
  return `#!/bin/bash
set -e

echo "Checking SES infrastructure health..."

echo "1. Checking SES receipt rule set..."
${SES_CLI_COMMANDS.describeReceiptRuleSet()}

echo "2. Checking S3 bucket location..."
${SES_CLI_COMMANDS.getBucketLocation()}

echo "3. Checking Lambda function status..."
${SES_CLI_COMMANDS.getLambdaFunction()}

echo "4. Checking SNS topic..."
${SES_CLI_COMMANDS.getSNSTopicAttributes()}

echo "SES infrastructure health check completed"
`;
}