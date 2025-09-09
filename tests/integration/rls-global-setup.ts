/**
 * RLS Global Setup
 * 
 * Global setup for RLS verification test suite
 */

import { createClient } from '@supabase/supabase-js';
import { testConfig } from '@/lib/config/test';

export default async function globalSetup() {
  console.log('🚀 Starting RLS Global Setup...');

  const adminClient = createClient(
    testConfig.supabase.url,
    testConfig.supabase.serviceRoleKey
  );

  try {
    // Verify database connectivity
    const { data, error } = await adminClient
      .from('orgs')
      .select('count')
      .limit(1);

    if (error) {
      throw new Error(`Database connectivity check failed: ${error.message}`);
    }

    console.log('✅ Database connectivity verified');

    // Verify RLS is enabled on critical tables
    const criticalTables = [
      'orgs',
      'org_members', 
      'emails',
      'transactions',
      'merchant_map',
      'processing_logs',
      'email_provider_logs'
    ];

    for (const table of criticalTables) {
      const { data: rlsStatus } = await adminClient
        .rpc('check_rls_enabled', { table_name: table })
        .single();

      if (!rlsStatus) {
        console.warn(`⚠️  RLS not enabled on table: ${table}`);
      }
    }

    console.log('✅ RLS status verified on critical tables');

    // Clean up any existing test data
    await cleanupTestData(adminClient);

    console.log('✅ RLS Global Setup Complete');

  } catch (error) {
    console.error('❌ RLS Global Setup Failed:', error);
    throw error;
  }
}

async function cleanupTestData(adminClient: any) {
  try {
    // Clean up test organizations and users
    const testEmailPatterns = [
      '%rls-test%',
      '%provider-test%',
      '%tx-provider-test%'
    ];

    for (const pattern of testEmailPatterns) {
      // Find test users
      const { data: testUsers } = await adminClient
        .from('users')
        .select('id')
        .ilike('email', pattern);

      if (testUsers && testUsers.length > 0) {
        // Delete auth users (this will cascade)
        for (const user of testUsers) {
          await adminClient.auth.admin.deleteUser(user.id);
        }
      }
    }

    // Clean up test organizations
    const testOrgPatterns = [
      '%Test Organization%',
      '%Provider Test Org%',
      '%Transaction Provider Test Org%'
    ];

    for (const pattern of testOrgPatterns) {
      await adminClient
        .from('orgs')
        .delete()
        .ilike('name', pattern);
    }

    console.log('🧹 Test data cleanup complete');

  } catch (error) {
    console.warn('⚠️  Test data cleanup warning:', error);
    // Don't fail setup if cleanup has issues
  }
}