import { z } from 'zod';

// Build-safe environment variable access
const isBuildTime = process.env.NODE_ENV === undefined || process.env.NEXT_PHASE === 'phase-production-build';

// Environment variable schema validation (only enforced at runtime, not build time)
const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_MAX_TOKENS: z.coerce.number().default(4000),

  // Email Processing (removed unused providers in production)
  EMAIL_DOMAIN: z.string().default('chiphi.ai'),

  // Rate Limiting
  RATE_LIMIT_PER_ORG_PER_HOUR: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().default(60),

  // AI Processing
  AI_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(100).default(70),
  MAX_TRANSLATION_RETRIES: z.coerce.number().default(3),
  MAX_EXTRACTION_RETRIES: z.coerce.number().default(3),

  // Security
  WEBHOOK_TIMEOUT_SECONDS: z.coerce.number().default(30),
  MAX_EMAIL_SIZE_MB: z.coerce.number().default(10),
  ALLOWED_EMAIL_DOMAINS: z.string().default('gmail.com,outlook.com,yahoo.com,icloud.com'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ENABLE_PROCESSING_LOGS: z.coerce.boolean().default(true),
  LOG_FORMAT: z.enum(['text', 'json']).default('text'),
  LOG_TIMESTAMP: z.coerce.boolean().default(true),
  LOG_CORRELATION_ID: z.coerce.boolean().default(false),

  // Database Connection Pooling
  DATABASE_MAX_CONNECTIONS: z.coerce.number().default(10),
  DATABASE_IDLE_TIMEOUT: z.coerce.number().default(30000),
  DATABASE_CONNECTION_TIMEOUT: z.coerce.number().default(10000),

  // Performance Monitoring
  ENABLE_PERFORMANCE_MONITORING: z.coerce.boolean().default(false),
  PERFORMANCE_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  SLOW_QUERY_THRESHOLD_MS: z.coerce.number().default(1000),

  // Health Check Configuration
  HEALTH_CHECK_TIMEOUT_MS: z.coerce.number().default(5000),
  HEALTH_CHECK_INTERVAL_MS: z.coerce.number().default(30000),

  // Error Tracking (removed unused Sentry in production)

  // Inbound Email Provider
  INBOUND_PROVIDER: z.enum(['cloudflare', 'ses', 'gmail']).default('ses'),
  CLOUDFLARE_EMAIL_SECRET: z.string().optional(),
  SES_WEBHOOK_SECRET: z.string().optional(),
  SHARED_SECRET: z.string().optional(),

  // AWS SES Configuration
  AWS_REGION: z.string().default('ap-southeast-1'),
  AWS_ACCOUNT_ID: z.string().optional(),
  SES_RECEIPT_RULE_SET: z.string().default('SESReceiptRuleSet'),
  SES_RECEIPT_RULE_NAME: z.string().default('chiphi-inbound-rule'),
  SES_EMAIL_DOMAIN: z.string().default('chiphi.oronculzac.com'),

  // AWS S3 Configuration
  S3_RAW_EMAILS_BUCKET: z.string().default('chiphi-raw-emails'),
  S3_EMAIL_PREFIX: z.string().default('emails/'),

  // AWS SNS Configuration
  SNS_EMAIL_TOPIC_ARN: z.string().optional(),

  // AWS Lambda Configuration
  LAMBDA_EMAIL_PROCESSOR_NAME: z.string().default('chiphi-email-processor'),
  LAMBDA_EMAIL_PROCESSOR_ARN: z.string().optional(),
  LAMBDA_TIMEOUT_SECONDS: z.coerce.number().default(30),
  LAMBDA_MEMORY_MB: z.coerce.number().default(256),

  // Visual Testing
  VISUAL_REGRESSION_THRESHOLD: z.coerce.number().min(0).max(1).default(0.01),
  ENABLE_VISUAL_TESTS: z.coerce.boolean().default(true),

  // Diagnostic Settings
  ENABLE_DEBUG_ENDPOINTS: z.coerce.boolean().default(false),
  STYLE_PROBE_ENABLED: z.coerce.boolean().default(true),

  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
});

// Safe environment access - only use process.env on server side
const getEnv = () => {
  if (typeof window !== 'undefined') {
    // Client side - only return public env vars
    return {
      NEXT_PUBLIC_SUPABASE_URL: 'https://nejamvygfivotgaooebr.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lamFtdnlnZml2b3RnYW9vZWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MjcwODMsImV4cCI6MjA3MjMwMzA4M30.usTNiEowC_LuniZeIOsFokaogHbvkGXk5Fn7KgQND8w',
      NODE_ENV: 'development',
    };
  }
  // Server side - return actual process.env
  return process.env;
};

const env = getEnv() as any;

