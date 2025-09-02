import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

/**
 * End-to-end tests for dashboard real-time updates
 * Tests Supabase real-time subscriptions and live data updates
 */

test.describe('Dashboard Real-time Updates', () => {
  let testOrgId: string;
  let testUserId: string;

  test.beforeAll(async () => {
    testOrgId = process.env.TEST_ORG_ID!;
    testUserId = process.env.TEST_USER_ID!;
  });

  test('should update dashboard when new transaction is processed', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    await TestHelpers.waitForElement(page, '[data-testid="dashboard"]');

    // Get initial transaction count
    const initialTransactionRows = page.locator('[data-testid="transaction-row"]');
    const initialCount = await initialTransactionRows.count();

    // Get initial month-to-date total
    const mtdTotalElement = page.locator('[data-testid="mtd-total"]');
    const initialMTDText = await mtdTotalElement.textContent();
    const initialMTD = parseFloat(initialMTDText?.replace(/[^0-9.]/g, '') || '0');

    // Simulate new transaction being processed (real-time update)
    const newTransaction = {
      id: 'test-transaction-' + Date.now(),
      org_id: testOrgId,
      date: new Date().toISOString().split('T')[0],
      amount: 25.99,
      currency: 'USD',
      merchant: 'Test Coffee Shop',
      category: 'Food & Dining',
      subcategory: 'Coffee',
      confidence: 92,
      created_at: new Date().toISOString()
    };

    // Simulate real-time update
    await TestHelpers.simulateRealtimeUpdate(page, {
      table: 'transactions',
      eventType: 'INSERT',
      new: newTransaction
    });

    // Wait for UI to update
    await page.waitForTimeout(2000);

    // Verify new transaction appears
    const updatedTransactionRows = page.locator('[data-testid="transaction-row"]');
    const updatedCount = await updatedTransactionRows.count();
    expect(updatedCount).toBe(initialCount + 1);

    // Verify the new transaction is visible
    const newTransactionRow = page.locator(`[data-testid="transaction-${newTransaction.id}"]`);
    await expect(newTransactionRow).toBeVisible();
    await expect(newTransactionRow.locator('[data-testid="merchant"]')).toContainText('Test Coffee Shop');
    await expect(newTransactionRow.locator('[data-testid="amount"]')).toContainText('25.99');

    // Verify month-to-date total updated
    const updatedMTDText = await mtdTotalElement.textContent();
    const updatedMTD = parseFloat(updatedMTDText?.replace(/[^0-9.]/g, '') || '0');
    expect(updatedMTD).toBeCloseTo(initialMTD + 25.99, 2);

    // Take screenshot
    await TestHelpers.takeTimestampedScreenshot(page, 'realtime-transaction-added');
  });

  test('should update category breakdown chart in real-time', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    await TestHelpers.waitForElement(page, '[data-testid="category-breakdown-chart"]');

    // Get initial category breakdown
    const chartElement = page.locator('[data-testid="category-breakdown-chart"]');
    await expect(chartElement).toBeVisible();

    // Check for Food & Dining category
    const foodDiningSegment = page.locator('[data-testid="category-segment-food-dining"]');
    const initialFoodDiningExists = await foodDiningSegment.isVisible().catch(() => false);

    // Simulate new Food & Dining transaction
    const newTransaction = {
      id: 'test-food-transaction-' + Date.now(),
      org_id: testOrgId,
      date: new Date().toISOString().split('T')[0],
      amount: 45.50,
      currency: 'USD',
      merchant: 'Pizza Palace',
      category: 'Food & Dining',
      subcategory: 'Restaurant',
      confidence: 88
    };

    // Simulate real-time update
    await TestHelpers.simulateRealtimeUpdate(page, {
      table: 'transactions',
      eventType: 'INSERT',
      new: newTransaction
    });

    // Wait for chart to update
    await page.waitForTimeout(3000);

    // Verify Food & Dining segment is now visible (or updated)
    await expect(foodDiningSegment).toBeVisible();

    // Verify tooltip shows updated amount when hovering
    await foodDiningSegment.hover();
    const tooltip = page.locator('[data-testid="chart-tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Food & Dining');

    // Take screenshot
    await TestHelpers.takeTimestampedScreenshot(page, 'realtime-category-chart-updated');
  });

  test('should update spending trend chart in real-time', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    await TestHelpers.waitForElement(page, '[data-testid="spending-trend-chart"]');

    // Get today's date for trend update
    const today = new Date().toISOString().split('T')[0];

    // Simulate transaction for today
    const todayTransaction = {
      id: 'test-trend-transaction-' + Date.now(),
      org_id: testOrgId,
      date: today,
      amount: 75.25,
      currency: 'USD',
      merchant: 'Gas Station',
      category: 'Transportation',
      subcategory: 'Fuel',
      confidence: 95
    };

    // Simulate real-time update
    await TestHelpers.simulateRealtimeUpdate(page, {
      table: 'transactions',
      eventType: 'INSERT',
      new: todayTransaction
    });

    // Wait for trend chart to update
    await page.waitForTimeout(3000);

    // Verify trend chart shows today's data point
    const trendChart = page.locator('[data-testid="spending-trend-chart"]');
    await expect(trendChart).toBeVisible();

    // Look for today's data point in the chart
    const todayDataPoint = page.locator(`[data-testid="trend-point-${today}"]`);
    await expect(todayDataPoint).toBeVisible();

    // Take screenshot
    await TestHelpers.takeTimestampedScreenshot(page, 'realtime-trend-chart-updated');
  });

  test('should handle transaction category updates in real-time', async ({ page }) => {
    // First, create a transaction to update
    const transactionId = 'test-update-transaction-' + Date.now();
    const originalTransaction = {
      id: transactionId,
      org_id: testOrgId,
      date: new Date().toISOString().split('T')[0],
      amount: 35.00,
      currency: 'USD',
      merchant: 'Unknown Store',
      category: 'Shopping',
      subcategory: null,
      confidence: 70
    };

    // Navigate to dashboard
    await page.goto('/dashboard');
    await TestHelpers.waitForElement(page, '[data-testid="dashboard"]');

    // Simulate initial transaction
    await TestHelpers.simulateRealtimeUpdate(page, {
      table: 'transactions',
      eventType: 'INSERT',
      new: originalTransaction
    });

    await page.waitForTimeout(2000);

    // Verify initial transaction appears
    const transactionRow = page.locator(`[data-testid="transaction-${transactionId}"]`);
    await expect(transactionRow).toBeVisible();
    await expect(transactionRow.locator('[data-testid="category"]')).toContainText('Shopping');

    // Simulate category correction (user or AI learning)
    const updatedTransaction = {
      ...originalTransaction,
      category: 'Food & Dining',
      subcategory: 'Grocery',
      confidence: 85
    };

    // Simulate real-time update for category change
    await TestHelpers.simulateRealtimeUpdate(page, {
      table: 'transactions',
      eventType: 'UPDATE',
      old: originalTransaction,
      new: updatedTransaction
    });

    await page.waitForTimeout(2000);

    // Verify category updated in the UI
    await expect(transactionRow.locator('[data-testid="category"]')).toContainText('Food & Dining');
    await expect(transactionRow.locator('[data-testid="subcategory"]')).toContainText('Grocery');

    // Verify confidence badge updated
    const confidenceBadge = transactionRow.locator('[data-testid="confidence-badge"]');
    await expect(confidenceBadge).toContainText('85');

    // Take screenshot
    await TestHelpers.takeTimestampedScreenshot(page, 'realtime-category-updated');
  });

  test('should handle multiple simultaneous real-time updates', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    await TestHelpers.waitForElement(page, '[data-testid="dashboard"]');

    // Get initial state
    const initialTransactionRows = page.locator('[data-testid="transaction-row"]');
    const initialCount = await initialTransactionRows.count();

    // Simulate multiple transactions being processed simultaneously
    const transactions = [
      {
        id: 'test-batch-1-' + Date.now(),
        org_id: testOrgId,
        date: new Date().toISOString().split('T')[0],
        amount: 12.50,
        merchant: 'Coffee Shop A',
        category: 'Food & Dining'
      },
      {
        id: 'test-batch-2-' + Date.now(),
        org_id: testOrgId,
        date: new Date().toISOString().split('T')[0],
        amount: 89.99,
        merchant: 'Electronics Store',
        category: 'Shopping'
      },
      {
        id: 'test-batch-3-' + Date.now(),
        org_id: testOrgId,
        date: new Date().toISOString().split('T')[0],
        amount: 25.00,
        merchant: 'Gas Station',
        category: 'Transportation'
      }
    ];

    // Send all updates rapidly
    for (const transaction of transactions) {
      await TestHelpers.simulateRealtimeUpdate(page, {
        table: 'transactions',
        eventType: 'INSERT',
        new: transaction
      });
    }

    // Wait for all updates to process
    await page.waitForTimeout(4000);

    // Verify all transactions appear
    const updatedTransactionRows = page.locator('[data-testid="transaction-row"]');
    const updatedCount = await updatedTransactionRows.count();
    expect(updatedCount).toBe(initialCount + 3);

    // Verify each transaction is visible
    for (const transaction of transactions) {
      const transactionRow = page.locator(`[data-testid="transaction-${transaction.id}"]`);
      await expect(transactionRow).toBeVisible();
      await expect(transactionRow.locator('[data-testid="merchant"]')).toContainText(transaction.merchant);
    }

    // Take screenshot
    await TestHelpers.takeTimestampedScreenshot(page, 'realtime-batch-updates');
  });

  test('should maintain real-time connection across page navigation', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    await TestHelpers.waitForElement(page, '[data-testid="dashboard"]');

    // Navigate to transactions page
    await page.click('[data-testid="nav-transactions"]');
    await TestHelpers.waitForElement(page, '[data-testid="transactions-page"]');

    // Navigate back to dashboard
    await page.click('[data-testid="nav-dashboard"]');
    await TestHelpers.waitForElement(page, '[data-testid="dashboard"]');

    // Simulate new transaction to test connection is still active
    const testTransaction = {
      id: 'test-navigation-' + Date.now(),
      org_id: testOrgId,
      date: new Date().toISOString().split('T')[0],
      amount: 15.75,
      merchant: 'Test Merchant',
      category: 'Shopping'
    };

    await TestHelpers.simulateRealtimeUpdate(page, {
      table: 'transactions',
      eventType: 'INSERT',
      new: testTransaction
    });

    await page.waitForTimeout(2000);

    // Verify transaction appears (connection is still active)
    const transactionRow = page.locator(`[data-testid="transaction-${testTransaction.id}"]`);
    await expect(transactionRow).toBeVisible();

    // Take screenshot
    await TestHelpers.takeTimestampedScreenshot(page, 'realtime-after-navigation');
  });
});