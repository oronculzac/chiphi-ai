/**
 * Reports Edge Cases and Error Scenarios Tests
 * 
 * Tests edge cases and error handling in reports functionality including:
 * - Network failures and retry mechanisms
 * - Invalid date ranges and filter combinations
 * - Concurrent user interactions
 * - Browser compatibility edge cases
 * - Data corruption scenarios
 */

import { test, expect } from '@playwright/test';
import { TestHelpers, MCPSupabaseHelper } from '../utils/enhanced-test-helpers';
import { testUsers, testOrganizations } from '../fixtures/test-organizations';

test.describe('Reports Edge Cases and Error Scenarios @reports @edge-cases', () => {
  let authHelper: TestHelpers.AuthHelper;
  let mcpSupabase: MCPSupabaseHelper;
  let docHelper: TestHelpers.TestDocumentationHelper;

  test.beforeAll(async () => {
    mcpSupabase = new MCPSupabaseHelper();
    await mcpSupabase.initialize();
    
    await mcpSupabase.ensureTestOrganization(
      testOrganizations.primary.id,
      testOrganizations.primary.name
    );
    await mcpSupabase.ensureTestUser(
      testUsers.primaryOwner.id,
      testUsers.primaryOwner.email,
      testOrganizations.primary.id
    );
  });

  test.beforeEach(async ({ page }) => {
    authHelper = new TestHelpers.AuthHelper(page);
    docHelper = new TestHelpers.TestDocumentationHelper(page);

    await authHelper.signInWithTestUser(
      testUsers.primaryOwner.email,
      'test-password'
    );
  });

  test('should handle network failures gracefully', async ({ page }) => {
    await docHelper.logTestStep('Starting network failure handling test');

    // Set up test data
    await mcpSupabase.executeSQL(`
      INSERT INTO transactions (id, org_id, date, amount, currency, merchant, category, subcategory, created_at)
      VALUES 
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '1 day', 25.50, 'USD', 'Network Test Coffee', 'Food & Dining', 'Coffee Shops', NOW())
    `, [testOrganizations.primary.id]);

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Simulate network failure
    await page.route('**/api/reports/**', route => {
      route.abort('failed');
    });

    // Try to change filters (should trigger network request)
    await page.selectOption('[data-testid="time-range-select"]', 'last7');
    
    // Verify error state is shown
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Failed to load')).toBeVisible();
    
    // Verify retry button is present
    const retryButton = page.locator('[data-testid="retry-button"]');
    await expect(retryButton).toBeVisible();
    
    await docHelper.logTestStep('Network failure error state verified');

    // Restore network and test retry
    await page.unroute('**/api/reports/**');
    
    await retryButton.click();
    await page.waitForLoadState('networkidle');
    
    // Verify data loads after retry
    await expect(page.locator('[data-testid="mtd-widget"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
    
    await docHelper.logTestStep('Network recovery and retry verified');
  });

  test('should validate invalid date ranges', async ({ page }) => {
    await docHelper.logTestStep('Starting invalid date range validation test');

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Test invalid custom date range (end before start)
    await page.selectOption('[data-testid="time-range-select"]', 'custom');
    await page.waitForSelector('[data-testid="custom-date-picker"]');
    
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Set end date before start date
    await page.fill('[data-testid="start-date-input"]', tomorrow.toISOString().split('T')[0]);
    await page.fill('[data-testid="end-date-input"]', today.toISOString().split('T')[0]);
    await page.click('[data-testid="apply-custom-range"]');
    
    // Verify validation error
    await expect(page.locator('[data-testid="date-validation-error"]')).toBeVisible();
    await expect(page.locator('text=End date must be after start date')).toBeVisible();
    
    await docHelper.logTestStep('Invalid date range validation verified');

    // Test future dates
    const futureDate = new Date(today);
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    
    await page.fill('[data-testid="start-date-input"]', today.toISOString().split('T')[0]);
    await page.fill('[data-testid="end-date-input"]', futureDate.toISOString().split('T')[0]);
    await page.click('[data-testid="apply-custom-range"]');
    
    // Verify future date warning
    const futureWarning = page.locator('[data-testid="future-date-warning"]');
    if (await futureWarning.isVisible()) {
      await expect(futureWarning).toContainText('future');
      await docHelper.logTestStep('Future date warning verified');
    }

    // Test extremely large date ranges
    const veryOldDate = new Date('1900-01-01');
    
    await page.fill('[data-testid="start-date-input"]', veryOldDate.toISOString().split('T')[0]);
    await page.fill('[data-testid="end-date-input"]', today.toISOString().split('T')[0]);
    await page.click('[data-testid="apply-custom-range"]');
    
    // Should handle large ranges gracefully
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="mtd-widget"]')).toBeVisible();
    
    await docHelper.logTestStep('Large date range handling verified');
  });

  test('should handle concurrent user interactions', async ({ page }) => {
    await docHelper.logTestStep('Starting concurrent interactions test');

    // Set up test data
    await mcpSupabase.executeSQL(`
      INSERT INTO transactions (id, org_id, date, amount, currency, merchant, category, subcategory, created_at)
      VALUES 
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '1 day', 25.50, 'USD', 'Concurrent Test 1', 'Food & Dining', 'Coffee Shops', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '2 days', 87.32, 'USD', 'Concurrent Test 2', 'Groceries', 'Supermarkets', NOW())
    `, [testOrganizations.primary.id]);

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Simulate rapid concurrent interactions
    const interactions = [
      () => page.selectOption('[data-testid="time-range-select"]', 'last7'),
      () => page.fill('[data-testid="search-input"]', 'test'),
      () => page.selectOption('[data-testid="time-range-select"]', 'last30'),
      () => page.fill('[data-testid="search-input"]', ''),
      () => page.selectOption('[data-testid="time-range-select"]', 'last90'),
    ];

    // Execute interactions rapidly
    const promises = interactions.map((interaction, index) => 
      new Promise(resolve => {
        setTimeout(async () => {
          try {
            await interaction();
            resolve(true);
          } catch (error) {
            resolve(false);
          }
        }, index * 100); // Stagger by 100ms
      })
    );

    await Promise.all(promises);
    await page.waitForLoadState('networkidle');

    // Verify page is still functional
    await expect(page.locator('[data-testid="mtd-widget"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-widget"]')).toBeVisible();
    
    await docHelper.logTestStep('Concurrent interactions handled successfully');
  });

  test('should handle malformed data gracefully', async ({ page }) => {
    await docHelper.logTestStep('Starting malformed data handling test');

    // Insert transactions with edge case data
    await mcpSupabase.executeSQL(`
      INSERT INTO transactions (id, org_id, date, amount, currency, merchant, category, subcategory, notes, created_at)
      VALUES 
        (gen_random_uuid(), $1, CURRENT_DATE, 0, 'USD', '', 'Unknown', '', '', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE, -50.00, 'USD', 'Refund Test', 'Refunds', 'Credit', 'Negative amount test', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE, 999999.99, 'USD', 'Large Amount Test', 'Other', 'Large', 'Very large amount', NOW()),
        (gen_random_uuid(), $1, '1970-01-01', 10.00, 'USD', 'Old Date Test', 'Test', 'Old', 'Very old date', NOW())
    `, [testOrganizations.primary.id]);

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Verify page loads despite malformed data
    await expect(page.locator('[data-testid="mtd-widget"]')).toBeVisible();
    
    // Check that zero amounts are handled
    const mtdTotal = await page.locator('[data-testid="mtd-total"]').textContent();
    expect(mtdTotal).toBeTruthy();
    
    // Check that negative amounts are handled (should show as refunds or be excluded)
    const categoryChart = page.locator('[data-testid="category-chart"]');
    await expect(categoryChart).toBeVisible();
    
    // Check that large amounts don't break formatting
    const trendChart = page.locator('[data-testid="trend-chart"]');
    await expect(trendChart).toBeVisible();
    
    await docHelper.logTestStep('Malformed data handled gracefully');

    // Test export with malformed data
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-csv-button"]');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    
    // Verify CSV content handles edge cases
    const downloadPath = await download.path();
    if (downloadPath) {
      const fs = require('fs');
      const csvContent = fs.readFileSync(downloadPath, 'utf-8');
      
      // Should contain headers even with malformed data
      expect(csvContent).toContain('Date,Amount,Currency');
      
      // Should handle empty merchant names
      expect(csvContent).toContain('""'); // Empty merchant should be quoted
      
      await docHelper.logTestStep('Export with malformed data verified');
    }
  });

  test('should handle browser compatibility edge cases', async ({ page }) => {
    await docHelper.logTestStep('Starting browser compatibility test');

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Test localStorage availability
    const localStorageTest = await page.evaluate(() => {
      try {
        localStorage.setItem('test', 'value');
        const value = localStorage.getItem('test');
        localStorage.removeItem('test');
        return value === 'value';
      } catch {
        return false;
      }
    });

    if (!localStorageTest) {
      // Verify app still works without localStorage
      await expect(page.locator('[data-testid="mtd-widget"]')).toBeVisible();
      await docHelper.logTestStep('App works without localStorage');
    }

    // Test CSS Grid support
    const gridSupport = await page.evaluate(() => {
      return CSS.supports('display', 'grid');
    });

    if (!gridSupport) {
      // Verify fallback layout works
      await expect(page.locator('[data-testid="reports-container"]')).toBeVisible();
      await docHelper.logTestStep('Fallback layout works without CSS Grid');
    }

    // Test JavaScript features
    const jsFeatures = await page.evaluate(() => {
      return {
        fetch: typeof fetch !== 'undefined',
        promise: typeof Promise !== 'undefined',
        arrow: (() => true)() === true,
        const: (() => { try { eval('const x = 1'); return true; } catch { return false; } })(),
      };
    });

    Object.entries(jsFeatures).forEach(([feature, supported]) => {
      if (!supported) {
        console.warn(`Feature ${feature} not supported`);
      }
    });

    await docHelper.logTestStep('Browser compatibility checked', jsFeatures);
  });

  test('should handle session expiration gracefully', async ({ page }) => {
    await docHelper.logTestStep('Starting session expiration test');

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Simulate session expiration by clearing auth cookies
    await page.context().clearCookies();
    
    // Try to perform an action that requires authentication
    await page.selectOption('[data-testid="time-range-select"]', 'last7');
    
    // Should redirect to login or show auth error
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    const hasAuthError = await page.locator('[data-testid="auth-error"]').isVisible();
    const isLoginPage = currentUrl.includes('/auth') || currentUrl.includes('/login');
    
    expect(hasAuthError || isLoginPage).toBe(true);
    
    await docHelper.logTestStep('Session expiration handled', {
      redirectedToLogin: isLoginPage,
      showsAuthError: hasAuthError
    });
  });

  test('should handle rapid filter changes without race conditions', async ({ page }) => {
    await docHelper.logTestStep('Starting race condition prevention test');

    // Set up test data
    await mcpSupabase.executeSQL(`
      INSERT INTO transactions (id, org_id, date, amount, currency, merchant, category, subcategory, created_at)
      SELECT 
        gen_random_uuid(),
        $1,
        CURRENT_DATE - (generate_series % 30),
        (random() * 100 + 5)::decimal(10,2),
        'USD',
        'Race Test ' || generate_series,
        (ARRAY['Food & Dining', 'Groceries', 'Shopping'])[floor(random() * 3 + 1)],
        'Test',
        NOW()
      FROM generate_series(1, 50)
    `, [testOrganizations.primary.id]);

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Perform rapid filter changes
    const rapidChanges = async () => {
      for (let i = 0; i < 10; i++) {
        const filters = ['last7', 'last30', 'last90', 'mtd'];
        await page.selectOption('[data-testid="time-range-select"]', filters[i % filters.length]);
        await page.waitForTimeout(50); // Very short delay
      }
    };

    await rapidChanges();
    await page.waitForLoadState('networkidle');

    // Verify final state is consistent
    await expect(page.locator('[data-testid="mtd-widget"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-widget"]')).toBeVisible();
    
    // Verify no error states
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
    
    await docHelper.logTestStep('Race conditions prevented successfully');
  });

  test.afterEach(async ({ page }) => {
    // Clean up test data
    await mcpSupabase.executeSQL(`
      DELETE FROM transactions 
      WHERE org_id = $1 AND created_at >= NOW() - INTERVAL '10 minutes'
    `, [testOrganizations.primary.id]);
    
    await docHelper.takeScreenshot('edge-case-test-completed');
  });

  test.afterAll(async () => {
    await mcpSupabase.cleanup();
  });
});