// Application configuration with fallbacks
export const config = {
  supabase: {
    url: env.NEXT_PUBLIC_SUPABASE_URL || 'https://nejamvygfivotgaooebr.supabase.co',
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lamFtdnlnZml2b3RnYW9vZWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MjcwODMsImV4cCI6MjA3MjMwMzA4M30.usTNiEowC_LuniZeIOsFokaogHbvkGXk5Fn7KgQND8w',
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || 'development-service-key',
  },

  openai: {
    apiKey: env.OPENAI_API_KEY || 'development-key',
    model: env.OPENAI_MODEL || 'gpt-4o-mini',
    maxTokens: env.OPENAI_MAX_TOKENS || 4000,
  },

  email: {
    domain: env.EMAIL_DOMAIN || 'chiphi.ai',
    maxSizeMB: env.MAX_EMAIL_SIZE_MB || 10,
    allowedDomains: (env.ALLOWED_EMAIL_DOMAINS || 'gmail.com,outlook.com,yahoo.com,icloud.com').split(',').map((d: string) => d.trim()),
    timeoutSeconds: env.WEBHOOK_TIMEOUT_SECONDS || 30,
  },

  rateLimit: {
    perOrgPerHour: env.RATE_LIMIT_PER_ORG_PER_HOUR || 100,
    windowMinutes: env.RATE_LIMIT_WINDOW_MINUTES || 60,
  },

  ai: {
    confidenceThreshold: env.AI_CONFIDENCE_THRESHOLD || 70,
    maxTranslationRetries: env.MAX_TRANSLATION_RETRIES || 3,
    maxExtractionRetries: env.MAX_EXTRACTION_RETRIES || 3,
  },

  database: {
    maxConnections: env.DATABASE_MAX_CONNECTIONS || 10,
    idleTimeout: env.DATABASE_IDLE_TIMEOUT || 30000,
    connectionTimeout: env.DATABASE_CONNECTION_TIMEOUT || 10000,
  },

  performance: {
    enableMonitoring: env.ENABLE_PERFORMANCE_MONITORING || false,
    sampleRate: env.PERFORMANCE_SAMPLE_RATE || 0.1,
    slowQueryThreshold: env.SLOW_QUERY_THRESHOLD_MS || 1000,
  },

  healthCheck: {
    timeoutMs: env.HEALTH_CHECK_TIMEOUT_MS || 5000,
    intervalMs: env.HEALTH_CHECK_INTERVAL_MS || 30000,
  },

  logging: {
    level: env.LOG_LEVEL || 'info',
    enableProcessingLogs: env.ENABLE_PROCESSING_LOGS !== 'false',
    format: env.LOG_FORMAT || 'text',
    timestamp: env.LOG_TIMESTAMP !== 'false',
    correlationId: env.LOG_CORRELATION_ID === 'true',
  },

  // Monitoring configuration removed - using internal logging only

  inboundProvider: {
    provider: env.INBOUND_PROVIDER || 'ses',
    cloudflareSecret: env.CLOUDFLARE_EMAIL_SECRET || (isBuildTime ? 'build-time-placeholder' : undefined),
    sesSecret: env.SES_WEBHOOK_SECRET || (isBuildTime ? 'build-time-placeholder' : undefined),
    sharedSecret: env.SHARED_SECRET || (isBuildTime ? 'build-time-placeholder' : undefined),
  },

  aws: {
    region: env.AWS_REGION || 'ap-southeast-1',
    accountId: env.AWS_ACCOUNT_ID || '741960641851',

    ses: {
      receiptRuleSet: env.SES_RECEIPT_RULE_SET || 'SESReceiptRuleSet',
      receiptRuleName: env.SES_RECEIPT_RULE_NAME || 'chiphi-inbound-rule',
      emailDomain: env.SES_EMAIL_DOMAIN || 'chiphi.oronculzac.com',
    },

    s3: {
      rawEmailsBucket: env.S3_RAW_EMAILS_BUCKET || 'chiphi-raw-emails',
      emailPrefix: env.S3_EMAIL_PREFIX || 'emails/',
    },

    sns: {
      emailTopicArn: env.SNS_EMAIL_TOPIC_ARN || `arn:aws:sns:${env.AWS_REGION || 'ap-southeast-1'}:${env.AWS_ACCOUNT_ID || '741960641851'}:chiphi-email-notifications`,
    },

    lambda: {
      emailProcessorName: env.LAMBDA_EMAIL_PROCESSOR_NAME || 'chiphi-email-processor',
      emailProcessorArn: env.LAMBDA_EMAIL_PROCESSOR_ARN || `arn:aws:lambda:${env.AWS_REGION || 'ap-southeast-1'}:${env.AWS_ACCOUNT_ID || '741960641851'}:function:chiphi-email-processor`,
      timeoutSeconds: env.LAMBDA_TIMEOUT_SECONDS || 30,
      memoryMB: env.LAMBDA_MEMORY_MB || 256,
    },
  },

  visualTesting: {
    threshold: env.VISUAL_REGRESSION_THRESHOLD || 0.01,
    enabled: env.ENABLE_VISUAL_TESTS !== 'false',
  },

  diagnostic: {
    enableDebugEndpoints: env.ENABLE_DEBUG_ENDPOINTS === 'true',
    styleProbeEnabled: env.STYLE_PROBE_ENABLED !== 'false',
  },

  app: {
    nodeEnv: env.NODE_ENV || 'development',
    nextAuthSecret: env.NEXTAUTH_SECRET || 'development-secret-key-minimum-32-characters-long-for-local-dev',
    nextAuthUrl: env.NEXTAUTH_URL || 'http://localhost:3000',
    isDevelopment: (env.NODE_ENV || 'development') === 'development',
    isProduction: (env.NODE_ENV || 'development') === 'production',
  },
} as const;

