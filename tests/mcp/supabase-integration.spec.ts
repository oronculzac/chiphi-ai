import { test, expect } from '@playwright/test';
import { MCPHelper, AuthHelper } from '../utils/test-helpers';
import { testUsers, testOrganizations } from '../fixtures/test-organizations';

/**
 * Supabase MCP Integration Tests
 * 
 * Tests the integration between Playwright tests and Supabase MCP server
 * for database operations, migrations, and project management.
 */

test.describe('Supabase MCP Integration', () => {
  let mcpHelper: MCPHelper;
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    mcpHelper = new MCPHelper(page);
    authHelper = new AuthHelper(page);
    
    // Authenticate as test user
    await authHelper.signInWithTestUser(
      testUsers.orgAOwner.email,
      testUsers.orgAOwner.password
    );
  });

  test('should execute SQL queries via MCP', async ({ page }) => {
    // Test basic SQL execution
    const result = await mcpHelper.executeSQL(
      'SELECT COUNT(*) as transaction_count FROM transactions WHERE org_id = $1',
      testOrganizations.orgA.id
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  test('should apply database migrations via MCP', async ({ page }) => {
    const testMigration = `
      -- Test migration for MCP integration
      CREATE TABLE IF NOT EXISTS test_mcp_table (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_data TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    const result = await mcpHelper.applyMigration(
      'test_mcp_integration',
      testMigration
    );

    expect(result.success).toBe(true);

    // Verify table was created
    const verifyResult = await mcpHelper.executeSQL(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'test_mcp_table'",
      testOrganizations.orgA.id
    );

    expect(verifyResult.success).toBe(true);
    expect(verifyResult.data.length).toBeGreaterThan(0);

    // Cleanup
    await mcpHelper.executeSQL(
      'DROP TABLE IF EXISTS test_mcp_table',
      testOrganizations.orgA.id
    );
  });

  test('should handle RLS policies correctly', async ({ page }) => {
    // Test that RLS prevents cross-tenant access
    const orgATransactions = await mcpHelper.executeSQL(
      'SELECT COUNT(*) as count FROM transactions WHERE org_id = $1',
      testOrganizations.orgA.id
    );

    const orgBTransactions = await mcpHelper.executeSQL(
      'SELECT COUNT(*) as count FROM transactions WHERE org_id = $1',
      testOrganizations.orgB.id
    );

    expect(orgATransactions.success).toBe(true);
    expect(orgBTransactions.success).toBe(true);

    // Should not be able to access other org's data without proper context
    const crossTenantQuery = await mcpHelper.executeSQL(
      `SELECT COUNT(*) as count FROM transactions 
       WHERE org_id = '${testOrganizations.orgB.id}'`,
      testOrganizations.orgA.id
    );

    // This should either fail or return 0 results due to RLS
    expect(crossTenantQuery.success).toBe(true);
    if (crossTenantQuery.data && crossTenantQuery.data.length > 0) {
      expect(crossTenantQuery.data[0].count).toBe(0);
    }
  });

  test('should create and manage transactions via MCP', async ({ page }) => {
    // Create a test transaction
    const createResult = await mcpHelper.executeSQL(
      `INSERT INTO transactions (
        org_id, email_id, date, amount, currency, merchant, 
        category, confidence, explanation
      ) VALUES (
        '${testOrganizations.orgA.id}',
        gen_random_uuid(),
        '2024-01-15',
        25.99,
        'USD',
        'Test Merchant MCP',
        'Shopping',
        85,
        'Test transaction created via MCP'
      ) RETURNING id`,
      testOrganizations.orgA.id
    );

    expect(createResult.success).toBe(true);
    expect(createResult.data.length).toBe(1);

    const transactionId = createResult.data[0].id;

    // Verify transaction was created
    const verifyResult = await mcpHelper.executeSQL(
      'SELECT * FROM transactions WHERE id = $1',
      transactionId
    );

    expect(verifyResult.success).toBe(true);
    expect(verifyResult.data.length).toBe(1);
    expect(verifyResult.data[0].merchant).toBe('Test Merchant MCP');
    expect(verifyResult.data[0].amount).toBe(25.99);

    // Update transaction
    const updateResult = await mcpHelper.executeSQL(
      `UPDATE transactions 
       SET category = 'Food & Dining', confidence = 90 
       WHERE id = $1 AND org_id = $2`,
      transactionId
    );

    expect(updateResult.success).toBe(true);

    // Verify update
    const verifyUpdateResult = await mcpHelper.executeSQL(
      'SELECT category, confidence FROM transactions WHERE id = $1',
      transactionId
    );

    expect(verifyUpdateResult.data[0].category).toBe('Food & Dining');
    expect(verifyUpdateResult.data[0].confidence).toBe(90);

    // Cleanup
    await mcpHelper.executeSQL(
      'DELETE FROM transactions WHERE id = $1',
      transactionId
    );
  });

  test('should handle database functions via MCP', async ({ page }) => {
    // Test calling a database function
    const statsResult = await mcpHelper.executeSQL(
      `SELECT * FROM get_transaction_stats('${testOrganizations.orgA.id}')`,
      testOrganizations.orgA.id
    );

    expect(statsResult.success).toBe(true);
    expect(statsResult.data).toBeDefined();
    
    if (statsResult.data.length > 0) {
      const stats = statsResult.data[0];
      expect(typeof stats.total_transactions).toBe('number');
      expect(typeof stats.total_amount).toBe('number');
      expect(typeof stats.average_confidence).toBe('number');
    }
  });

  test('should handle MCP errors gracefully', async ({ page }) => {
    // Test invalid SQL
    const invalidResult = await mcpHelper.executeSQL(
      'SELECT * FROM non_existent_table',
      testOrganizations.orgA.id
    );

    expect(invalidResult.success).toBe(false);
    expect(invalidResult.error).toBeDefined();
    expect(invalidResult.error).toContain('does not exist');

    // Test invalid migration
    const invalidMigration = await mcpHelper.applyMigration(
      'invalid_migration',
      'INVALID SQL SYNTAX HERE'
    );

    expect(invalidMigration.success).toBe(false);
    expect(invalidMigration.error).toBeDefined();
  });

  test('should manage project settings via MCP', async ({ page }) => {
    // Get project information
    const projectResult = await mcpHelper.callSupabaseMCP('get_project', {
      project_id: process.env.SUPABASE_PROJECT_ID,
    });

    expect(projectResult.success).toBe(true);
    expect(projectResult.data).toBeDefined();
    expect(projectResult.data.id).toBe(process.env.SUPABASE_PROJECT_ID);
  });

  test('should list and manage edge functions via MCP', async ({ page }) => {
    // List edge functions
    const functionsResult = await mcpHelper.callSupabaseMCP('list_edge_functions', {
      project_id: process.env.SUPABASE_PROJECT_ID,
    });

    expect(functionsResult.success).toBe(true);
    expect(Array.isArray(functionsResult.data)).toBe(true);
  });

  test('should handle concurrent MCP operations', async ({ page }) => {
    // Execute multiple MCP operations concurrently
    const operations = [
      mcpHelper.executeSQL(
        'SELECT COUNT(*) FROM transactions',
        testOrganizations.orgA.id
      ),
      mcpHelper.executeSQL(
        'SELECT COUNT(*) FROM merchant_map',
        testOrganizations.orgA.id
      ),
      mcpHelper.executeSQL(
        'SELECT COUNT(*) FROM inbox_aliases',
        testOrganizations.orgA.id
      ),
    ];

    const results = await Promise.all(operations);

    // All operations should succeed
    results.forEach(result => {
      expect(result.success).toBe(true);
    });
  });

  test('should validate data integrity via MCP', async ({ page }) => {
    // Test data validation function
    const validationResult = await mcpHelper.executeSQL(
      `SELECT * FROM validate_transaction_integrity('${testOrganizations.orgA.id}')`,
      testOrganizations.orgA.id
    );

    expect(validationResult.success).toBe(true);
    expect(Array.isArray(validationResult.data)).toBe(true);

    // Should return integrity issues if any exist
    validationResult.data.forEach((issue: any) => {
      expect(issue.issue_type).toBeDefined();
      expect(typeof issue.issue_count).toBe('number');
      expect(Array.isArray(issue.sample_ids)).toBe(true);
    });
  });
});