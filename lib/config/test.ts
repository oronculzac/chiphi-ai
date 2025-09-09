/**
 * Test Configuration
 * 
 * Specialized configuration for test environments that ensures
 * proper Supabase client initialization and database connectivity.
 */

import { z } from 'zod';

// Test environment schema - stricter validation for tests
const testEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('test'),
});

// Direct environment access for tests (no client-side restrictions)
const getTestEnv = () => {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NODE_ENV: process.env.NODE_ENV || 'test',
  };
};

// Validate test environment
const validateTestEnv = () => {
  const env = getTestEnv();
  
  try {
    testEnvSchema.parse(env);
    return env;
  } catch (error) {
    console.error('❌ Test environment validation failed:');
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    
    console.error('\n📋 Required environment variables for tests:');
    console.error('  - NEXT_PUBLIC_SUPABASE_URL');
    console.error('  - NEXT_PUBLIC_SUPABASE_ANON_KEY');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    
    throw new Error('Test environment configuration is invalid');
  }
};

// Test-specific configuration
export const testConfig = (() => {
  const env = validateTestEnv();
  
  return {
    supabase: {
      url: env.NEXT_PUBLIC_SUPABASE_URL!,
      anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY!,
    },
    app: {
      nodeEnv: env.NODE_ENV,
      isTest: env.NODE_ENV === 'test',
    },
  } as const;
})();

// Utility function to check if we're in test environment
export const isTestEnvironment = () => {
  return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
};

// Export type
export type TestConfig = typeof testConfig;