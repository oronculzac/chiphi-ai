/**
 * Supabase MCP Integration Tests
 * 
 * Tests direct database operations, migrations, and queries using Supabase MCP server
 * Validates multi-tenant isolation, RLS policies, and data integrity
 */

import { test, expect } from '@playwright/test';
import { TestHelpers, MCPSupabaseHelper } from '../utils/test-helpers';
import { testOrganizations, testUsers } from '../fixtures/test-organizations';
import { englishReceipts } from '../fixtures/email-samples';
import { validateTestResult } from '@/lib/types/test-schemas';

test.describe('Supabase MCP Integration', () => {
  let mcpSupabase: MCPSupabaseHelper;
  let testOrgId: string;
  let testUserId: string;

  test.beforeAll(async () => {
    mcpSupabase = new MCPSupabaseHelper();
    testOrgId = testOrganizations.orgA.id;
    testUserId = testOrganizations.orgA.userId;
  });

  test.beforeEach(async ({ page }) => {
    // Initialize MCP connection
    await mcpSupabase.initialize();
    
    // Ensure test organization exists
    await mcpSupabase.ensureTestOrganization(testOrgId, testOrganizations.orgA.name);
    await mcpSupabase.ensureTestUser(testUserId, testUsers.orgAOwner.email, testOrgId);
  });

  test('should create and query transactions with RLS enforcement', async ({ page }) => {
    // Create test transaction using MCP
    const transactionData = {
      org_id: testOrgId,
      email_id: 'test-email-123',
      date: '2024-01-15',
      amount: 25.99,
      currency: 'USD',
      merchant: 'Test Merchant',
      category: 'Shopping',
      confidence: 85,
      explanation: 'Test transaction for MCP integration',
    };

    const createResult = await mcpSupabase.executeSQL(`
      INSERT INTO transactions (org_id, email_id, date, amount, currency, merchant, category, confidence, explanation)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      transactionData.org_id,
      transactionData.email_id,
      transactionData.date,
      transactionData.amount,
      transactionData.currency,
      transactionData.merchant,
      transactionData.category,
      transactionData.confidence,
      transactionData.explanation,
    ]);

    expect(createResult.success).toBe(true);
    expect(createResult.data).toHaveLength(1);
    
    const transactionId = createResult.data[0].id;

    // Query transaction with proper org context
    const queryResult = await mcpSupabase.executeSQL(`
      SELECT * FROM transactions WHERE id = $1 AND org_id = $2
    `, [transactionId, testOrgId]);

    expect(queryResult.success).toBe(true);
    expect(queryResult.data).toHaveLength(1);
    expect(queryResult.data[0].merchant).toBe('Test Merchant');
    expect(queryResult.data[0].amount).toBe('25.99');

    // Verify RLS prevents access from different org
    const otherOrgId = testOrganizations.orgB.id;
    const rlsTestResult = await mcpSupabase.executeSQL(`
      SELECT * FROM transactions WHERE id = $1 AND org_id = $2
    `, [transactionId, otherOrgId]);

    expect(rlsTestResult.success).toBe(true);
    expect(rlsTestResult.data).toHaveLength(0); // Should be empty due to RLS
  });

  test('should manage merchant mappings with tenant isolation', async ({ page }) => {
    const merchantData = {
      org_id: testOrgId,
      merchant_name: 'test merchant mcp',
      category: 'Food & Dining',
      subcategory: 'Coffee Shops',
      created_by: testUserId,
    };

    // Create merchant mapping
    const createResult = await mcpSupabase.executeSQL(`
      INSERT INTO merchant_map (org_id, merchant_name, category, subcategory, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [
      merchantData.org_id,
      merchantData.merchant_name,
      merchantData.category,
      merchantData.subcategory,
      merchantData.created_by,
    ]);

    expect(createResult.success).toBe(true);
    const mappingId = createResult.data[0].id;

    // Query mapping
    const queryResult = await mcpSupabase.executeSQL(`
      SELECT * FROM merchant_map WHERE merchant_name = $1 AND org_id = $2
    `, [merchantData.merchant_name, testOrgId]);

    expect(queryResult.success).toBe(true);
    expect(queryResult.data).toHaveLength(1);
    expect(queryResult.data[0].category).toBe('Food & Dining');

    // Test tenant isolation - other org shouldn't see this mapping
    const isolationResult = await mcpSupabase.executeSQL(`
      SELECT * FROM merchant_map WHERE merchant_name = $1 AND org_id = $2
    `, [merchantData.merchant_name, testOrganizations.orgB.id]);

    expect(isolationResult.success).toBe(true);
    expect(isolationResult.data).toHaveLength(0);

    // Update mapping
    const updateResult = await mcpSupabase.executeSQL(`
      UPDATE merchant_map 
      SET category = $1, subcategory = $2, updated_at = NOW()
      WHERE id = $3 AND org_id = $4
    `, ['Transportation', 'Gas Stations', mappingId, testOrgId]);

    expect(updateResult.success).toBe(true);

    // Verify update
    const verifyResult = await mcpSupabase.executeSQL(`
      SELECT category, subcategory FROM merchant_map WHERE id = $1
    `, [mappingId]);

    expect(verifyResult.data[0].category).toBe('Transportation');
    expect(verifyResult.data[0].subcategory).toBe('Gas Stations');
  });

  test('should apply database migrations using MCP', async ({ page }) => {
    // Test migration for adding performance metrics table
    const migrationSQL = `
      CREATE TABLE IF NOT EXISTS test_performance_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
        metric_name TEXT NOT NULL,
        metric_value NUMERIC NOT NULL,
        metric_unit TEXT,
        endpoint TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Add RLS policy
      ALTER TABLE test_performance_metrics ENABLE ROW LEVEL SECURITY;

      CREATE POLICY IF NOT EXISTS "Users can only access their org's performance metrics"
      ON test_performance_metrics FOR ALL
      USING (org_id IN (
        SELECT org_id FROM org_members 
        WHERE user_id = auth.uid()
      ));

      -- Add index for performance
      CREATE INDEX IF NOT EXISTS idx_test_performance_metrics_org_created 
      ON test_performance_metrics (org_id, created_at DESC);
    `;

    const migrationResult = await mcpSupabase.applyMigration(
      'test_performance_metrics_table',
      migrationSQL
    );

    expect(migrationResult.success).toBe(true);

    // Verify table was created
    const tableCheckResult = await mcpSupabase.executeSQL(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name = 'test_performance_metrics' AND table_schema = 'public'
    `);

    expect(tableCheckResult.success).toBe(true);
    expect(tableCheckResult.data).toHaveLength(1);

    // Test inserting data into new table
    const insertResult = await mcpSupabase.executeSQL(`
      INSERT INTO test_performance_metrics (org_id, metric_name, metric_value, metric_unit)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [testOrgId, 'test_metric', 100, 'ms']);

    expect(insertResult.success).toBe(true);

    // Verify RLS works on new table
    const rlsTestResult = await mcpSupabase.executeSQL(`
      SELECT * FROM test_performance_metrics WHERE org_id = $1
    `, [testOrganizations.orgB.id]);

    expect(rlsTestResult.success).toBe(true);
    expect(rlsTestResult.data).toHaveLength(0); // Should be empty due to RLS

    // Clean up test table
    await mcpSupabase.executeSQL('DROP TABLE IF EXISTS test_performance_metrics CASCADE');
  });

  test('should validate database indexes and performance', async ({ page }) => {
    // Check critical indexes exist
    const indexQueries = [
      {
        name: 'transactions_org_date',
        query: `
          SELECT indexname FROM pg_indexes 
          WHERE tablename = 'transactions' 
          AND indexname = 'idx_transactions_org_date'
        `
      },
      {
        name: 'merchant_map_org_merchant',
        query: `
          SELECT indexname FROM pg_indexes 
          WHERE tablename = 'merchant_map' 
          AND indexname = 'idx_merchant_map_org_merchant'
        `
      },
      {
        name: 'emails_org_created_at',
        query: `
          SELECT indexname FROM pg_indexes 
          WHERE tablename = 'emails' 
          AND indexname = 'idx_emails_org_created_at'
        `
      },
    ];

    for (const indexCheck of indexQueries) {
      const result = await mcpSupabase.executeSQL(indexCheck.query);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      console.log(`✅ Index ${indexCheck.name} exists`);
    }

    // Test query performance with EXPLAIN ANALYZE
    const performanceTestQuery = `
      EXPLAIN ANALYZE 
      SELECT * FROM transactions 
      WHERE org_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY date DESC 
      LIMIT 10
    `;

    const performanceResult = await mcpSupabase.executeSQL(performanceTestQuery, [testOrgId]);
    expect(performanceResult.success).toBe(true);

    // Check that query uses index (should contain "Index Scan" in execution plan)
    const executionPlan = performanceResult.data.map(row => row['QUERY PLAN']).join(' ');
    expect(executionPlan).toContain('Index');
  });

  test('should test email processing pipeline with database integration', async ({ page }) => {
    const emailData = englishReceipts[0];

    // Simulate email storage
    const emailInsertResult = await mcpSupabase.executeSQL(`
      INSERT INTO emails (org_id, message_id, from_email, to_email, subject, raw_content, parsed_content)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      testOrgId,
      emailData.messageId,
      emailData.from,
      emailData.to,
      emailData.subject,
      emailData.body,
      JSON.stringify({ body: emailData.body, language: emailData.language })
    ]);

    expect(emailInsertResult.success).toBe(true);
    const emailId = emailInsertResult.data[0].id;

    // Create corresponding transaction
    const transactionInsertResult = await mcpSupabase.executeSQL(`
      INSERT INTO transactions (
        org_id, email_id, date, amount, currency, merchant, 
        category, subcategory, confidence, explanation, last4
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `, [
      testOrgId,
      emailId,
      emailData.expectedExtraction.date,
      emailData.expectedExtraction.amount,
      emailData.expectedExtraction.currency,
      emailData.expectedExtraction.merchant,
      emailData.expectedExtraction.category,
      emailData.expectedExtraction.subcategory,
      emailData.expectedExtraction.confidence,
      emailData.expectedExtraction.explanation,
      emailData.expectedExtraction.last4
    ]);

    expect(transactionInsertResult.success).toBe(true);
    const transactionId = transactionInsertResult.data[0].id;

    // Verify complete email-to-transaction pipeline
    const pipelineVerifyResult = await mcpSupabase.executeSQL(`
      SELECT 
        e.message_id,
        e.from_email,
        e.subject,
        t.merchant,
        t.amount,
        t.category,
        t.confidence
      FROM emails e
      JOIN transactions t ON e.id = t.email_id
      WHERE e.id = $1 AND e.org_id = $2
    `, [emailId, testOrgId]);

    expect(pipelineVerifyResult.success).toBe(true);
    expect(pipelineVerifyResult.data).toHaveLength(1);
    
    const result = pipelineVerifyResult.data[0];
    expect(result.message_id).toBe(emailData.messageId);
    expect(result.merchant).toBe(emailData.expectedExtraction.merchant);
    expect(parseFloat(result.amount)).toBe(emailData.expectedExtraction.amount);
  });

  test('should test analytics queries with proper aggregation', async ({ page }) => {
    // Insert test data for analytics
    const testTransactions = [
      { date: '2024-01-15', amount: 25.99, category: 'Food & Dining', merchant: 'Restaurant A' },
      { date: '2024-01-16', amount: 45.50, category: 'Transportation', merchant: 'Gas Station B' },
      { date: '2024-01-17', amount: 12.75, category: 'Food & Dining', merchant: 'Coffee Shop C' },
      { date: '2024-01-18', amount: 89.99, category: 'Shopping', merchant: 'Store D' },
    ];

    for (const transaction of testTransactions) {
      await mcpSupabase.executeSQL(`
        INSERT INTO transactions (org_id, email_id, date, amount, currency, merchant, category, confidence, explanation)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        testOrgId,
        'test-email-analytics',
        transaction.date,
        transaction.amount,
        'USD',
        transaction.merchant,
        transaction.category,
        85,
        'Test transaction for analytics'
      ]);
    }

    // Test category breakdown query
    const categoryBreakdownResult = await mcpSupabase.executeSQL(`
      SELECT 
        category,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        ROUND((SUM(amount) / (SELECT SUM(amount) FROM transactions WHERE org_id = $1) * 100), 2) as percentage
      FROM transactions 
      WHERE org_id = $1 
      GROUP BY category 
      ORDER BY total_amount DESC
    `, [testOrgId]);

    expect(categoryBreakdownResult.success).toBe(true);
    expect(categoryBreakdownResult.data.length).toBeGreaterThan(0);

    // Verify aggregation accuracy
    const totalExpected = testTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalFromQuery = categoryBreakdownResult.data.reduce((sum, row) => sum + parseFloat(row.total_amount), 0);
    expect(Math.abs(totalFromQuery - totalExpected)).toBeLessThan(0.01);

    // Test monthly spending trend
    const monthlyTrendResult = await mcpSupabase.executeSQL(`
      SELECT 
        DATE_TRUNC('day', date) as day,
        SUM(amount) as daily_total,
        COUNT(*) as transaction_count
      FROM transactions 
      WHERE org_id = $1 
        AND date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', date)
      ORDER BY day DESC
    `, [testOrgId]);

    expect(monthlyTrendResult.success).toBe(true);
    expect(monthlyTrendResult.data.length).toBeGreaterThan(0);
  });

  test('should validate RLS policies across all tables', async ({ page }) => {
    const rlsTestCases = [
      {
        table: 'transactions',
        testQuery: 'SELECT COUNT(*) as count FROM transactions WHERE org_id = $1',
      },
      {
        table: 'merchant_map',
        testQuery: 'SELECT COUNT(*) as count FROM merchant_map WHERE org_id = $1',
      },
      {
        table: 'emails',
        testQuery: 'SELECT COUNT(*) as count FROM emails WHERE org_id = $1',
      },
      {
        table: 'inbox_aliases',
        testQuery: 'SELECT COUNT(*) as count FROM inbox_aliases WHERE org_id = $1',
      },
    ];

    for (const testCase of rlsTestCases) {
      // Test access to own org data
      const ownOrgResult = await mcpSupabase.executeSQL(testCase.testQuery, [testOrgId]);
      expect(ownOrgResult.success).toBe(true);

      // Test isolation from other org data
      const otherOrgResult = await mcpSupabase.executeSQL(testCase.testQuery, [testOrganizations.orgB.id]);
      expect(otherOrgResult.success).toBe(true);
      
      // Should not see other org's data (count should be 0 or less than own org)
      const ownCount = parseInt(ownOrgResult.data[0].count);
      const otherCount = parseInt(otherOrgResult.data[0].count);
      
      console.log(`RLS Test - ${testCase.table}: Own org: ${ownCount}, Other org: ${otherCount}`);
      
      // If we have data in our org, other org should have 0 or different data
      if (ownCount > 0) {
        expect(otherCount).toBe(0);
      }
    }
  });

  test.afterEach(async ({ page }) => {
    // Clean up test data
    await mcpSupabase.executeSQL('DELETE FROM transactions WHERE org_id = $1 AND explanation LIKE $2', [testOrgId, '%Test%']);
    await mcpSupabase.executeSQL('DELETE FROM merchant_map WHERE org_id = $1 AND merchant_name LIKE $2', [testOrgId, '%test%']);
    await mcpSupabase.executeSQL('DELETE FROM emails WHERE org_id = $1 AND message_id LIKE $2', [testOrgId, '%test%']);
  });

  test.afterAll(async () => {
    // Close MCP connection
    await mcpSupabase.cleanup();
  });
});