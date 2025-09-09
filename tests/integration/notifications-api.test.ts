import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

// Test configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('Notifications API Integration Tests', () => {
  let supabase: ReturnType<typeof createClient<Database>>;
  let testOrgId: string;
  let testUserId: string;
  let authToken: string;

  beforeEach(async () => {
    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Create test organization
    const { data: org, error: orgError } = await supabase
      .from('orgs')
      .insert({ name: 'Test Notifications Org' })
      .select()
      .single();

    if (orgError) throw orgError;
    testOrgId = org.id;

    // Create test user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'notifications-test@example.com',
      password: 'test-password-123',
      email_confirm: true,
    });

    if (authError) throw authError;
    testUserId = authData.user.id;

    // Add user to organization
    const { error: memberError } = await supabase
      .from('org_members')
      .insert({
        org_id: testOrgId,
        user_id: testUserId,
        role: 'owner',
      });

    if (memberError) throw memberError;

    // Get auth token for API requests
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: 'notifications-test@example.com',
    });

    if (sessionError) throw sessionError;

    // Sign in to get session token
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'notifications-test@example.com',
      password: 'test-password-123',
    });

    if (signInError) throw signInError;
    authToken = signInData.session?.access_token || '';
  });

  afterEach(async () => {
    // Clean up test data
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
    if (testOrgId) {
      await supabase.from('orgs').delete().eq('id', testOrgId);
    }
  });

  describe('GET /api/settings/notifications', () => {
    it('should return default notification preferences for new user', async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/settings/notifications`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data).toEqual({
        receiptProcessed: true,
        dailySummary: false,
        weeklySummary: false,
        summaryEmails: [],
      });
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/settings/notifications`);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return existing preferences', async () => {
      // Create notification preferences directly in database
      await supabase
        .from('notifications_prefs')
        .insert({
          org_id: testOrgId,
          user_id: testUserId,
          receipt_processed: false,
          daily_summary: true,
          weekly_summary: true,
          summary_emails: ['test1@example.com', 'test2@example.com'],
        });

      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/settings/notifications`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data).toEqual({
        receiptProcessed: false,
        dailySummary: true,
        weeklySummary: true,
        summaryEmails: ['test1@example.com', 'test2@example.com'],
      });
    });
  });

  describe('PUT /api/settings/notifications', () => {
    it('should update notification preferences', async () => {
      const updateData = {
        receiptProcessed: false,
        dailySummary: true,
        weeklySummary: false,
        summaryEmails: ['updated@example.com'],
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/settings/notifications`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data).toEqual(updateData);

      // Verify in database
      const { data: dbData, error } = await supabase
        .from('notifications_prefs')
        .select('*')
        .eq('org_id', testOrgId)
        .eq('user_id', testUserId)
        .single();

      expect(error).toBeNull();
      expect(dbData?.receipt_processed).toBe(false);
      expect(dbData?.daily_summary).toBe(true);
      expect(dbData?.weekly_summary).toBe(false);
      expect(dbData?.summary_emails).toEqual(['updated@example.com']);
    });

    it('should update partial preferences', async () => {
      // First create initial preferences
      await supabase
        .from('notifications_prefs')
        .insert({
          org_id: testOrgId,
          user_id: testUserId,
          receipt_processed: true,
          daily_summary: false,
          weekly_summary: false,
          summary_emails: ['initial@example.com'],
        });

      // Update only daily_summary
      const updateData = {
        dailySummary: true,
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/settings/notifications`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      // Should return all preferences with only dailySummary updated
      expect(data.receiptProcessed).toBe(true);
      expect(data.dailySummary).toBe(true);
      expect(data.weeklySummary).toBe(false);
      expect(data.summaryEmails).toEqual(['initial@example.com']);
    });

    it('should validate email addresses in summaryEmails', async () => {
      const updateData = {
        summaryEmails: ['valid@example.com', 'invalid-email'],
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/settings/notifications`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request data');
      expect(data.details).toBeDefined();
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/settings/notifications`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ receiptProcessed: false }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should handle invalid JSON', async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/settings/notifications`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      });

      expect(response.status).toBe(500);
    });

    it('should enforce multi-tenant isolation', async () => {
      // Create another organization and user
      const { data: otherOrg, error: otherOrgError } = await supabase
        .from('orgs')
        .insert({ name: 'Other Org' })
        .select()
        .single();

      if (otherOrgError) throw otherOrgError;

      const { data: otherAuthData, error: otherAuthError } = await supabase.auth.admin.createUser({
        email: 'other-user@example.com',
        password: 'test-password-123',
        email_confirm: true,
      });

      if (otherAuthError) throw otherAuthError;

      await supabase
        .from('org_members')
        .insert({
          org_id: otherOrg.id,
          user_id: otherAuthData.user.id,
          role: 'owner',
        });

      // Create preferences for other user
      await supabase
        .from('notifications_prefs')
        .insert({
          org_id: otherOrg.id,
          user_id: otherAuthData.user.id,
          receipt_processed: false,
          daily_summary: true,
          weekly_summary: true,
          summary_emails: ['other@example.com'],
        });

      // Try to access with our test user - should not see other user's preferences
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/settings/notifications`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      // Should get default preferences, not the other user's preferences
      expect(data).toEqual({
        receiptProcessed: true,
        dailySummary: false,
        weeklySummary: false,
        summaryEmails: [],
      });

      // Clean up
      await supabase.auth.admin.deleteUser(otherAuthData.user.id);
      await supabase.from('orgs').delete().eq('id', otherOrg.id);
    });
  });

  describe('Database Functions', () => {
    it('should create default preferences with get_or_create_notification_prefs', async () => {
      const { data, error } = await supabase
        .rpc('get_or_create_notification_prefs', {
          p_org_id: testOrgId,
          p_user_id: testUserId,
        });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.receipt_processed).toBe(true);
      expect(data.daily_summary).toBe(false);
      expect(data.weekly_summary).toBe(false);
      expect(data.summary_emails).toEqual([]);
    });

    it('should return existing preferences with get_or_create_notification_prefs', async () => {
      // Create preferences first
      await supabase
        .from('notifications_prefs')
        .insert({
          org_id: testOrgId,
          user_id: testUserId,
          receipt_processed: false,
          daily_summary: true,
          weekly_summary: true,
          summary_emails: ['existing@example.com'],
        });

      const { data, error } = await supabase
        .rpc('get_or_create_notification_prefs', {
          p_org_id: testOrgId,
          p_user_id: testUserId,
        });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.receipt_processed).toBe(false);
      expect(data.daily_summary).toBe(true);
      expect(data.weekly_summary).toBe(true);
      expect(data.summary_emails).toEqual(['existing@example.com']);
    });

    it('should update preferences with update_notification_prefs', async () => {
      const { data, error } = await supabase
        .rpc('update_notification_prefs', {
          p_org_id: testOrgId,
          p_user_id: testUserId,
          p_receipt_processed: false,
          p_daily_summary: true,
          p_weekly_summary: false,
          p_summary_emails: ['function@example.com'],
        });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.receipt_processed).toBe(false);
      expect(data.daily_summary).toBe(true);
      expect(data.weekly_summary).toBe(false);
      expect(data.summary_emails).toEqual(['function@example.com']);
    });

    it('should handle partial updates with update_notification_prefs', async () => {
      // Create initial preferences
      await supabase
        .from('notifications_prefs')
        .insert({
          org_id: testOrgId,
          user_id: testUserId,
          receipt_processed: true,
          daily_summary: false,
          weekly_summary: false,
          summary_emails: ['initial@example.com'],
        });

      // Update only daily_summary
      const { data, error } = await supabase
        .rpc('update_notification_prefs', {
          p_org_id: testOrgId,
          p_user_id: testUserId,
          p_daily_summary: true,
        });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.receipt_processed).toBe(true); // Should remain unchanged
      expect(data.daily_summary).toBe(true); // Should be updated
      expect(data.weekly_summary).toBe(false); // Should remain unchanged
      expect(data.summary_emails).toEqual(['initial@example.com']); // Should remain unchanged
    });
  });
});