/**
 * Playwright MCP Integration Tests
 * 
 * Tests browser automation capabilities using Playwright MCP server
 * for email processing workflow validation and UI interaction testing
 */

import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/enhanced-test-helpers';
import { englishReceipts, spanishReceipts } from '../fixtures/email-samples';
import { testUsers, testOrganizations } from '../fixtures/test-organizations';

test.describe('Playwright MCP Integration', () => {
  let authHelper: TestHelpers.AuthHelper;
  let mcpHelper: TestHelpers.MCPHelper;
  let docHelper: TestHelpers.TestDocumentationHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new TestHelpers.AuthHelper(page);
    mcpHelper = new TestHelpers.MCPHelper(page);
    docHelper = new TestHelpers.TestDocumentationHelper(page);
  });

  test('should automate email processing workflow using Playwright MCP', async ({ page }) => {
    await docHelper.logTestStep('Starting Playwright MCP automation test');

    // Authenticate using MCP browser automation
    await authHelper.signInWithTestUser(
      testUsers.orgAOwner.email,
      testUsers.orgAOwner.password
    );

    // Use MCP to navigate to email processing interface
    await page.goto('/admin/email-processor');
    await page.waitForSelector('[data-testid="email-processor-interface"]');

    // Test email processing using MCP automation
    const testEmail = englishReceipts[0];
    
    // Fill email form using MCP
    await page.fill('[data-testid="email-from"]', testEmail.from);
    await page.fill('[data-testid="email-to"]', testEmail.to);
    await page.fill('[data-testid="email-subject"]', testEmail.subject);
    await page.fill('[data-testid="email-body"]', testEmail.body);

    // Submit for processing
    await page.click('[data-testid="process-email-btn"]');

    // Wait for processing to complete
    await page.waitForSelector('[data-testid="processing-complete"]', { timeout: 30000 });

    // Verify transaction was created
    const transactionId = await page.getAttribute('[data-testid="created-transaction"]', 'data-transaction-id');
    expect(transactionId).toBeTruthy();

    // Navigate to transaction details
    await page.goto(`/transactions/${transactionId}`);
    await page.waitForSelector('[data-testid="transaction-details"]');

    // Verify extraction results
    const merchantText = await page.textContent('[data-testid="transaction-merchant"]');
    const amountText = await page.textContent('[data-testid="transaction-amount"]');
    const categoryText = await page.textContent('[data-testid="transaction-category"]');

    expect(merchantText).toContain(testEmail.expectedExtraction.merchant);
    expect(amountText).toContain(testEmail.expectedExtraction.amount.toString());
    expect(categoryText).toContain(testEmail.expectedExtraction.category);

    await docHelper.logTestStep('Playwright MCP automation completed successfully', {
      transactionId,
      merchant: merchantText,
      amount: amountText,
      category: categoryText,
    });
  });

  test('should test multilingual processing with MCP browser automation', async ({ page }) => {
    await docHelper.logTestStep('Starting multilingual MCP automation test');

    await authHelper.signInWithTestUser(
      testUsers.orgAOwner.email,
      testUsers.orgAOwner.password
    );

    // Test Spanish receipt processing
    const spanishEmail = spanishReceipts[0];
    
    await page.goto('/admin/email-processor');
    await page.waitForSelector('[data-testid="email-processor-interface"]');

    // Fill form with Spanish receipt
    await page.fill('[data-testid="email-from"]', spanishEmail.from);
    await page.fill('[data-testid="email-to"]', spanishEmail.to);
    await page.fill('[data-testid="email-subject"]', spanishEmail.subject);
    await page.fill('[data-testid="email-body"]', spanishEmail.body);

    // Enable translation monitoring
    await page.check('[data-testid="monitor-translation"]');

    // Submit for processing
    await page.click('[data-testid="process-email-btn"]');

    // Wait for translation step
    await page.waitForSelector('[data-testid="translation-in-progress"]', { timeout: 10000 });
    await docHelper.logTestStep('Translation step detected');

    // Wait for processing completion
    await page.waitForSelector('[data-testid="processing-complete"]', { timeout: 45000 });

    // Verify translation occurred
    const translationStatus = await page.textContent('[data-testid="translation-status"]');
    expect(translationStatus).toContain('Spanish → English');

    // Get transaction details
    const transactionId = await page.getAttribute('[data-testid="created-transaction"]', 'data-transaction-id');
    await page.goto(`/transactions/${transactionId}`);
    await page.waitForSelector('[data-testid="transaction-details"]');

    // Test original/translated text toggle
    await page.click('[data-testid="toggle-original-text"]');
    const originalText = await page.textContent('[data-testid="original-receipt-text"]');
    expect(originalText).toContain('Restaurante El Jardín');

    await page.click('[data-testid="toggle-translated-text"]');
    const translatedText = await page.textContent('[data-testid="translated-receipt-text"]');
    expect(translatedText).toContain('Garden Restaurant');

    await docHelper.logTestStep('Multilingual processing verified', {
      transactionId,
      originalLanguage: 'Spanish',
      translationDetected: true,
    });
  });

  test('should test merchant learning workflow with MCP automation', async ({ page }) => {
    await docHelper.logTestStep('Starting merchant learning MCP test');

    await authHelper.signInWithTestUser(
      testUsers.orgAOwner.email,
      testUsers.orgAOwner.password
    );

    // Process initial receipt
    const testEmail = englishReceipts[0]; // Starbucks
    await mcpHelper.simulateEmailProcessing(testEmail);
    
    const firstTransactionId = await page.waitForSelector('[data-testid="created-transaction"]')
      .then(el => el.getAttribute('data-transaction-id'));

    // Navigate to transaction and correct category
    await page.goto(`/transactions/${firstTransactionId}`);
    await page.waitForSelector('[data-testid="transaction-details"]');

    // Click edit category
    await page.click('[data-testid="edit-category-btn"]');
    await page.waitForSelector('[data-testid="category-editor"]');

    // Change category to test learning
    await page.selectOption('[data-testid="category-select"]', 'Food & Dining');
    await page.selectOption('[data-testid="subcategory-select"]', 'Coffee Shops');
    await page.click('[data-testid="save-category-btn"]');

    // Wait for save confirmation
    await page.waitForSelector('[data-testid="category-saved"]');
    await docHelper.logTestStep('Category correction applied');

    // Process second receipt from same merchant
    const secondEmail = {
      ...testEmail,
      messageId: 'msg-starbucks-learning-test',
      subject: 'Another Starbucks Receipt - Learning Test',
    };

    await mcpHelper.simulateEmailProcessing(secondEmail);
    const secondTransactionId = await page.waitForSelector('[data-testid="created-transaction"]')
      .then(el => el.getAttribute('data-transaction-id'));

    // Verify learning occurred
    await page.goto(`/transactions/${secondTransactionId}`);
    await page.waitForSelector('[data-testid="transaction-details"]');

    const learnedCategory = await page.textContent('[data-testid="transaction-category"]');
    const confidenceScore = await page.textContent('[data-testid="confidence-score"]');

    expect(learnedCategory).toContain('Food & Dining');
    expect(learnedCategory).toContain('Coffee Shops');
    
    // Confidence should be higher due to learning
    const confidence = parseInt(confidenceScore?.match(/\d+/)?.[0] || '0');
    expect(confidence).toBeGreaterThan(90);

    await docHelper.logTestStep('Merchant learning verified', {
      firstTransactionId,
      secondTransactionId,
      learnedCategory,
      confidence,
    });
  });

  test('should test real-time dashboard updates with MCP monitoring', async ({ page }) => {
    await docHelper.logTestStep('Starting real-time dashboard MCP test');

    await authHelper.signInWithTestUser(
      testUsers.orgAOwner.email,
      testUsers.orgAOwner.password
    );

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="dashboard"]');

    // Get initial dashboard state
    const initialTotal = await page.textContent('[data-testid="month-to-date-total"]');
    const initialTransactionCount = await page.locator('[data-testid="transaction-item"]').count();

    await docHelper.logTestStep('Initial dashboard state captured', {
      initialTotal,
      initialTransactionCount,
    });

    // Set up real-time monitoring
    await page.evaluate(() => {
      (window as any).__REALTIME_UPDATES__ = [];
      
      // Mock Supabase real-time subscription
      if ((window as any).supabase) {
        (window as any).supabase
          .channel('test-transactions')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, 
              (payload: any) => {
                (window as any).__REALTIME_UPDATES__.push(payload);
              })
          .subscribe();
      }
    });

    // Process new email in background
    const testEmail = englishReceipts[1]; // Amazon receipt
    await mcpHelper.simulateEmailProcessing(testEmail);

    // Wait for real-time update
    await page.waitForFunction(() => {
      return (window as any).__REALTIME_UPDATES__?.length > 0;
    }, { timeout: 10000 });

    // Verify dashboard updated
    await page.waitForFunction((expectedCount) => {
      const transactions = document.querySelectorAll('[data-testid="transaction-item"]');
      return transactions.length > expectedCount;
    }, initialTransactionCount, { timeout: 15000 });

    const finalTotal = await page.textContent('[data-testid="month-to-date-total"]');
    const finalTransactionCount = await page.locator('[data-testid="transaction-item"]').count();

    expect(finalTransactionCount).toBeGreaterThan(initialTransactionCount);
    expect(finalTotal).not.toBe(initialTotal);

    await docHelper.logTestStep('Real-time dashboard updates verified', {
      initialTotal,
      finalTotal,
      initialTransactionCount,
      finalTransactionCount,
    });
  });

  test('should test error handling with MCP automation', async ({ page }) => {
    await docHelper.logTestStep('Starting error handling MCP test');

    await authHelper.signInWithTestUser(
      testUsers.orgAOwner.email,
      testUsers.orgAOwner.password
    );

    // Test malformed email processing
    await page.goto('/admin/email-processor');
    await page.waitForSelector('[data-testid="email-processor-interface"]');

    // Submit malformed email
    await page.fill('[data-testid="email-from"]', 'invalid-email');
    await page.fill('[data-testid="email-to"]', 'receipts-test@chiphi.ai');
    await page.fill('[data-testid="email-subject"]', 'Malformed Receipt');
    await page.fill('[data-testid="email-body"]', 'This is not a valid receipt format');

    await page.click('[data-testid="process-email-btn"]');

    // Wait for error handling
    await page.waitForSelector('[data-testid="processing-error"]', { timeout: 20000 });

    const errorMessage = await page.textContent('[data-testid="error-message"]');
    expect(errorMessage).toBeTruthy();

    await docHelper.logTestStep('Error handling verified', {
      errorMessage,
    });

    // Test retry functionality
    await page.click('[data-testid="retry-processing-btn"]');
    
    // Should show error again for malformed data
    await page.waitForSelector('[data-testid="processing-error"]', { timeout: 20000 });

    await docHelper.logTestStep('Retry functionality tested');
  });

  test('should test performance monitoring with MCP automation', async ({ page }) => {
    await docHelper.logTestStep('Starting performance monitoring MCP test');

    await authHelper.signInWithTestUser(
      testUsers.orgAOwner.email,
      testUsers.orgAOwner.password
    );

    // Navigate to performance dashboard
    await page.goto('/admin/performance');
    await page.waitForSelector('[data-testid="performance-dashboard"]');

    // Get initial performance metrics
    const initialMetrics = await page.evaluate(() => {
      return {
        cacheHitRate: document.querySelector('[data-testid="cache-hit-rate"]')?.textContent,
        activeSubscriptions: document.querySelector('[data-testid="active-subscriptions"]')?.textContent,
        aiCosts: document.querySelector('[data-testid="ai-costs"]')?.textContent,
      };
    });

    await docHelper.logTestStep('Initial performance metrics captured', initialMetrics);

    // Process multiple emails to generate metrics
    const testEmails = englishReceipts.slice(0, 3);
    
    for (const email of testEmails) {
      await mcpHelper.simulateEmailProcessing(email);
      await page.waitForTimeout(1000); // Small delay between processing
    }

    // Refresh performance dashboard
    await page.click('[data-testid="refresh-metrics-btn"]');
    await page.waitForTimeout(2000);

    // Get updated metrics
    const updatedMetrics = await page.evaluate(() => {
      return {
        cacheHitRate: document.querySelector('[data-testid="cache-hit-rate"]')?.textContent,
        activeSubscriptions: document.querySelector('[data-testid="active-subscriptions"]')?.textContent,
        aiCosts: document.querySelector('[data-testid="ai-costs"]')?.textContent,
      };
    });

    // Verify metrics changed
    expect(updatedMetrics.aiCosts).not.toBe(initialMetrics.aiCosts);

    await docHelper.logTestStep('Performance monitoring verified', {
      initialMetrics,
      updatedMetrics,
    });
  });

  test.afterEach(async ({ page }) => {
    // Clean up MCP monitoring
    await mcpHelper.cleanup();
    
    // Take final screenshot
    await docHelper.takeScreenshot('mcp-test-final-state');
    
    // Log test completion
    const testSteps = docHelper.getTestSteps();
    await docHelper.logTestStep('MCP test completed', {
      totalSteps: testSteps.length,
    });
  });
});