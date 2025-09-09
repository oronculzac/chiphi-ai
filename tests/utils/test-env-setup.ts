/**
 * Test Environment Setup
 * 
 * Ensures proper environment variable loading for tests
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local for tests
export function setupTestEnvironment() {
  // Load .env.local file
  const envPath = resolve(process.cwd(), '.env.local');
  const result = config({ path: envPath });
  
  if (result.error) {
    console.warn('⚠️  Could not load .env.local file:', result.error.message);
    console.warn('   Make sure .env.local exists with Supabase credentials');
  } else {
    console.log('✅ Loaded environment variables from .env.local');
  }
  
  // Verify critical environment variables are present
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    throw new Error('Test environment setup failed: missing required environment variables');
  }
  
  console.log('✅ All required environment variables are present');
  
  // Set NODE_ENV to test if not already set
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
  }
  
  // Set VITEST flag for test detection
  process.env.VITEST = 'true';
  
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  };
}