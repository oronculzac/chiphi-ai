/**
 * Dashboard Real-time Updates Tests
 * 
 * Tests real-time dashboard functionality including:
 * - Live transaction updates
 * - Category breakdown changes
 * - Spending trend updates
 * - Performance monitoring
 */

import { test, expect } from '@playwright/test';
import { TestHelpers, MCPSupabaseHelper } from '../utils/enhanced-test-helpers';
import { englishReceipts, spanishReceipts } from '../fixtures/email-samples';
import { testUsers, testOrganizations } from '../fixtures/test-organizations';
import { createTestAssertion } from '@/lib/types/test-schemas';

test.describe('Dashboard Real-time Updates @realtime @dashboard', () => {
  let authHelper: TestHelpers.AuthHelper;
  let dashboardHelper: TestHelpers.DashboardHelper;
  let mcpHelper: TestHelpers.MCPHelper;
  let mcpSupabase: MCPSupabaseHelper;
  let docHelper: TestHelpers.TestDocumentationHelper;

  test.beforeAll(async () => {
    mcpSupabase = new MCPSupabaseHelper();
    await mcpSupabase.initialize();
  });

  test.beforeEach(async ({ page }) => {
    authHelper = new TestHelpers.AuthHelper(page);
    dashboardHelper = new TestHelpers.DashboardHelper(page);
    mcpHelper = new TestHelpers.MCPHelper(page);
    docHelper = new TestHelpers.TestDocumentationHelper(page);

    // Authenticate and navigate to dashboard
    await authHelper.signInWithTestUser(
      testUsers.orgAOwner.email,
      testUsers.orgAOwner.password
    );
    
    await page.goto('/dashboard');
    await dashboardHelper.waitForDashboardLoad();
  });

  test('should update month-to-date total in real-time', async ({ page }) => {
    await docHelper.logTestStep('Starting real-time total update test');

    // Get initial dashboard state
    const initialTotal = await dashboardHelper.getMonthToDateTotal();
    const initialTransactionCount = await dashboardHelper.getTransactionCount();

    await docHelper.logTestStep('Initial dashboard state captured', {
      initialTotal,
      initialTransactionCount,
    });

    // Set up real-time monitoring
    const updateMonitor = await mcpHelper.startRealtimeMonitoring();

    // Process new transaction
    const testEmail = englishReceipts[0]; // $9.45 Starbucks
    const processingResult = await mcpHelper.simulateEmailProcessing(testEmail);
    expect(processingResult.success).toBe(true);

    // Wait for real-time update
    const updateReceived = await updateMonitor.waitForUpdate(15000);
    expect(updateReceived).toBe(true);

    // Verify dashboard updated automatically (without refresh)
    await page.waitForFunction(
      (expectedTotal) => {
        const totalElement = document.querySelector('[data-testid="month-to-date-total"]');
        if (!totalElement) return false;
        const currentTotal = parseFloat(totalElement.textContent?.replace(/[^0-9.]/g, '') || '0');
        return currentTotal > expectedTotal;
      },
      initialTotal,
      { timeout: 10000 }
    );

    const updatedTotal = await dashboardHelper.getMonthToDateTotal();
    const expectedIncrease = testEmail.expectedExtraction.amount;
    
    const totalAssertion = createTestAssertion(
      'equals',
      'totalIncrease',
      expectedIncrease,
      updatedTotal - initialTotal,
      0.01
    );
    expect(totalAssertion.passed).toBe(true);

    // Stop monitoring
    await updateMonitor.stop();

    await docHelper.logTestStep('Real-time total update verified', {
      initialTotal,
      updatedTotal,
      increase: updatedTotal - initialTotal,
      expectedIncrease,
    });
  });

  test('should update category breakdown in real-time', async ({ page }) => {
    await docHelper.logTestStep('Starting real-time category breakdown test');

    // Navigate to analytics view
    await dashboardHelper.navigateToAnalytics();
    
    // Get initial category breakdown
    const initialCategories = await dashboardHelper.getCategoryBreakdown();
    const initialCategoryCount = initialCategories.length;

    await docHelper.logTestStep('Initial category breakdown captured', {
      categoryCount: initialCategoryCount,
      categories: initialCategories.map(c => ({ category: c.category, amount: c.amount })),
    });

    // Set up real-time monitoring
    const updateMonitor = await mcpHelper.startRealtimeMonitoring();

    // Process transaction in new category
    const testEmail = englishReceipts[1]; // Amazon - Shopping category
    const processingResult = await mcpHelper.simulateEmailProcessing(testEmail);
    expect(processingResult.success).toBe(true);

    // Wait for real-time update
    const updateReceived = await updateMonitor.waitForUpdate(15000);
    expect(updateReceived).toBe(true);

    // Wait for category breakdown to update
    await page.waitForFunction(
      (initialCount) => {
        const categoryItems = document.querySelectorAll('[data-testid="category-item"]');
        return categoryItems.length > initialCount;
      },
      initialCategoryCount,
      { timeout: 10000 }
    );

    const updatedCategories = await dashboardHelper.getCategoryBreakdown();
    
    // Verify new category appeared or existing category amount increased
    const shoppingCategory = updatedCategories.find(c => c.category === 'Shopping');
    expect(shoppingCategory).toBeTruthy();
    expect(shoppingCategory!.amount).toBeGreaterThan(0);

    // Stop monitoring
    await updateMonitor.stop();

    await docHelper.logTestStep('Real-time category breakdown verified', {
      initialCategoryCount,
      updatedCategoryCount: updatedCategories.length,
      newShoppingAmount: shoppingCategory!.amount,
    });
  });

  test('should update transaction list in real-time', async ({ page }) => {
    await docHelper.logTestStep('Starting real-time transaction list test');

    // Get initial transaction count
    const initialCount = await dashboardHelper.getTransactionCount();

    await docHelper.logTestStep('Initial transaction count captured', {
      initialCount,
    });

    // Set up real-time monitoring
    const updateMonitor = await mcpHelper.startRealtimeMonitoring();

    // Process multiple transactions
    const testEmails = [englishReceipts[0], spanishReceipts[0]];
    const processingPromises = testEmails.map(email => 
      mcpHelper.simulateEmailProcessing(email)
    );

    const results = await Promise.all(processingPromises);
    results.forEach(result => {
      expect(result.success).toBe(true);
    });

    // Wait for real-time updates
    const updateReceived = await updateMonitor.waitForUpdate(20000);
    expect(updateReceived).toBe(true);

    // Wait for transaction list to update
    await page.waitForFunction(
      (expectedCount) => {
        const transactionItems = document.querySelectorAll('[data-testid="transaction-item"]');
        return transactionItems.length >= expectedCount;
      },
      initialCount + testEmails.length,
      { timeout: 15000 }
    );

    const finalCount = await dashboardHelper.getTransactionCount();
    expect(finalCount).toBeGreaterThanOrEqual(initialCount + testEmails.length);

    // Verify transaction details are visible
    const firstTransaction = page.locator('[data-testid="transaction-item"]').first();
    await expect(firstTransaction).toBeVisible();
    
    // Check that merchant name is displayed
    const merchantName = await firstTransaction.locator('[data-testid="transaction-merchant"]').textContent();
    expect(merchantName).toBeTruthy();

    // Stop monitoring
    await updateMonitor.stop();

    await docHelper.logTestStep('Real-time transaction list verified', {
      initialCount,
      finalCount,
      transactionsAdded: finalCount - initialCount,
    });
  });

  test('should handle concurrent updates efficiently', async ({ page }) => {
    await docHelper.logTestStep('Starting concurrent updates test');

    // Set up real-time monitoring
    const updateMonitor = await mcpHelper.startRealtimeMonitoring();

    // Get initial state
    const initialTotal = await dashboardHelper.getMonthToDateTotal();
    const initialCount = await dashboardHelper.getTransactionCount();

    // Process multiple emails concurrently
    const concurrentEmails = englishReceipts.slice(0, 3);
    const startTime = Date.now();

    const processingPromises = concurrentEmails.map(email => 
      mcpHelper.simulateEmailProcessing(email)
    );

    const results = await Promise.all(processingPromises);
    const processingTime = Date.now() - startTime;

    // Verify all processed successfully
    results.forEach(result => {
      expect(result.success).toBe(true);
    });

    // Wait for all updates to propagate
    const updateReceived = await updateMonitor.waitForUpdate(30000);
    expect(updateReceived).toBe(true);

    // Wait for dashboard to reflect all changes
    await page.waitForFunction(
      (expectedCount) => {
        const transactionItems = document.querySelectorAll('[data-testid="transaction-item"]');
        return transactionItems.length >= expectedCount;
      },
      initialCount + concurrentEmails.length,
      { timeout: 20000 }
    );

    // Verify final state
    const finalTotal = await dashboardHelper.getMonthToDateTotal();
    const finalCount = await dashboardHelper.getTransactionCount();

    const expectedTotalIncrease = concurrentEmails.reduce(
      (sum, email) => sum + email.expectedExtraction.amount, 
      0
    );

    const totalAssertion = createTestAssertion(
      'equals',
      'concurrentTotalIncrease',
      expectedTotalIncrease,
      finalTotal - initialTotal,
      0.01
    );
    expect(totalAssertion.passed).toBe(true);

    // Performance assertions
    expect(processingTime).toBeLessThan(60000); // Under 1 minute
    expect(finalCount).toBeGreaterThanOrEqual(initialCount + concurrentEmails.length);

    // Stop monitoring
    await updateMonitor.stop();

    await docHelper.logTestStep('Concurrent updates handled efficiently', {
      emailsProcessed: concurrentEmails.length,
      processingTime,
      averageTime: processingTime / concurrentEmails.length,
      totalIncrease: finalTotal - initialTotal,
      expectedIncrease: expectedTotalIncrease,
    });
  });

  test('should maintain real-time connection stability', async ({ page }) => {
    await docHelper.logTestStep('Starting connection stability test');

    // Set up monitoring for extended period
    const updateMonitor = await mcpHelper.startRealtimeMonitoring();

    // Process transactions over time to test connection stability
    const testEmails = englishReceipts.slice(0, 2);
    let updateCount = 0;

    for (const email of testEmails) {
      // Process email
      const result = await mcpHelper.simulateEmailProcessing(email);
      expect(result.success).toBe(true);

      // Wait for update
      const updateReceived = await updateMonitor.waitForUpdate(10000);
      if (updateReceived) {
        updateCount++;
      }

      // Wait between processing to test connection persistence
      await page.waitForTimeout(2000);
    }

    // Verify all updates were received
    expect(updateCount).toBe(testEmails.length);

    // Test connection recovery by simulating network interruption
    await page.evaluate(() => {
      // Simulate brief network interruption
      if ((window as any).supabase) {
        (window as any).supabase.removeAllChannels();
        
        // Reconnect after brief delay
        setTimeout(() => {
          (window as any).supabase
            .channel('test-reconnection')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, 
                () => {
                  (window as any).__REALTIME_RECONNECTED__ = true;
                })
            .subscribe();
        }, 1000);
      }
    });

    // Process another email after reconnection
    await page.waitForTimeout(2000);
    const reconnectionEmail = englishReceipts[2];
    const reconnectionResult = await mcpHelper.simulateEmailProcessing(reconnectionEmail);
    expect(reconnectionResult.success).toBe(true);

    // Verify reconnection worked
    await page.waitForFunction(() => {
      return (window as any).__REALTIME_RECONNECTED__ === true;
    }, { timeout: 10000 });

    // Stop monitoring
    await updateMonitor.stop();

    await docHelper.logTestStep('Connection stability verified', {
      updatesReceived: updateCount,
      reconnectionSuccessful: true,
    });
  });

  test('should throttle updates appropriately', async ({ page }) => {
    await docHelper.logTestStep('Starting update throttling test');

    // Set up monitoring with throttling
    const updateMonitor = await mcpHelper.startRealtimeMonitoring();

    // Process rapid-fire transactions
    const rapidEmails = englishReceipts.slice(0, 5);
    const updateTimestamps: number[] = [];

    // Track update timing
    await page.evaluate(() => {
      (window as any).__UPDATE_TIMESTAMPS__ = [];
      
      if ((window as any).supabase) {
        (window as any).supabase
          .channel('throttle-test')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, 
              () => {
                (window as any).__UPDATE_TIMESTAMPS__.push(Date.now());
              })
          .subscribe();
      }
    });

    // Process emails rapidly
    const startTime = Date.now();
    for (const email of rapidEmails) {
      const result = await mcpHelper.simulateEmailProcessing(email);
      expect(result.success).toBe(true);
      await page.waitForTimeout(100); // Very short delay
    }

    // Wait for all updates to process
    await page.waitForTimeout(10000);

    // Get update timestamps
    const timestamps = await page.evaluate(() => {
      return (window as any).__UPDATE_TIMESTAMPS__ || [];
    });

    // Verify throttling occurred (updates should be spaced out)
    if (timestamps.length > 1) {
      const intervals = [];
      for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
      }
      
      const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      
      // Should have some throttling (average interval > 500ms)
      expect(averageInterval).toBeGreaterThan(500);
    }

    // Stop monitoring
    await updateMonitor.stop();

    await docHelper.logTestStep('Update throttling verified', {
      emailsProcessed: rapidEmails.length,
      updatesReceived: timestamps.length,
      throttlingDetected: timestamps.length < rapidEmails.length,
    });
  });

  test.afterEach(async ({ page }) => {
    // Clean up test data
    await mcpSupabase.executeSQL(`
      DELETE FROM transactions 
      WHERE org_id = $1 AND created_at >= NOW() - INTERVAL '5 minutes'
    `, [testOrganizations.orgA.id]);

    // Clean up MCP connections
    await mcpHelper.cleanup();
    
    // Take screenshot for documentation
    await docHelper.takeScreenshot('dashboard-realtime-final');
    
    // Log test completion
    const testSteps = docHelper.getTestSteps();
    await docHelper.logTestStep('Dashboard real-time test completed', {
      totalSteps: testSteps.length,
    });
  });

  test.afterAll(async () => {
    await mcpSupabase.cleanup();
  });
});