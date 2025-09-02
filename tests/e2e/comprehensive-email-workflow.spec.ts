/**
 * Comprehensive Email Processing Workflow Tests
 * 
 * End-to-end tests for the complete email receipt processing pipeline
 * Tests email ingestion, AI processing, translation, extraction, and storage
 */

import { test, expect } from '@playwright/test';
import { AuthHelper, EmailHelper, DashboardHelper } from '../utils/test-helpers';
import { getTestOrg, getTestUser } from '../fixtures/test-organizations';
import { getEmailSample, englishEmailSamples, spanishEmailSamples } from '../fixtures/email-samples';
import { validateEmailTestData, validateEmailProcessingResult } from '@/lib/types/test-schemas';

test.describe('Comprehensive Email Processing Workflow', () => {
  let authHelper: AuthHelper;
  let emailHelper: EmailHelper;
  let dashboardHelper: DashboardHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    emailHelper = new EmailHelper(page);
    dashboardHelper = new DashboardHelper(page);
    
    // Login as primary test user
    await authHelper.loginAsUser('primaryOwner');
  });

  test.afterEach(async ({ page }) => {
    await authHelper.logout();
  });

  test('should process English Starbucks receipt end-to-end', async ({ page }) => {
    const emailData = getEmailSample('starbucksCoffee');
    validateEmailTestData(emailData);

    // Step 1: Send email to inbox alias
    const response = await emailHelper.sendTestEmail(emailData);
    expect(response.status()).toBe(200);

    // Step 2: Wait for email processing to complete
    const processingResult = await emailHelper.waitForEmailProcessing(emailData.messageId);
    validateEmailProcessingResult(processingResult);
    
    expect(processingResult.success).toBe(true);
    expect(processingResult.steps.received).toBe(true);
    expect(processingResult.steps.parsed).toBe(true);
    expect(processingResult.steps.extracted).toBe(true);
    expect(processingResult.steps.stored).toBe(true);

    // Step 3: Verify transaction was created correctly
    const transaction = await emailHelper.verifyTransactionCreated(emailData.messageId, emailData);
    
    expect(transaction.amount).toBeCloseTo(5.95, 2);
    expect(transaction.merchant).toContain('Starbucks');
    expect(transaction.category).toBe('Food & Dining');
    expect(transaction.confidence).toBeGreaterThan(80);
    expect(transaction.explanation).toBeTruthy();
    expect(transaction.last4).toBe('1234');

    // Step 4: Verify dashboard updates
    await dashboardHelper.navigateToDashboard();
    await dashboardHelper.waitForStatsUpdate({
      monthToDateTotal: 5.95,
      transactionCount: 1,
      categoryBreakdown: [{
        category: 'Food & Dining',
        amount: 5.95,
        percentage: 100,
        count: 1,
      }],
      spendingTrend: [],
    });

    // Step 5: Verify real-time notification
    await dashboardHelper.verifyRealtimeUpdate({
      merchant: 'Starbucks',
      amount: 5.95,
      category: 'Food & Dining',
    });

    // Step 6: Verify transaction appears in transaction list
    await page.goto('/dashboard/transactions');
    await expect(page.locator('[data-testid="transaction-list"]')).toBeVisible();
    
    const transactionRow = page.locator(`[data-testid="transaction-${transaction.id}"]`);
    await expect(transactionRow).toBeVisible();
    await expect(transactionRow).toContainText('Starbucks');
    await expect(transactionRow).toContainText('$5.95');
    await expect(transactionRow).toContainText('Food & Dining');

    // Step 7: Verify confidence badge and explanation
    const confidenceBadge = transactionRow.locator('[data-testid="confidence-badge"]');
    await expect(confidenceBadge).toBeVisible();
    await expect(confidenceBadge).toContainText('95%');

    await transactionRow.click();
    await expect(page.locator('[data-testid="transaction-explanation"]')).toBeVisible();
    await expect(page.locator('[data-testid="transaction-explanation"]')).toContainText('Coffee shop');
  });

  test('should process Spanish restaurant receipt with translation', async ({ page }) => {
    const emailData = getEmailSample('restaurantReceipt');
    validateEmailTestData(emailData);

    // Step 1: Send Spanish email
    const response = await emailHelper.sendTestEmail(emailData);
    expect(response.status()).toBe(200);

    // Step 2: Wait for processing (translation takes longer)
    const processingResult = await emailHelper.waitForEmailProcessing(emailData.messageId, 45000);
    
    expect(processingResult.success).toBe(true);
    expect(processingResult.steps.translated).toBe(true);

    // Step 3: Verify transaction with translation
    const transaction = await emailHelper.verifyTransactionCreated(emailData.messageId, emailData);
    
    expect(transaction.amount).toBeCloseTo(44.66, 2);
    expect(transaction.merchant).toContain('Restaurante El Patio');
    expect(transaction.category).toBe('Food & Dining');
    expect(transaction.original_text).toBeTruthy();
    expect(transaction.translated_text).toBeTruthy();
    expect(transaction.source_language).toBe('es');

    // Step 4: Verify translation toggle in UI
    await page.goto('/dashboard/transactions');
    const transactionRow = page.locator(`[data-testid="transaction-${transaction.id}"]`);
    await transactionRow.click();

    // Check for translation toggle
    const translationToggle = page.locator('[data-testid="translation-toggle"]');
    await expect(translationToggle).toBeVisible();
    
    // Toggle to original text
    await translationToggle.click();
    await expect(page.locator('[data-testid="original-text"]')).toContainText('PAELLA VALENCIANA');
    
    // Toggle back to translated text
    await translationToggle.click();
    await expect(page.locator('[data-testid="translated-text"]')).toContainText('Valencian Paella');
  });

  test('should handle multiple concurrent email processing', async ({ page }) => {
    const emailSamples = [
      getEmailSample('starbucksCoffee'),
      getEmailSample('wholeFoodsGrocery'),
      getEmailSample('uberRide'),
    ];

    // Step 1: Send multiple emails concurrently
    const sendPromises = emailSamples.map(emailData => 
      emailHelper.sendTestEmail({
        ...emailData,
        messageId: `${emailData.messageId}-concurrent-${Date.now()}`,
      })
    );

    const responses = await Promise.all(sendPromises);
    responses.forEach(response => {
      expect(response.status()).toBe(200);
    });

    // Step 2: Wait for all processing to complete
    const processingPromises = emailSamples.map((emailData, index) => 
      emailHelper.waitForEmailProcessing(`${emailData.messageId}-concurrent-${Date.now()}`)
    );

    const processingResults = await Promise.all(processingPromises);
    processingResults.forEach(result => {
      expect(result.success).toBe(true);
    });

    // Step 3: Verify all transactions were created
    await dashboardHelper.navigateToDashboard();
    
    const expectedTotal = emailSamples.reduce((sum, email) => sum + (email.expectedAmount || 0), 0);
    await dashboardHelper.waitForStatsUpdate({
      monthToDateTotal: expectedTotal,
      transactionCount: 3,
      categoryBreakdown: [
        { category: 'Food & Dining', amount: 5.95, percentage: 0, count: 1 },
        { category: 'Groceries', amount: 35.27, percentage: 0, count: 1 },
        { category: 'Transportation', amount: 14.95, percentage: 0, count: 1 },
      ],
      spendingTrend: [],
    });

    // Step 4: Verify transaction list shows all transactions
    await page.goto('/dashboard/transactions');
    await expect(page.locator('[data-testid="transaction-list"] tr')).toHaveCount(4); // 3 transactions + header
  });

  test('should handle malformed email gracefully', async ({ page }) => {
    const emailData = getEmailSample('malformedReceipt');

    // Step 1: Send malformed email
    const response = await emailHelper.sendTestEmail(emailData);
    expect(response.status()).toBe(200);

    // Step 2: Wait for processing (should complete but with low confidence)
    const processingResult = await emailHelper.waitForEmailProcessing(emailData.messageId);
    
    expect(processingResult.success).toBe(true);
    expect(processingResult.steps.received).toBe(true);
    expect(processingResult.steps.parsed).toBe(true);

    // Step 3: Verify transaction was created with low confidence
    const transaction = await emailHelper.verifyTransactionCreated(emailData.messageId, {
      expectedCategory: 'Other',
      expectedMerchant: 'Unknown',
    });
    
    expect(transaction.confidence).toBeLessThan(50);
    expect(transaction.category).toBe('Other');
    expect(transaction.merchant).toContain('Unknown');

    // Step 4: Verify low confidence warning in UI
    await page.goto('/dashboard/transactions');
    const transactionRow = page.locator(`[data-testid="transaction-${transaction.id}"]`);
    
    const confidenceBadge = transactionRow.locator('[data-testid="confidence-badge"]');
    await expect(confidenceBadge).toHaveClass(/.*low-confidence.*/);
    
    const reviewFlag = transactionRow.locator('[data-testid="review-flag"]');
    await expect(reviewFlag).toBeVisible();
  });

  test('should prevent duplicate processing', async ({ page }) => {
    const emailData = getEmailSample('duplicateReceipt');

    // Step 1: Send email first time
    const response1 = await emailHelper.sendTestEmail(emailData);
    expect(response1.status()).toBe(200);

    // Step 2: Wait for first processing
    await emailHelper.waitForEmailProcessing(emailData.messageId);

    // Step 3: Send same email again (duplicate)
    const response2 = await emailHelper.sendTestEmail(emailData);
    expect(response2.status()).toBe(200);

    // Step 4: Verify duplicate was detected and rejected
    const duplicateResponse = await page.request.get(`/api/emails/${emailData.messageId}/status`);
    const duplicateStatus = await duplicateResponse.json();
    
    expect(duplicateStatus.duplicate_detected).toBe(true);
    expect(duplicateStatus.original_transaction_id).toBeTruthy();

    // Step 5: Verify only one transaction exists
    await page.goto('/dashboard/transactions');
    const transactionRows = page.locator('[data-testid^="transaction-"]');
    await expect(transactionRows).toHaveCount(1);
  });

  test('should handle forwarded email chains', async ({ page }) => {
    const emailData = getEmailSample('forwardedEmail');

    // Step 1: Send forwarded email
    const response = await emailHelper.sendTestEmail(emailData);
    expect(response.status()).toBe(200);

    // Step 2: Wait for processing
    const processingResult = await emailHelper.waitForEmailProcessing(emailData.messageId);
    expect(processingResult.success).toBe(true);

    // Step 3: Verify extraction from forwarded content
    const transaction = await emailHelper.verifyTransactionCreated(emailData.messageId, emailData);
    
    expect(transaction.merchant).toContain("Mario's Italian Restaurant");
    expect(transaction.amount).toBeCloseTo(82.64, 2);
    expect(transaction.category).toBe('Food & Dining');
    expect(transaction.last4).toBe('4567');

    // Step 4: Verify forwarded email metadata is preserved
    const emailResponse = await page.request.get(`/api/emails/${emailData.messageId}`);
    const emailRecord = await emailResponse.json();
    
    expect(emailRecord.data.is_forwarded).toBe(true);
    expect(emailRecord.data.original_sender).toBe('receipts@restaurant.com');
  });

  test('should process PDF attachment receipts', async ({ page }) => {
    const emailData = getEmailSample('pdfAttachment');

    // Step 1: Send email with PDF attachment
    const response = await emailHelper.sendTestEmail(emailData);
    expect(response.status()).toBe(200);

    // Step 2: Wait for processing (PDF extraction takes longer)
    const processingResult = await emailHelper.waitForEmailProcessing(emailData.messageId, 60000);
    expect(processingResult.success).toBe(true);
    expect(processingResult.steps.attachment_processed).toBe(true);

    // Step 3: Verify transaction from PDF content
    const transaction = await emailHelper.verifyTransactionCreated(emailData.messageId, emailData);
    
    expect(transaction.merchant).toContain('Grand Hotel');
    expect(transaction.amount).toBeCloseTo(250.00, 2);
    expect(transaction.category).toBe('Travel');

    // Step 4: Verify attachment metadata
    const attachmentResponse = await page.request.get(`/api/transactions/${transaction.id}/attachments`);
    const attachments = await attachmentResponse.json();
    
    expect(attachments.data).toHaveLength(1);
    expect(attachments.data[0].filename).toBe('hotel-receipt.pdf');
    expect(attachments.data[0].content_type).toBe('application/pdf');
  });

  test('should maintain processing performance under load', async ({ page }) => {
    const emailCount = 10;
    const maxProcessingTime = 30000; // 30 seconds per email
    
    // Step 1: Generate multiple test emails
    const emailPromises = Array.from({ length: emailCount }, (_, index) => {
      const baseEmail = getEmailSample('starbucksCoffee');
      return emailHelper.sendTestEmail({
        ...baseEmail,
        messageId: `load-test-${index}-${Date.now()}`,
        expectedAmount: 5.95 + index, // Vary amounts
      });
    });

    // Step 2: Send all emails
    const startTime = Date.now();
    const responses = await Promise.all(emailPromises);
    
    responses.forEach(response => {
      expect(response.status()).toBe(200);
    });

    // Step 3: Wait for all processing to complete
    const processingPromises = Array.from({ length: emailCount }, (_, index) => 
      emailHelper.waitForEmailProcessing(`load-test-${index}-${Date.now()}`, maxProcessingTime)
    );

    const processingResults = await Promise.all(processingPromises);
    const totalTime = Date.now() - startTime;

    // Step 4: Verify performance metrics
    processingResults.forEach(result => {
      expect(result.success).toBe(true);
      expect(result.processingTime).toBeLessThan(maxProcessingTime);
    });

    const averageProcessingTime = processingResults.reduce((sum, result) => sum + result.processingTime, 0) / emailCount;
    
    console.log(`Load test results:
      - Total emails: ${emailCount}
      - Total time: ${totalTime}ms
      - Average processing time: ${averageProcessingTime}ms
      - Max processing time: ${Math.max(...processingResults.map(r => r.processingTime))}ms
    `);

    // Performance assertions
    expect(averageProcessingTime).toBeLessThan(15000); // Average under 15 seconds
    expect(totalTime).toBeLessThan(emailCount * maxProcessingTime); // Parallel processing benefit

    // Step 5: Verify all transactions in dashboard
    await dashboardHelper.navigateToDashboard();
    await dashboardHelper.waitForStatsUpdate({
      monthToDateTotal: emailCount * 5.95 + (emailCount * (emailCount - 1)) / 2, // Sum of arithmetic sequence
      transactionCount: emailCount,
      categoryBreakdown: [{
        category: 'Food & Dining',
        amount: 0, // Will be calculated
        percentage: 100,
        count: emailCount,
      }],
      spendingTrend: [],
    });
  });

  test('should handle processing errors gracefully', async ({ page }) => {
    // Step 1: Send email that will cause AI processing error (empty content)
    const errorEmailData = {
      messageId: 'error-test-001@test.com',
      from: 'test@example.com',
      to: 'test-primary@chiphi-test.com',
      subject: 'Empty Receipt',
      textContent: '', // Empty content should cause extraction error
      language: 'en',
    };

    const response = await emailHelper.sendTestEmail(errorEmailData);
    expect(response.status()).toBe(200);

    // Step 2: Wait for processing to complete (should fail gracefully)
    try {
      await emailHelper.waitForEmailProcessing(errorEmailData.messageId, 30000);
    } catch (error) {
      // Processing should fail, but gracefully
      expect(error.message).toContain('processing failed');
    }

    // Step 3: Verify error was logged
    const errorResponse = await page.request.get(`/api/emails/${errorEmailData.messageId}/status`);
    const errorStatus = await errorResponse.json();
    
    expect(errorStatus.success).toBe(false);
    expect(errorStatus.error).toBeTruthy();
    expect(errorStatus.steps.received).toBe(true);
    expect(errorStatus.steps.parsed).toBe(true);
    expect(errorStatus.steps.extracted).toBe(false);

    // Step 4: Verify no transaction was created
    const transactionResponse = await page.request.get(`/api/transactions?messageId=${errorEmailData.messageId}`);
    const transactions = await transactionResponse.json();
    
    expect(transactions.data).toHaveLength(0);

    // Step 5: Verify error notification in dashboard
    await dashboardHelper.navigateToDashboard();
    await expect(page.locator('[data-testid="processing-error-notification"]')).toBeVisible();
  });
});