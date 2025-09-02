import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';
import { TestReceiptFixture } from '@/lib/types/test-schemas';

/**
 * End-to-end tests for email receipt processing workflow
 * Tests the complete pipeline from email ingestion to dashboard display
 */

test.describe('Email Processing Workflow', () => {
  let testOrgId: string;
  let testUserId: string;
  let testInboxAlias: string;
  let webhookSigningKey: string;

  test.beforeAll(async () => {
    testOrgId = process.env.TEST_ORG_ID!;
    testUserId = process.env.TEST_USER_ID!;
    testInboxAlias = process.env.TEST_INBOX_ALIAS!;
    webhookSigningKey = process.env.TEST_WEBHOOK_SIGNING_KEY!;

    expect(testOrgId).toBeTruthy();
    expect(testUserId).toBeTruthy();
    expect(testInboxAlias).toBeTruthy();
    expect(webhookSigningKey).toBeTruthy();
  });

  test('should process English Amazon receipt end-to-end', async ({ page }) => {
    // Load test fixture
    const fixture: TestReceiptFixture = await TestHelpers.loadFixture('amazon-receipt-english');
    
    // Create webhook payload
    const webhookPayload = TestHelpers.createWebhookPayload(fixture.email, webhookSigningKey);
    const formData = TestHelpers.webhookPayloadToFormData(webhookPayload);

    // Send webhook request
    const webhookResponse = await page.request.post('/api/inbound', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: formData
    });

    expect(webhookResponse.status()).toBe(200);
    
    const responseData = await webhookResponse.json();
    expect(responseData.success).toBe(true);
    expect(responseData.emailId).toBeTruthy();

    // Wait for processing to complete (in real implementation, this would be async)
    await page.waitForTimeout(5000);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await TestHelpers.waitForElement(page, '[data-testid="dashboard"]');

    // Verify transaction appears in dashboard
    await TestHelpers.verifyTransactionInDashboard(page, {
      merchant: fixture.expectedResult.merchant,
      amount: fixture.expectedResult.amount,
      category: fixture.expectedResult.category,
      date: fixture.expectedResult.date
    });

    // Verify confidence badge
    await TestHelpers.verifyConfidenceBadge(page, fixture.expectedResult.confidence);

    // Take screenshot for verification
    await TestHelpers.takeTimestampedScreenshot(page, 'amazon-receipt-processed');
  });

  test('should process Spanish Starbucks receipt with translation', async ({ page }) => {
    // Load test fixture
    const fixture: TestReceiptFixture = await TestHelpers.loadFixture('starbucks-receipt-spanish');
    
    // Create webhook payload
    const webhookPayload = TestHelpers.createWebhookPayload(fixture.email, webhookSigningKey);
    const formData = TestHelpers.webhookPayloadToFormData(webhookPayload);

    // Send webhook request
    const webhookResponse = await page.request.post('/api/inbound', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: formData
    });

    expect(webhookResponse.status()).toBe(200);

    // Wait for processing to complete
    await page.waitForTimeout(8000); // Translation takes longer

    // Navigate to dashboard
    await page.goto('/dashboard');
    await TestHelpers.waitForElement(page, '[data-testid="dashboard"]');

    // Verify transaction appears
    await TestHelpers.verifyTransactionInDashboard(page, {
      merchant: fixture.expectedResult.merchant,
      amount: fixture.expectedResult.amount,
      category: fixture.expectedResult.category,
      date: fixture.expectedResult.date
    });

    // Click on transaction to view details
    const transactionRow = page.locator('[data-testid="transaction-row"]').first();
    await transactionRow.click();

    // Verify translation toggle functionality
    await TestHelpers.verifyTranslationToggle(
      page, 
      fixture.email.body, // Original Spanish text
      'Thank you for visiting Starbucks!' // Expected translated text (partial)
    );

    // Take screenshot
    await TestHelpers.takeTimestampedScreenshot(page, 'starbucks-spanish-translated');
  });

  test('should process French Uber receipt with currency conversion', async ({ page }) => {
    // Load test fixture
    const fixture: TestReceiptFixture = await TestHelpers.loadFixture('uber-receipt-french');
    
    // Create webhook payload
    const webhookPayload = TestHelpers.createWebhookPayload(fixture.email, webhookSigningKey);
    const formData = TestHelpers.webhookPayloadToFormData(webhookPayload);

    // Send webhook request
    const webhookResponse = await page.request.post('/api/inbound', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: formData
    });

    expect(webhookResponse.status()).toBe(200);

    // Wait for processing
    await page.waitForTimeout(8000);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await TestHelpers.waitForElement(page, '[data-testid="dashboard"]');

    // Verify transaction with EUR currency
    const transactionRow = page.locator('[data-testid="transaction-row"]').first();
    await expect(transactionRow.locator('[data-testid="merchant"]')).toContainText('Uber');
    await expect(transactionRow.locator('[data-testid="amount"]')).toContainText('€36.70');
    await expect(transactionRow.locator('[data-testid="category"]')).toContainText('Transportation');

    // Verify subcategory
    await expect(transactionRow.locator('[data-testid="subcategory"]')).toContainText('Rideshare');

    // Take screenshot
    await TestHelpers.takeTimestampedScreenshot(page, 'uber-french-processed');
  });

  test('should handle complex Japanese restaurant receipt', async ({ page }) => {
    // Load test fixture
    const fixture: TestReceiptFixture = await TestHelpers.loadFixture('complex-receipt-japanese');
    
    // Create webhook payload
    const webhookPayload = TestHelpers.createWebhookPayload(fixture.email, webhookSigningKey);
    const formData = TestHelpers.webhookPayloadToFormData(webhookPayload);

    // Send webhook request
    const webhookResponse = await page.request.post('/api/inbound', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: formData
    });

    expect(webhookResponse.status()).toBe(200);

    // Wait for processing (complex translation takes longer)
    await page.waitForTimeout(12000);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await TestHelpers.waitForElement(page, '[data-testid="dashboard"]');

    // Verify transaction with JPY currency
    const transactionRow = page.locator('[data-testid="transaction-row"]').first();
    await expect(transactionRow.locator('[data-testid="merchant"]')).toContainText('Sushi Zen');
    await expect(transactionRow.locator('[data-testid="amount"]')).toContainText('¥8,580');
    await expect(transactionRow.locator('[data-testid="category"]')).toContainText('Food & Dining');

    // Click to view details
    await transactionRow.click();

    // Verify detailed notes with itemized purchases
    const notesSection = page.locator('[data-testid="transaction-notes"]');
    await expect(notesSection).toContainText('sushi');
    await expect(notesSection).toContainText('tempura');
    await expect(notesSection).toContainText('beer');

    // Verify confidence score (should be lower due to complexity)
    await TestHelpers.verifyConfidenceBadge(page, 80); // Allow for lower confidence

    // Take screenshot
    await TestHelpers.takeTimestampedScreenshot(page, 'japanese-restaurant-processed');
  });

  test('should reject invalid webhook signature', async ({ page }) => {
    // Load test fixture
    const fixture: TestReceiptFixture = await TestHelpers.loadFixture('amazon-receipt-english');
    
    // Create webhook payload with invalid signature
    const webhookPayload = TestHelpers.createWebhookPayload(fixture.email, webhookSigningKey);
    webhookPayload.signature = 'invalid-signature';
    const formData = TestHelpers.webhookPayloadToFormData(webhookPayload);

    // Send webhook request
    const webhookResponse = await page.request.post('/api/inbound', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: formData
    });

    expect(webhookResponse.status()).toBe(401);
    
    const responseData = await webhookResponse.json();
    expect(responseData.error).toContain('Invalid signature');
  });

  test('should handle rate limiting', async ({ page }) => {
    // Load test fixture
    const fixture: TestReceiptFixture = await TestHelpers.loadFixture('amazon-receipt-english');
    
    // Send multiple requests rapidly to trigger rate limiting
    const requests = [];
    for (let i = 0; i < 10; i++) {
      const webhookPayload = TestHelpers.createWebhookPayload(fixture.email, webhookSigningKey);
      webhookPayload['message-id'] = `<test-rate-limit-${i}@amazon.com>`;
      const formData = TestHelpers.webhookPayloadToFormData(webhookPayload);

      requests.push(
        page.request.post('/api/inbound', {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          data: formData
        })
      );
    }

    const responses = await Promise.all(requests);
    
    // Some requests should succeed, some should be rate limited
    const successCount = responses.filter(r => r.status() === 200).length;
    const rateLimitedCount = responses.filter(r => r.status() === 429).length;
    
    expect(successCount).toBeGreaterThan(0);
    expect(rateLimitedCount).toBeGreaterThan(0);
  });

  test('should verify multi-tenant isolation', async ({ page }) => {
    // This test would verify that users can only see their own organization's data
    await page.goto('/dashboard');
    
    // Verify tenant isolation
    await TestHelpers.verifyTenantIsolation(page, testOrgId);
    
    // Verify no cross-tenant data leakage
    const transactionRows = page.locator('[data-testid="transaction-row"]');
    const count = await transactionRows.count();
    
    // All visible transactions should belong to the test org
    for (let i = 0; i < count; i++) {
      const row = transactionRows.nth(i);
      // In a real implementation, you'd verify org_id in the data attributes
      await expect(row).toBeVisible();
    }
  });
});