// Runtime validation function (only runs when actually needed)
export function validateConfig() {
  if (isBuildTime) {
    console.log('Skipping config validation during build time');
    return;
  }

  // Only validate critical runtime configs
  const requiredInProduction = config.app.isProduction ? [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL'
  ] : [];

  // Additional validation for SES provider in production
  const requiredForSES = (config.app.isProduction && config.inboundProvider.provider === 'ses') ? [
    'AWS_REGION',
    'AWS_ACCOUNT_ID',
    'S3_RAW_EMAILS_BUCKET',
    'SNS_EMAIL_TOPIC_ARN',
    'LAMBDA_EMAIL_PROCESSOR_ARN',
    'SHARED_SECRET'
  ] : [];

  const missing = [...requiredInProduction, ...requiredForSES].filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate SES configuration consistency
  if (config.inboundProvider.provider === 'ses' && !isBuildTime) {
    validateSESConfiguration();
  }
}

// SES-specific configuration validation
function validateSESConfiguration() {
  const { aws, inboundProvider } = config;

  // Validate region consistency
  if (aws.region !== 'ap-southeast-1') {
    console.warn(`SES region mismatch: expected ap-southeast-1, got ${aws.region}`);
  }

  // Validate ARN consistency
  const expectedSNSArn = `arn:aws:sns:${aws.region}:${aws.accountId}:chiphi-email-notifications`;
  if (aws.sns.emailTopicArn !== expectedSNSArn) {
    console.warn(`SNS ARN mismatch: expected ${expectedSNSArn}, got ${aws.sns.emailTopicArn}`);
  }

  const expectedLambdaArn = `arn:aws:lambda:${aws.region}:${aws.accountId}:function:${aws.lambda.emailProcessorName}`;
  if (aws.lambda.emailProcessorArn !== expectedLambdaArn) {
    console.warn(`Lambda ARN mismatch: expected ${expectedLambdaArn}, got ${aws.lambda.emailProcessorArn}`);
  }

  // Validate shared secret is configured
  if (!inboundProvider.sharedSecret || inboundProvider.sharedSecret === 'build-time-placeholder') {
    console.warn('SHARED_SECRET not configured for SES provider');
  }

  // Validate bucket name format
  if (!aws.s3.rawEmailsBucket.match(/^[a-z0-9.-]+$/)) {
    console.warn(`Invalid S3 bucket name format: ${aws.s3.rawEmailsBucket}`);
  }
}

// Helper function to get SES infrastructure status
export function getSESInfrastructureConfig() {
  return {
    region: config.aws.region,
    accountId: config.aws.accountId,
    receiptRuleSet: config.aws.ses.receiptRuleSet,
    receiptRuleName: config.aws.ses.receiptRuleName,
    emailDomain: config.aws.ses.emailDomain,
    s3Bucket: config.aws.s3.rawEmailsBucket,
    s3Prefix: config.aws.s3.emailPrefix,
    snsTopicArn: config.aws.sns.emailTopicArn,
    lambdaFunctionName: config.aws.lambda.emailProcessorName,
    lambdaArn: config.aws.lambda.emailProcessorArn,
    sharedSecretConfigured: !!config.inboundProvider.sharedSecret && config.inboundProvider.sharedSecret !== 'build-time-placeholder',
  };
}

// SES infrastructure utilities are available in ./config/ses-infrastructure.ts
// Import them directly from there to avoid circular dependencies

// Type exports
export type Config = typeof config;
export type LogLevel = typeof config.logging.level;
export type SESInfrastructureConfig = ReturnType<typeof getSESInfrastructureConfig>;