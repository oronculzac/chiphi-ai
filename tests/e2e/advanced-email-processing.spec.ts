import { test, expect } from '@playwright/test';
import { createTestOrganization, createTestUser, cleanupTestData } from '../fixtures/test-organizations';
import { generateTestEmailSamples } from '../fixtures/email-samples';

test.describe('Advanced Email Processing Features', () => {
  let testOrgId: string;
  let testUserId: string;
  let testAliasEmail: string;

  test.beforeEach(async () => {
    // Create test organization and user
    const testOrg = await createTestOrganization();
    testOrgId = testOrg.orgId;
    testUserId = testOrg.userId;
    testAliasEmail = testOrg.aliasEmail;
  });

  test.afterEach(async () => {
    // Cleanup test data
    await cleanupTestData(testOrgId);
  });

  test('should process PDF receipt attachments', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Wait for dashboard to load
    await expect(page.locator('[data-testid="dashboard-analytics"]')).toBeVisible();
    
    // Simulate email with PDF attachment being processed
    const emailWithPDF = generateTestEmailSamples().pdfReceipt;
    
    // Send webhook request with PDF attachment
    const webhookResponse = await page.request.post('/api/inbound', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: {
        'signature': 'test-signature',
        'timestamp': Date.now().toString(),
        'token': 'test-token',
        'body-mime': emailWithPDF.mimeContent,
        'message-id': emailWithPDF.messageId,
        'recipient': testAliasEmail,
        'sender': emailWithPDF.from,
        'subject': emailWithPDF.subject,
      },
    });
    
    expect(webhookResponse.ok()).toBeTruthy();
    
    // Wait for processing to complete
    await page.waitForTimeout(3000);
    
    // Refresh dashboard to see new transaction
    await page.reload();
    
    // Verify transaction appears in dashboard
    await expect(page.locator('[data-testid="transaction-list"]')).toBeVisible();
    
    // Check that PDF content was processed
    const transactionRow = page.locator('[data-testid="transaction-row"]').first();
    await expect(transactionRow).toBeVisible();
    
    // Click on transaction to view details
    await transactionRow.click();
    
    // Verify transaction details include PDF-extracted information
    await expect(page.locator('[data-testid="transaction-detail"]')).toBeVisible();
    
    // Check for PDF processing indicators
    const transactionNotes = page.locator('[data-testid="transaction-notes"]');
    await expect(transactionNotes).toContainText('PDF');
  });

  test('should handle forwarded email chains', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Simulate forwarded email being processed
    const forwardedEmail = generateTestEmailSamples().forwardedReceipt;
    
    // Send webhook request with forwarded email
    const webhookResponse = await page.request.post('/api/inbound', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: {
        'signature': 'test-signature',
        'timestamp': Date.now().toString(),
        'token': 'test-token',
        'body-mime': forwardedEmail.mimeContent,
        'message-id': forwardedEmail.messageId,
        'recipient': testAliasEmail,
        'sender': forwardedEmail.from,
        'subject': forwardedEmail.subject,
      },
    });
    
    expect(webhookResponse.ok()).toBeTruthy();
    
    // Wait for processing to complete
    await page.waitForTimeout(3000);
    
    // Refresh dashboard
    await page.reload();
    
    // Verify transaction was created
    await expect(page.locator('[data-testid="transaction-list"]')).toBeVisible();
    
    const transactionRow = page.locator('[data-testid="transaction-row"]').first();
    await expect(transactionRow).toBeVisible();
    
    // Click to view details
    await transactionRow.click();
    
    // Verify forwarded chain information is captured
    const transactionNotes = page.locator('[data-testid="transaction-notes"]');
    await expect(transactionNotes).toContainText('FORWARDED');
  });

  test('should detect and prevent duplicate processing', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    const duplicateEmail = generateTestEmailSamples().standardReceipt;
    
    // Send the same email twice
    const webhookData = {
      'signature': 'test-signature',
      'timestamp': Date.now().toString(),
      'token': 'test-token',
      'body-mime': duplicateEmail.mimeContent,
      'message-id': duplicateEmail.messageId,
      'recipient': testAliasEmail,
      'sender': duplicateEmail.from,
      'subject': duplicateEmail.subject,
    };
    
    // First request
    const firstResponse = await page.request.post('/api/inbound', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: webhookData,
    });
    expect(firstResponse.ok()).toBeTruthy();
    
    // Wait for processing
    await page.waitForTimeout(2000);
    
    // Second request (duplicate)
    const secondResponse = await page.request.post('/api/inbound', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: webhookData,
    });
    expect(secondResponse.ok()).toBeTruthy();
    
    // Wait for processing
    await page.waitForTimeout(2000);
    
    // Refresh dashboard
    await page.reload();
    
    // Verify only one transaction was created
    const transactionRows = page.locator('[data-testid="transaction-row"]');
    await expect(transactionRows).toHaveCount(1);
  });

  test('should sanitize malicious email content', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    const maliciousEmail = generateTestEmailSamples().maliciousEmail;
    
    // Send malicious email
    const webhookResponse = await page.request.post('/api/inbound', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: {
        'signature': 'test-signature',
        'timestamp': Date.now().toString(),
        'token': 'test-token',
        'body-mime': maliciousEmail.mimeContent,
        'message-id': maliciousEmail.messageId,
        'recipient': testAliasEmail,
        'sender': maliciousEmail.from,
        'subject': maliciousEmail.subject,
      },
    });
    
    expect(webhookResponse.ok()).toBeTruthy();
    
    // Wait for processing
    await page.waitForTimeout(3000);
    
    // Refresh dashboard
    await page.reload();
    
    // Verify transaction was created (content sanitized)
    await expect(page.locator('[data-testid="transaction-list"]')).toBeVisible();
    
    const transactionRow = page.locator('[data-testid="transaction-row"]').first();
    await expect(transactionRow).toBeVisible();
    
    // Click to view details
    await transactionRow.click();
    
    // Verify security flags are present
    const transactionNotes = page.locator('[data-testid="transaction-notes"]');
    await expect(transactionNotes).toContainText('SECURITY');
    
    // Verify malicious content was sanitized
    const transactionContent = page.locator('[data-testid="transaction-content"]');
    await expect(transactionContent).not.toContainText('<script>');
    await expect(transactionContent).not.toContainText('javascript:');
  });

  test('should redact sensitive information', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    const emailWithSensitiveData = generateTestEmailSamples().sensitiveDataEmail;
    
    // Send email with sensitive data
    const webhookResponse = await page.request.post('/api/inbound', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: {
        'signature': 'test-signature',
        'timestamp': Date.now().toString(),
        'token': 'test-token',
        'body-mime': emailWithSensitiveData.mimeContent,
        'message-id': emailWithSensitiveData.messageId,
        'recipient': testAliasEmail,
        'sender': emailWithSensitiveData.from,
        'subject': emailWithSensitiveData.subject,
      },
    });
    
    expect(webhookResponse.ok()).toBeTruthy();
    
    // Wait for processing
    await page.waitForTimeout(3000);
    
    // Refresh dashboard
    await page.reload();
    
    // Verify transaction was created
    await expect(page.locator('[data-testid="transaction-list"]')).toBeVisible();
    
    const transactionRow = page.locator('[data-testid="transaction-row"]').first();
    await expect(transactionRow).toBeVisible();
    
    // Click to view details
    await transactionRow.click();
    
    // Verify sensitive data was redacted
    const transactionContent = page.locator('[data-testid="transaction-content"]');
    
    // Should show redacted credit card (last 4 digits only)
    await expect(transactionContent).toContainText('**** **** **** 3456');
    await expect(transactionContent).not.toContainText('1234-5678-9012-3456');
    
    // Should show redacted SSN
    await expect(transactionContent).toContainText('***-**-****');
    await expect(transactionContent).not.toContainText('123-45-6789');
  });

  test('should handle multiple attachment types', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    const emailWithMultipleAttachments = generateTestEmailSamples().multipleAttachmentsEmail;
    
    // Send email with multiple attachments
    const webhookResponse = await page.request.post('/api/inbound', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: {
        'signature': 'test-signature',
        'timestamp': Date.now().toString(),
        'token': 'test-token',
        'body-mime': emailWithMultipleAttachments.mimeContent,
        'message-id': emailWithMultipleAttachments.messageId,
        'recipient': testAliasEmail,
        'sender': emailWithMultipleAttachments.from,
        'subject': emailWithMultipleAttachments.subject,
      },
    });
    
    expect(webhookResponse.ok()).toBeTruthy();
    
    // Wait for processing
    await page.waitForTimeout(3000);
    
    // Refresh dashboard
    await page.reload();
    
    // Verify transaction was created
    await expect(page.locator('[data-testid="transaction-list"]')).toBeVisible();
    
    const transactionRow = page.locator('[data-testid="transaction-row"]').first();
    await expect(transactionRow).toBeVisible();
    
    // Click to view details
    await transactionRow.click();
    
    // Verify attachment processing information
    const transactionNotes = page.locator('[data-testid="transaction-notes"]');
    
    // Should indicate PDF was processed
    await expect(transactionNotes).toContainText('PDF');
    
    // Should indicate dangerous attachments were removed
    await expect(transactionNotes).toContainText('removed');
  });

  test('should detect suspicious sender domains', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    const suspiciousEmail = generateTestEmailSamples().suspiciousSenderEmail;
    
    // Send email from suspicious domain
    const webhookResponse = await page.request.post('/api/inbound', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: {
        'signature': 'test-signature',
        'timestamp': Date.now().toString(),
        'token': 'test-token',
        'body-mime': suspiciousEmail.mimeContent,
        'message-id': suspiciousEmail.messageId,
        'recipient': testAliasEmail,
        'sender': suspiciousEmail.from,
        'subject': suspiciousEmail.subject,
      },
    });
    
    expect(webhookResponse.ok()).toBeTruthy();
    
    // Wait for processing
    await page.waitForTimeout(3000);
    
    // Refresh dashboard
    await page.reload();
    
    // Verify transaction was created with security flags
    await expect(page.locator('[data-testid="transaction-list"]')).toBeVisible();
    
    const transactionRow = page.locator('[data-testid="transaction-row"]').first();
    await expect(transactionRow).toBeVisible();
    
    // Click to view details
    await transactionRow.click();
    
    // Verify security warning about suspicious sender
    const transactionNotes = page.locator('[data-testid="transaction-notes"]');
    await expect(transactionNotes).toContainText('SECURITY');
    await expect(transactionNotes).toContainText('temporary');
  });

  test('should process multilingual forwarded receipts', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    const multilingualEmail = generateTestEmailSamples().multilingualForwardedReceipt;
    
    // Send multilingual forwarded email
    const webhookResponse = await page.request.post('/api/inbound', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: {
        'signature': 'test-signature',
        'timestamp': Date.now().toString(),
        'token': 'test-token',
        'body-mime': multilingualEmail.mimeContent,
        'message-id': multilingualEmail.messageId,
        'recipient': testAliasEmail,
        'sender': multilingualEmail.from,
        'subject': multilingualEmail.subject,
      },
    });
    
    expect(webhookResponse.ok()).toBeTruthy();
    
    // Wait for processing (translation takes longer)
    await page.waitForTimeout(5000);
    
    // Refresh dashboard
    await page.reload();
    
    // Verify transaction was created
    await expect(page.locator('[data-testid="transaction-list"]')).toBeVisible();
    
    const transactionRow = page.locator('[data-testid="transaction-row"]').first();
    await expect(transactionRow).toBeVisible();
    
    // Click to view details
    await transactionRow.click();
    
    // Verify both forwarded chain and translation information
    const transactionNotes = page.locator('[data-testid="transaction-notes"]');
    await expect(transactionNotes).toContainText('FORWARDED');
    
    // Should have original/translated text toggle
    const textToggle = page.locator('[data-testid="text-toggle"]');
    await expect(textToggle).toBeVisible();
    
    // Test toggle functionality
    await textToggle.click();
    
    // Should show original language text
    const originalText = page.locator('[data-testid="original-text"]');
    await expect(originalText).toBeVisible();
  });
});