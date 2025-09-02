import { test, expect } from '@playwright/test';
import { 
  AuthHelper, 
  EmailProcessingHelper, 
  DashboardHelper, 
  AssertionHelper,
  TestDocumentationHelper,
  PerformanceHelper 
} from '../utils/test-helpers';
import { englishReceipts, spanishReceipts, edgeCaseReceipts } from '../fixtures/email-samples';
import { testUsers } from '../fixtures/test-organizations';

/**
 * End-to-End Email Processing Workflow Tests
 * 
 * Comprehensive tests for the complete email receipt processing workflow:
 * - Email reception and parsing
 * - Language detection and translation
 * - AI extraction and categorization
 * - Transaction creation and storage
 * - Dashboard real-time updates
 * - Multi-tenant isolation
 */

test.describe('Email Processing Workflow', () => {
  let authHelper: AuthHelper;
  let emailHelper: EmailProcessingHelper;
  let dashboardHelper: DashboardHelper;
  let docHelper: TestDocumentationHelper;
  let perfHelper: PerformanceHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    emailHelper = new EmailProcessingHelper(page);
    dashboardHelper = new DashboardHelper(page);
    docHelper = new TestDocumentationHelper(page);
    perfHelper = new PerformanceHelper(page);

    // Authenticate as test user
    await authHelper.signInWithTestUser(
      testUsers.orgAOwner.email,
      testUsers.orgAOwner.password
    );

    await dashboardHelper.waitForDashboardLoad();
    await docHelper.logTestStep('Test setup completed');
  });

  test('should process English receipt email end-to-end', async ({ page }) => {
    const emailData = englishReceipts[0]; // Starbucks receipt
    
    await docHelper.logTestStep('Starting English receipt processing test', {
      merchant: emailData.expectedExtraction.merchant,
      amount: emailData.expectedExtraction.amount,
    });

    // Take initial screenshot
    await docHelper.takeScreenshot('initial-dashboard');

    // Get initial dashboard state
    const initialTotal = await dashboardHelper.getMonthToDateTotal();
    const initialCategories = await dashboardHelper.getCategoryBreakdown();

    await docHelper.logTestStep('Captured initial dashboard state', {
      initialTotal,
      categoryCount: initialCategories.length,
    });

    // Measure processing performance
    const processingTime = await perfHelper.measureEmailProcessingTime(emailData);

    await docHelper.logTestStep('Email processing completed', {
      processingTimeMs: processingTime,
    });

    // Wait for transaction to be created
    const transactionId = await emailHelper.waitForTransactionCreated();
    expect(transactionId).toBeTruthy();

    // Take screenshot after processing
    await docHelper.takeScreenshot('after-processing');

    // Validate extraction results
    const assertions = await AssertionHelper.validateExtraction(
      page,
      emailData.expectedExtraction,
      { amount: 0.01, confidence: 10 }
    );

    // Log assertion results
    assertions.forEach(assertion => {
      if (assertion.type === 'equals') {
        expect(assertion.actual).toBe(assertion.expected);
      } else if (assertion.type === 'greaterThan') {
        expect(assertion.actual).toBeGreaterThan(assertion.expected);
      }
    });

    // Validate dashboard updates
    const dashboardAssertions = await AssertionHelper.validateDashboardUpdate(
      page,
      { total: initialTotal, categoryCount: initialCategories.length },
      { 
        totalIncrease: emailData.expectedExtraction.amount,
        newCategory: emailData.expectedExtraction.category,
      }
    );

    dashboardAssertions.forEach(assertion => {
      expect(assertion.actual).toBe(assertion.expected);
    });

    // Verify performance requirements
    expect(processingTime).toBeLessThan(30000); // Should process within 30 seconds

    await docHelper.logTestStep('Test completed successfully', {
      transactionId,
      processingTime,
      assertionsPassed: assertions.length + dashboardAssertions.length,
    });
  });

  test('should process Spanish receipt with translation', async ({ page }) => {
    const emailData = spanishReceipts[0]; // Spanish restaurant receipt
    
    await docHelper.logTestStep('Starting Spanish receipt processing test', {
      language: emailData.language,
      merchant: emailData.expectedExtraction.merchant,
    });

    // Get initial state
    const initialTotal = await dashboardHelper.getMonthToDateTotal();

    // Process Spanish email
    await emailHelper.simulateEmailReceived(emailData);
    const transactionId = await emailHelper.waitForTransactionCreated(45000); // Allow extra time for translation

    // Verify transaction was created
    expect(transactionId).toBeTruthy();

    // Get transaction details
    const transactionDetails = await emailHelper.getTransactionDetails(transactionId);

    // Verify translation and extraction
    expect(transactionDetails.merchant).toContain('Restaurante');
    expect(transactionDetails.amount).toBeCloseTo(emailData.expectedExtraction.amount, 2);
    expect(transactionDetails.category).toBe(emailData.expectedExtraction.category);

    // Verify confidence is reasonable for translated content
    expect(transactionDetails.confidence).toBeGreaterThan(70);

    // Verify dashboard update
    const finalTotal = await dashboardHelper.getMonthToDateTotal();
    expect(finalTotal).toBeGreaterThan(initialTotal);

    await docHelper.logTestStep('Spanish translation test completed', {
      transactionId,
      translatedMerchant: transactionDetails.merchant,
      confidence: transactionDetails.confidence,
    });
  });

  test('should handle malformed receipt gracefully', async ({ page }) => {
    const emailData = edgeCaseReceipts[0]; // Malformed receipt
    
    await docHelper.logTestStep('Starting malformed receipt test');

    // Process malformed email
    await emailHelper.simulateEmailReceived(emailData);

    // Should either create low-confidence transaction or show error
    try {
      const transactionId = await emailHelper.waitForTransactionCreated(15000);
      
      if (transactionId) {
        // If transaction was created, verify it has low confidence
        const transactionDetails = await emailHelper.getTransactionDetails(transactionId);
        expect(transactionDetails.confidence).toBeLessThan(50);
        
        await docHelper.logTestStep('Malformed receipt created low-confidence transaction', {
          transactionId,
          confidence: transactionDetails.confidence,
        });
      }
    } catch (error) {
      // If no transaction was created, that's also acceptable for malformed data
      await docHelper.logTestStep('Malformed receipt rejected (expected behavior)');
      
      // Verify error message is shown
      const errorMessage = page.locator('text=Could not process, text=Low confidence');
      const hasError = await errorMessage.isVisible();
      expect(hasError).toBeTruthy();
    }
  });

  test('should redact PII from receipt content', async ({ page }) => {
    const emailData = edgeCaseReceipts[1]; // PII-heavy receipt
    
    await docHelper.logTestStep('Starting PII redaction test');

    // Process email with PII
    await emailHelper.simulateEmailReceived(emailData);
    const transactionId = await emailHelper.waitForTransactionCreated();

    // Navigate to transaction details
    await page.click(`[data-transaction-id="${transactionId}"]`);
    await page.waitForSelector('[data-testid="transaction-details"]');

    // Verify PII is redacted in displayed content
    const transactionContent = await page.locator('[data-testid="transaction-details"]').textContent();
    
    // Should not contain original PII
    expect(transactionContent).not.toContain('4532-1234-5678-9012'); // Full credit card
    expect(transactionContent).not.toContain('123-45-6789'); // SSN
    expect(transactionContent).not.toContain('555-123-4567'); // Phone
    expect(transactionContent).not.toContain('john.doe@email.com'); // Email

    // Should contain redacted versions
    expect(transactionContent).toContain('****-****-****-9012'); // Last 4 digits
    
    await docHelper.logTestStep('PII redaction verified');
  });

  test('should handle concurrent email processing', async ({ page }) => {
    await docHelper.logTestStep('Starting concurrent processing test');

    const emailBatch = [
      englishReceipts[0],
      englishReceipts[1],
      englishReceipts[2],
    ];

    // Get initial state
    const initialTotal = await dashboardHelper.getMonthToDateTotal();

    // Process multiple emails concurrently
    const processingPromises = emailBatch.map(email => 
      emailHelper.simulateEmailReceived(email)
    );

    await Promise.all(processingPromises);

    // Wait for all transactions to be created
    await page.waitForFunction(
      (expectedCount) => {
        const transactions = document.querySelectorAll('[data-testid="transaction-item"]');
        return transactions.length >= expectedCount;
      },
      emailBatch.length,
      { timeout: 60000 }
    );

    // Verify all transactions were created
    const transactionElements = await page.locator('[data-testid="transaction-item"]').all();
    expect(transactionElements.length).toBeGreaterThanOrEqual(emailBatch.length);

    // Verify total amount increased correctly
    const finalTotal = await dashboardHelper.getMonthToDateTotal();
    const expectedIncrease = emailBatch.reduce((sum, email) => sum + email.expectedExtraction.amount, 0);
    expect(finalTotal - initialTotal).toBeCloseTo(expectedIncrease, 2);

    await docHelper.logTestStep('Concurrent processing completed', {
      processedCount: emailBatch.length,
      totalIncrease: finalTotal - initialTotal,
    });
  });

  test('should update real-time analytics', async ({ page }) => {
    await docHelper.logTestStep('Starting real-time analytics test');

    // Navigate to analytics page
    await dashboardHelper.navigateToAnalytics();
    await docHelper.takeScreenshot('analytics-initial');

    // Get initial analytics state
    const initialCategories = await dashboardHelper.getCategoryBreakdown();

    // Process an email
    const emailData = englishReceipts[0];
    await emailHelper.simulateEmailReceived(emailData);
    await emailHelper.waitForTransactionCreated();

    // Wait for analytics to update (real-time)
    await page.waitForTimeout(3000);

    // Verify analytics updated
    const updatedCategories = await dashboardHelper.getCategoryBreakdown();
    
    // Should have same or more categories
    expect(updatedCategories.length).toBeGreaterThanOrEqual(initialCategories.length);

    // Find the category that should have increased
    const targetCategory = updatedCategories.find(cat => 
      cat.category === emailData.expectedExtraction.category
    );

    expect(targetCategory).toBeDefined();
    expect(targetCategory!.amount).toBeGreaterThan(0);

    await docHelper.takeScreenshot('analytics-updated');
    await docHelper.logTestStep('Real-time analytics update verified');
  });

  test('should handle merchant mapping learning', async ({ page }) => {
    await docHelper.logTestStep('Starting merchant mapping learning test');

    const emailData = englishReceipts[0]; // Starbucks

    // Process initial email
    await emailHelper.simulateEmailReceived(emailData);
    const transactionId = await emailHelper.waitForTransactionCreated();

    // Navigate to transaction and correct category
    await page.click(`[data-transaction-id="${transactionId}"]`);
    await page.waitForSelector('[data-testid="transaction-details"]');

    // Edit category
    await page.click('[data-testid="edit-category"]');
    await page.selectOption('select[name="category"]', 'Food & Dining');
    await page.selectOption('select[name="subcategory"]', 'Coffee Shops');
    await page.click('button:has-text("Save")');

    // Wait for update
    await page.waitForSelector('text=Transaction updated');

    // Process another email from same merchant
    const secondEmail = {
      ...emailData,
      messageId: 'msg-starbucks-2',
      subject: 'Another Starbucks Receipt',
      body: emailData.body.replace('Order #456789', 'Order #789012'),
    };

    await emailHelper.simulateEmailReceived(secondEmail);
    const secondTransactionId = await emailHelper.waitForTransactionCreated();

    // Verify second transaction uses learned mapping
    const secondTransaction = await emailHelper.getTransactionDetails(secondTransactionId);
    expect(secondTransaction.category).toBe('Food & Dining');
    expect(secondTransaction.confidence).toBeGreaterThan(85); // Should have higher confidence

    await docHelper.logTestStep('Merchant mapping learning verified', {
      firstTransactionId: transactionId,
      secondTransactionId,
      learnedCategory: secondTransaction.category,
      improvedConfidence: secondTransaction.confidence,
    });
  });

  test('should maintain performance under load', async ({ page }) => {
    await docHelper.logTestStep('Starting performance load test');

    const emailCount = 10;
    const emails = Array.from({ length: emailCount }, (_, i) => ({
      ...englishReceipts[i % englishReceipts.length],
      messageId: `load-test-${i}`,
      subject: `Load Test Receipt ${i + 1}`,
    }));

    const startTime = Date.now();

    // Process emails in batches to avoid overwhelming the system
    const batchSize = 3;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      const batchPromises = batch.map(email => 
        emailHelper.simulateEmailReceived(email)
      );
      
      await Promise.all(batchPromises);
      
      // Small delay between batches
      await page.waitForTimeout(1000);
    }

    // Wait for all transactions to be processed
    await page.waitForFunction(
      (expectedCount) => {
        const transactions = document.querySelectorAll('[data-testid="transaction-item"]');
        return transactions.length >= expectedCount;
      },
      emailCount,
      { timeout: 120000 } // 2 minutes for load test
    );

    const totalTime = Date.now() - startTime;
    const averageTime = totalTime / emailCount;

    // Performance assertions
    expect(totalTime).toBeLessThan(120000); // Should complete within 2 minutes
    expect(averageTime).toBeLessThan(12000); // Average 12 seconds per email

    await docHelper.logTestStep('Performance load test completed', {
      emailCount,
      totalTimeMs: totalTime,
      averageTimeMs: averageTime,
    });
  });

  test.afterEach(async ({ page }) => {
    // Capture final state for debugging
    await docHelper.takeScreenshot('test-final-state');
    
    // Log any console errors
    const consoleLogs = await docHelper.captureConsoleLogs();
    const errors = consoleLogs.filter(log => log.level === 'error');
    
    if (errors.length > 0) {
      await docHelper.logTestStep('Console errors detected', { errors });
    }
  });
});