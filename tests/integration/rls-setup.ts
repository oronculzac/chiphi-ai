/**
 * RLS Test Setup
 * 
 * Setup configuration for RLS verification tests
 */

import { beforeAll, afterAll } from 'vitest';
import { testConfig } from '@/lib/config/test';
import '../utils/integration-setup';

// Verify test environment configuration
beforeAll(async () => {
  // Ensure we're running against a test database
  if (!config.SUPABASE_URL.includes('test') && !config.SUPABASE_URL.includes('localhost')) {
    console.warn('⚠️  Warning: RLS tests should run against a test database');
  }

  // Verify required environment variables
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  }

  console.log('🔒 RLS Test Environment Initialized');
  console.log(`   Database: ${testConfig.supabase.url}`);
  console.log(`   Test Mode: ${process.env.NODE_ENV || 'development'}`);
});

afterAll(async () => {
  console.log('🧹 RLS Test Environment Cleanup Complete');
});