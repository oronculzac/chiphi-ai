/**
 * Reports Visual Regression Tests
 * 
 * Dedicated visual regression testing for reports components including:
 * - Chart rendering consistency across browsers
 * - Responsive layout verification
 * - Theme compatibility (light/dark mode)
 * - Loading state consistency
 * - Error state visual verification
 */

import { test, expect } from '@playwright/test';
import { TestHelpers, MCPSupabaseHelper } from '../utils/enhanced-test-helpers';
import { testUsers, testOrganizations } from '../fixtures/test-organizations';

test.describe('Reports Visual Regression Tests @reports @visual', () => {
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

    // Set up consistent test data for visual tests
    await mcpSupabase.executeSQL(`
      DELETE FROM transactions WHERE org_id = $1;
      
      INSERT INTO transactions (id, org_id, date, amount, currency, merchant, category, subcategory, created_at)
      VALUES 
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '1 day', 25.50, 'USD', 'Visual Test Coffee Shop', 'Food & Dining', 'Coffee Shops', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '2 days', 87.32, 'USD', 'Visual Test Grocery Store', 'Groceries', 'Supermarkets', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '3 days', 45.60, 'USD', 'Visual Test Restaurant', 'Food & Dining', 'Restaurants', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '4 days', 123.45, 'USD', 'Visual Test Online Store', 'Shopping', 'Online', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '5 days', 67.89, 'USD', 'Visual Test Gas Station', 'Transportation', 'Gas Stations', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '6 days', 34.56, 'USD', 'Visual Test Pharmacy', 'Health & Medical', 'Pharmacy', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '7 days', 78.90, 'USD', 'Visual Test Electric Bill', 'Bills & Utilities', 'Electric', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '8 days', 156.78, 'USD', 'Visual Test Department Store', 'Shopping', 'Department Stores', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '9 days', 23.45, 'USD', 'Visual Test Fast Food', 'Food & Dining', 'Fast Food', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '10 days', 89.12, 'USD', 'Visual Test Clothing Store', 'Shopping', 'Clothing', NOW())
    `, [testOrganizations.primary.id]);
  });

  test.beforeEach(async ({ page }) => {
    authHelper = new TestHelpers.AuthHelper(page);
    docHelper = new TestHelpers.TestDocumentationHelper(page);

    await authHelper.signInWithTestUser(
      testUsers.primaryOwner.email,
      'test-password'
    );
  });

  test('should capture baseline screenshots for desktop layout', async ({ page }) => {
    await docHelper.logTestStep('Capturing desktop baseline screenshots');

    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    
    // Wait for all charts to render
    await page.waitForSelector('[data-testid="category-chart"] svg');
    await page.waitForSelector('[data-testid="trend-chart"] svg');
    await page.waitForTimeout(2000); // Allow animations to complete

    // Full page screenshot
    await expect(page).toHaveScreenshot('reports-desktop-full-page.png', {
      fullPage: true,
      threshold: 0.01, // 1% threshold for visual differences
    });

    // Individual widget screenshots
    await expect(page.locator('[data-testid="mtd-widget"]')).toHaveScreenshot('mtd-widget-desktop.png');
    await expect(page.locator('[data-testid="category-widget"]')).toHaveScreenshot('category-widget-desktop.png');
    await expect(page.locator('[data-testid="trend-widget"]')).toHaveScreenshot('trend-widget-desktop.png');
    
    // Filters section
    await expect(page.locator('[data-testid="reports-filters"]')).toHaveScreenshot('filters-section-desktop.png');
    
    await docHelper.logTestStep('Desktop baseline screenshots captured');
  });

  test('should capture baseline screenshots for tablet layout', async ({ page }) => {
    await docHelper.logTestStep('Capturing tablet baseline screenshots');

    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="category-chart"] svg');
    await page.waitForTimeout(2000);

    // Full page screenshot
    await expect(page).toHaveScreenshot('reports-tablet-full-page.png', {
      fullPage: true,
      threshold: 0.01,
    });

    // Widget grid layout
    await expect(page.locator('[data-testid="reports-widgets-grid"]')).toHaveScreenshot('widgets-grid-tablet.png');
    
    await docHelper.logTestStep('Tablet baseline screenshots captured');
  });

  test('should capture baseline screenshots for mobile layout', async ({ page }) => {
    await docHelper.logTestStep('Capturing mobile baseline screenshots');

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="category-chart"] svg');
    await page.waitForTimeout(2000);

    // Full page screenshot
    await expect(page).toHaveScreenshot('reports-mobile-full-page.png', {
      fullPage: true,
      threshold: 0.01,
    });

    // Mobile navigation
    await expect(page.locator('[data-testid="mobile-nav"]')).toHaveScreenshot('mobile-navigation.png');
    
    await docHelper.logTestStep('Mobile baseline screenshots captured');
  });

  test('should capture dark mode screenshots', async ({ page }) => {
    await docHelper.logTestStep('Capturing dark mode screenshots');

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Switch to dark mode
    const themeToggle = page.locator('[data-testid="theme-toggle"]');
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(1000); // Allow theme transition
    } else {
      // Manually set dark mode via localStorage
      await page.evaluate(() => {
        localStorage.setItem('theme', 'dark');
        document.documentElement.classList.add('dark');
      });
      await page.reload();
      await page.waitForLoadState('networkidle');
    }

    await page.waitForSelector('[data-testid="category-chart"] svg');
    await page.waitForTimeout(2000);

    // Dark mode full page
    await expect(page).toHaveScreenshot('reports-dark-mode-full-page.png', {
      fullPage: true,
      threshold: 0.01,
    });

    // Dark mode widgets
    await expect(page.locator('[data-testid="mtd-widget"]')).toHaveScreenshot('mtd-widget-dark.png');
    await expect(page.locator('[data-testid="category-widget"]')).toHaveScreenshot('category-widget-dark.png');
    await expect(page.locator('[data-testid="trend-widget"]')).toHaveScreenshot('trend-widget-dark.png');
    
    await docHelper.logTestStep('Dark mode screenshots captured');
  });

  test('should capture loading state screenshots', async ({ page }) => {
    await docHelper.logTestStep('Capturing loading state screenshots');

    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Intercept API calls to simulate loading
    await page.route('**/api/reports/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
      route.continue();
    });

    await page.goto('/reports');
    
    // Capture loading skeletons
    await page.waitForSelector('[data-testid="loading-skeleton"]');
    
    await expect(page).toHaveScreenshot('reports-loading-state.png', {
      fullPage: true,
      threshold: 0.01,
    });

    // Individual loading widgets
    await expect(page.locator('[data-testid="mtd-loading-skeleton"]')).toHaveScreenshot('mtd-loading-skeleton.png');
    await expect(page.locator('[data-testid="category-loading-skeleton"]')).toHaveScreenshot('category-loading-skeleton.png');
    await expect(page.locator('[data-testid="trend-loading-skeleton"]')).toHaveScreenshot('trend-loading-skeleton.png');
    
    await docHelper.logTestStep('Loading state screenshots captured');
    
    // Clear route to allow normal loading
    await page.unroute('**/api/reports/**');
  });

  test('should capture error state screenshots', async ({ page }) => {
    await docHelper.logTestStep('Capturing error state screenshots');

    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Simulate API error
    await page.route('**/api/reports/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    
    // Wait for error state to appear
    await page.waitForSelector('[data-testid="error-message"]');
    
    await expect(page).toHaveScreenshot('reports-error-state.png', {
      fullPage: true,
      threshold: 0.01,
    });

    // Individual error widgets
    await expect(page.locator('[data-testid="mtd-error-state"]')).toHaveScreenshot('mtd-error-state.png');
    await expect(page.locator('[data-testid="category-error-state"]')).toHaveScreenshot('category-error-state.png');
    await expect(page.locator('[data-testid="trend-error-state"]')).toHaveScreenshot('trend-error-state.png');
    
    await docHelper.logTestStep('Error state screenshots captured');
  });

  test('should capture empty state screenshots', async ({ page }) => {
    await docHelper.logTestStep('Capturing empty state screenshots');

    // Clear all transactions for empty state
    await mcpSupabase.executeSQL(`
      DELETE FROM transactions WHERE org_id = $1
    `, [testOrganizations.primary.id]);

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    
    // Wait for empty state to render
    await page.waitForSelector('[data-testid="reports-empty-state"]');
    
    await expect(page).toHaveScreenshot('reports-empty-state.png', {
      fullPage: true,
      threshold: 0.01,
    });

    // Empty state components
    await expect(page.locator('[data-testid="reports-empty-state"]')).toHaveScreenshot('empty-state-component.png');
    
    await docHelper.logTestStep('Empty state screenshots captured');
  });

  test('should capture chart interaction states', async ({ page }) => {
    await docHelper.logTestStep('Capturing chart interaction screenshots');

    // Restore test data
    await mcpSupabase.executeSQL(`
      INSERT INTO transactions (id, org_id, date, amount, currency, merchant, category, subcategory, created_at)
      VALUES 
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '1 day', 25.50, 'USD', 'Interaction Test Coffee', 'Food & Dining', 'Coffee Shops', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '2 days', 87.32, 'USD', 'Interaction Test Grocery', 'Groceries', 'Supermarkets', NOW())
    `, [testOrganizations.primary.id]);

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="category-chart"] svg');
    await page.waitForTimeout(2000);

    // Hover state
    const categorySegment = page.locator('[data-testid="category-segment"]').first();
    if (await categorySegment.isVisible()) {
      await categorySegment.hover();
      await page.waitForTimeout(500);
      
      await expect(page.locator('[data-testid="category-widget"]')).toHaveScreenshot('category-chart-hover.png');
    }

    // Active filter state
    if (await categorySegment.isVisible()) {
      await categorySegment.click();
      await page.waitForTimeout(500);
      
      await expect(page).toHaveScreenshot('reports-with-active-filter.png', {
        fullPage: true,
        threshold: 0.01,
      });
    }

    // Trend chart hover
    const trendPoint = page.locator('[data-testid="trend-point"]').first();
    if (await trendPoint.isVisible()) {
      await trendPoint.hover();
      await page.waitForTimeout(500);
      
      await expect(page.locator('[data-testid="trend-widget"]')).toHaveScreenshot('trend-chart-hover.png');
    }
    
    await docHelper.logTestStep('Chart interaction screenshots captured');
  });

  test('should capture filter state screenshots', async ({ page }) => {
    await docHelper.logTestStep('Capturing filter state screenshots');

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Custom date picker open
    await page.selectOption('[data-testid="time-range-select"]', 'custom');
    await page.waitForSelector('[data-testid="custom-date-picker"]');
    
    await expect(page.locator('[data-testid="reports-filters"]')).toHaveScreenshot('filters-custom-date-open.png');

    // Category filter dropdown open
    await page.selectOption('[data-testid="time-range-select"]', 'last30'); // Close custom picker
    await page.click('[data-testid="category-filter"]');
    await page.waitForSelector('[data-testid="category-dropdown"]');
    
    await expect(page.locator('[data-testid="reports-filters"]')).toHaveScreenshot('filters-category-dropdown-open.png');

    // Search input with text
    await page.fill('[data-testid="search-input"]', 'test search query');
    await page.waitForTimeout(500);
    
    await expect(page.locator('[data-testid="reports-filters"]')).toHaveScreenshot('filters-with-search-text.png');
    
    await docHelper.logTestStep('Filter state screenshots captured');
  });

  test.afterAll(async () => {
    // Clean up test data
    await mcpSupabase.executeSQL(`
      DELETE FROM transactions WHERE org_id = $1
    `, [testOrganizations.primary.id]);
    
    await mcpSupabase.cleanup();
  });
});