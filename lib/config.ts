import { z } from 'zod';

// Environment variable schema validation
const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  
  // OpenAI
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_MAX_TOKENS: z.coerce.number().default(4000),
  
  // Email Processing
  MAILGUN_WEBHOOK_SIGNING_KEY: z.string().optional(),
  RESEND_WEBHOOK_SIGNING_KEY: z.string().optional(),
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
  
  // Error Tracking
  SENTRY_DSN: z.string().optional(),
  
  // Inbound Email Provider
  INBOUND_PROVIDER: z.enum(['cloudflare', 'ses']).default('cloudflare'),
  CLOUDFLARE_EMAIL_SECRET: z.string().optional(),
  SES_WEBHOOK_SECRET: z.string().optional(),
  
  // Visual Testing
  VISUAL_REGRESSION_THRESHOLD: z.coerce.number().min(0).max(1).default(0.01),
  ENABLE_VISUAL_TESTS: z.coerce.boolean().default(true),
  
  // Diagnostic Settings
  ENABLE_DEBUG_ENDPOINTS: z.coerce.boolean().default(false),
  STYLE_PROBE_ENABLED: z.coerce.boolean().default(true),

  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
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
    mailgunSigningKey: env.MAILGUN_WEBHOOK_SIGNING_KEY,
    resendSigningKey: env.RESEND_WEBHOOK_SIGNING_KEY,
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
  
  monitoring: {
    sentryDsn: env.SENTRY_DSN,
  },
  
  inboundProvider: {
    provider: env.INBOUND_PROVIDER || 'cloudflare',
    cloudflareSecret: env.CLOUDFLARE_EMAIL_SECRET,
    sesSecret: env.SES_WEBHOOK_SECRET,
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

// Type exports
export type Config = typeof config;
export type LogLevel = typeof config.logging.level;