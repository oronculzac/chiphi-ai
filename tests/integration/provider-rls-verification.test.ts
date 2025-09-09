/**
 * Provider System RLS Verification Tests
 * 
 * This test suite specifically verifies RLS policies for the new provider
 * abstraction system, including provider logs, diagnostic checks, and
 * monitoring dashboards.
 * 
 * Requirements tested:
 * - Provider logs are properly isolated by organization
 * - Diagnostic checks have appropriate access controls
 * - Monitoring dashboards respect RLS policies
 * - Provider functions enforce multi-tenant isolation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/lib/types/database';
import { testConfig } from '@/lib/config/test';

interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient<Database>;
  orgId: string;
  role: 'owner' | 'admin' | 'member';
}

describe('Provider System RLS Verification', () => {
  let adminClient: SupabaseClient<Database>;
  let testUsers: TestUser[] = [];
  let testOrgIds: string[] = [];
  
  // Test data cleanup tracking
  const createdProviderLogs: string[] = [];
  const createdDiagnosticChecks: string[] = [];

  beforeAll(async () => {
    adminClient = createClient<Database>(
      testConfig.supabase.url,
      testConfig.supabase.serviceRoleKey
    );

    await setupProviderTestEnvironment();
  });

  afterAll(async () => {
    await cleanupProviderTestEnvironment();
  });

  beforeEach(async () => {
    createdProviderLogs.length = 0;
    createdDiagnosticChecks.length = 0;
  });

  afterEach(async () => {
    await cleanupProviderTestData();
  });

  describe('Email Provider Logs RLS', () => {
    it('should isolate provider logs by organization', async () => {
      const [user1, user2] = testUsers;
      
      // Create provider logs for different organizations
      const { data: log1, error: error1 } = await adminClient
        .from('email_provider_logs')
        .insert({
          org_id: user1.orgId,
          provider_name: 'cloudflare',
          message_id: `provider-rls-test-1-${Date.now()}`,
          payload: { 
            alias: 'u_test1@chiphi.oronculzac.com',
            from: 'sender@example.com',
            subject: 'Test Receipt 1'
          },
          success: true,
          processing_time_ms: 150,
          correlation_id: crypto.randomUUID()
        })
        .select()
        .single();

      expect(error1).toBeNull();
      createdProviderLogs.push(log1!.id);

      const { data: log2, error: error2 } = await adminClient
        .from('email_provider_logs')
        .insert({
          org_id: user2.orgId,
          provider_name: 'ses',
          message_id: `provider-rls-test-2-${Date.now()}`,
          payload: { 
            alias: 'u_test2@chiphi.oronculzac.com',
            from: 'sender@example.com',
            subject: 'Test Receipt 2'
          },
          success: true,
          processing_time_ms: 200,
          correlation_id: crypto.randomUUID()
        })
        .select()
        .single();

      expect(error2).toBeNull();
      createdProviderLogs.push(log2!.id);

      // User 1 should only see their organization's logs
      const { data: user1Logs, error: user1Error } = await user1.client
        .from('email_provider_logs')
        .select('*');

      expect(user1Error).toBeNull();
      expect(user1Logs).toBeDefined();
      
      // Verify all logs belong to user1's organization
      expect(user1Logs!.every(log => log.org_id === user1.orgId)).toBe(true);
      
      // Verify user1 can see their log but not user2's log
      const user1LogIds = user1Logs!.map(log => log.id);
      expect(user1LogIds.includes(log1!.id)).toBe(true);
      expect(user1LogIds.includes(log2!.id)).toBe(false);

      // User 2 should only see their organization's logs
      const { data: user2Logs, error: user2Error } = await user2.client
        .from('email_provider_logs')
        .select('*');

      expect(user2Error).toBeNull();
      expect(user2Logs).toBeDefined();
      
      // Verify all logs belong to user2's organization
      expect(user2Logs!.every(log => log.org_id === user2.orgId)).toBe(true);
      
      // Verify user2 can see their log but not user1's log
      const user2LogIds = user2Logs!.map(log => log.id);
      expect(user2LogIds.includes(log2!.id)).toBe(true);
      expect(user2LogIds.includes(log1!.id)).toBe(false);
    });

    it('should prevent cross-tenant provider log access via direct queries', async () => {
      const [user1, user2] = testUsers;
      
      // Create a provider log for user1's organization
      const { data: log, error: createError } = await adminClient
        .from('email_provider_logs')
        .insert({
          org_id: user1.orgId,
          provider_name: 'cloudflare',
          message_id: `cross-tenant-test-${Date.now()}`,
          payload: { sensitive: 'user1 data' },
          success: true,
          processing_time_ms: 100
        })
        .select()
        .single();

      expect(createError).toBeNull();
      createdProviderLogs.push(log!.id);

      // User2 attempts to access user1's provider log directly
      const { data: crossTenantAccess, error: accessError } = await user2.client
        .from('email_provider_logs')
        .select('*')
        .eq('id', log!.id);

      expect(accessError).toBeNull();
      expect(crossTenantAccess).toEqual([]);

      // User2 attempts to update user1's provider log
      const { data: updateResult, error: updateError } = await user2.client
        .from('email_provider_logs')
        .update({ success: false })
        .eq('id', log!.id)
        .select();

      expect(updateError).toBeNull();
      expect(updateResult).toEqual([]);

      // Verify the log is unchanged
      const { data: verifyLog } = await user1.client
        .from('email_provider_logs')
        .select('success')
        .eq('id', log!.id)
        .single();

      expect(verifyLog!.success).toBe(true);
    });

    it('should enforce unique message constraint per organization', async () => {
      const [user1, user2] = testUsers;
      const messageId = `unique-constraint-test-${Date.now()}`;

      // Both organizations can process the same message ID
      const { data: log1, error: error1 } = await adminClient
        .from('email_provider_logs')
        .insert({
          org_id: user1.orgId,
          provider_name: 'cloudflare',
          message_id: messageId,
          payload: { org: 'user1' },
          success: true,
          processing_time_ms: 150
        })
        .select()
        .single();

      expect(error1).toBeNull();
      createdProviderLogs.push(log1!.id);

      const { data: log2, error: error2 } = await adminClient
        .from('email_provider_logs')
        .insert({
          org_id: user2.orgId,
          provider_name: 'cloudflare',
          message_id: messageId,
          payload: { org: 'user2' },
          success: true,
          processing_time_ms: 180
        })
        .select()
        .single();

      expect(error2).toBeNull();
      createdProviderLogs.push(log2!.id);

      // Same organization cannot process the same message ID twice
      const { data: duplicateLog, error: duplicateError } = await adminClient
        .from('email_provider_logs')
        .insert({
          org_id: user1.orgId,
          provider_name: 'ses',
          message_id: messageId,
          payload: { attempt: 'duplicate' },
          success: true,
          processing_time_ms: 100
        })
        .select()
        .single();

      expect(duplicateError).toBeDefined();
      expect(duplicateError!.code).toBe('23505'); // Unique constraint violation
      expect(duplicateLog).toBeNull();
    });
  });

  describe('Diagnostic Checks RLS', () => {
    it('should restrict diagnostic check access to admin users only', async () => {
      const adminUser = testUsers.find(u => u.role === 'admin')!;
      const memberUser = testUsers.find(u => u.role === 'member')!;

      // Create diagnostic checks
      const { data: check1, error: error1 } = await adminClient
        .from('diagnostic_checks')
        .insert({
          check_type: 'css_health',
          check_name: 'tailwind_compilation',
          status: 'pass',
          details: { message: 'CSS compiled successfully' },
          execution_time_ms: 50
        })
        .select()
        .single();

      expect(error1).toBeNull();
      createdDiagnosticChecks.push(check1!.id);

      // Admin user should be able to access diagnostic checks
      const { data: adminAccess, error: adminError } = await adminUser.client
        .from('diagnostic_checks')
        .select('*')
        .eq('id', check1!.id);

      expect(adminError).toBeNull();
      expect(adminAccess).toBeDefined();
      expect(adminAccess!.length).toBe(1);

      // Member user should not be able to access diagnostic checks
      const { data: memberAccess, error: memberError } = await memberUser.client
        .from('diagnostic_checks')
        .select('*')
        .eq('id', check1!.id);

      expect(memberError).toBeNull();
      expect(memberAccess).toEqual([]);
    });

    it('should allow system to insert diagnostic checks regardless of user context', async () => {
      // System should be able to insert diagnostic checks
      const { data: systemCheck, error: systemError } = await adminClient
        .from('diagnostic_checks')
        .insert({
          check_type: 'database_connectivity',
          check_name: 'supabase_connection',
          status: 'pass',
          details: { latency_ms: 25 },
          execution_time_ms: 30
        })
        .select()
        .single();

      expect(systemError).toBeNull();
      expect(systemCheck).toBeDefined();
      createdDiagnosticChecks.push(systemCheck!.id);
    });
  });

  describe('Provider Monitoring Dashboard RLS', () => {
    it('should filter provider monitoring dashboard by organization', async () => {
      const [user1, user2] = testUsers;

      // Create provider logs for both organizations
      const { data: logs } = await adminClient
        .from('email_provider_logs')
        .insert([
          {
            org_id: user1.orgId,
            provider_name: 'cloudflare',
            message_id: `dashboard-test-1-${Date.now()}`,
            payload: { test: 'dashboard user1' },
            success: true,
            processing_time_ms: 100
          },
          {
            org_id: user2.orgId,
            provider_name: 'ses',
            message_id: `dashboard-test-2-${Date.now()}`,
            payload: { test: 'dashboard user2' },
            success: false,
            processing_time_ms: 500,
            error_message: 'Test error'
          }
        ])
        .select();

      logs!.forEach(log => createdProviderLogs.push(log.id));

      // User1 should only see their organization's data in the dashboard
      const { data: user1Dashboard, error: user1Error } = await user1.client
        .from('provider_monitoring_dashboard')
        .select('*');

      expect(user1Error).toBeNull();
      expect(user1Dashboard).toBeDefined();
      expect(user1Dashboard!.every(item => item.org_id === user1.orgId)).toBe(true);
      expect(user1Dashboard!.some(item => item.provider_name === 'cloudflare')).toBe(true);
      expect(user1Dashboard!.some(item => item.provider_name === 'ses')).toBe(false);

      // User2 should only see their organization's data in the dashboard
      const { data: user2Dashboard, error: user2Error } = await user2.client
        .from('provider_monitoring_dashboard')
        .select('*');

      expect(user2Error).toBeNull();
      expect(user2Dashboard).toBeDefined();
      expect(user2Dashboard!.every(item => item.org_id === user2.orgId)).toBe(true);
      expect(user2Dashboard!.some(item => item.provider_name === 'ses')).toBe(true);
      expect(user2Dashboard!.some(item => item.provider_name === 'cloudflare')).toBe(false);
    });
  });

  describe('Provider Function RLS Enforcement', () => {
    it('should enforce RLS in log_provider_processing function', async () => {
      const [user1, user2] = testUsers;
      const messageId = `function-rls-test-${Date.now()}`;

      // User1 calls the function for their organization
      const { data: result1, error: error1 } = await user1.client
        .rpc('log_provider_processing', {
          org_uuid: user1.orgId,
          provider_name_param: 'cloudflare',
          message_id_param: messageId,
          payload_param: { test: 'function test' },
          processing_time_ms_param: 200,
          success_param: true
        });

      expect(error1).toBeNull();
      expect(result1).toBeDefined();

      // User2 should not be able to call the function for user1's organization
      const { data: result2, error: error2 } = await user2.client
        .rpc('log_provider_processing', {
          org_uuid: user1.orgId, // Attempting to log for user1's org
          provider_name_param: 'ses',
          message_id_param: `${messageId}-cross-tenant`,
          payload_param: { test: 'cross tenant attempt' },
          processing_time_ms_param: 150,
          success_param: true
        });

      // The function should either fail or not create the log
      // We'll verify by checking if user2 can see the log they attempted to create
      if (!error2) {
        const { data: crossTenantLog } = await user2.client
          .from('email_provider_logs')
          .select('*')
          .eq('message_id', `${messageId}-cross-tenant`);

        expect(crossTenantLog).toEqual([]);
      }
    });

    it('should enforce RLS in get_provider_statistics function', async () => {
      const [user1, user2] = testUsers;

      // Create provider logs for both organizations
      await adminClient.from('email_provider_logs').insert([
        {
          org_id: user1.orgId,
          provider_name: 'cloudflare',
          message_id: `stats-rls-1-${Date.now()}`,
          payload: { test: 'stats test' },
          success: true,
          processing_time_ms: 150
        },
        {
          org_id: user2.orgId,
          provider_name: 'cloudflare',
          message_id: `stats-rls-2-${Date.now()}`,
          payload: { test: 'stats test' },
          success: true,
          processing_time_ms: 200
        }
      ]);

      // User1 gets statistics for their organization
      const { data: user1Stats, error: user1Error } = await user1.client
        .rpc('get_provider_statistics', {
          org_uuid: user1.orgId,
          provider_name_param: 'cloudflare',
          hours_back: 24
        });

      expect(user1Error).toBeNull();
      expect(user1Stats).toBeDefined();
      expect(user1Stats!.length).toBeGreaterThan(0);

      // User1 attempts to get statistics for user2's organization
      const { data: crossTenantStats, error: crossTenantError } = await user1.client
        .rpc('get_provider_statistics', {
          org_uuid: user2.orgId,
          provider_name_param: 'cloudflare',
          hours_back: 24
        });

      // Should return empty results or fail
      expect(crossTenantStats === null || crossTenantStats.length === 0).toBe(true);
    });

    it('should enforce RLS in get_provider_errors function', async () => {
      const [user1, user2] = testUsers;

      // Create error logs for both organizations
      await adminClient.from('email_provider_logs').insert([
        {
          org_id: user1.orgId,
          provider_name: 'cloudflare',
          message_id: `error-rls-1-${Date.now()}`,
          payload: { test: 'error test' },
          success: false,
          error_message: 'User1 test error',
          processing_time_ms: 100
        },
        {
          org_id: user2.orgId,
          provider_name: 'ses',
          message_id: `error-rls-2-${Date.now()}`,
          payload: { test: 'error test' },
          success: false,
          error_message: 'User2 test error',
          processing_time_ms: 150
        }
      ]);

      // User1 gets errors for their organization
      const { data: user1Errors, error: user1Error } = await user1.client
        .rpc('get_provider_errors', {
          org_uuid: user1.orgId,
          hours_back: 24
        });

      expect(user1Error).toBeNull();
      expect(user1Errors).toBeDefined();
      expect(user1Errors!.length).toBeGreaterThan(0);
      expect(user1Errors!.every(err => err.error_message?.includes('User1'))).toBe(true);

      // User1 attempts to get errors for user2's organization
      const { data: crossTenantErrors, error: crossTenantError } = await user1.client
        .rpc('get_provider_errors', {
          org_uuid: user2.orgId,
          hours_back: 24
        });

      // Should return empty results or fail
      expect(crossTenantErrors === null || crossTenantErrors.length === 0).toBe(true);
    });
  });

  // Helper functions
  async function setupProviderTestEnvironment() {
    // Create test organizations
    const { data: orgs } = await adminClient
      .from('orgs')
      .insert([
        { name: 'Provider Test Org 1' },
        { name: 'Provider Test Org 2' },
        { name: 'Provider Test Org 3' }
      ])
      .select();

    testOrgIds = orgs!.map(org => org.id);

    // Create test users with different roles and unique timestamps
    const timestamp = Date.now();
    const testUserData = [
      { email: `provider-test-owner-${timestamp}@example.com`, password: 'test-pass-123', role: 'owner' as const, orgIndex: 0 },
      { email: `provider-test-admin-${timestamp}@example.com`, password: 'test-pass-456', role: 'admin' as const, orgIndex: 1 },
      { email: `provider-test-member-${timestamp}@example.com`, password: 'test-pass-789', role: 'member' as const, orgIndex: 2 }
    ];

    for (const userData of testUserData) {
      // Create auth user
      const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true
      });

      if (authError) {
        throw new Error(`Failed to create test user: ${authError.message}`);
      }

      // Create user profile
      await adminClient
        .from('users')
        .insert({
          id: authUser.user.id,
          email: userData.email,
          full_name: `Provider Test User ${userData.role}`
        });

      // Add user to organization
      await adminClient
        .from('org_members')
        .insert({
          org_id: testOrgIds[userData.orgIndex],
          user_id: authUser.user.id,
          role: userData.role
        });

      // Create client for this user
      const userClient = createClient<Database>(
        testConfig.supabase.url,
        testConfig.supabase.anonKey
      );

      // Sign in the user
      const { error: signInError } = await userClient.auth.signInWithPassword({
        email: userData.email,
        password: userData.password
      });

      if (signInError) {
        throw new Error(`Failed to sign in test user: ${signInError.message}`);
      }

      testUsers.push({
        id: authUser.user.id,
        email: userData.email,
        client: userClient,
        orgId: testOrgIds[userData.orgIndex],
        role: userData.role
      });
    }
  }

  async function cleanupProviderTestEnvironment() {
    // Delete test users
    for (const user of testUsers) {
      await adminClient.auth.admin.deleteUser(user.id);
    }

    // Delete test organizations
    for (const orgId of testOrgIds) {
      await adminClient
        .from('orgs')
        .delete()
        .eq('id', orgId);
    }
  }

  async function cleanupProviderTestData() {
    // Clean up provider logs
    if (createdProviderLogs.length > 0) {
      await adminClient
        .from('email_provider_logs')
        .delete()
        .in('id', createdProviderLogs);
    }

    // Clean up diagnostic checks
    if (createdDiagnosticChecks.length > 0) {
      await adminClient
        .from('diagnostic_checks')
        .delete()
        .in('id', createdDiagnosticChecks);
    }
  }
});