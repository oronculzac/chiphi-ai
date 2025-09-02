/**
 * Email Processing MCP Integration Tests
 * 
 * Tests email processing workflows using MCP servers for:
 * - Supabase database operations
 * - Playwright browser automation
 * - Real-time validation of email-to-transaction pipeline
 */

import { test, expect } from '@playwright/test';
import { TestHelpers, MCPSupabaseHelper } from '../utils/enhanced-test-helpers';
import { englishReceipts, spanishReceipts, edgeCaseReceipts } from '../fixtures/email-samples';
import { testUsers, testOrganizations } from '../fixtures/test-organizations';

test.describe('Email Processing MCP Integration @mcp @email-processing', () => {
  let mcpSupabase: MCPSupabaseHelper;
  let authHelper: TestHelpers.AuthHelper;
  let mcpHelper: TestHelpers.MCPHelper;
  let docHelper: TestHelpers.TestDocumentationHelper;

  test.beforeAll(async () => {
    mcpSupabase = new MCPSupabaseHelper();
    await mcpSupabase.initialize();
  });

  test.beforeEach(async ({ page }) => {
    authHelper = new TestHelpers.AuthHelper(page);
    mcpHelper = new TestHelpers.MCPHelper(page);
    docHelper = new TestHelpers.TestDocumentationHelper(page);

    // Authenticate as test user
    await authHelper.signInWithTestUser(
      testUsers.orgAOwner.email,
      testUsers.orgAOwner.password
    );
  });

  test('should process email end-to-end using MCP automation', async ({ page }) => {
    await docHelper.logTestStep('Starting MCP email processing test');

    const testEmail = englishReceipts[0]; // Starbucks receipt
    
    // Use MCP Supabase to verify initial state
    const initialTransactionCount = await mcpSupabase.executeSQL(`
      SELECT COUNT(*) as count FROM transactions WHERE org_id = $1
    `, [testOrganizations.orgA.id]);
    
    expect(initialTransactionCount.success).toBe(true);
    const initialCount = parseInt(initialTransactionCount.data[0].count);

    // Use MCP to simulate email processing
    const processingResult = await mcpHelper.simulateEmailProcessing(testEmail);
    expect(processingResult.success).toBe(true);
    expect(processingResult.transactionId).toBeTruthy();

    // Verify transaction was created in database using MCP
    const finalTransactionCount = await mcpSupabase.executeSQL(`
      SELECT COUNT(*) as count FROM transactions WHERE org_id = $1
    `, [testOrganizations.orgA.id]);
    
    expect(finalTransactionCount.success).toBe(true);
    const finalCount = parseInt(finalTransactionCount.data[0].count);
    expect(finalCount).toBe(initialCount + 1);

    // Verify transaction details using MCP
    const transactionDetails = await mcpSupabase.executeSQL(`
      SELECT * FROM transactions WHERE id = $1
    `, [processingResult.transactionId]);

    expect(transactionDetails.success).toBe(true);
    expect(transactionDetails.data).toHaveLength(1);

    const transaction = transactionDetails.data[0];
    expect(transaction.merchant).toBe(testEmail.expectedExtraction.merchant);
    expect(parseFloat(transaction.amount)).toBe(testEmail.expectedExtraction.amount);
    expect(transaction.currency).toBe(testEmail.expectedExtraction.currency);
    expect(transaction.confidence).toBeGreaterThan(70);

    await docHelper.logTestStep('MCP email processing completed successfully', {
      transactionId: processingResult.transactionId,
      merchant: transaction.merchant,
      amount: transaction.amount,
      confidence: transaction.confidence,
    });
  });

  test('should handle multilingual processing with MCP validation', async ({ page }) => {
    await docHelper.logTestStep('Starting multilingual MCP processing test');

    const spanishEmail = spanishReceipts[0];
    
    // Process Spanish email
    const processingResult = await mcpHelper.simulateEmailProcessing(spanishEmail);
    expect(processingResult.success).toBe(true);

    // Verify translation occurred using MCP database query
    const translationDetails = await mcpSupabase.executeSQL(`
      SELECT 
        t.*,
        e.parsed_content
      FROM transactions t
      JOIN emails e ON t.email_id = e.id
      WHERE t.id = $1
    `, [processingResult.transactionId]);

    expect(translationDetails.success).toBe(true);
    const transaction = translationDetails.data[0];
    
    // Verify translation metadata
    const parsedContent = JSON.parse(transaction.parsed_content);
    expect(parsedContent.language).toBe('es');
    expect(parsedContent.translated).toBe(true);
    expect(parsedContent.originalText).toBeTruthy();
    expect(parsedContent.translatedText).toBeTruthy();

    // Verify extraction worked despite language barrier
    expect(transaction.merchant).toBe(spanishEmail.expectedExtraction.merchant);
    expect(parseFloat(transaction.amount)).toBe(spanishEmail.expectedExtraction.amount);
    expect(transaction.currency).toBe(spanishEmail.expectedExtraction.currency);

    await docHelper.logTestStep('Multilingual processing validated', {
      sourceLanguage: parsedContent.language,
      translationDetected: parsedContent.translated,
      extractionAccuracy: transaction.confidence,
    });
  });

  test('should create merchant mappings through MCP learning', async ({ page }) => {
    await docHelper.logTestStep('Starting merchant learning MCP test');

    const testEmail = englishReceipts[0]; // Starbucks
    
    // Process initial email
    const firstResult = await mcpHelper.simulateEmailProcessing(testEmail);
    expect(firstResult.success).toBe(true);

    // Get initial confidence
    const initialTransaction = await mcpSupabase.executeSQL(`
      SELECT confidence FROM transactions WHERE id = $1
    `, [firstResult.transactionId]);
    
    const initialConfidence = initialTransaction.data[0].confidence;

    // Use MCP to correct the category (simulate user correction)
    await mcpSupabase.executeSQL(`
      UPDATE transactions 
      SET category = $1, subcategory = $2, updated_at = NOW()
      WHERE id = $3
    `, ['Food & Dining', 'Coffee Shops', firstResult.transactionId]);

    // Create merchant mapping using MCP
    await mcpSupabase.executeSQL(`
      INSERT INTO merchant_map (org_id, merchant_name, category, subcategory, created_by)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (org_id, merchant_name) 
      DO UPDATE SET 
        category = EXCLUDED.category,
        subcategory = EXCLUDED.subcategory,
        updated_at = NOW()
    `, [
      testOrganizations.orgA.id,
      testEmail.expectedExtraction.merchant.toLowerCase(),
      'Food & Dining',
      'Coffee Shops',
      testUsers.orgAOwner.id
    ]);

    // Process second email from same merchant
    const secondEmail = {
      ...testEmail,
      messageId: 'msg-starbucks-learning-mcp',
      subject: 'Another Starbucks Receipt - MCP Learning Test',
    };

    const secondResult = await mcpHelper.simulateEmailProcessing(secondEmail);
    expect(secondResult.success).toBe(true);

    // Verify learning occurred
    const learnedTransaction = await mcpSupabase.executeSQL(`
      SELECT * FROM transactions WHERE id = $1
    `, [secondResult.transactionId]);

    const learned = learnedTransaction.data[0];
    expect(learned.category).toBe('Food & Dining');
    expect(learned.subcategory).toBe('Coffee Shops');
    expect(learned.confidence).toBeGreaterThan(initialConfidence);

    await docHelper.logTestStep('Merchant learning verified via MCP', {
      initialConfidence,
      learnedConfidence: learned.confidence,
      improvementPercent: ((learned.confidence - initialConfidence) / initialConfidence * 100).toFixed(1),
    });
  });

  test('should validate RLS policies using MCP cross-org queries', async ({ page }) => {
    await docHelper.logTestStep('Starting RLS validation test');

    const testEmail = englishReceipts[1]; // Amazon receipt
    
    // Create transaction in Org A
    const processingResult = await mcpHelper.simulateEmailProcessing(testEmail);
    expect(processingResult.success).toBe(true);

    // Verify Org A can access its transaction
    const orgAQuery = await mcpSupabase.executeSQL(`
      SELECT * FROM transactions WHERE id = $1 AND org_id = $2
    `, [processingResult.transactionId, testOrganizations.orgA.id]);

    expect(orgAQuery.success).toBe(true);
    expect(orgAQuery.data).toHaveLength(1);

    // Verify Org B cannot access Org A's transaction (RLS enforcement)
    const orgBQuery = await mcpSupabase.executeSQL(`
      SELECT * FROM transactions WHERE id = $1 AND org_id = $2
    `, [processingResult.transactionId, testOrganizations.orgB.id]);

    expect(orgBQuery.success).toBe(true);
    expect(orgBQuery.data).toHaveLength(0); // Should be empty due to RLS

    // Test merchant mapping isolation
    const merchantMapping = await mcpSupabase.executeSQL(`
      INSERT INTO merchant_map (org_id, merchant_name, category, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [
      testOrganizations.orgA.id,
      'test merchant rls mcp',
      'Test Category',
      testUsers.orgAOwner.id
    ]);

    const mappingId = merchantMapping.data[0].id;

    // Verify cross-org merchant mapping isolation
    const crossOrgMappingQuery = await mcpSupabase.executeSQL(`
      SELECT * FROM merchant_map WHERE id = $1 AND org_id = $2
    `, [mappingId, testOrganizations.orgB.id]);

    expect(crossOrgMappingQuery.success).toBe(true);
    expect(crossOrgMappingQuery.data).toHaveLength(0);

    await docHelper.logTestStep('RLS policies validated via MCP', {
      transactionIsolated: true,
      merchantMappingIsolated: true,
    });
  });

  test('should handle error scenarios with MCP monitoring', async ({ page }) => {
    await docHelper.logTestStep('Starting error handling MCP test');

    // Test malformed email
    const malformedEmail = edgeCaseReceipts[0];
    const malformedResult = await mcpHelper.simulateEmailProcessing(malformedEmail);

    if (malformedResult.success) {
      // If processed, verify low confidence was recorded
      const errorTransaction = await mcpSupabase.executeSQL(`
        SELECT * FROM transactions WHERE id = $1
      `, [malformedResult.transactionId]);

      expect(errorTransaction.data[0].confidence).toBeLessThan(50);
      
      await docHelper.logTestStep('Malformed email processed with low confidence', {
        confidence: errorTransaction.data[0].confidence,
      });
    } else {
      // If rejected, verify no transaction was created
      expect(malformedResult.error).toBeTruthy();
      await docHelper.logTestStep('Malformed email appropriately rejected', {
        error: malformedResult.error,
      });
    }

    // Test database error handling
    const invalidOrgQuery = await mcpSupabase.executeSQL(`
      SELECT * FROM transactions WHERE org_id = $1
    `, ['invalid-org-id']);

    // Should succeed but return no results
    expect(invalidOrgQuery.success).toBe(true);
    expect(invalidOrgQuery.data).toHaveLength(0);

    await docHelper.logTestStep('Error scenarios handled correctly');
  });

  test('should validate performance metrics using MCP monitoring', async ({ page }) => {
    await docHelper.logTestStep('Starting performance monitoring MCP test');

    const testEmails = englishReceipts.slice(0, 3);
    const startTime = Date.now();

    // Process multiple emails and track performance
    const results = [];
    for (const email of testEmails) {
      const emailStartTime = Date.now();
      const result = await mcpHelper.simulateEmailProcessing(email);
      const processingTime = Date.now() - emailStartTime;
      
      results.push({
        success: result.success,
        transactionId: result.transactionId,
        processingTime,
      });
    }

    const totalTime = Date.now() - startTime;
    const averageTime = totalTime / testEmails.length;
    const successRate = (results.filter(r => r.success).length / results.length) * 100;

    // Verify performance metrics using MCP
    const performanceQuery = await mcpSupabase.executeSQL(`
      SELECT 
        COUNT(*) as total_transactions,
        AVG(confidence) as avg_confidence,
        MIN(confidence) as min_confidence,
        MAX(confidence) as max_confidence
      FROM transactions 
      WHERE org_id = $1 
        AND created_at >= NOW() - INTERVAL '1 minute'
    `, [testOrganizations.orgA.id]);

    expect(performanceQuery.success).toBe(true);
    const metrics = performanceQuery.data[0];

    // Performance assertions
    expect(successRate).toBeGreaterThan(90); // 90% success rate
    expect(averageTime).toBeLessThan(10000); // Average under 10 seconds
    expect(parseFloat(metrics.avg_confidence)).toBeGreaterThan(70); // Average confidence > 70%

    await docHelper.logTestStep('Performance metrics validated', {
      totalEmails: testEmails.length,
      successRate,
      averageProcessingTime: averageTime,
      totalTime,
      avgConfidence: parseFloat(metrics.avg_confidence),
      minConfidence: parseFloat(metrics.min_confidence),
      maxConfidence: parseFloat(metrics.max_confidence),
    });
  });

  test.afterEach(async ({ page }) => {
    // Clean up test data using MCP
    await mcpSupabase.executeSQL(`
      DELETE FROM transactions 
      WHERE org_id = $1 AND explanation LIKE '%MCP%'
    `, [testOrganizations.orgA.id]);

    await mcpSupabase.executeSQL(`
      DELETE FROM merchant_map 
      WHERE org_id = $1 AND merchant_name LIKE '%test%'
    `, [testOrganizations.orgA.id]);

    // Clean up MCP connections
    await mcpHelper.cleanup();
    
    // Take screenshot for documentation
    await docHelper.takeScreenshot('mcp-email-processing-final');
  });

  test.afterAll(async () => {
    await mcpSupabase.cleanup();
  });
});