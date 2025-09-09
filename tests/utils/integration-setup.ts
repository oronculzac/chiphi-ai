/**
 * Integration Test Setup
 * 
 * Setup for integration tests that need real database connections
 */

import { setupTestEnvironment } from './test-env-setup';

// Setup environment variables for integration tests
setupTestEnvironment();

// Don't mock Supabase for integration tests - we need real connections
// The mocks from vitest-setup.ts are for unit tests only

console.log('🔧 Integration test environment configured');
console.log(`   Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
console.log(`   Node Environment: ${process.env.NODE_ENV}`);
console.log(`   Test Mode: Integration`);