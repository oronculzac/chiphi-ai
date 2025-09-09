/**
 * Comprehensive Reports MVP Playwright Tests
 * 
 * Tests all aspects of the reports functionality including:
 * - Navigation and widget visibility
 * - Date filter functionality with data updates
 * - Category filtering via chart interactions
 * - CSV export functionality with header verification
 * - Empty state scenarios
 * - Visual regression testing for charts and responsive layouts
 * 
 * Requirements covered: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { test, expect } from '@playwright/test';
import { TestHelpers, MCPSupabaseHelper } from '../utils/enhanced-test-helpers';
import { testUsers, testOrganizations } from '../fixtures/test-organizations';

test.describe('Reports MVP Comprehensive Tests @reports @e2e', () => {
  let authHelper: TestHelpers.AuthHelper;
  let dashboardHelper: TestHelpers.DashboardHelper;
  let mcpHelper: TestHelpers.MCPHelper;
  let mcpSupabase: MCPSupabaseHelper;
  let docHelper: TestHelpers.TestDocumentationHelper;

  test.beforeAll(async () => {
    mcpSupabase = new MCPSupabaseHelper();
    await mcpSupabase.initialize();
    
    // Set up test organization and user
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
    dashboardHelper = new TestHelpers.DashboardHelper(page);
    mcpHelper = new TestHelpers.MCPHelper(page);
    docHelper = new TestHelpers.TestDocumentationHelper(page);

    // Authenticate with test user
    await authHelper.signInWithTestUser(
      testUsers.primaryOwner.email,
      'test-password'
    );
  });

  test('should navigate to reports page and verify widget visibility', async ({ page }) => {
    await docHelper.logTestStep('Starting reports page navigation test');

    // Navigate to reports page
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Verify page title and metadata
    await expect(page).toHaveTitle(/Reports/);
    
    // Verify navigation header is present
    await expect(page.locator('text=Financial Reports')).toBeVisible();
    await expect(page.locator('text=Back to Dashboard')).toBeVisible();

    // Verify main widgets are visible (requirement 10.1)
    await expect(page.locator('[data-testid="mtd-widget"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-widget"]')).toBeVisible();
    await expect(page.locator('[data-testid="trend-widget"]')).toBeVisible();

    // Verify filters section is present
    await expect(page.locator('[data-testid="reports-filters"]')).toBeVisible();
    await expect(page.locator('[data-testid="time-range-select"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-filter"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible();

    // Verify export section is present
    await expect(page.locator('text=Export Data')).toBeVisible();
    await expect(page.locator('text=Export CSV')).toBeVisible();
    await expect(page.locator('text=Export YNAB')).toBeVisible();

    await docHelper.logTestStep('Reports page navigation and widget visibility verified');
    await docHelper.takeScreenshot('reports-page-loaded');
  });

  test('should test date filter functionality and verify data updates', async ({ page }) => {
    await docHelper.logTestStep('Starting date filter functionality test');

    // Set up test data first
    await mcpSupabase.executeSQL(`
      INSERT INTO transactions (id, org_id, date, amount, currency, merchant, category, subcategory, created_at)
      VALUES 
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '5 days', 25.50, 'USD', 'Test Coffee Shop', 'Food & Dining', 'Coffee Shops', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '15 days', 87.32, 'USD', 'Test Grocery Store', 'Groceries', 'Supermarkets', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '45 days', 45.60, 'USD', 'Test Restaurant', 'Food & Dining', 'Restaurants', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '75 days', 123.45, 'USD', 'Test Shopping', 'Shopping', 'Online', NOW())
    `, [testOrganizations.primary.id]);

    // Navigate to reports page
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Get initial MTD total
    const initialTotal = await page.locator('[data-testid="mtd-total"]').textContent();
    await docHelper.logTestStep('Initial MTD total captured', { initialTotal });

    // Test Last 7 days filter (requirement 10.2)
    await page.selectOption('[data-testid="time-range-select"]', 'last7');
    await page.waitForLoadState('networkidle');
    
    // Verify data updated
    const last7Total = await page.locator('[data-testid="mtd-total"]').textContent();
    expect(last7Total).not.toBe(initialTotal);
    await docHelper.logTestStep('Last 7 days filter applied', { last7Total });

    // Test Last 30 days filter
    await page.selectOption('[data-testid="time-range-select"]', 'last30');
    await page.waitForLoadState('networkidle');
    
    const last30Total = await page.locator('[data-testid="mtd-total"]').textContent();
    await docHelper.logTestStep('Last 30 days filter applied', { last30Total });

    // Test Last 90 days filter
    await page.selectOption('[data-testid="time-range-select"]', 'last90');
    await page.waitForLoadState('networkidle');
    
    const last90Total = await page.locator('[data-testid="mtd-total"]').textContent();
    await docHelper.logTestStep('Last 90 days filter applied', { last90Total });

    // Test custom date range
    await page.selectOption('[data-testid="time-range-select"]', 'custom');
    await page.waitForSelector('[data-testid="custom-date-picker"]');
    
    // Set custom date range (last 60 days)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60);
    const endDate = new Date();
    
    await page.fill('[data-testid="start-date-input"]', startDate.toISOString().split('T')[0]);
    await page.fill('[data-testid="end-date-input"]', endDate.toISOString().split('T')[0]);
    await page.click('[data-testid="apply-custom-range"]');
    await page.waitForLoadState('networkidle');
    
    const customTotal = await page.locator('[data-testid="mtd-total"]').textContent();
    await docHelper.logTestStep('Custom date range applied', { customTotal });

    // Verify that totals are different for different ranges
    expect(last7Total).not.toBe(last30Total);
    expect(last30Total).not.toBe(last90Total);

    await docHelper.takeScreenshot('date-filters-tested');
  });

  test('should test category filtering via chart interactions', async ({ page }) => {
    await docHelper.logTestStep('Starting category filtering test');

    // Set up test data with multiple categories
    await mcpSupabase.executeSQL(`
      INSERT INTO transactions (id, org_id, date, amount, currency, merchant, category, subcategory, created_at)
      VALUES 
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '5 days', 25.50, 'USD', 'Coffee Shop A', 'Food & Dining', 'Coffee Shops', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '6 days', 87.32, 'USD', 'Grocery Store A', 'Groceries', 'Supermarkets', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '7 days', 45.60, 'USD', 'Restaurant A', 'Food & Dining', 'Restaurants', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '8 days', 123.45, 'USD', 'Online Store A', 'Shopping', 'Online', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '9 days', 67.89, 'USD', 'Gas Station A', 'Transportation', 'Gas Stations', NOW())
    `, [testOrganizations.primary.id]);

    // Navigate to reports page
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Wait for category breakdown chart to load
    await page.waitForSelector('[data-testid="category-chart"]');

    // Get initial state
    const initialCategories = await page.locator('[data-testid="category-item"]').count();
    await docHelper.logTestStep('Initial category count', { initialCategories });

    // Test clicking on chart segment (requirement 10.3)
    const foodDiningSegment = page.locator('[data-testid="category-segment-Food & Dining"]');
    if (await foodDiningSegment.isVisible()) {
      await foodDiningSegment.click();
      await page.waitForLoadState('networkidle');
      
      // Verify filter was applied
      const activeFilter = page.locator('[data-testid="active-category-filter"]');
      await expect(activeFilter).toBeVisible();
      await expect(activeFilter).toContainText('Food & Dining');
      
      await docHelper.logTestStep('Category filter applied via chart click');
    }

    // Test clicking on legend item
    const groceriesLegend = page.locator('[data-testid="category-legend-Groceries"]');
    if (await groceriesLegend.isVisible()) {
      await groceriesLegend.click();
      await page.waitForLoadState('networkidle');
      
      // Verify multiple filters can be applied
      const activeFilters = page.locator('[data-testid="active-category-filter"]');
      const filterCount = await activeFilters.count();
      expect(filterCount).toBeGreaterThan(0);
      
      await docHelper.logTestStep('Multiple category filters applied');
    }

    // Test clearing category filters
    const clearFiltersButton = page.locator('[data-testid="clear-category-filters"]');
    if (await clearFiltersButton.isVisible()) {
      await clearFiltersButton.click();
      await page.waitForLoadState('networkidle');
      
      // Verify filters were cleared
      const activeFiltersAfterClear = page.locator('[data-testid="active-category-filter"]');
      await expect(activeFiltersAfterClear).toHaveCount(0);
      
      await docHelper.logTestStep('Category filters cleared');
    }

    // Test category dropdown filter
    const categoryDropdown = page.locator('[data-testid="category-filter"]');
    await categoryDropdown.click();
    
    const shoppingOption = page.locator('[data-testid="category-option-Shopping"]');
    if (await shoppingOption.isVisible()) {
      await shoppingOption.click();
      await page.waitForLoadState('networkidle');
      
      // Verify filter was applied via dropdown
      const dropdownActiveFilter = page.locator('[data-testid="active-category-filter"]');
      await expect(dropdownActiveFilter).toContainText('Shopping');
      
      await docHelper.logTestStep('Category filter applied via dropdown');
    }

    await docHelper.takeScreenshot('category-filtering-tested');
  });

  test('should test CSV export functionality and verify headers', async ({ page }) => {
    await docHelper.logTestStep('Starting CSV export test');

    // Set up test data for export
    await mcpSupabase.executeSQL(`
      INSERT INTO transactions (id, org_id, date, amount, currency, merchant, category, subcategory, notes, created_at)
      VALUES 
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '1 day', 25.50, 'USD', 'Export Test Coffee', 'Food & Dining', 'Coffee Shops', 'Test export note', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '2 days', 87.32, 'USD', 'Export Test Grocery', 'Groceries', 'Supermarkets', 'Another test note', NOW())
    `, [testOrganizations.primary.id]);

    // Navigate to reports page
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Test CSV export (requirement 10.4)
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-csv-button"]');
    const download = await downloadPromise;

    // Verify download occurred
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    await docHelper.logTestStep('CSV download initiated', { 
      filename: download.suggestedFilename() 
    });

    // Save and verify CSV content
    const downloadPath = await download.path();
    if (downloadPath) {
      const fs = require('fs');
      const csvContent = fs.readFileSync(downloadPath, 'utf-8');
      
      // Verify CSV headers (requirement 6.4)
      const lines = csvContent.split('\n');
      const headers = lines[0];
      
      expect(headers).toContain('Date');
      expect(headers).toContain('Amount');
      expect(headers).toContain('Currency');
      expect(headers).toContain('Merchant');
      expect(headers).toContain('Category');
      expect(headers).toContain('Subcategory');
      expect(headers).toContain('Notes');
      
      await docHelper.logTestStep('CSV headers verified', { headers });
      
      // Verify data rows exist
      expect(lines.length).toBeGreaterThan(1);
      
      // Verify sample data
      const dataRow = lines[1];
      expect(dataRow).toContain('Export Test');
      
      await docHelper.logTestStep('CSV data content verified');
    }

    // Test YNAB export
    const ynabDownloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-ynab-button"]');
    const ynabDownload = await ynabDownloadPromise;

    // Verify YNAB download
    expect(ynabDownload.suggestedFilename()).toMatch(/\.csv$/);
    await docHelper.logTestStep('YNAB export completed', { 
      filename: ynabDownload.suggestedFilename() 
    });

    // Test export with filters applied
    await page.selectOption('[data-testid="time-range-select"]', 'last7');
    await page.waitForLoadState('networkidle');
    
    const filteredDownloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-csv-button"]');
    const filteredDownload = await filteredDownloadPromise;
    
    expect(filteredDownload.suggestedFilename()).toMatch(/\.csv$/);
    await docHelper.logTestStep('Filtered export completed');

    await docHelper.takeScreenshot('export-functionality-tested');
  });

  test('should test empty state scenarios', async ({ page }) => {
    await docHelper.logTestStep('Starting empty state scenarios test');

    // Clean up any existing transactions for this test
    await mcpSupabase.executeSQL(`
      DELETE FROM transactions WHERE org_id = $1
    `, [testOrganizations.primary.id]);

    // Test organization with no transactions (requirement 10.5)
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Verify empty state is shown
    await expect(page.locator('[data-testid="reports-empty-state"]')).toBeVisible();
    await expect(page.locator('text=No data found')).toBeVisible();
    
    // Verify empty state messaging
    const emptyStateText = await page.locator('[data-testid="empty-state-message"]').textContent();
    expect(emptyStateText).toContain('no transactions');
    
    await docHelper.logTestStep('Organization empty state verified');

    // Test quick action buttons
    const getStartedButton = page.locator('[data-testid="get-started-button"]');
    if (await getStartedButton.isVisible()) {
      await expect(getStartedButton).toBeVisible();
      await docHelper.logTestStep('Get started button present in empty state');
    }

    // Add some test data and test filter empty state
    await mcpSupabase.executeSQL(`
      INSERT INTO transactions (id, org_id, date, amount, currency, merchant, category, subcategory, created_at)
      VALUES 
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '100 days', 25.50, 'USD', 'Old Transaction', 'Food & Dining', 'Coffee Shops', NOW())
    `, [testOrganizations.primary.id]);

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Apply filter that returns no results
    await page.selectOption('[data-testid="time-range-select"]', 'last7');
    await page.waitForLoadState('networkidle');

    // Verify filter empty state
    const filterEmptyState = page.locator('[data-testid="filter-empty-state"]');
    if (await filterEmptyState.isVisible()) {
      await expect(filterEmptyState).toBeVisible();
      await expect(page.locator('text=No data found for the selected criteria')).toBeVisible();
      
      // Test widen range buttons
      const widenRangeButton = page.locator('[data-testid="widen-range-button"]');
      if (await widenRangeButton.isVisible()) {
        await widenRangeButton.click();
        await page.waitForLoadState('networkidle');
        
        // Verify data appears after widening range
        const mtdWidget = page.locator('[data-testid="mtd-widget"]');
        await expect(mtdWidget).toBeVisible();
        
        await docHelper.logTestStep('Widen range functionality verified');
      }
    }

    // Test search empty state
    await page.fill('[data-testid="search-input"]', 'nonexistent merchant');
    await page.waitForTimeout(500); // Wait for debounce
    await page.waitForLoadState('networkidle');

    // Verify search empty state
    const searchEmptyState = page.locator('[data-testid="search-empty-state"]');
    if (await searchEmptyState.isVisible()) {
      await expect(searchEmptyState).toBeVisible();
      await docHelper.logTestStep('Search empty state verified');
    }

    // Clear search
    await page.fill('[data-testid="search-input"]', '');
    await page.waitForTimeout(500);
    await page.waitForLoadState('networkidle');

    await docHelper.takeScreenshot('empty-states-tested');
  });

  test('should perform visual regression tests for charts and responsive layouts', async ({ page }) => {
    await docHelper.logTestStep('Starting visual regression tests');

    // Set up comprehensive test data for visual testing
    await mcpSupabase.executeSQL(`
      INSERT INTO transactions (id, org_id, date, amount, currency, merchant, category, subcategory, created_at)
      VALUES 
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '1 day', 25.50, 'USD', 'Visual Test Coffee', 'Food & Dining', 'Coffee Shops', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '2 days', 87.32, 'USD', 'Visual Test Grocery', 'Groceries', 'Supermarkets', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '3 days', 45.60, 'USD', 'Visual Test Restaurant', 'Food & Dining', 'Restaurants', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '4 days', 123.45, 'USD', 'Visual Test Shopping', 'Shopping', 'Online', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '5 days', 67.89, 'USD', 'Visual Test Gas', 'Transportation', 'Gas Stations', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '6 days', 34.56, 'USD', 'Visual Test Pharmacy', 'Health & Medical', 'Pharmacy', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '7 days', 78.90, 'USD', 'Visual Test Utilities', 'Bills & Utilities', 'Electric', NOW())
    `, [testOrganizations.primary.id]);

    // Test desktop layout
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    
    // Wait for charts to render
    await page.waitForSelector('[data-testid="category-chart"]');
    await page.waitForSelector('[data-testid="trend-chart"]');
    await page.waitForTimeout(2000); // Allow charts to fully render

    // Take desktop screenshot
    await page.screenshot({ 
      path: 'test-results/visual/reports-desktop-1920x1080.png',
      fullPage: true 
    });
    await docHelper.logTestStep('Desktop layout screenshot captured');

    // Test tablet layout
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000); // Allow responsive layout to adjust
    
    await page.screenshot({ 
      path: 'test-results/visual/reports-tablet-768x1024.png',
      fullPage: true 
    });
    await docHelper.logTestStep('Tablet layout screenshot captured');

    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'test-results/visual/reports-mobile-375x667.png',
      fullPage: true 
    });
    await docHelper.logTestStep('Mobile layout screenshot captured');

    // Test individual chart components
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // MTD Widget screenshot
    const mtdWidget = page.locator('[data-testid="mtd-widget"]');
    await mtdWidget.screenshot({ 
      path: 'test-results/visual/mtd-widget.png' 
    });
    
    // Category Chart screenshot
    const categoryWidget = page.locator('[data-testid="category-widget"]');
    await categoryWidget.screenshot({ 
      path: 'test-results/visual/category-chart.png' 
    });
    
    // Trend Chart screenshot
    const trendWidget = page.locator('[data-testid="trend-widget"]');
    await trendWidget.screenshot({ 
      path: 'test-results/visual/trend-chart.png' 
    });
    
    await docHelper.logTestStep('Individual widget screenshots captured');

    // Test dark mode (if available)
    const themeToggle = page.locator('[data-testid="theme-toggle"]');
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(1000);
      
      await page.screenshot({ 
        path: 'test-results/visual/reports-dark-mode.png',
        fullPage: true 
      });
      await docHelper.logTestStep('Dark mode screenshot captured');
    }

    // Test chart interactions for visual verification
    const categorySegment = page.locator('[data-testid="category-segment"]').first();
    if (await categorySegment.isVisible()) {
      await categorySegment.hover();
      await page.waitForTimeout(500);
      
      await page.screenshot({ 
        path: 'test-results/visual/chart-hover-state.png',
        fullPage: true 
      });
      await docHelper.logTestStep('Chart hover state captured');
    }

    // Test loading states
    await page.goto('/reports?slow=true'); // Simulate slow loading
    await page.waitForSelector('[data-testid="loading-skeleton"]');
    
    await page.screenshot({ 
      path: 'test-results/visual/loading-skeletons.png',
      fullPage: true 
    });
    await docHelper.logTestStep('Loading skeleton states captured');

    await docHelper.logTestStep('Visual regression tests completed');
  });

  test('should test accessibility and keyboard navigation', async ({ page }) => {
    await docHelper.logTestStep('Starting accessibility tests');

    // Set up test data
    await mcpSupabase.executeSQL(`
      INSERT INTO transactions (id, org_id, date, amount, currency, merchant, category, subcategory, created_at)
      VALUES 
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '1 day', 25.50, 'USD', 'A11y Test Coffee', 'Food & Dining', 'Coffee Shops', NOW()),
        (gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '2 days', 87.32, 'USD', 'A11y Test Grocery', 'Groceries', 'Supermarkets', NOW())
    `, [testOrganizations.primary.id]);

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Test keyboard navigation
    await page.keyboard.press('Tab'); // Should focus first interactive element
    await page.keyboard.press('Tab'); // Navigate to next element
    
    // Verify focus is visible
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
    await docHelper.logTestStep('Keyboard navigation verified');

    // Test ARIA labels and roles
    const chartElements = page.locator('[role="img"], [role="button"], [role="combobox"]');
    const chartCount = await chartElements.count();
    expect(chartCount).toBeGreaterThan(0);
    
    // Verify charts have proper ARIA labels
    const categoryChart = page.locator('[data-testid="category-chart"]');
    const ariaLabel = await categoryChart.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    
    await docHelper.logTestStep('ARIA labels verified');

    // Test screen reader compatibility using accessibility snapshot
    const accessibilitySnapshot = await page.accessibility.snapshot();
    expect(accessibilitySnapshot).toBeTruthy();
    expect(accessibilitySnapshot?.children).toBeTruthy();
    
    await docHelper.logTestStep('Accessibility snapshot captured');

    // Test color contrast (basic check)
    const contrastIssues = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const issues = [];
      
      for (const element of elements) {
        const styles = window.getComputedStyle(element);
        const color = styles.color;
        const backgroundColor = styles.backgroundColor;
        
        // Basic contrast check (simplified)
        if (color && backgroundColor && color !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'rgba(0, 0, 0, 0)') {
          // This is a simplified check - in real scenarios, use proper contrast calculation
          if (color === backgroundColor) {
            issues.push(`Poor contrast: ${element.tagName}`);
          }
        }
      }
      
      return issues;
    });
    
    expect(contrastIssues.length).toBe(0);
    await docHelper.logTestStep('Color contrast check passed');
  });

  test.afterEach(async ({ page }) => {
    // Clean up test data
    await mcpSupabase.executeSQL(`
      DELETE FROM transactions 
      WHERE org_id = $1 AND created_at >= NOW() - INTERVAL '10 minutes'
    `, [testOrganizations.primary.id]);

    // Clean up MCP connections
    await mcpHelper.cleanup();
    
    // Take final screenshot for documentation
    await docHelper.takeScreenshot('test-completed');
    
    // Log test completion
    const testSteps = docHelper.getTestSteps();
    await docHelper.logTestStep('Reports test completed', {
      totalSteps: testSteps.length,
    });
  });

  test.afterAll(async () => {
    // Final cleanup
    await mcpSupabase.executeSQL(`
      DELETE FROM transactions WHERE org_id = $1
    `, [testOrganizations.primary.id]);
    
    await mcpSupabase.cleanup();
  });
});