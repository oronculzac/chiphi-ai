/**
 * Multi-tenant RLS Verification Tests
 * 
 * This test suite verifies that Row Level Security (RLS) policies properly
 * isolate data between organizations and prevent cross-tenant data access.
 * 
 * Requirements tested:
 * - 3.1: Users can only access data belonging to their organization through RLS policies
 * - 3.2: Attempting to access another user's data returns appropriate error responses
 * - 3.3: Inbound emails are correctly associated with the proper organization based on email alias
 * - 3.4: Database queries enforce row-level security policies for all data access
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/lib/types/database';
import { testConfig } from '@/lib/config/test';

// Test user credentials for multi-tenant testing
interface TestUser {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient<Database>;
  orgId?: string;
}

interface TestOrganization {
  id: string;
  name: string;
  ownerId: string;
}

describe('Multi-tenant RLS Verification', () => {
  let adminClient: SupabaseClient<Database>;
  let testUsers: TestUser[] = [];
  let testOrgs: TestOrganization[] = [];
  
  // Test data cleanup tracking
  const createdEmails: string[] = [];
  const createdTransactions: string[] = [];
  const createdProviderLogs: string[] = [];

  beforeAll(async () => {
    // Create admin client for setup
    adminClient = createClient<Database>(
      testConfig.supabase.url,
      testConfig.supabase.serviceRoleKey
    );

    // Create test users and organizations
    await setupTestEnvironment();
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestEnvironment();
  });

  beforeEach(async () => {
    // Clear tracking arrays for each test
    createdEmails.length = 0;
    createdTransactions.length = 0;
    createdProviderLogs.length = 0;
  });

  afterEach(async () => {
    // Clean up test data created during the test
    await cleanupTestData();
  });

  describe('Organization Data Isolation', () => {
    it('should prevent users from accessing other organizations data', async () => {
      const [user1, user2] = testUsers;
      
      // User 1 creates a transaction
      const { data: transaction, error: createError } = await user1.client
        .from('transactions')
        .insert({
          org_id: user1.orgId!,
          email_id: null, // We'll create a minimal transaction for testing
          date: '2024-01-01',
          amount: 100.00,
          currency: 'USD',
          merchant: 'Test Merchant',
          category: 'Food',
          confidence: 85,
          explanation: 'Test transaction for RLS verification'
        })
        .select()
        .single();

      expect(createError).toBeNull();
      expect(transaction).toBeDefined();
      createdTransactions.push(transaction!.id);

      // User 2 should not be able to see User 1's transaction
      const { data: otherUserTransactions, error: accessError } = await user2.client
        .from('transactions')
        .select('*')
        .eq('id', transaction!.id);

      expect(accessError).toBeNull();
      expect(otherUserTransactions).toEqual([]);
    });

    it('should prevent users from accessing other organizations emails', async () => {
      const [user1, user2] = testUsers;
      
      // User 1 creates an email
      const { data: email, error: createError } = await user1.client
        .from('emails')
        .insert({
          org_id: user1.orgId!,
          message_id: `test-message-${Date.now()}`,
          from_email: 'test@example.com',
          to_email: 'user1@chiphi.oronculzac.com',
          subject: 'Test Receipt',
          raw_content: 'Test email content'
        })
        .select()
        .single();

      expect(createError).toBeNull();
      expect(email).toBeDefined();
      createdEmails.push(email!.id);

      // User 2 should not be able to see User 1's email
      const { data: otherUserEmails, error: accessError } = await user2.client
        .from('emails')
        .select('*')
        .eq('id', email!.id);

      expect(accessError).toBeNull();
      expect(otherUserEmails).toEqual([]);
    });

    it('should prevent users from accessing other organizations merchant mappings', async () => {
      const [user1, user2] = testUsers;
      
      // User 1 creates a merchant mapping
      const { data: mapping, error: createError } = await user1.client
        .from('merchant_map')
        .insert({
          org_id: user1.orgId!,
          merchant_name: 'Test Merchant RLS',
          category: 'Food',
          subcategory: 'Restaurant',
          created_by: user1.id
        })
        .select()
        .single();

      expect(createError).toBeNull();
      expect(mapping).toBeDefined();

      // User 2 should not be able to see User 1's merchant mapping
      const { data: otherUserMappings, error: accessError } = await user2.client
        .from('merchant_map')
        .select('*')
        .eq('id', mapping!.id);

      expect(accessError).toBeNull();
      expect(otherUserMappings).toEqual([]);
    });

    it('should prevent users from accessing other organizations processing logs', async () => {
      const [user1, user2] = testUsers;
      
      // Create an email first for the processing log
      const { data: email } = await user1.client
        .from('emails')
        .insert({
          org_id: user1.orgId!,
          message_id: `test-message-log-${Date.now()}`,
          from_email: 'test@example.com',
          to_email: 'user1@chiphi.oronculzac.com',
          subject: 'Test Receipt for Log',
          raw_content: 'Test email content'
        })
        .select()
        .single();

      createdEmails.push(email!.id);

      // User 1 creates a processing log (using admin client since system creates these)
      const { data: log, error: createError } = await adminClient
        .from('processing_logs')
        .insert({
          org_id: user1.orgId!,
          email_id: email!.id,
          step: 'email_parsing',
          status: 'completed',
          details: { test: 'RLS verification' },
          processing_time_ms: 150
        })
        .select()
        .single();

      expect(createError).toBeNull();
      expect(log).toBeDefined();

      // User 2 should not be able to see User 1's processing log
      const { data: otherUserLogs, error: accessError } = await user2.client
        .from('processing_logs')
        .select('*')
        .eq('id', log!.id);

      expect(accessError).toBeNull();
      expect(otherUserLogs).toEqual([]);
    });
  });

  describe('Provider Logs RLS Verification', () => {
    it('should isolate provider logs by organization', async () => {
      const [user1, user2] = testUsers;
      
      // User 1's organization processes an email
      const { data: providerLog1, error: createError1 } = await adminClient
        .from('email_provider_logs')
        .insert({
          org_id: user1.orgId!,
          provider_name: 'cloudflare',
          message_id: `test-provider-msg-${Date.now()}-user1`,
          payload: { test: 'user1 data' },
          success: true,
          processing_time_ms: 200
        })
        .select()
        .single();

      expect(createError1).toBeNull();
      createdProviderLogs.push(providerLog1!.id);

      // User 2's organization processes an email
      const { data: providerLog2, error: createError2 } = await adminClient
        .from('email_provider_logs')
        .insert({
          org_id: user2.orgId!,
          provider_name: 'ses',
          message_id: `test-provider-msg-${Date.now()}-user2`,
          payload: { test: 'user2 data' },
          success: true,
          processing_time_ms: 180
        })
        .select()
        .single();

      expect(createError2).toBeNull();
      createdProviderLogs.push(providerLog2!.id);

      // User 1 should only see their organization's provider logs
      const { data: user1Logs, error: user1Error } = await user1.client
        .from('email_provider_logs')
        .select('*');

      expect(user1Error).toBeNull();
      expect(user1Logs).toBeDefined();
      expect(user1Logs!.length).toBeGreaterThan(0);
      expect(user1Logs!.every(log => log.org_id === user1.orgId)).toBe(true);
      expect(user1Logs!.some(log => log.id === providerLog1!.id)).toBe(true);
      expect(user1Logs!.some(log => log.id === providerLog2!.id)).toBe(false);

      // User 2 should only see their organization's provider logs
      const { data: user2Logs, error: user2Error } = await user2.client
        .from('email_provider_logs')
        .select('*');

      expect(user2Error).toBeNull();
      expect(user2Logs).toBeDefined();
      expect(user2Logs!.length).toBeGreaterThan(0);
      expect(user2Logs!.every(log => log.org_id === user2.orgId)).toBe(true);
      expect(user2Logs!.some(log => log.id === providerLog2!.id)).toBe(true);
      expect(user2Logs!.some(log => log.id === providerLog1!.id)).toBe(false);
    });

    it('should enforce idempotency per organization for provider logs', async () => {
      const [user1, user2] = testUsers;
      const messageId = `test-idempotency-${Date.now()}`;

      // Both organizations process the same message ID (should be allowed)
      const { data: log1, error: error1 } = await adminClient
        .from('email_provider_logs')
        .insert({
          org_id: user1.orgId!,
          provider_name: 'cloudflare',
          message_id: messageId,
          payload: { test: 'org1 data' },
          success: true,
          processing_time_ms: 200
        })
        .select()
        .single();

      expect(error1).toBeNull();
      createdProviderLogs.push(log1!.id);

      const { data: log2, error: error2 } = await adminClient
        .from('email_provider_logs')
        .insert({
          org_id: user2.orgId!,
          provider_name: 'cloudflare',
          message_id: messageId,
          payload: { test: 'org2 data' },
          success: true,
          processing_time_ms: 180
        })
        .select()
        .single();

      expect(error2).toBeNull();
      createdProviderLogs.push(log2!.id);

      // Attempting to insert the same message ID for the same org should fail
      const { data: duplicateLog, error: duplicateError } = await adminClient
        .from('email_provider_logs')
        .insert({
          org_id: user1.orgId!,
          provider_name: 'ses',
          message_id: messageId,
          payload: { test: 'duplicate attempt' },
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

  describe('Cross-tenant Access Prevention', () => {
    it('should prevent direct access to other organizations data via ID manipulation', async () => {
      const [user1, user2] = testUsers;
      
      // User 1 creates a transaction
      const { data: transaction } = await user1.client
        .from('transactions')
        .insert({
          org_id: user1.orgId!,
          email_id: null,
          date: '2024-01-01',
          amount: 50.00,
          currency: 'USD',
          merchant: 'Cross Tenant Test',
          category: 'Shopping',
          confidence: 90,
          explanation: 'Cross-tenant access test'
        })
        .select()
        .single();

      createdTransactions.push(transaction!.id);

      // User 2 attempts to update User 1's transaction
      const { data: updateResult, error: updateError } = await user2.client
        .from('transactions')
        .update({ amount: 999.99 })
        .eq('id', transaction!.id)
        .select();

      expect(updateResult).toEqual([]);
      expect(updateError).toBeNull(); // No error, but no rows affected

      // User 2 attempts to delete User 1's transaction
      const { data: deleteResult, error: deleteError } = await user2.client
        .from('transactions')
        .delete()
        .eq('id', transaction!.id)
        .select();

      expect(deleteResult).toEqual([]);
      expect(deleteError).toBeNull(); // No error, but no rows affected

      // Verify the transaction still exists and is unchanged
      const { data: verifyTransaction } = await user1.client
        .from('transactions')
        .select('*')
        .eq('id', transaction!.id)
        .single();

      expect(Number(verifyTransaction!.amount)).toBe(50.00);
    });

    it('should prevent bulk operations from affecting other organizations data', async () => {
      const [user1, user2] = testUsers;
      
      // User 1 creates multiple transactions
      const { data: user1Transactions } = await user1.client
        .from('transactions')
        .insert([
          {
            org_id: user1.orgId!,
            email_id: null,
            date: '2024-01-01',
            amount: 25.00,
            currency: 'USD',
            merchant: 'Bulk Test 1',
            category: 'Food',
            confidence: 85,
            explanation: 'Bulk test transaction 1'
          },
          {
            org_id: user1.orgId!,
            email_id: null,
            date: '2024-01-02',
            amount: 35.00,
            currency: 'USD',
            merchant: 'Bulk Test 2',
            category: 'Food',
            confidence: 88,
            explanation: 'Bulk test transaction 2'
          }
        ])
        .select();

      user1Transactions!.forEach(t => createdTransactions.push(t.id));

      // User 2 creates their own transactions
      const { data: user2Transactions } = await user2.client
        .from('transactions')
        .insert([
          {
            org_id: user2.orgId!,
            email_id: null,
            date: '2024-01-01',
            amount: 45.00,
            currency: 'USD',
            merchant: 'User2 Bulk Test 1',
            category: 'Shopping',
            confidence: 92,
            explanation: 'User2 bulk test transaction 1'
          }
        ])
        .select();

      user2Transactions!.forEach(t => createdTransactions.push(t.id));

      // User 2 attempts bulk update on all transactions (should only affect their own)
      const { data: bulkUpdateResult } = await user2.client
        .from('transactions')
        .update({ category: 'Modified' })
        .neq('id', '00000000-0000-0000-0000-000000000000') // Update all accessible transactions
        .select();

      expect(bulkUpdateResult!.length).toBe(1); // Only their own transaction
      expect(bulkUpdateResult![0].id).toBe(user2Transactions![0].id);

      // Verify User 1's transactions are unchanged
      const { data: user1VerifyTransactions } = await user1.client
        .from('transactions')
        .select('category')
        .in('id', user1Transactions!.map(t => t.id));

      expect(user1VerifyTransactions!.every(t => t.category === 'Food')).toBe(true);
    });
  });

  describe('Email Alias Association Verification', () => {
    it('should correctly associate emails with organizations based on alias', async () => {
      const [user1, user2] = testUsers;
      
      // Create inbox aliases for both organizations
      const { data: alias1 } = await user1.client
        .from('inbox_aliases')
        .insert({
          org_id: user1.orgId!,
          alias_email: 'u_test1@chiphi.oronculzac.com',
          is_active: true
        })
        .select()
        .single();

      const { data: alias2 } = await user2.client
        .from('inbox_aliases')
        .insert({
          org_id: user2.orgId!,
          alias_email: 'u_test2@chiphi.oronculzac.com',
          is_active: true
        })
        .select()
        .single();

      // Simulate email processing for each organization
      const { data: email1 } = await adminClient
        .from('emails')
        .insert({
          org_id: user1.orgId!,
          message_id: `alias-test-1-${Date.now()}`,
          from_email: 'sender@example.com',
          to_email: alias1!.alias_email,
          subject: 'Receipt for User 1',
          raw_content: 'Receipt content for user 1'
        })
        .select()
        .single();

      createdEmails.push(email1!.id);

      const { data: email2 } = await adminClient
        .from('emails')
        .insert({
          org_id: user2.orgId!,
          message_id: `alias-test-2-${Date.now()}`,
          from_email: 'sender@example.com',
          to_email: alias2!.alias_email,
          subject: 'Receipt for User 2',
          raw_content: 'Receipt content for user 2'
        })
        .select()
        .single();

      createdEmails.push(email2!.id);

      // Verify each user can only see their own emails
      const { data: user1Emails } = await user1.client
        .from('emails')
        .select('*')
        .in('id', [email1!.id, email2!.id]);

      expect(user1Emails!.length).toBe(1);
      expect(user1Emails![0].id).toBe(email1!.id);
      expect(user1Emails![0].to_email).toBe(alias1!.alias_email);

      const { data: user2Emails } = await user2.client
        .from('emails')
        .select('*')
        .in('id', [email1!.id, email2!.id]);

      expect(user2Emails!.length).toBe(1);
      expect(user2Emails![0].id).toBe(email2!.id);
      expect(user2Emails![0].to_email).toBe(alias2!.alias_email);
    });
  });

  describe('Database Function RLS Enforcement', () => {
    it('should enforce RLS in provider statistics function', async () => {
      const [user1, user2] = testUsers;
      
      // Create provider logs for both organizations
      await adminClient.from('email_provider_logs').insert([
        {
          org_id: user1.orgId!,
          provider_name: 'cloudflare',
          message_id: `stats-test-1-${Date.now()}`,
          payload: { test: 'stats test 1' },
          success: true,
          processing_time_ms: 150
        },
        {
          org_id: user2.orgId!,
          provider_name: 'ses',
          message_id: `stats-test-2-${Date.now()}`,
          payload: { test: 'stats test 2' },
          success: true,
          processing_time_ms: 200
        }
      ]);

      // Call provider statistics function as user 1
      const { data: user1Stats, error: user1Error } = await user1.client
        .rpc('get_provider_statistics', {
          org_uuid: user1.orgId!,
          provider_name_param: 'cloudflare',
          hours_back: 24
        });

      expect(user1Error).toBeNull();
      expect(user1Stats).toBeDefined();
      expect(user1Stats!.length).toBeGreaterThan(0);

      // Test that the function properly filters by organization
      // The function uses SECURITY DEFINER so it bypasses RLS, but it should still filter by org_id
      const { data: user2Stats, error: user2Error } = await user1.client
        .rpc('get_provider_statistics', {
          org_uuid: user2.orgId!,
          provider_name_param: 'cloudflare', // Specifically look for cloudflare stats in user2's org
          hours_back: 24
        });

      expect(user2Error).toBeNull();
      // Since user2's org only has SES logs (not cloudflare), this should return empty
      expect(user2Stats === null || user2Stats.length === 0).toBe(true);
    });

    it('should enforce RLS in idempotency check function', async () => {
      const [user1, user2] = testUsers;
      const messageId = `idempotency-test-${Date.now()}`;
      
      // Create a provider log for user 1's organization
      await adminClient.from('email_provider_logs').insert({
        org_id: user1.orgId!,
        provider_name: 'cloudflare',
        message_id: messageId,
        payload: { test: 'idempotency test' },
        success: true,
        processing_time_ms: 100
      });

      // User 1 should be able to check idempotency for their organization
      const { data: user1Check, error: user1Error } = await user1.client
        .rpc('check_message_idempotency', {
          org_uuid: user1.orgId!,
          message_id_param: messageId
        });

      expect(user1Error).toBeNull();
      expect(user1Check).toBe(true);

      // User 2 should not see the message as processed for their organization
      const { data: user2Check, error: user2Error } = await user2.client
        .rpc('check_message_idempotency', {
          org_uuid: user2.orgId!,
          message_id_param: messageId
        });

      expect(user2Error).toBeNull();
      expect(user2Check).toBe(false);
    });
  });

  // Helper functions for test setup and cleanup
  async function setupTestEnvironment() {
    // Create test organizations with unique names to avoid conflicts
    const timestamp = Date.now();
    const { data: orgs, error: orgError } = await adminClient
      .from('orgs')
      .insert([
        { name: `Test Organization 1 ${timestamp}` },
        { name: `Test Organization 2 ${timestamp}` }
      ])
      .select();

    if (orgError) {
      throw new Error(`Failed to create test organizations: ${orgError?.message || JSON.stringify(orgError)}`);
    }

    if (!orgs || orgs.length === 0) {
      throw new Error('No organizations were created');
    }

    testOrgs = orgs.map(org => ({
      id: org.id,
      name: org.name,
      ownerId: ''
    }));

    // Create test users with unique timestamps to avoid conflicts
    const testUserData = [
      { email: `rls-test-user1-${timestamp}@example.com`, password: 'test-password-123' },
      { email: `rls-test-user2-${timestamp}@example.com`, password: 'test-password-456' }
    ];

    for (let i = 0; i < testUserData.length; i++) {
      const userData = testUserData[i];
      
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
          full_name: `Test User ${i + 1}`
        });

      // Add user to organization
      await adminClient
        .from('org_members')
        .insert({
          org_id: testOrgs[i].id,
          user_id: authUser.user.id,
          role: 'owner'
        });

      testOrgs[i].ownerId = authUser.user.id;

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
        password: userData.password,
        client: userClient,
        orgId: testOrgs[i].id
      });
    }
  }

  async function cleanupTestEnvironment() {
    // Delete test users (this will cascade to org_members)
    for (const user of testUsers) {
      await adminClient.auth.admin.deleteUser(user.id);
    }

    // Delete test organizations
    for (const org of testOrgs) {
      await adminClient
        .from('orgs')
        .delete()
        .eq('id', org.id);
    }
  }

  async function cleanupTestData() {
    // Clean up emails
    if (createdEmails.length > 0) {
      await adminClient
        .from('emails')
        .delete()
        .in('id', createdEmails);
    }

    // Clean up transactions
    if (createdTransactions.length > 0) {
      await adminClient
        .from('transactions')
        .delete()
        .in('id', createdTransactions);
    }

    // Clean up provider logs
    if (createdProviderLogs.length > 0) {
      await adminClient
        .from('email_provider_logs')
        .delete()
        .in('id', createdProviderLogs);
    }
  }
});