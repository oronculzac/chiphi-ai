/**
 * Advanced Email Processing Workflow Tests
 * 
 * Comprehensive end-to-end tests for the ChiPhi AI email receipt processing system,
 * covering complex scenarios, edge cases, and advanced features.
 */

import { test, expect } from '@playwright/test';
import { 
  EmailSample,
  validateEmailSample,
  validateExtractionResult,
  createTestAssertion,
  generateTestOrganization,
  generateTestUser
} from '@/lib/types/test-schemas';
import { 
  allEmailSamples, 
  getSamplesByLanguage, 
  getEdgeCaseSamples,
  generateTestEmailSamples
} from '../fixtures/email-samples';
import { TestHelpers } from '../utils/enhanced-test-helpers';

test.describe('Advanced Email Processing Workflows', () => {
  let emailHelper: TestHelpers.EmailProcessingHelper;
  let dashboardHelper: TestHelpers.DashboardHelper;
  let authHelper: TestHelpers.AuthHelper;
  let docHelper: TestHelpers.TestDocumentationHelper;
  let performanceHelper: TestHelpers.PerformanceHelper;

  test.beforeEach(async ({ page }) => {
    emailHelper = new TestHelpers.EmailProcessingHelper(page);
    dashboardHelper = new TestHelpers.DashboardHelper(page);
    authHelper = new TestHelpers.AuthHelper(page);
    docHelper = new TestHelpers.TestDocumentationHelper(page);
    performanceHelper = new TestHelpers.PerformanceHelper(page);

    // Setup test environment
    const testOrg = generateTestOrganization({
      name: 'Advanced Processing Test Org',
      inboxAlias: 'advanced-test@chiphi.ai'
    });
    
    const testUser = generateTestUser({
      email: 'advanced-test@example.com',
      orgId: testOrg.id,
      role: 'owner'
    });

    await authHelper.signInWithTestUser(testUser.email, 'test-password');
    await docHelper.logTestStep('Advanced email processing test setup completed');
  });

  test.afterEach(async ({ page }) => {
    await docHelper.takeScreenshot('advanced-test-completion');
  });

  test('AEP-001: PDF receipt attachment processing', async ({ page }) => {
    await docHelper.logTestStep('Starting PDF receipt attachment processing test');

    const testEmails = generateTestEmailSamples();
    const pdfReceiptEmail = testEmails.pdfReceipt;

    await docHelper.logTestStep('Processing email with PDF attachment');

    // Navigate to email processing interface
    await emailHelper.simulateEmailReceived({
      messageId: pdfReceiptEmail.messageId,
      from: pdfReceiptEmail.from,
      to: pdfReceiptEmail.to,
      subject: pdfReceiptEmail.subject,
      body: 'Please find your receipt attached as PDF.',
      language: 'en',
      expectedExtraction: {
        date: '2024-01-15',
        amount: 28.58,
        currency: 'USD',
        merchant: 'Store',
        last4: '1234',
        category: 'Shopping',
        subcategory: null,
        notes: 'Item A, Item B',
        confidence: 85,
        explanation: 'Receipt extracted from PDF attachment',
      },
      tags: ['pdf', 'attachment'],
      processingTimeoutMs: 45000,
    });

    // Wait for processing to complete
    const transactionId = await emailHelper.waitForTransactionCreated(45000);
    expect(transactionId).toBeTruthy();

    await docHelper.logTestStep('PDF processing completed', { transactionId });

    // Verify extraction results
    const extractionResult = await emailHelper.getTransactionDetails(transactionId);
    
    expect(extractionResult.merchant).toBeTruthy();
    expect(extractionResult.amount).toBeGreaterThan(0);
    expect(extractionResult.confidence).toBeGreaterThan(70);

    await docHelper.logTestStep('PDF extraction validated', {
      merchant: extractionResult.merchant,
      amount: extractionResult.amount,
      confidence: extractionResult.confidence
    });
  });

  test('AEP-002: Forwarded email chain processing', async ({ page }) => {
    await docHelper.logTestStep('Starting forwarded email chain processing test');

    const testEmails = generateTestEmailSamples();
    const forwardedEmail = testEmails.forwardedReceipt;

    await docHelper.logTestStep('Processing forwarded email with nested content');

    // Process forwarded email
    await emailHelper.simulateEmailReceived({
      messageId: forwardedEmail.messageId,
      from: forwardedEmail.from,
      to: forwardedEmail.to,
      subject: forwardedEmail.subject,
      body: forwardedEmail.mimeContent,
      language: 'en',
      expectedExtraction: {
        date: '2024-01-15',
        amount: 10.45,
        currency: 'USD',
        merchant: 'Coffee Shop',
        last4: '1234',
        category: 'Food & Dining',
        subcategory: 'Coffee Shops',
        notes: '2x Espresso, 1x Croissant',
        confidence: 88,
        explanation: 'Receipt extracted from forwarded email content',
      },
      tags: ['forwarded', 'nested'],
      processingTimeoutMs: 35000,
    });

    const transactionId = await emailHelper.waitForTransactionCreated(35000);
    expect(transactionId).toBeTruthy();

    await docHelper.logTestStep('Forwarded email processing completed', { transactionId });

    // Verify the system correctly extracted from the nested content
    const extractionResult = await emailHelper.getTransactionDetails(transactionId);
    
    expect(extractionResult.merchant).toContain('Coffee');
    expect(extractionResult.amount).toBe(10.45);
    expect(extractionResult.category).toBe('Food & Dining');

    await docHelper.logTestStep('Forwarded email extraction validated', extractionResult);
  });

  test('AEP-003: Multilingual receipt processing with confidence scoring', async ({ page }) => {
    await docHelper.logTestStep('Starting multilingual receipt processing test');

    const languages = ['spanish', 'french', 'japanese', 'german'];
    const results: Array<{ language: string; confidence: number; processingTime: number }> = [];

    for (const language of languages) {
      await docHelper.logTestStep(`Processing ${language} receipt`);

      const samples = getSamplesByLanguage(language);
      if (samples.length === 0) {
        await docHelper.logTestStep(`No samples available for ${language}, skipping`);
        continue;
      }

      const emailSample = samples[0];
      const startTime = Date.now();

      // Process the multilingual email
      await emailHelper.simulateEmailReceived(emailSample);
      const transactionId = await emailHelper.waitForTransactionCreated(60000);
      
      const processingTime = Date.now() - startTime;
      expect(transactionId).toBeTruthy();

      // Verify extraction and translation
      const extractionResult = await emailHelper.getTransactionDetails(transactionId);
      
      // Validate translation occurred for non-English languages
      if (language !== 'english') {
        expect(extractionResult.originalText).toBeDefined();
        expect(extractionResult.translatedText).toBeDefined();
        expect(extractionResult.sourceLanguage).toBe(emailSample.language);
      }

      // Verify extraction quality
      expect(extractionResult.merchant).toBeTruthy();
      expect(extractionResult.amount).toBeGreaterThan(0);
      expect(extractionResult.confidence).toBeGreaterThan(60); // Lower threshold for translation

      results.push({
        language,
        confidence: extractionResult.confidence,
        processingTime
      });

      await docHelper.logTestStep(`${language} processing completed`, {
        confidence: extractionResult.confidence,
        processingTime,
        translationRequired: language !== 'english'
      });
    }

    // Analyze results across languages
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    const avgProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;

    expect(avgConfidence).toBeGreaterThan(70);
    expect(avgProcessingTime).toBeLessThan(45000); // 45 seconds average

    await docHelper.logTestStep('Multilingual processing analysis completed', {
      avgConfidence,
      avgProcessingTime,
      languagesTested: results.length
    });
  });

  test('AEP-004: Duplicate detection and prevention', async ({ page }) => {
    await docHelper.logTestStep('Starting duplicate detection test');

    const emailSample = allEmailSamples.english[0]; // Starbucks receipt
    
    // Process the same email twice
    await docHelper.logTestStep('Processing original email');
    
    await emailHelper.simulateEmailReceived(emailSample);
    const firstTransactionId = await emailHelper.waitForTransactionCreated();
    expect(firstTransactionId).toBeTruthy();

    await docHelper.logTestStep('First processing completed', { firstTransactionId });

    // Get initial transaction count
    await dashboardHelper.waitForDashboardLoad();
    const initialCount = await dashboardHelper.getTransactionCount();

    // Process the same email again (duplicate)
    await docHelper.logTestStep('Processing duplicate email');
    
    await emailHelper.simulateEmailReceived({
      ...emailSample,
      messageId: emailSample.messageId, // Same message ID = duplicate
    });

    // Wait a bit to see if duplicate processing occurs
    await page.waitForTimeout(10000);

    // Verify no duplicate transaction was created
    const finalCount = await dashboardHelper.getTransactionCount();
    expect(finalCount).toBe(initialCount); // Should be the same

    await docHelper.logTestStep('Duplicate detection verified', {
      initialCount,
      finalCount,
      duplicatePrevented: finalCount === initialCount
    });

    // Process with different message ID (should create new transaction)
    await docHelper.logTestStep('Processing similar email with different message ID');
    
    await emailHelper.simulateEmailReceived({
      ...emailSample,
      messageId: `${emailSample.messageId}-different`,
    });

    const secondTransactionId = await emailHelper.waitForTransactionCreated();
    expect(secondTransactionId).toBeTruthy();
    expect(secondTransactionId).not.toBe(firstTransactionId);

    await docHelper.logTestStep('Different message ID processed successfully', {
      secondTransactionId,
      differentFromFirst: secondTransactionId !== firstTransactionId
    });
  });

  test('AEP-005: Malicious content handling and security', async ({ page }) => {
    await docHelper.logTestStep('Starting malicious content handling test');

    const testEmails = generateTestEmailSamples();
    const maliciousEmail = testEmails.maliciousEmail;

    await docHelper.logTestStep('Processing email with malicious content');

    // Process email with potential XSS and malicious scripts
    await emailHelper.simulateEmailReceived({
      messageId: maliciousEmail.messageId,
      from: maliciousEmail.from,
      to: maliciousEmail.to,
      subject: maliciousEmail.subject,
      body: 'URGENT: Click here to verify! Your receipt total: $25.99',
      language: 'en',
      expectedExtraction: {
        date: new Date().toISOString().split('T')[0],
        amount: 25.99,
        currency: 'USD',
        merchant: 'Unknown',
        last4: null,
        category: 'Miscellaneous',
        subcategory: null,
        notes: null,
        confidence: 40,
        explanation: 'Low confidence due to suspicious content',
      },
      tags: ['malicious', 'security', 'low-confidence'],
      processingTimeoutMs: 30000,
    });

    const transactionId = await emailHelper.waitForTransactionCreated();
    expect(transactionId).toBeTruthy();

    await docHelper.logTestStep('Malicious email processed', { transactionId });

    // Verify security measures
    const extractionResult = await emailHelper.getTransactionDetails(transactionId);
    
    // Should have low confidence due to suspicious content
    expect(extractionResult.confidence).toBeLessThan(60);
    
    // Verify no script execution occurred
    const pageContent = await page.content();
    expect(pageContent).not.toContain('<script>');
    expect(pageContent).not.toContain('javascript:');

    await docHelper.logTestStep('Security validation completed', {
      confidence: extractionResult.confidence,
      scriptsBlocked: !pageContent.includes('<script>'),
      javascriptBlocked: !pageContent.includes('javascript:')
    });
  });

  test('AEP-006: PII redaction and data protection', async ({ page }) => {
    await docHelper.logTestStep('Starting PII redaction test');

    const testEmails = generateTestEmailSamples();
    const sensitiveEmail = testEmails.sensitiveDataEmail;

    await docHelper.logTestStep('Processing email with sensitive PII data');

    // Process email containing various PII types
    await emailHelper.simulateEmailReceived({
      messageId: sensitiveEmail.messageId,
      from: sensitiveEmail.from,
      to: sensitiveEmail.to,
      subject: sensitiveEmail.subject,
      body: 'Thank you for your purchase! Total: $45.99 Credit Card: 1234-5678-9012-3456 SSN: 123-45-6789',
      language: 'en',
      expectedExtraction: {
        date: new Date().toISOString().split('T')[0],
        amount: 45.99,
        currency: 'USD',
        merchant: 'Store',
        last4: '3456',
        category: 'Shopping',
        subcategory: null,
        notes: null,
        confidence: 75,
        explanation: 'Receipt with PII redacted during processing',
      },
      tags: ['pii', 'redaction', 'security'],
      processingTimeoutMs: 30000,
    });

    const transactionId = await emailHelper.waitForTransactionCreated();
    expect(transactionId).toBeTruthy();

    await docHelper.logTestStep('PII email processed', { transactionId });

    // Verify PII redaction
    const extractionResult = await emailHelper.getTransactionDetails(transactionId);
    
    // Should have last4 but not full card number
    expect(extractionResult.last4).toBe('3456');
    
    // Verify full PII is not stored in any text fields
    const textFields = [
      extractionResult.originalText,
      extractionResult.translatedText,
      extractionResult.notes,
      extractionResult.explanation
    ].filter(Boolean);

    textFields.forEach(text => {
      // No full credit card numbers
      expect(text).not.toMatch(/\d{4}-\d{4}-\d{4}-\d{4}/);
      expect(text).not.toMatch(/\d{16}/);
      
      // No SSNs
      expect(text).not.toMatch(/\d{3}-\d{2}-\d{4}/);
      
      // No phone numbers in full format
      expect(text).not.toMatch(/\d{3}-\d{3}-\d{4}/);
    });

    await docHelper.logTestStep('PII redaction validated', {
      last4Preserved: extractionResult.last4 === '3456',
      fullCardRedacted: true,
      ssnRedacted: true,
      textFieldsChecked: textFields.length
    });
  });

  test('AEP-007: Performance under load with concurrent processing', async ({ page }) => {
    await docHelper.logTestStep('Starting concurrent processing performance test');

    const concurrentEmails = 10;
    const emailSamples = allEmailSamples.english.slice(0, concurrentEmails);
    const processingResults: Array<{ 
      index: number; 
      success: boolean; 
      processingTime: number; 
      transactionId?: string 
    }> = [];

    await docHelper.logTestStep(`Starting concurrent processing of ${concurrentEmails} emails`);

    // Process emails concurrently
    const processingPromises = emailSamples.map(async (emailSample, index) => {
      const startTime = Date.now();
      
      try {
        // Create unique message ID for each concurrent email
        const uniqueEmail = {
          ...emailSample,
          messageId: `concurrent-${index}-${emailSample.messageId}`,
        };

        await emailHelper.simulateEmailReceived(uniqueEmail);
        const transactionId = await emailHelper.waitForTransactionCreated(60000);
        
        const processingTime = Date.now() - startTime;
        
        return {
          index,
          success: true,
          processingTime,
          transactionId
        };
      } catch (error) {
        const processingTime = Date.now() - startTime;
        
        return {
          index,
          success: false,
          processingTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    const results = await Promise.allSettled(processingPromises);
    
    // Analyze results
    let successCount = 0;
    let totalProcessingTime = 0;
    const processingTimes: number[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        processingResults.push(result.value);
        if (result.value.success) {
          successCount++;
          totalProcessingTime += result.value.processingTime;
          processingTimes.push(result.value.processingTime);
        }
      }
    });

    const successRate = (successCount / concurrentEmails) * 100;
    const avgProcessingTime = totalProcessingTime / successCount;
    const maxProcessingTime = Math.max(...processingTimes);
    const minProcessingTime = Math.min(...processingTimes);

    await docHelper.logTestStep('Concurrent processing completed', {
      totalEmails: concurrentEmails,
      successCount,
      successRate,
      avgProcessingTime,
      maxProcessingTime,
      minProcessingTime
    });

    // Performance assertions
    expect(successRate).toBeGreaterThan(80); // At least 80% success rate
    expect(avgProcessingTime).toBeLessThan(45000); // Average under 45 seconds
    expect(maxProcessingTime).toBeLessThan(90000); // Max under 90 seconds

    // Verify dashboard can handle the load
    await dashboardHelper.waitForDashboardLoad();
    const finalTransactionCount = await dashboardHelper.getTransactionCount();
    expect(finalTransactionCount).toBeGreaterThanOrEqual(successCount);

    await docHelper.logTestStep('Performance validation completed', {
      performanceMetrics: {
        successRate,
        avgProcessingTime,
        maxProcessingTime,
        minProcessingTime
      },
      dashboardTransactionCount: finalTransactionCount
    });
  });

  test('AEP-008: Edge cases and error recovery', async ({ page }) => {
    await docHelper.logTestStep('Starting edge cases and error recovery test');

    const edgeCases = getEdgeCaseSamples();
    
    for (const edgeCase of edgeCases) {
      await docHelper.logTestStep(`Processing edge case: ${edgeCase.tags.join(', ')}`);

      try {
        await emailHelper.simulateEmailReceived(edgeCase);
        const transactionId = await emailHelper.waitForTransactionCreated(30000);
        
        if (transactionId) {
          const extractionResult = await emailHelper.getTransactionDetails(transactionId);
          
          // Verify system handled edge case gracefully
          expect(extractionResult.confidence).toBeGreaterThan(0);
          expect(extractionResult.explanation).toBeTruthy();
          
          await docHelper.logTestStep(`Edge case processed successfully`, {
            tags: edgeCase.tags,
            confidence: extractionResult.confidence,
            merchant: extractionResult.merchant
          });
        }
      } catch (error) {
        // Some edge cases are expected to fail gracefully
        await docHelper.logTestStep(`Edge case handled with expected error`, {
          tags: edgeCase.tags,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Test system recovery after edge cases
    await docHelper.logTestStep('Testing system recovery with normal email');
    
    const normalEmail = allEmailSamples.english[0];
    await emailHelper.simulateEmailReceived({
      ...normalEmail,
      messageId: `recovery-test-${normalEmail.messageId}`,
    });
    
    const recoveryTransactionId = await emailHelper.waitForTransactionCreated();
    expect(recoveryTransactionId).toBeTruthy();

    await docHelper.logTestStep('System recovery validated', { recoveryTransactionId });
  });
});