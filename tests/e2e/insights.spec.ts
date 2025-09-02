/**
 * Insights and Analytics Tests
 * 
 * Tests the AI-powered insights system, natural language queries,
 * dashboard analytics, and spending pattern analysis
 */

import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/enhanced-test-helpers';
import { englishReceipts, spanishReceipts } from '../fixtures/email-samples';
import { testUsers } from '../fixtures/test-organizations';

test.describe('Insights and Analytics @insights @analytics', () => {
  let authHelper: TestHelpers.AuthHelper;
  let dashboardHelper: TestHelpers.DashboardHelper;
  let mcpHelper: TestHelpers.MCPHelper;
  let docHelper: TestHelpers.TestDocumentationHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new TestHelpers.AuthHelper(page);
    dashboardHelper = new TestHelpers.DashboardHelper(page);
    mcpHelper = new TestHelpers.MCPHelper(page);
    docHelper = new TestHelpers.TestDocumentationHelper(page);

    await authHelper.signInWithTestUser(
      testUsers.orgAOwner.email,
      testUsers.orgAOwner.password
    );
  });

  test('should generate accurate spending insights @smoke', async ({ page }) => {
    await docHelper.logTestStep('Starting spending insights test');

    // Create test data by processing multiple receipts
    const testEmails = [
      englishReceipts[0], // Starbucks - $9.45
      englishReceipts[1], // Amazon - $100.42
      englishReceipts[2], // Shell - $43.13
    ];

    const processedTransactions = [];
    for (const email of testEmails) {
      const result = await mcpHelper.simulateEmailProcessing(email);
      expect(result.success).toBe(true);
      processedTransactions.push(result.transactionId);
    }

    await docHelper.logTestStep('Test data created', {
      transactionCount: processedTransactions.length,
      totalExpected: testEmails.reduce((sum, email) => sum + email.expectedExtraction.amount, 0),
    });

    // Navigate to insights dashboard
    await page.goto('/dashboard/insights');
    await page.waitForSelector('[data-testid="insights-dashboard"]');

    // Test basic spending summary
    const totalSpent = await page.textContent('[data-testid="total-spent"]');
    const transactionCount = await page.textContent('[data-testid="transaction-count"]');
    const avgTransaction = await page.textContent('[data-testid="avg-transaction"]');

    expect(totalSpent).toContain('153.00'); // $9.45 + $100.42 + $43.13
    expect(transactionCount).toContain('3');
    expect(avgTransaction).toContain('51.00'); // $153 / 3

    await docHelper.logTestStep('Basic insights validated', {
      totalSpent,
      transactionCount,
      avgTransaction,
    });
  });

  test('should provide category breakdown insights @regression', async ({ page }) => {
    await docHelper.logTestStep('Starting category breakdown insights test');

    // Process receipts from different categories
    const categoryEmails = [
      englishReceipts[0], // Food & Dining - $9.45
      englishReceipts[1], // Shopping - $100.42
      englishReceipts[2], // Transportation - $43.13
    ];

    for (const email of categoryEmails) {
      const result = await mcpHelper.simulateEmailProcessing(email);
      expect(result.success).toBe(true);
    }

    await dashboardHelper.navigateToAnalytics();
    const categoryBreakdown = await dashboardHelper.getCategoryBreakdown();

    // Verify category breakdown
    expect(categoryBreakdown).toHaveLength(3);
    
    const foodDining = categoryBreakdown.find(cat => cat.category === 'Food & Dining');
    const shopping = categoryBreakdown.find(cat => cat.category === 'Shopping');
    const transportation = categoryBreakdown.find(cat => cat.category === 'Transportation');

    expect(foodDining?.amount).toBeCloseTo(9.45, 2);
    expect(shopping?.amount).toBeCloseTo(100.42, 2);
    expect(transportation?.amount).toBeCloseTo(43.13, 2);

    await docHelper.logTestStep('Category breakdown validated', {
      categories: categoryBreakdown.map(cat => ({
        category: cat.category,
        amount: cat.amount,
        percentage: cat.percentage,
      })),
    });
  });

  test('should handle natural language insights queries @ai', async ({ page }) => {
    await docHelper.logTestStep('Starting natural language insights test');

    // Create diverse test data
    const testEmails = [
      englishReceipts[0], // Starbucks
      englishReceipts[1], // Amazon
      englishReceipts[2], // Shell
      spanishReceipts[0], // Spanish restaurant
    ];

    for (const email of testEmails) {
      const result = await mcpHelper.simulateEmailProcessing(email);
      expect(result.success).toBe(true);
    }

    await page.goto('/dashboard/insights');
    await page.waitForSelector('[data-testid="insights-query-interface"]');

    // Test various natural language queries
    const queries = [
      {
        query: "How much did I spend on food this month?",
        expectedResponse: /food.*dining/i,
        expectedAmount: true,
      },
      {
        query: "What's my biggest expense category?",
        expectedResponse: /shopping|highest|biggest/i,
        expectedAmount: false,
      },
      {
        query: "How many transactions do I have?",
        expectedResponse: /4|four/i,
        expectedAmount: false,
      },
      {
        query: "Show me my spending trend",
        expectedResponse: /trend|pattern|over time/i,
        expectedAmount: false,
      },
    ];

    for (const testQuery of queries) {
      await docHelper.logTestStep(`Testing query: "${testQuery.query}"`);

      // Enter query
      await page.fill('[data-testid="insights-query-input"]', testQuery.query);
      await page.click('[data-testid="submit-query-btn"]');

      // Wait for response
      await page.waitForSelector('[data-testid="insights-response"]', { timeout: 15000 });
      
      const response = await page.textContent('[data-testid="insights-response"]');
      expect(response).toMatch(testQuery.expectedResponse);

      if (testQuery.expectedAmount) {
        expect(response).toMatch(/\$[\d,]+\.?\d*/);
      }

      await docHelper.logTestStep('Query response validated', {
        query: testQuery.query,
        response: response?.substring(0, 100) + '...',
      });

      // Clear for next query
      await page.fill('[data-testid="insights-query-input"]', '');
    }
  });

  test('should provide spending trend analysis @analytics', async ({ page }) => {
    await docHelper.logTestStep('Starting spending trend analysis test');

    // Create transactions across different dates
    const trendEmails = englishReceipts.slice(0, 3).map((email, index) => ({
      ...email,
      messageId: `trend-test-${index}`,
      // Simulate different dates
      body: email.body.replace(/January \d+, 2024/, `January ${15 + index}, 2024`),
    }));

    for (const email of trendEmails) {
      const result = await mcpHelper.simulateEmailProcessing(email);
      expect(result.success).toBe(true);
    }

    await dashboardHelper.navigateToAnalytics();
    const spendingTrend = await dashboardHelper.getSpendingTrend();

    // Verify trend data
    expect(spendingTrend.length).toBeGreaterThan(0);
    
    // Check that dates are properly formatted
    spendingTrend.forEach(point => {
      expect(point.date).toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(point.amount).toBeGreaterThan(0);
    });

    await docHelper.logTestStep('Spending trend validated', {
      trendPoints: spendingTrend.length,
      dateRange: {
        start: spendingTrend[0]?.date,
        end: spendingTrend[spendingTrend.length - 1]?.date,
      },
    });
  });

  test('should provide merchant insights @merchant-analysis', async ({ page }) => {
    await docHelper.logTestStep('Starting merchant insights test');

    // Process multiple transactions from same merchant
    const starbucksEmails = [
      englishReceipts[0],
      {
        ...englishReceipts[0],
        messageId: 'starbucks-2',
        body: englishReceipts[0].body.replace('$9.45', '$12.75'),
        expectedExtraction: {
          ...englishReceipts[0].expectedExtraction,
          amount: 12.75,
        },
      },
      {
        ...englishReceipts[0],
        messageId: 'starbucks-3',
        body: englishReceipts[0].body.replace('$9.45', '$8.25'),
        expectedExtraction: {
          ...englishReceipts[0].expectedExtraction,
          amount: 8.25,
        },
      },
    ];

    for (const email of starbucksEmails) {
      const result = await mcpHelper.simulateEmailProcessing(email);
      expect(result.success).toBe(true);
    }

    await page.goto('/dashboard/insights');
    await page.waitForSelector('[data-testid="insights-dashboard"]');

    // Query for merchant-specific insights
    await page.fill('[data-testid="insights-query-input"]', 'How much do I spend at Starbucks?');
    await page.click('[data-testid="submit-query-btn"]');
    await page.waitForSelector('[data-testid="insights-response"]');

    const merchantResponse = await page.textContent('[data-testid="insights-response"]');
    expect(merchantResponse).toMatch(/starbucks/i);
    expect(merchantResponse).toMatch(/\$30\.45/); // $9.45 + $12.75 + $8.25

    await docHelper.logTestStep('Merchant insights validated', {
      merchant: 'Starbucks',
      totalSpent: '$30.45',
      transactionCount: 3,
    });

    // Test merchant frequency insights
    await page.fill('[data-testid="insights-query-input"]', 'Which merchant do I visit most?');
    await page.click('[data-testid="submit-query-btn"]');
    await page.waitForSelector('[data-testid="insights-response"]');

    const frequencyResponse = await page.textContent('[data-testid="insights-response"]');
    expect(frequencyResponse).toMatch(/starbucks/i);
    expect(frequencyResponse).toMatch(/3|three/i);

    await docHelper.logTestStep('Merchant frequency insights validated');
  });

  test('should provide budget and goal insights @budgeting', async ({ page }) => {
    await docHelper.logTestStep('Starting budget insights test');

    // Set up budget goals
    await page.goto('/settings/budget');
    await page.waitForSelector('[data-testid="budget-settings"]');

    // Set monthly budget
    await page.fill('[data-testid="monthly-budget-input"]', '500');
    await page.selectOption('[data-testid="budget-category"]', 'Food & Dining');
    await page.fill('[data-testid="category-budget-input"]', '100');
    await page.click('[data-testid="save-budget-btn"]');
    await page.waitForSelector('[data-testid="budget-saved"]');

    // Create spending data
    const budgetEmails = [
      englishReceipts[0], // Food & Dining - $9.45
      {
        ...englishReceipts[0],
        messageId: 'food-2',
        body: englishReceipts[0].body.replace('$9.45', '$45.50'),
        expectedExtraction: {
          ...englishReceipts[0].expectedExtraction,
          amount: 45.50,
        },
      },
    ];

    for (const email of budgetEmails) {
      const result = await mcpHelper.simulateEmailProcessing(email);
      expect(result.success).toBe(true);
    }

    await page.goto('/dashboard/insights');
    await page.waitForSelector('[data-testid="insights-dashboard"]');

    // Query budget status
    await page.fill('[data-testid="insights-query-input"]', 'How am I doing with my Food & Dining budget?');
    await page.click('[data-testid="submit-query-btn"]');
    await page.waitForSelector('[data-testid="insights-response"]');

    const budgetResponse = await page.textContent('[data-testid="insights-response"]');
    expect(budgetResponse).toMatch(/food.*dining/i);
    expect(budgetResponse).toMatch(/\$54\.95/); // $9.45 + $45.50
    expect(budgetResponse).toMatch(/\$100/); // Budget amount
    expect(budgetResponse).toMatch(/54\.95%|55%/); // Percentage used

    await docHelper.logTestStep('Budget insights validated', {
      categorySpent: '$54.95',
      categoryBudget: '$100',
      percentageUsed: '54.95%',
    });
  });

  test('should provide comparative insights @comparison', async ({ page }) => {
    await docHelper.logTestStep('Starting comparative insights test');

    // Create data for comparison (simulate previous month data)
    const currentMonthEmails = englishReceipts.slice(0, 2);
    for (const email of currentMonthEmails) {
      const result = await mcpHelper.simulateEmailProcessing(email);
      expect(result.success).toBe(true);
    }

    await page.goto('/dashboard/insights');
    await page.waitForSelector('[data-testid="insights-dashboard"]');

    // Test month-over-month comparison
    await page.fill('[data-testid="insights-query-input"]', 'How does this month compare to last month?');
    await page.click('[data-testid="submit-query-btn"]');
    await page.waitForSelector('[data-testid="insights-response"]');

    const comparisonResponse = await page.textContent('[data-testid="insights-response"]');
    expect(comparisonResponse).toMatch(/month|compare|previous/i);

    await docHelper.logTestStep('Comparative insights validated');

    // Test category comparison
    await page.fill('[data-testid="insights-query-input"]', 'Which category increased the most?');
    await page.click('[data-testid="submit-query-btn"]');
    await page.waitForSelector('[data-testid="insights-response"]');

    const categoryComparisonResponse = await page.textContent('[data-testid="insights-response"]');
    expect(categoryComparisonResponse).toMatch(/category|increased|most/i);

    await docHelper.logTestStep('Category comparison insights validated');
  });

  test('should handle insights security and privacy @security', async ({ page }) => {
    await docHelper.logTestStep('Starting insights security test');

    await page.goto('/dashboard/insights');
    await page.waitForSelector('[data-testid="insights-dashboard"]');

    // Test that SQL injection attempts are blocked
    const maliciousQueries = [
      "'; DROP TABLE transactions; --",
      "SELECT * FROM transactions WHERE org_id != 'current'",
      "UNION SELECT * FROM users",
    ];

    for (const maliciousQuery of maliciousQueries) {
      await page.fill('[data-testid="insights-query-input"]', maliciousQuery);
      await page.click('[data-testid="submit-query-btn"]');
      await page.waitForSelector('[data-testid="insights-response"]');

      const response = await page.textContent('[data-testid="insights-response"]');
      
      // Should not execute SQL or return sensitive data
      expect(response).not.toMatch(/error|sql|table|select/i);
      expect(response).toMatch(/sorry|understand|help|try/i);

      await page.fill('[data-testid="insights-query-input"]', '');
    }

    await docHelper.logTestStep('SQL injection protection validated');

    // Test that insights only show current user's data
    await page.fill('[data-testid="insights-query-input"]', 'Show me all transactions');
    await page.click('[data-testid="submit-query-btn"]');
    await page.waitForSelector('[data-testid="insights-response"]');

    const allTransactionsResponse = await page.textContent('[data-testid="insights-response"]');
    
    // Should only reference current user's data
    expect(allTransactionsResponse).not.toMatch(/other users|all organizations/i);

    await docHelper.logTestStep('Data isolation in insights validated');
  });

  test.afterEach(async ({ page }) => {
    // Clean up MCP connections
    await mcpHelper.cleanup();
    
    // Take screenshot for documentation
    await docHelper.takeScreenshot('insights-test-final');
    
    // Log test completion
    const testSteps = docHelper.getTestSteps();
    await docHelper.logTestStep('Insights test completed', {
      totalSteps: testSteps.length,
    });
  });
});