/**
 * Transaction and Provider Integration RLS Tests
 * 
 * This test suite verifies that transaction data remains properly isolated
 * when processed through the new provider system, ensuring that the
 * provider abstraction layer maintains multi-tenant security.
 * 
 * Requirements tested:
 * - Transaction data isolation with new provider system
 * - Provider logs are correctly linked to transactions
 * - Processing logs maintain organization boundaries
 * - End-to-end email processing respects RLS policies
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
  aliasEmail: string;
}

describe('Transaction and Provider Integration RLS', () => {
  let adminClient: SupabaseClient<Database>;
  let testUsers: TestUser[] = [];
  let testOrgIds: string[] = [];
  
  // Test data cleanup tracking
  const createdEmails: string[] = [];
  const createdTransactions: string[] = [];
  const createdProviderLogs: string[] = [];
  const createdProcessingLogs: string[] = [];
  const createdAliases: string[] = [];

  beforeAll(async () => {
    adminClient = createClient<Database>(
      testConfig.supabase.url,
      testConfig.supabase.serviceRoleKey
    );

    await setupTransactionProviderTestEnvironment();
  });

  afterAll(async () => {
    await cleanupTransactionProviderTestEnvironment();
  });

  beforeEach(async () => {
    // Clear tracking arrays
    createdEmails.length = 0;
    createdTransactions.length = 0;
    createdProviderLogs.length = 0;
    createdProcessingLogs.length = 0;
    createdAliases.length = 0;
  });

  afterEach(async () => {
    await cleanupTransactionProviderTestData();
  });

  describe('End-to-End Provider Processing RLS', () => {
    it('should maintain transaction isolation through complete provider processing pipeline', async () => {
      const [user1, user2] = testUsers;
      const correlationId1 = crypto.randomUUID();
      const correlationId2 = crypto.randomUUID();

      // Simulate complete email processing for both organizations
      
      // Step 1: Create emails for both organizations
      const { data: email1 } = await adminClient
        .from('emails')
        .insert({
          org_id: user1.orgId,
          message_id: `pipeline-test-1-${Date.now()}`,
          from_email: 'receipt@store.com',
          to_email: user1.aliasEmail,
          subject: 'Your Receipt - $25.99',
          raw_content: 'Receipt content for user 1',
          parsed_content: {
            amount: 25.99,
            merchant: 'Test Store 1',
            date: '2024-01-01'
          }
        })
        .select()
        .single();

      createdEmails.push(email1!.id);

      const { data: email2 } = await adminClient
        .from('emails')
        .insert({
          org_id: user2.orgId,
          message_id: `pipeline-test-2-${Date.now()}`,
          from_email: 'receipt@shop.com',
          to_email: user2.aliasEmail,
          subject: 'Your Receipt - $45.50',
          raw_content: 'Receipt content for user 2',
          parsed_content: {
            amount: 45.50,
            merchant: 'Test Store 2',
            date: '2024-01-01'
          }
        })
        .select()
        .single();

      createdEmails.push(email2!.id);

      // Step 2: Create provider logs
      const { data: providerLog1 } = await adminClient
        .from('email_provider_logs')
        .insert({
          org_id: user1.orgId,
          provider_name: 'cloudflare',
          message_id: email1!.message_id,
          payload: {
            alias: user1.aliasEmail,
            from: 'receipt@store.com',
            subject: 'Your Receipt - $25.99'
          },
          success: true,
          processing_time_ms: 150,
          correlation_id: correlationId1
        })
        .select()
        .single();

      createdProviderLogs.push(providerLog1!.id);

      const { data: providerLog2 } = await adminClient
        .from('email_provider_logs')
        .insert({
          org_id: user2.orgId,
          provider_name: 'ses',
          message_id: email2!.message_id,
          payload: {
            alias: user2.aliasEmail,
            from: 'receipt@shop.com',
            subject: 'Your Receipt - $45.50'
          },
          success: true,
          processing_time_ms: 200,
          correlation_id: correlationId2
        })
        .select()
        .single();

      createdProviderLogs.push(providerLog2!.id);

      // Step 3: Create processing logs
      const { data: processingLog1 } = await adminClient
        .from('processing_logs')
        .insert({
          org_id: user1.orgId,
          email_id: email1!.id,
          step: 'ai_extraction',
          status: 'completed',
          details: { confidence: 85, extracted_amount: 25.99 },
          processing_time_ms: 2500,
          provider_log_id: providerLog1!.id
        })
        .select()
        .single();

      createdProcessingLogs.push(processingLog1!.id);

      const { data: processingLog2 } = await adminClient
        .from('processing_logs')
        .insert({
          org_id: user2.orgId,
          email_id: email2!.id,
          step: 'ai_extraction',
          status: 'completed',
          details: { confidence: 92, extracted_amount: 45.50 },
          processing_time_ms: 2200,
          provider_log_id: providerLog2!.id
        })
        .select()
        .single();

      createdProcessingLogs.push(processingLog2!.id);

      // Step 4: Create transactions
      const { data: transaction1 } = await adminClient
        .from('transactions')
        .insert({
          org_id: user1.orgId,
          email_id: email1!.id,
          date: '2024-01-01',
          amount: 25.99,
          currency: 'USD',
          merchant: 'Test Store 1',
          category: 'Shopping',
          confidence: 85,
          explanation: 'Extracted from receipt email via Cloudflare provider'
        })
        .select()
        .single();

      createdTransactions.push(transaction1!.id);

      const { data: transaction2 } = await adminClient
        .from('transactions')
        .insert({
          org_id: user2.orgId,
          email_id: email2!.id,
          date: '2024-01-01',
          amount: 45.50,
          currency: 'USD',
          merchant: 'Test Store 2',
          category: 'Shopping',
          confidence: 92,
          explanation: 'Extracted from receipt email via SES provider'
        })
        .select()
        .single();

      createdTransactions.push(transaction2!.id);

      // Verification: Each user should only see their own data across all tables
      
      // Check emails
      const { data: user1Emails } = await user1.client
        .from('emails')
        .select('*');
      
      expect(user1Emails!.every(e => e.org_id === user1.orgId)).toBe(true);
      expect(user1Emails!.some(e => e.id === email1!.id)).toBe(true);
      expect(user1Emails!.some(e => e.id === email2!.id)).toBe(false);

      // Check provider logs
      const { data: user1ProviderLogs } = await user1.client
        .from('email_provider_logs')
        .select('*');
      
      expect(user1ProviderLogs!.every(p => p.org_id === user1.orgId)).toBe(true);
      expect(user1ProviderLogs!.some(p => p.id === providerLog1!.id)).toBe(true);
      expect(user1ProviderLogs!.some(p => p.id === providerLog2!.id)).toBe(false);

      // Check processing logs
      const { data: user1ProcessingLogs } = await user1.client
        .from('processing_logs')
        .select('*');
      
      expect(user1ProcessingLogs!.every(p => p.org_id === user1.orgId)).toBe(true);
      expect(user1ProcessingLogs!.some(p => p.id === processingLog1!.id)).toBe(true);
      expect(user1ProcessingLogs!.some(p => p.id === processingLog2!.id)).toBe(false);

      // Check transactions
      const { data: user1Transactions } = await user1.client
        .from('transactions')
        .select('*');
      
      expect(user1Transactions!.every(t => t.org_id === user1.orgId)).toBe(true);
      expect(user1Transactions!.some(t => t.id === transaction1!.id)).toBe(true);
      expect(user1Transactions!.some(t => t.id === transaction2!.id)).toBe(false);

      // Verify user2 has the same isolation
      const { data: user2Transactions } = await user2.client
        .from('transactions')
        .select('*');
      
      expect(user2Transactions!.every(t => t.org_id === user2.orgId)).toBe(true);
      expect(user2Transactions!.some(t => t.id === transaction2!.id)).toBe(true);
      expect(user2Transactions!.some(t => t.id === transaction1!.id)).toBe(false);
    });

    it('should prevent cross-tenant access to linked provider and processing data', async () => {
      const [user1, user2] = testUsers;
      const correlationId = crypto.randomUUID();

      // Create a complete processing chain for user1
      const { data: email } = await adminClient
        .from('emails')
        .insert({
          org_id: user1.orgId,
          message_id: `linked-data-test-${Date.now()}`,
          from_email: 'receipt@example.com',
          to_email: user1.aliasEmail,
          subject: 'Test Receipt',
          raw_content: 'Test content'
        })
        .select()
        .single();

      createdEmails.push(email!.id);

      const { data: providerLog } = await adminClient
        .from('email_provider_logs')
        .insert({
          org_id: user1.orgId,
          provider_name: 'cloudflare',
          message_id: email!.message_id,
          payload: { test: 'linked data' },
          success: true,
          processing_time_ms: 100,
          correlation_id: correlationId
        })
        .select()
        .single();

      createdProviderLogs.push(providerLog!.id);

      const { data: processingLog } = await adminClient
        .from('processing_logs')
        .insert({
          org_id: user1.orgId,
          email_id: email!.id,
          step: 'test_step',
          status: 'completed',
          details: { test: 'linked processing' },
          processing_time_ms: 500,
          provider_log_id: providerLog!.id
        })
        .select()
        .single();

      createdProcessingLogs.push(processingLog!.id);

      const { data: transaction } = await adminClient
        .from('transactions')
        .insert({
          org_id: user1.orgId,
          email_id: email!.id,
          date: '2024-01-01',
          amount: 100.00,
          currency: 'USD',
          merchant: 'Linked Data Test',
          category: 'Test',
          confidence: 95,
          explanation: 'Test transaction with linked data'
        })
        .select()
        .single();

      createdTransactions.push(transaction!.id);

      // User2 should not be able to access any of the linked data
      
      // Cannot access the email
      const { data: crossTenantEmail } = await user2.client
        .from('emails')
        .select('*')
        .eq('id', email!.id);
      expect(crossTenantEmail).toEqual([]);

      // Cannot access the provider log
      const { data: crossTenantProviderLog } = await user2.client
        .from('email_provider_logs')
        .select('*')
        .eq('id', providerLog!.id);
      expect(crossTenantProviderLog).toEqual([]);

      // Cannot access the processing log
      const { data: crossTenantProcessingLog } = await user2.client
        .from('processing_logs')
        .select('*')
        .eq('id', processingLog!.id);
      expect(crossTenantProcessingLog).toEqual([]);

      // Cannot access the transaction
      const { data: crossTenantTransaction } = await user2.client
        .from('transactions')
        .select('*')
        .eq('id', transaction!.id);
      expect(crossTenantTransaction).toEqual([]);

      // Cannot access via joins either
      const { data: joinedData } = await user2.client
        .from('transactions')
        .select(`
          *,
          emails(*),
          processing_logs(*),
          processing_logs(email_provider_logs(*))
        `)
        .eq('id', transaction!.id);
      
      // RLS can return null or empty array when access is blocked
      expect(joinedData === null || joinedData.length === 0).toBe(true);
    });
  });

  describe('Provider Statistics and Analytics RLS', () => {
    it('should isolate provider statistics by organization', async () => {
      const [user1, user2] = testUsers;

      // Create provider logs with different success rates for each organization
      await adminClient.from('email_provider_logs').insert([
        // User1 org: 2 successful, 1 failed
        {
          org_id: user1.orgId,
          provider_name: 'cloudflare',
          message_id: `stats-1-${Date.now()}`,
          payload: { test: 'stats' },
          success: true,
          processing_time_ms: 100
        },
        {
          org_id: user1.orgId,
          provider_name: 'cloudflare',
          message_id: `stats-2-${Date.now()}`,
          payload: { test: 'stats' },
          success: true,
          processing_time_ms: 150
        },
        {
          org_id: user1.orgId,
          provider_name: 'cloudflare',
          message_id: `stats-3-${Date.now()}`,
          payload: { test: 'stats' },
          success: false,
          processing_time_ms: 200,
          error_message: 'Test error'
        },
        // User2 org: 1 successful, 0 failed
        {
          org_id: user2.orgId,
          provider_name: 'ses',
          message_id: `stats-4-${Date.now()}`,
          payload: { test: 'stats' },
          success: true,
          processing_time_ms: 180
        }
      ]);

      // User1 gets their organization's statistics
      const { data: user1Stats, error: user1Error } = await user1.client
        .rpc('get_provider_statistics', {
          org_uuid: user1.orgId,
          hours_back: 24
        });

      expect(user1Error).toBeNull();
      expect(user1Stats).toBeDefined();
      expect(user1Stats!.length).toBeGreaterThan(0);
      
      const cloudflareStats = user1Stats!.find(s => s.provider_name === 'cloudflare');
      expect(cloudflareStats).toBeDefined();
      expect(cloudflareStats!.total_processed).toBeGreaterThanOrEqual(3);
      expect(cloudflareStats!.success_count).toBeGreaterThanOrEqual(2);
      expect(cloudflareStats!.error_count).toBeGreaterThanOrEqual(1);

      // User2 gets their organization's statistics
      const { data: user2Stats, error: user2Error } = await user2.client
        .rpc('get_provider_statistics', {
          org_uuid: user2.orgId,
          hours_back: 24
        });

      expect(user2Error).toBeNull();
      expect(user2Stats).toBeDefined();
      expect(user2Stats!.length).toBeGreaterThan(0);
      
      const sesStats = user2Stats!.find(s => s.provider_name === 'ses');
      expect(sesStats).toBeDefined();
      expect(sesStats!.total_processed).toBeGreaterThanOrEqual(1);
      expect(sesStats!.success_count).toBeGreaterThanOrEqual(1);
      expect(sesStats!.error_count).toBe(0);

      // Verify no cross-contamination
      expect(user1Stats!.some(s => s.provider_name === 'ses')).toBe(false);
      expect(user2Stats!.some(s => s.provider_name === 'cloudflare')).toBe(false);
    });

    it('should prevent access to other organizations error details', async () => {
      const [user1, user2] = testUsers;

      // Create error logs for both organizations
      await adminClient.from('email_provider_logs').insert([
        {
          org_id: user1.orgId,
          provider_name: 'cloudflare',
          message_id: `error-detail-1-${Date.now()}`,
          payload: { sensitive: 'user1 data' },
          success: false,
          error_message: 'User1 sensitive error message',
          processing_time_ms: 100
        },
        {
          org_id: user2.orgId,
          provider_name: 'ses',
          message_id: `error-detail-2-${Date.now()}`,
          payload: { sensitive: 'user2 data' },
          success: false,
          error_message: 'User2 sensitive error message',
          processing_time_ms: 150
        }
      ]);

      // User1 gets their error details
      const { data: user1Errors, error: user1Error } = await user1.client
        .rpc('get_provider_errors', {
          org_uuid: user1.orgId,
          hours_back: 24
        });

      expect(user1Error).toBeNull();
      expect(user1Errors).toBeDefined();
      expect(user1Errors!.length).toBeGreaterThan(0);
      expect(user1Errors!.some(e => e.error_message?.includes('User1'))).toBe(true);
      expect(user1Errors!.some(e => e.error_message?.includes('User2'))).toBe(false);

      // User2 gets their error details
      const { data: user2Errors, error: user2Error } = await user2.client
        .rpc('get_provider_errors', {
          org_uuid: user2.orgId,
          hours_back: 24
        });

      expect(user2Error).toBeNull();
      expect(user2Errors).toBeDefined();
      expect(user2Errors!.length).toBeGreaterThan(0);
      expect(user2Errors!.some(e => e.error_message?.includes('User2'))).toBe(true);
      expect(user2Errors!.some(e => e.error_message?.includes('User1'))).toBe(false);
    });
  });

  // Helper functions
  async function setupTransactionProviderTestEnvironment() {
    // Create test organizations
    const { data: orgs } = await adminClient
      .from('orgs')
      .insert([
        { name: 'Transaction Provider Test Org 1' },
        { name: 'Transaction Provider Test Org 2' }
      ])
      .select();

    testOrgIds = orgs!.map(org => org.id);

    // Create test users with unique timestamps
    const timestamp = Date.now();
    const testUserData = [
      { email: `tx-provider-test-1-${timestamp}@example.com`, password: 'test-pass-123' },
      { email: `tx-provider-test-2-${timestamp}@example.com`, password: 'test-pass-456' }
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
          full_name: `Transaction Provider Test User ${i + 1}`
        });

      // Add user to organization
      await adminClient
        .from('org_members')
        .insert({
          org_id: testOrgIds[i],
          user_id: authUser.user.id,
          role: 'owner'
        });

      // Create inbox alias for this user
      const aliasEmail = `u_txtest${i + 1}@chiphi.oronculzac.com`;
      const { data: alias } = await adminClient
        .from('inbox_aliases')
        .insert({
          org_id: testOrgIds[i],
          alias_email: aliasEmail,
          is_active: true
        })
        .select()
        .single();

      createdAliases.push(alias!.id);

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
        orgId: testOrgIds[i],
        aliasEmail: aliasEmail
      });
    }
  }

  async function cleanupTransactionProviderTestEnvironment() {
    // Clean up aliases
    if (createdAliases.length > 0) {
      await adminClient
        .from('inbox_aliases')
        .delete()
        .in('id', createdAliases);
    }

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

  async function cleanupTransactionProviderTestData() {
    // Clean up in reverse dependency order
    if (createdTransactions.length > 0) {
      await adminClient
        .from('transactions')
        .delete()
        .in('id', createdTransactions);
    }

    if (createdProcessingLogs.length > 0) {
      await adminClient
        .from('processing_logs')
        .delete()
        .in('id', createdProcessingLogs);
    }

    if (createdProviderLogs.length > 0) {
      await adminClient
        .from('email_provider_logs')
        .delete()
        .in('id', createdProviderLogs);
    }

    if (createdEmails.length > 0) {
      await adminClient
        .from('emails')
        .delete()
        .in('id', createdEmails);
    }
  }
});