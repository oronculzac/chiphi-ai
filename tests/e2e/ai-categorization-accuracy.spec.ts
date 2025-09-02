/**
 * AI Categorization Accuracy Tests
 * 
 * Tests the accuracy of AI-powered receipt extraction and categorization,
 * validates confidence scoring, and ensures proper handling of edge cases
 */

import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/enhanced-test-helpers';
import { 
  englishReceipts, 
  spanishReceipts, 
  frenchReceipts, 
  japaneseReceipts,
  germanReceipts,
  edgeCaseReceipts 
} from '../fixtures/email-samples';
import { testUsers } from '../fixtures/test-organizations';
import { createTestAssertion } from '@/lib/types/test-schemas';

test.describe('AI Categorization Accuracy @accuracy @ai', () => {
  let authHelper: TestHelpers.AuthHelper;
  let emailHelper: TestHelpers.EmailProcessingHelper;
  let mcpHelper: TestHelpers.MCPHelper;
  let docHelper: TestHelpers.TestDocumentationHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new TestHelpers.AuthHelper(page);
    emailHelper = new TestHelpers.EmailProcessingHelper(page);
    mcpHelper = new TestHelpers.MCPHelper(page);
    docHelper = new TestHelpers.TestDocumentationHelper(page);

    await authHelper.signInWithTestUser(
      testUsers.orgAOwner.email,
      testUsers.orgAOwner.password
    );
  });

  test('should accurately categorize common merchant types @smoke', async ({ page }) => {
    await docHelper.logTestStep('Starting merchant categorization accuracy test');

    const testCases = [
      {
        email: englishReceipts[0], // Starbucks
        expectedCategory: 'Food & Dining',
        expectedSubcategory: 'Coffee Shops',
        minConfidence: 90,
      },
      {
        email: englishReceipts[1], // Amazon
        expectedCategory: 'Shopping',
        expectedSubcategory: 'Electronics',
        minConfidence: 85,
      },
      {
        email: englishReceipts[2], // Shell Gas Station
        expectedCategory: 'Transportation',
        expectedSubcategory: 'Gas Stations',
        minConfidence: 90,
      },
    ];

    for (const testCase of testCases) {
      await docHelper.logTestStep(`Testing ${testCase.email.expectedExtraction.merchant}`, {
        expectedCategory: testCase.expectedCategory,
        expectedSubcategory: testCase.expectedSubcategory,
      });

      // Process email
      const result = await mcpHelper.simulateEmailProcessing(testCase.email);
      expect(result.success).toBe(true);

      // Get transaction details
      const transactionDetails = await emailHelper.getTransactionDetails(result.transactionId!);

      // Validate categorization accuracy
      const categoryAssertion = createTestAssertion(
        'equals',
        'category',
        testCase.expectedCategory,
        transactionDetails.category
      );
      expect(categoryAssertion.passed).toBe(true);

      if (testCase.expectedSubcategory) {
        const subcategoryAssertion = createTestAssertion(
          'equals',
          'subcategory',
          testCase.expectedSubcategory,
          transactionDetails.subcategory
        );
        expect(subcategoryAssertion.passed).toBe(true);
      }

      // Validate confidence score
      const confidenceAssertion = createTestAssertion(
        'greaterThan',
        'confidence',
        testCase.minConfidence,
        transactionDetails.confidence
      );
      expect(confidenceAssertion.passed).toBe(true);

      // Validate explanation exists
      expect(transactionDetails.explanation).toBeTruthy();
      expect(transactionDetails.explanation.length).toBeGreaterThan(10);

      await docHelper.logTestStep(`${testCase.email.expectedExtraction.merchant} categorized correctly`, {
        actualCategory: transactionDetails.category,
        actualSubcategory: transactionDetails.subcategory,
        confidence: transactionDetails.confidence,
      });
    }
  });

  test('should handle multilingual receipts with translation @translation', async ({ page }) => {
    await docHelper.logTestStep('Starting multilingual categorization test');

    const multilingualTests = [
      {
        email: spanishReceipts[0], // Spanish restaurant
        language: 'Spanish',
        expectedCategory: 'Food & Dining',
        expectedSubcategory: 'Restaurants',
      },
      {
        email: frenchReceipts[0], // French pharmacy
        language: 'French',
        expectedCategory: 'Healthcare',
        expectedSubcategory: 'Pharmacy',
      },
      {
        email: japaneseReceipts[0], // Japanese convenience store
        language: 'Japanese',
        expectedCategory: 'Food & Dining',
        expectedSubcategory: 'Convenience Stores',
      },
      {
        email: germanReceipts[0], // German supermarket
        language: 'German',
        expectedCategory: 'Groceries',
        expectedSubcategory: 'Supermarkets',
      },
    ];

    for (const testCase of multilingualTests) {
      await docHelper.logTestStep(`Testing ${testCase.language} receipt`, {
        merchant: testCase.email.expectedExtraction.merchant,
        expectedCategory: testCase.expectedCategory,
      });

      // Process multilingual email
      const result = await mcpHelper.simulateEmailProcessing(testCase.email);
      expect(result.success).toBe(true);

      // Get transaction details
      const transactionDetails = await emailHelper.getTransactionDetails(result.transactionId!);

      // Validate translation occurred
      expect(transactionDetails.originalText).toBeTruthy();
      expect(transactionDetails.translatedText).toBeTruthy();
      expect(transactionDetails.sourceLanguage).toBeTruthy();

      // Validate categorization despite language barrier
      expect(transactionDetails.category).toBe(testCase.expectedCategory);
      if (testCase.expectedSubcategory) {
        expect(transactionDetails.subcategory).toBe(testCase.expectedSubcategory);
      }

      // Confidence should still be reasonable despite translation
      expect(transactionDetails.confidence).toBeGreaterThan(70);

      await docHelper.logTestStep(`${testCase.language} receipt processed successfully`, {
        sourceLanguage: transactionDetails.sourceLanguage,
        category: transactionDetails.category,
        confidence: transactionDetails.confidence,
        translationDetected: !!transactionDetails.translatedText,
      });
    }
  });

  test('should provide accurate amount extraction @regression', async ({ page }) => {
    await docHelper.logTestStep('Starting amount extraction accuracy test');

    const amountTests = [
      {
        email: englishReceipts[0], // $9.45
        expectedAmount: 9.45,
        expectedCurrency: 'USD',
      },
      {
        email: spanishReceipts[0], // €53.85
        expectedAmount: 53.85,
        expectedCurrency: 'EUR',
      },
      {
        email: japaneseReceipts[0], // ¥561
        expectedAmount: 561,
        expectedCurrency: 'JPY',
      },
    ];

    for (const testCase of amountTests) {
      await docHelper.logTestStep(`Testing amount extraction for ${testCase.expectedCurrency}`, {
        expectedAmount: testCase.expectedAmount,
        expectedCurrency: testCase.expectedCurrency,
      });

      const result = await mcpHelper.simulateEmailProcessing(testCase.email);
      expect(result.success).toBe(true);

      const transactionDetails = await emailHelper.getTransactionDetails(result.transactionId!);

      // Validate amount accuracy (within 1 cent/unit)
      const amountAssertion = createTestAssertion(
        'equals',
        'amount',
        testCase.expectedAmount,
        transactionDetails.amount,
        0.01
      );
      expect(amountAssertion.passed).toBe(true);

      // Validate currency
      expect(transactionDetails.currency).toBe(testCase.expectedCurrency);

      await docHelper.logTestStep('Amount extraction validated', {
        extractedAmount: transactionDetails.amount,
        extractedCurrency: transactionDetails.currency,
      });
    }
  });

  test('should handle edge cases with appropriate confidence @edge-case', async ({ page }) => {
    await docHelper.logTestStep('Starting edge case handling test');

    const edgeCaseTests = [
      {
        email: edgeCaseReceipts[0], // Malformed receipt
        expectedLowConfidence: true,
        maxConfidence: 50,
        description: 'Malformed receipt',
      },
      {
        email: edgeCaseReceipts[2], // Mixed language
        expectedLowConfidence: false,
        minConfidence: 60,
        description: 'Mixed language receipt',
      },
    ];

    for (const testCase of edgeCaseTests) {
      await docHelper.logTestStep(`Testing ${testCase.description}`, {
        expectedLowConfidence: testCase.expectedLowConfidence,
      });

      const result = await mcpHelper.simulateEmailProcessing(testCase.email);
      
      if (result.success) {
        const transactionDetails = await emailHelper.getTransactionDetails(result.transactionId!);

        if (testCase.expectedLowConfidence) {
          expect(transactionDetails.confidence).toBeLessThan(testCase.maxConfidence!);
        } else {
          expect(transactionDetails.confidence).toBeGreaterThan(testCase.minConfidence!);
        }

        // Edge cases should always have explanations
        expect(transactionDetails.explanation).toBeTruthy();
        expect(transactionDetails.explanation.length).toBeGreaterThan(20);

        await docHelper.logTestStep(`${testCase.description} handled appropriately`, {
          confidence: transactionDetails.confidence,
          category: transactionDetails.category,
          explanation: transactionDetails.explanation.substring(0, 100) + '...',
        });
      } else {
        // Some edge cases might fail processing entirely
        expect(result.error).toBeTruthy();
        await docHelper.logTestStep(`${testCase.description} appropriately rejected`, {
          error: result.error,
        });
      }
    }
  });

  test('should provide consistent categorization for similar merchants @consistency', async ({ page }) => {
    await docHelper.logTestStep('Starting categorization consistency test');

    // Test multiple receipts from similar merchant types
    const consistencyTests = [
      {
        merchants: ['Starbucks', 'Dunkin Donuts', 'Local Coffee Shop'],
        expectedCategory: 'Food & Dining',
        expectedSubcategory: 'Coffee Shops',
        description: 'Coffee shops',
      },
      {
        merchants: ['Shell', 'Exxon', 'BP Gas Station'],
        expectedCategory: 'Transportation',
        expectedSubcategory: 'Gas Stations',
        description: 'Gas stations',
      },
    ];

    for (const testGroup of consistencyTests) {
      await docHelper.logTestStep(`Testing consistency for ${testGroup.description}`);

      const results = [];

      for (const merchant of testGroup.merchants) {
        // Create a test email for this merchant
        const testEmail = {
          ...englishReceipts[0],
          messageId: `test-${merchant.toLowerCase().replace(/\s+/g, '-')}`,
          body: englishReceipts[0].body.replace('Starbucks', merchant),
          expectedExtraction: {
            ...englishReceipts[0].expectedExtraction,
            merchant: merchant,
          },
        };

        const result = await mcpHelper.simulateEmailProcessing(testEmail);
        expect(result.success).toBe(true);

        const transactionDetails = await emailHelper.getTransactionDetails(result.transactionId!);
        results.push({
          merchant,
          category: transactionDetails.category,
          subcategory: transactionDetails.subcategory,
          confidence: transactionDetails.confidence,
        });
      }

      // Verify consistency across similar merchants
      const categories = results.map(r => r.category);
      const subcategories = results.map(r => r.subcategory);

      // All should have the same category
      expect(new Set(categories).size).toBe(1);
      expect(categories[0]).toBe(testGroup.expectedCategory);

      // Most should have the same subcategory (allowing for some variation)
      const subcategoryMode = subcategories.reduce((a, b, i, arr) =>
        arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
      );
      expect(subcategoryMode).toBe(testGroup.expectedSubcategory);

      await docHelper.logTestStep(`Consistency validated for ${testGroup.description}`, {
        results: results.map(r => ({ merchant: r.merchant, category: r.category, confidence: r.confidence })),
      });
    }
  });

  test('should improve accuracy with merchant learning @learning', async ({ page }) => {
    await docHelper.logTestStep('Starting merchant learning accuracy test');

    // Use a generic merchant name that might be miscategorized initially
    const testMerchant = 'Generic Store 123';
    const testEmail = {
      ...englishReceipts[0],
      messageId: 'test-learning-merchant',
      body: englishReceipts[0].body.replace('Starbucks', testMerchant),
      expectedExtraction: {
        ...englishReceipts[0].expectedExtraction,
        merchant: testMerchant,
      },
    };

    // Process initial email
    const initialResult = await mcpHelper.simulateEmailProcessing(testEmail);
    expect(initialResult.success).toBe(true);

    const initialTransaction = await emailHelper.getTransactionDetails(initialResult.transactionId!);
    const initialConfidence = initialTransaction.confidence;

    await docHelper.logTestStep('Initial processing completed', {
      merchant: testMerchant,
      initialCategory: initialTransaction.category,
      initialConfidence: initialConfidence,
    });

    // Correct the categorization
    await emailHelper.updateTransactionCategory(
      initialResult.transactionId!,
      'Food & Dining',
      'Coffee Shops'
    );

    await docHelper.logTestStep('Category correction applied');

    // Process second email from same merchant
    const secondEmail = {
      ...testEmail,
      messageId: 'test-learning-merchant-2',
      subject: 'Second Receipt from Generic Store 123',
    };

    const secondResult = await mcpHelper.simulateEmailProcessing(secondEmail);
    expect(secondResult.success).toBe(true);

    const secondTransaction = await emailHelper.getTransactionDetails(secondResult.transactionId!);

    // Verify learning occurred
    expect(secondTransaction.category).toBe('Food & Dining');
    expect(secondTransaction.subcategory).toBe('Coffee Shops');
    expect(secondTransaction.confidence).toBeGreaterThan(initialConfidence);

    await docHelper.logTestStep('Merchant learning verified', {
      initialConfidence,
      learnedConfidence: secondTransaction.confidence,
      confidenceImprovement: secondTransaction.confidence - initialConfidence,
      learnedCategory: secondTransaction.category,
    });
  });

  test('should validate PII redaction accuracy @security', async ({ page }) => {
    await docHelper.logTestStep('Starting PII redaction accuracy test');

    const piiEmail = edgeCaseReceipts[1]; // PII-heavy receipt

    const result = await mcpHelper.simulateEmailProcessing(piiEmail);
    expect(result.success).toBe(true);

    const transactionDetails = await emailHelper.getTransactionDetails(result.transactionId!);

    // Navigate to transaction to check displayed content
    await page.goto(`/transactions/${result.transactionId}`);
    await page.waitForSelector('[data-testid="transaction-details"]');

    const displayedContent = await page.textContent('[data-testid="transaction-content"]');

    // Verify PII is redacted in displayed content
    const piiChecks = [
      { type: 'full_credit_card', pattern: /4532-1234-5678-9012/, shouldBePresent: false },
      { type: 'ssn', pattern: /123-45-6789/, shouldBePresent: false },
      { type: 'phone', pattern: /555-123-4567/, shouldBePresent: false },
      { type: 'email', pattern: /john\.doe@email\.com/, shouldBePresent: false },
      { type: 'last4_digits', pattern: /\*\*\*\*9012/, shouldBePresent: true },
    ];

    for (const check of piiChecks) {
      const isPresent = check.pattern.test(displayedContent || '');
      const assertion = createTestAssertion(
        'equals',
        `${check.type}_present`,
        check.shouldBePresent,
        isPresent
      );
      expect(assertion.passed).toBe(true);
    }

    // Verify last4 is properly extracted
    expect(transactionDetails.last4).toBe('9012');

    await docHelper.logTestStep('PII redaction validated', {
      last4Extracted: transactionDetails.last4,
      piiRedacted: true,
    });
  });

  test.afterEach(async ({ page }) => {
    // Clean up MCP connections
    await mcpHelper.cleanup();
    
    // Take screenshot for documentation
    await docHelper.takeScreenshot('ai-accuracy-test-final');
    
    // Log test performance metrics
    const testSteps = docHelper.getTestSteps();
    await docHelper.logTestStep('AI accuracy test completed', {
      totalSteps: testSteps.length,
    });
  });
});