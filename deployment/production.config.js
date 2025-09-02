// Production deployment configuration
// This file contains production-specific settings and optimizations

module.exports = {
  // Next.js production configuration
  nextjs: {
    // Enable compression
    compress: true,
    
    // Optimize images
    images: {
      domains: ['your-domain.com'],
      formats: ['image/webp', 'image/avif'],
      minimumCacheTTL: 86400, // 24 hours
    },
    
    // Security headers
    headers: [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ],
    
    // Redirects for security
    redirects: [
      {
        source: '/api/health',
        destination: '/api/health',
        permanent: false,
        has: [
          {
            type: 'header',
            key: 'user-agent',
            value: '(?!.*health-check).*', // Block non-health-check requests
          },
        ],
      },
    ],
  },

  // Database configuration
  database: {
    // Connection pooling settings
    pool: {
      min: 2,
      max: 20,
      acquireTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      createTimeoutMillis: 10000,
    },
    
    // Query optimization
    query: {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
    },
  },

  // Logging configuration
  logging: {
    level: 'info',
    format: 'json',
    timestamp: true,
    correlationId: true,
    
    // Log rotation (if using file logging)
    rotation: {
      maxFiles: 10,
      maxSize: '100MB',
      datePattern: 'YYYY-MM-DD',
    },
  },

  // Performance monitoring
  monitoring: {
    enabled: true,
    sampleRate: 0.1,
    slowQueryThreshold: 1000,
    
    // Health check configuration
    healthCheck: {
      timeout: 5000,
      interval: 30000,
      retries: 3,
    },
  },

  // Security configuration
  security: {
    // Rate limiting
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP',
    },
    
    // CORS configuration
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://your-domain.com'],
      credentials: true,
      optionsSuccessStatus: 200,
    },
    
    // Helmet security headers
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://api.openai.com", "wss://your-supabase-project.supabase.co"],
        },
      },
    },
  },

  // Email processing configuration
  email: {
    // Processing limits
    maxConcurrentProcessing: 5,
    maxEmailSize: 25 * 1024 * 1024, // 25MB
    processingTimeout: 45000, // 45 seconds
    
    // Retry configuration
    retries: {
      maxAttempts: 3,
      backoffMultiplier: 2,
      initialDelay: 1000,
    },
  },

  // AI service configuration
  ai: {
    // OpenAI configuration
    openai: {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
    },
    
    // Processing limits
    maxConcurrentRequests: 10,
    confidenceThreshold: 70,
  },

  // Deployment environment variables validation
  requiredEnvVars: [
    'NODE_ENV',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'EMAIL_DOMAIN',
  ],

  // Optional environment variables with defaults
  optionalEnvVars: {
    LOG_LEVEL: 'info',
    RATE_LIMIT_PER_ORG_PER_HOUR: '500',
    AI_CONFIDENCE_THRESHOLD: '70',
    MAX_EMAIL_SIZE_MB: '25',
    WEBHOOK_TIMEOUT_SECONDS: '45',
  },
};

// Validation function for production deployment
function validateProductionConfig() {
  const config = module.exports;
  const errors = [];

  // Check required environment variables
  config.requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  });

  // Validate URLs
  if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.startsWith('https://')) {
    errors.push('NEXTAUTH_URL must use HTTPS in production');
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('https://')) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL must use HTTPS in production');
  }

  // Validate secrets
  if (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length < 32) {
    errors.push('NEXTAUTH_SECRET must be at least 32 characters long');
  }

  if (errors.length > 0) {
    console.error('Production configuration validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }

  console.log('Production configuration validation passed');
}

// Export validation function
module.exports.validateProductionConfig = validateProductionConfig;

// Run validation if this file is executed directly
if (require.main === module) {
  validateProductionConfig();
}