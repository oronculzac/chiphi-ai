/**
 * Reports MVP Database Functions Tests
 * 
 * Unit tests for fn_report_totals, fn_report_by_category, and fn_report_daily functions
 * Requirements: 1.1, 2.1, 3.1, 9.1, 9.2
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

type SupabaseClient = ReturnType<typeof createClient<Database>>;

describe('Reports MVP Database Functions', () => {
  let supabase: SupabaseClient;
  let testOrgId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Create admin client for test setup
    supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Create test organization
    const { data: orgData, error: orgError } = await supabase
      .from('orgs')
      .insert({
        name: 'Test Reports Org',
      })
      .select()
      .single();

    if (orgError) throw orgError;
    testOrgId = orgData.id;

    // Create test user (using a mock auth user ID)
    testUserId = '00000000-0000-0000-0000-000000000001';
    
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        email: 'test-reports@example.com',
        full_name: 'Test Reports User',
      });

    if (userError && !userError.message.includes('duplicate key')) {
      throw userError;
    }

    // Create org membership
    const { error: memberError } = await supabase
      .from('org_members')
      .insert({
        org_id: testOrgId,
        user_id: testUserId,
        role: 'owner',
      });

    if (memberError && !memberError.message.includes('duplicate key')) {
      throw memberError;
    }
  });

  afterAll(async () => {
    // Clean up test data
    await supabase.from('transactions').delete().eq('org_id', testOrgId);
    await supabase.from('org_members').delete().eq('org_id', testOrgId);
    await supabase.from('users').delete().eq('id', testUserId);
    await supabase.from('orgs').delete().eq('id', testOrgId);
  });

  beforeEach(async () => {
    // Clean up transactions before each test
    await supabase.from('transactions').delete().eq('org_id', testOrgId);
  });

  describe('fn_report_totals', () => {
    it('should return correct totals with comparison to previous period', async () => {
      // Insert test transactions for current period (last 7 days)
      const currentPeriodTransactions = [
        {
          org_id: testOrgId,
          date: '2024-01-15',
          amount: 100.00,
          currency: 'USD',
          merchant: 'Test Merchant 1',
          category: 'Food',
          confidence: 95,
          explanation: 'Test transaction',
        },
        {
          org_id: testOrgId,
          date: '2024-01-16',
          amount: 50.00,
          currency: 'USD',
          merchant: 'Test Merchant 2',
          category: 'Transport',
          confidence: 90,
          explanation: 'Test transaction',
        },
      ];

      // Insert test transactions for previous period (7 days before)
      const previousPeriodTransactions = [
        {
          org_id: testOrgId,
          date: '2024-01-07',
          amount: 80.00,
          currency: 'USD',
          merchant: 'Test Merchant 3',
          category: 'Food',
          confidence: 95,
          explanation: 'Test transaction',
        },
        {
          org_id: testOrgId,
          date: '2024-01-08',
          amount: 40.00,
          currency: 'USD',
          merchant: 'Test Merchant 4',
          category: 'Transport',
          confidence: 90,
          explanation: 'Test transaction',
        },
      ];

      // Insert all transactions
      const { error: insertError } = await supabase
        .from('transactions')
        .insert([...currentPeriodTransactions, ...previousPeriodTransactions]);

      expect(insertError).toBeNull();

      // Call the function
      const { data, error } = await supabase.rpc('fn_report_totals', {
        p_org_id: testOrgId,
        p_start_date: '2024-01-15',
        p_end_date: '2024-01-16',
      });

      expect(error).toBeNull();
      expect(data).toHaveLength(1);

      const result = data[0];
      expect(result.current_total).toBe('150.00');
      expect(result.previous_total).toBe('120.00');
      expect(result.change_amount).toBe('30.00');
      expect(result.change_percentage).toBe('25.00');
    });

    it('should handle zero previous period correctly', async () => {
      // Insert only current period transactions
      const { error: insertError } = await supabase
        .from('transactions')
        .insert([
          {
            org_id: testOrgId,
            date: '2024-01-15',
            amount: 100.00,
            currency: 'USD',
            merchant: 'Test Merchant',
            category: 'Food',
            confidence: 95,
            explanation: 'Test transaction',
          },
        ]);

      expect(insertError).toBeNull();

      const { data, error } = await supabase.rpc('fn_report_totals', {
        p_org_id: testOrgId,
        p_start_date: '2024-01-15',
        p_end_date: '2024-01-15',
      });

      expect(error).toBeNull();
      expect(data).toHaveLength(1);

      const result = data[0];
      expect(result.current_total).toBe('100.00');
      expect(result.previous_total).toBe('0.00');
      expect(result.change_amount).toBe('100.00');
      expect(result.change_percentage).toBe('100.00');
    });

    it('should validate date parameters', async () => {
      const { error } = await supabase.rpc('fn_report_totals', {
        p_org_id: testOrgId,
        p_start_date: '2024-01-16',
        p_end_date: '2024-01-15', // End date before start date
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Start date cannot be after end date');
    });
  });

  describe('fn_report_by_category', () => {
    it('should return category breakdown with percentages', async () => {
      // Insert test transactions with different categories
      const transactions = [
        {
          org_id: testOrgId,
          date: '2024-01-15',
          amount: 100.00,
          currency: 'USD',
          merchant: 'Restaurant',
          category: 'Food',
          confidence: 95,
          explanation: 'Test transaction',
        },
        {
          org_id: testOrgId,
          date: '2024-01-15',
          amount: 50.00,
          currency: 'USD',
          merchant: 'Uber',
          category: 'Transport',
          confidence: 90,
          explanation: 'Test transaction',
        },
        {
          org_id: testOrgId,
          date: '2024-01-15',
          amount: 50.00,
          currency: 'USD',
          merchant: 'Another Restaurant',
          category: 'Food',
          confidence: 95,
          explanation: 'Test transaction',
        },
      ];

      const { error: insertError } = await supabase
        .from('transactions')
        .insert(transactions);

      expect(insertError).toBeNull();

      const { data, error } = await supabase.rpc('fn_report_by_category', {
        p_org_id: testOrgId,
        p_start_date: '2024-01-15',
        p_end_date: '2024-01-15',
      });

      expect(error).toBeNull();
      expect(data).toHaveLength(2);

      // Results should be ordered by amount DESC
      expect(data[0].category).toBe('Food');
      expect(data[0].amount).toBe('150.00');
      expect(data[0].percentage).toBe('75.00');
      expect(data[0].count).toBe(2);

      expect(data[1].category).toBe('Transport');
      expect(data[1].amount).toBe('50.00');
      expect(data[1].percentage).toBe('25.00');
      expect(data[1].count).toBe(1);
    });

    it('should filter by categories when provided', async () => {
      // Insert test transactions
      const transactions = [
        {
          org_id: testOrgId,
          date: '2024-01-15',
          amount: 100.00,
          currency: 'USD',
          merchant: 'Restaurant',
          category: 'Food',
          confidence: 95,
          explanation: 'Test transaction',
        },
        {
          org_id: testOrgId,
          date: '2024-01-15',
          amount: 50.00,
          currency: 'USD',
          merchant: 'Uber',
          category: 'Transport',
          confidence: 90,
          explanation: 'Test transaction',
        },
        {
          org_id: testOrgId,
          date: '2024-01-15',
          amount: 30.00,
          currency: 'USD',
          merchant: 'Store',
          category: 'Shopping',
          confidence: 85,
          explanation: 'Test transaction',
        },
      ];

      const { error: insertError } = await supabase
        .from('transactions')
        .insert(transactions);

      expect(insertError).toBeNull();

      // Filter by Food and Transport categories only
      const { data, error } = await supabase.rpc('fn_report_by_category', {
        p_org_id: testOrgId,
        p_start_date: '2024-01-15',
        p_end_date: '2024-01-15',
        p_categories: ['Food', 'Transport'],
      });

      expect(error).toBeNull();
      expect(data).toHaveLength(2);

      // Should only include Food and Transport, not Shopping
      const categories = data.map(d => d.category);
      expect(categories).toContain('Food');
      expect(categories).toContain('Transport');
      expect(categories).not.toContain('Shopping');

      // Percentages should be calculated based on filtered total (150.00)
      const foodResult = data.find(d => d.category === 'Food');
      expect(foodResult?.percentage).toBe('66.67');
    });

    it('should handle empty results', async () => {
      const { data, error } = await supabase.rpc('fn_report_by_category', {
        p_org_id: testOrgId,
        p_start_date: '2024-01-15',
        p_end_date: '2024-01-15',
      });

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  });

  describe('fn_report_daily', () => {
    it('should return daily spending data for date range', async () => {
      // Insert test transactions across multiple days
      const transactions = [
        {
          org_id: testOrgId,
          date: '2024-01-15',
          amount: 100.00,
          currency: 'USD',
          merchant: 'Restaurant',
          category: 'Food',
          confidence: 95,
          explanation: 'Test transaction',
        },
        {
          org_id: testOrgId,
          date: '2024-01-15',
          amount: 50.00,
          currency: 'USD',
          merchant: 'Uber',
          category: 'Transport',
          confidence: 90,
          explanation: 'Test transaction',
        },
        {
          org_id: testOrgId,
          date: '2024-01-16',
          amount: 75.00,
          currency: 'USD',
          merchant: 'Store',
          category: 'Shopping',
          confidence: 85,
          explanation: 'Test transaction',
        },
        // No transactions on 2024-01-17
      ];

      const { error: insertError } = await supabase
        .from('transactions')
        .insert(transactions);

      expect(insertError).toBeNull();

      const { data, error } = await supabase.rpc('fn_report_daily', {
        p_org_id: testOrgId,
        p_start_date: '2024-01-15',
        p_end_date: '2024-01-17',
      });

      expect(error).toBeNull();
      expect(data).toHaveLength(3); // 3 days in range

      // Check each day
      expect(data[0].date).toBe('2024-01-15');
      expect(data[0].amount).toBe('150.00');
      expect(data[0].transaction_count).toBe(2);

      expect(data[1].date).toBe('2024-01-16');
      expect(data[1].amount).toBe('75.00');
      expect(data[1].transaction_count).toBe(1);

      expect(data[2].date).toBe('2024-01-17');
      expect(data[2].amount).toBe('0.00');
      expect(data[2].transaction_count).toBe(0);
    });

    it('should filter by categories', async () => {
      // Insert test transactions
      const transactions = [
        {
          org_id: testOrgId,
          date: '2024-01-15',
          amount: 100.00,
          currency: 'USD',
          merchant: 'Restaurant',
          category: 'Food',
          confidence: 95,
          explanation: 'Test transaction',
        },
        {
          org_id: testOrgId,
          date: '2024-01-15',
          amount: 50.00,
          currency: 'USD',
          merchant: 'Uber',
          category: 'Transport',
          confidence: 90,
          explanation: 'Test transaction',
        },
      ];

      const { error: insertError } = await supabase
        .from('transactions')
        .insert(transactions);

      expect(insertError).toBeNull();

      // Filter by Food category only
      const { data, error } = await supabase.rpc('fn_report_daily', {
        p_org_id: testOrgId,
        p_start_date: '2024-01-15',
        p_end_date: '2024-01-15',
        p_categories: ['Food'],
      });

      expect(error).toBeNull();
      expect(data).toHaveLength(1);

      expect(data[0].amount).toBe('100.00');
      expect(data[0].transaction_count).toBe(1);
    });

    it('should filter by search term', async () => {
      // Insert test transactions
      const transactions = [
        {
          org_id: testOrgId,
          date: '2024-01-15',
          amount: 100.00,
          currency: 'USD',
          merchant: 'McDonald\'s Restaurant',
          category: 'Food',
          confidence: 95,
          explanation: 'Test transaction',
          notes: 'Lunch with colleagues',
        },
        {
          org_id: testOrgId,
          date: '2024-01-15',
          amount: 50.00,
          currency: 'USD',
          merchant: 'Uber',
          category: 'Transport',
          confidence: 90,
          explanation: 'Test transaction',
          notes: 'Trip to airport',
        },
      ];

      const { error: insertError } = await supabase
        .from('transactions')
        .insert(transactions);

      expect(insertError).toBeNull();

      // Search for "McDonald" in merchant name
      const { data: merchantData, error: merchantError } = await supabase.rpc('fn_report_daily', {
        p_org_id: testOrgId,
        p_start_date: '2024-01-15',
        p_end_date: '2024-01-15',
        p_search: 'McDonald',
      });

      expect(merchantError).toBeNull();
      expect(merchantData).toHaveLength(1);
      expect(merchantData[0].amount).toBe('100.00');

      // Search for "airport" in notes
      const { data: notesData, error: notesError } = await supabase.rpc('fn_report_daily', {
        p_org_id: testOrgId,
        p_start_date: '2024-01-15',
        p_end_date: '2024-01-15',
        p_search: 'airport',
      });

      expect(notesError).toBeNull();
      expect(notesData).toHaveLength(1);
      expect(notesData[0].amount).toBe('50.00');
    });

    it('should limit date range to prevent excessive computation', async () => {
      const { error } = await supabase.rpc('fn_report_daily', {
        p_org_id: testOrgId,
        p_start_date: '2023-01-01',
        p_end_date: '2024-12-31', // More than 365 days
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Date range cannot exceed 365 days');
    });

    it('should validate date parameters', async () => {
      const { error } = await supabase.rpc('fn_report_daily', {
        p_org_id: testOrgId,
        p_start_date: '2024-01-16',
        p_end_date: '2024-01-15', // End date before start date
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Start date cannot be after end date');
    });
  });

  describe('Multi-tenant isolation', () => {
    let otherOrgId: string;

    beforeAll(async () => {
      // Create another test organization
      const { data: orgData, error: orgError } = await supabase
        .from('orgs')
        .insert({
          name: 'Other Test Org',
        })
        .select()
        .single();

      if (orgError) throw orgError;
      otherOrgId = orgData.id;
    });

    afterAll(async () => {
      // Clean up other org
      await supabase.from('transactions').delete().eq('org_id', otherOrgId);
      await supabase.from('orgs').delete().eq('id', otherOrgId);
    });

    it('should only return data for the specified organization', async () => {
      // Insert transactions for both organizations
      const transactions = [
        {
          org_id: testOrgId,
          date: '2024-01-15',
          amount: 100.00,
          currency: 'USD',
          merchant: 'Test Org Transaction',
          category: 'Food',
          confidence: 95,
          explanation: 'Test transaction',
        },
        {
          org_id: otherOrgId,
          date: '2024-01-15',
          amount: 200.00,
          currency: 'USD',
          merchant: 'Other Org Transaction',
          category: 'Food',
          confidence: 95,
          explanation: 'Test transaction',
        },
      ];

      const { error: insertError } = await supabase
        .from('transactions')
        .insert(transactions);

      expect(insertError).toBeNull();

      // Test fn_report_totals isolation
      const { data: totalsData, error: totalsError } = await supabase.rpc('fn_report_totals', {
        p_org_id: testOrgId,
        p_start_date: '2024-01-15',
        p_end_date: '2024-01-15',
      });

      expect(totalsError).toBeNull();
      expect(totalsData[0].current_total).toBe('100.00'); // Only test org data

      // Test fn_report_by_category isolation
      const { data: categoryData, error: categoryError } = await supabase.rpc('fn_report_by_category', {
        p_org_id: testOrgId,
        p_start_date: '2024-01-15',
        p_end_date: '2024-01-15',
      });

      expect(categoryError).toBeNull();
      expect(categoryData[0].amount).toBe('100.00'); // Only test org data

      // Test fn_report_daily isolation
      const { data: dailyData, error: dailyError } = await supabase.rpc('fn_report_daily', {
        p_org_id: testOrgId,
        p_start_date: '2024-01-15',
        p_end_date: '2024-01-15',
      });

      expect(dailyError).toBeNull();
      expect(dailyData[0].amount).toBe('100.00'); // Only test org data
    });
  });
});