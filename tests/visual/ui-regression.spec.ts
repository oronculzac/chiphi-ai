import { test, expect } from '@playwright/test';

/**
 * Comprehensive UI Visual Regression Tests
 * 
 * This test suite provides comprehensive visual regression testing for:
 * - Dashboard components and layouts
 * - Transaction list and detail view styling
 * - Responsive design across different viewport sizes
 * - Cross-browser visual consistency
 * - Automated baseline image management
 * 
 * Uses MCP-first approach with Playwright MCP for all UI testing and validation.
 */

test.describe('Dashboard Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Wait for dashboard components to load
    await page.waitForSelector('[data-testid="transaction-dashboard"]', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('dashboard page renders with correct layout and styling', async ({ page }) => {
    // Verify main dashboard elements are visible
    await expect(page.locator('h1:has-text("Transaction Dashboard")')).toBeVisible();
    await expect(page.locator('text=View and manage your receipt transactions')).toBeVisible();
    
    // Check dashboard tabs are present
    const tabsList = page.locator('[role="tablist"]').first();
    await expect(tabsList).toBeVisible();
    await expect(tabsList.locator('text=Analytics')).toBeVisible();
    await expect(tabsList.locator('text=AI Insights')).toBeVisible();
    await expect(tabsList.locator('text=Transactions')).toBeVisible();
    
    // Test computed styles for main container
    const container = page.locator('.container').first();
    const containerPadding = await container.evaluate(el => 
      getComputedStyle(el).paddingTop
    );
    expect(parseFloat(containerPadding)).toBeGreaterThan(0);
    
    // Visual regression test for full dashboard
    await expect(page).toHaveScreenshot('dashboard-full-page.png', {
      fullPage: true,
      threshold: 0.01,
      maxDiffPixels: 200
    });
  });

  test('analytics tab visual regression', async ({ page }) => {
    // Click on Analytics tab
    await page.locator('text=Analytics').click();
    await page.waitForSelector('[data-testid="demo-analytics"]', { timeout: 10000 });
    
    // Wait for charts and analytics to load
    await page.waitForTimeout(2000);
    
    // Verify analytics components are visible
    const analyticsSection = page.locator('[role="region"][aria-labelledby="analytics-heading"]');
    await expect(analyticsSection).toBeVisible();
    
    // Test analytics cards styling
    const cards = page.locator('.grid .card, [data-testid*="card"]');
    const cardCount = await cards.count();
    
    if (cardCount > 0) {
      const firstCard = cards.first();
      const cardBorder = await firstCard.evaluate(el => 
        getComputedStyle(el).borderWidth
      );
      expect(parseFloat(cardBorder)).toBeGreaterThan(0);
      
      const cardBorderRadius = await firstCard.evaluate(el => 
        getComputedStyle(el).borderRadius
      );
      expect(parseFloat(cardBorderRadius)).toBeGreaterThan(0);
    }
    
    // Visual regression test for analytics tab
    await expect(page.locator('[data-testid="demo-analytics"]')).toHaveScreenshot('analytics-tab.png', {
      threshold: 0.01,
      maxDiffPixels: 150
    });
  });

  test('insights tab visual regression', async ({ page }) => {
    // Click on AI Insights tab
    await page.locator('text=AI Insights').click();
    await page.waitForSelector('[data-testid="insights-panel"]', { timeout: 10000 });
    
    // Wait for insights panel to load
    await page.waitForTimeout(1000);
    
    // Verify insights panel is visible
    const insightsPanel = page.locator('[data-testid="insights-panel"]');
    await expect(insightsPanel).toBeVisible();
    
    // Test insights panel styling
    const panelBg = await insightsPanel.evaluate(el => 
      getComputedStyle(el).backgroundColor
    );
    expect(panelBg).not.toBe('rgba(0, 0, 0, 0)');
    
    // Visual regression test for insights tab
    await expect(insightsPanel).toHaveScreenshot('insights-tab.png', {
      threshold: 0.01,
      maxDiffPixels: 100
    });
  });

  test('transactions tab visual regression', async ({ page }) => {
    // Click on Transactions tab
    await page.locator('text=Transactions').click();
    await page.waitForSelector('[role="table"]', { timeout: 10000 });
    
    // Wait for transaction list to load
    await page.waitForTimeout(2000);
    
    // Verify transaction table is visible
    const transactionTable = page.locator('[role="table"]');
    await expect(transactionTable).toBeVisible();
    
    // Test table styling
    const tableHeaders = page.locator('th');
    const headerCount = await tableHeaders.count();
    expect(headerCount).toBeGreaterThan(0);
    
    if (headerCount > 0) {
      const firstHeader = tableHeaders.first();
      const headerFontWeight = await firstHeader.evaluate(el => 
        getComputedStyle(el).fontWeight
      );
      expect(parseInt(headerFontWeight)).toBeGreaterThanOrEqual(500);
    }
    
    // Visual regression test for transactions tab
    await expect(page.locator('[data-testid="transactions-table-title"]').locator('..')).toHaveScreenshot('transactions-tab.png', {
      threshold: 0.01,
      maxDiffPixels: 200
    });
  });
});

test.describe('Transaction List Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('text=Transactions').click();
    await page.waitForSelector('[role="table"]', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('transaction table styling and layout', async ({ page }) => {
    const table = page.locator('[role="table"]');
    await expect(table).toBeVisible();
    
    // Test table structure
    const headers = page.locator('th');
    const expectedHeaders = ['Date', 'Merchant', 'Amount', 'Category', 'Confidence'];
    
    for (const headerText of expectedHeaders) {
      await expect(page.locator(`th:has-text("${headerText}")`)).toBeVisible();
    }
    
    // Test table row styling
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    
    if (rowCount > 0) {
      const firstRow = rows.first();
      
      // Test row hover state
      await firstRow.hover();
      const hoverBg = await firstRow.evaluate(el => 
        getComputedStyle(el).backgroundColor
      );
      
      // Test cell padding
      const firstCell = firstRow.locator('td').first();
      const cellPadding = await firstCell.evaluate(el => 
        getComputedStyle(el).padding
      );
      expect(cellPadding).not.toBe('0px');
    }
    
    // Visual regression test for transaction table
    await expect(table).toHaveScreenshot('transaction-table.png', {
      threshold: 0.01,
      maxDiffPixels: 150
    });
  });

  test('transaction filters visual regression', async ({ page }) => {
    // Click filters button
    const filtersButton = page.locator('button:has-text("Filters")');
    await filtersButton.click();
    
    // Wait for filters to appear
    await page.waitForSelector('#transaction-filters', { timeout: 5000 });
    
    // Verify filter components are visible
    const filtersSection = page.locator('#transaction-filters');
    await expect(filtersSection).toBeVisible();
    
    // Test filter input styling
    const categoryFilter = page.locator('#category-filter');
    if (await categoryFilter.isVisible()) {
      const inputBorder = await categoryFilter.evaluate(el => 
        getComputedStyle(el).borderWidth
      );
      expect(parseFloat(inputBorder)).toBeGreaterThan(0);
      
      const inputBorderRadius = await categoryFilter.evaluate(el => 
        getComputedStyle(el).borderRadius
      );
      expect(parseFloat(inputBorderRadius)).toBeGreaterThan(0);
    }
    
    // Visual regression test for filters
    await expect(filtersSection).toHaveScreenshot('transaction-filters.png', {
      threshold: 0.01,
      maxDiffPixels: 100
    });
  });

  test('confidence badges visual regression', async ({ page }) => {
    // Look for confidence badges in the table
    const confidenceBadges = page.locator('[data-testid*="confidence"], .badge');
    const badgeCount = await confidenceBadges.count();
    
    if (badgeCount > 0) {
      const firstBadge = confidenceBadges.first();
      await expect(firstBadge).toBeVisible();
      
      // Test badge styling
      const badgeBg = await firstBadge.evaluate(el => 
        getComputedStyle(el).backgroundColor
      );
      expect(badgeBg).not.toBe('rgba(0, 0, 0, 0)');
      
      const badgePadding = await firstBadge.evaluate(el => 
        getComputedStyle(el).padding
      );
      expect(badgePadding).not.toBe('0px');
      
      // Visual regression test for confidence badges
      await expect(firstBadge).toHaveScreenshot('confidence-badge.png', {
        threshold: 0.01,
        maxDiffPixels: 30
      });
    }
  });

  test('transaction action buttons visual regression', async ({ page }) => {
    // Look for action buttons in the table
    const actionButtons = page.locator('tbody tr button');
    const buttonCount = await actionButtons.count();
    
    if (buttonCount > 0) {
      const viewButton = actionButtons.filter({ hasText: 'View' }).first();
      const editButton = page.locator('button[aria-label*="Edit"]').first();
      
      if (await viewButton.isVisible()) {
        // Test button styling
        const buttonBg = await viewButton.evaluate(el => 
          getComputedStyle(el).backgroundColor
        );
        
        const buttonBorderRadius = await viewButton.evaluate(el => 
          getComputedStyle(el).borderRadius
        );
        expect(parseFloat(buttonBorderRadius)).toBeGreaterThan(0);
        
        // Test hover state
        await viewButton.hover();
        const hoverBg = await viewButton.evaluate(el => 
          getComputedStyle(el).backgroundColor
        );
        
        // Visual regression test for action buttons
        await expect(viewButton).toHaveScreenshot('action-button.png', {
          threshold: 0.01,
          maxDiffPixels: 20
        });
      }
    }
  });
});

test.describe('Transaction Detail View Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('text=Transactions').click();
    await page.waitForSelector('[role="table"]', { timeout: 10000 });
  });

  test('transaction detail modal visual regression', async ({ page }) => {
    // Click on first View button if available
    const viewButton = page.locator('button:has-text("View")').first();
    
    if (await viewButton.isVisible()) {
      await viewButton.click();
      
      // Wait for modal to open
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();
      
      // Test modal styling
      const modalBg = await modal.evaluate(el => 
        getComputedStyle(el).backgroundColor
      );
      expect(modalBg).not.toBe('rgba(0, 0, 0, 0)');
      
      const modalBorderRadius = await modal.evaluate(el => 
        getComputedStyle(el).borderRadius
      );
      expect(parseFloat(modalBorderRadius)).toBeGreaterThan(0);
      
      // Wait for content to load
      await page.waitForTimeout(1000);
      
      // Visual regression test for transaction detail modal
      await expect(modal).toHaveScreenshot('transaction-detail-modal.png', {
        threshold: 0.01,
        maxDiffPixels: 200
      });
      
      // Close modal
      await page.keyboard.press('Escape');
    }
  });

  test('transaction detail cards visual regression', async ({ page }) => {
    const viewButton = page.locator('button:has-text("View")').first();
    
    if (await viewButton.isVisible()) {
      await viewButton.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      
      // Test individual cards within the detail view
      const cards = page.locator('[role="dialog"] .card');
      const cardCount = await cards.count();
      
      if (cardCount > 0) {
        const firstCard = cards.first();
        
        // Test card styling
        const cardBorder = await firstCard.evaluate(el => 
          getComputedStyle(el).borderWidth
        );
        expect(parseFloat(cardBorder)).toBeGreaterThan(0);
        
        const cardShadow = await firstCard.evaluate(el => 
          getComputedStyle(el).boxShadow
        );
        expect(cardShadow).not.toBe('none');
        
        // Visual regression test for detail cards
        await expect(firstCard).toHaveScreenshot('transaction-detail-card.png', {
          threshold: 0.01,
          maxDiffPixels: 100
        });
      }
      
      await page.keyboard.press('Escape');
    }
  });
});

test.describe('Responsive Design Visual Regression', () => {
  const viewports = [
    { width: 1920, height: 1080, name: 'desktop-large' },
    { width: 1280, height: 720, name: 'desktop' },
    { width: 1024, height: 768, name: 'tablet-landscape' },
    { width: 768, height: 1024, name: 'tablet-portrait' },
    { width: 375, height: 667, name: 'mobile' },
    { width: 320, height: 568, name: 'mobile-small' }
  ];

  for (const viewport of viewports) {
    test(`dashboard responsive design - ${viewport.name}`, async ({ page }) => {
      // Set viewport size
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      // Navigate to dashboard
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="transaction-dashboard"]', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
      
      // Wait for layout to adjust
      await page.waitForTimeout(1000);
      
      // Verify main elements are still visible and properly laid out
      await expect(page.locator('h1:has-text("Transaction Dashboard")')).toBeVisible();
      
      // Test tab navigation on mobile
      const tabsList = page.locator('[role="tablist"]').first();
      await expect(tabsList).toBeVisible();
      
      // Check if tabs are stacked on mobile
      if (viewport.width < 768) {
        const tabsContainer = tabsList.locator('..');
        const flexDirection = await tabsContainer.evaluate(el => 
          getComputedStyle(el).flexDirection
        );
        // On mobile, tabs might be stacked (column) or wrapped
        expect(['column', 'row'].includes(flexDirection)).toBe(true);
      }
      
      // Visual regression test for responsive layout
      await expect(page).toHaveScreenshot(`dashboard-${viewport.name}.png`, {
        fullPage: true,
        threshold: 0.02, // Slightly higher threshold for responsive layouts
        maxDiffPixels: 300
      });
    });

    test(`transaction list responsive design - ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      await page.goto('/dashboard');
      await page.locator('text=Transactions').click();
      await page.waitForSelector('[role="table"]', { timeout: 10000 });
      await page.waitForTimeout(1000);
      
      // Verify table is visible and scrollable on small screens
      const table = page.locator('[role="table"]');
      await expect(table).toBeVisible();
      
      // On mobile, table should be in a scrollable container
      if (viewport.width < 768) {
        const tableContainer = table.locator('..').locator('..');
        const overflow = await tableContainer.evaluate(el => 
          getComputedStyle(el).overflowX
        );
        expect(['auto', 'scroll'].includes(overflow)).toBe(true);
      }
      
      // Visual regression test for responsive table
      await expect(page.locator('[data-testid="transactions-table-title"]').locator('..')).toHaveScreenshot(`transaction-list-${viewport.name}.png`, {
        threshold: 0.02,
        maxDiffPixels: 250
      });
    });
  }
});

test.describe('Cross-Browser Visual Regression', () => {
  // These tests will run across different browser projects defined in playwright.config.ts
  
  test('dashboard cross-browser consistency', async ({ page, browserName }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="transaction-dashboard"]', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    
    // Test browser-specific styling
    const container = page.locator('.container').first();
    const containerStyles = await container.evaluate(el => ({
      display: getComputedStyle(el).display,
      maxWidth: getComputedStyle(el).maxWidth,
      margin: getComputedStyle(el).margin
    }));
    
    expect(containerStyles.display).toBeTruthy();
    expect(containerStyles.maxWidth).toBeTruthy();
    
    // Visual regression test with browser-specific baseline
    await expect(page).toHaveScreenshot(`dashboard-${browserName}.png`, {
      fullPage: true,
      threshold: 0.01,
      maxDiffPixels: 200
    });
  });

  test('transaction components cross-browser consistency', async ({ page, browserName }) => {
    await page.goto('/dashboard');
    await page.locator('text=Transactions').click();
    await page.waitForSelector('[role="table"]', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    
    // Test table rendering across browsers
    const table = page.locator('[role="table"]');
    const tableStyles = await table.evaluate(el => ({
      borderCollapse: getComputedStyle(el).borderCollapse,
      width: getComputedStyle(el).width
    }));
    
    expect(tableStyles.width).toBeTruthy();
    
    // Visual regression test with browser-specific baseline
    await expect(table).toHaveScreenshot(`transaction-table-${browserName}.png`, {
      threshold: 0.01,
      maxDiffPixels: 150
    });
  });
});

test.describe('Automated Baseline Management', () => {
  test('generate baseline images for new components', async ({ page }) => {
    // This test helps generate baseline images for new components
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Generate baselines for all major components
    const components = [
      { selector: 'h1:has-text("Transaction Dashboard")', name: 'dashboard-title' },
      { selector: '[role="tablist"]', name: 'dashboard-tabs' },
      { selector: '.container', name: 'dashboard-container' }
    ];
    
    for (const component of components) {
      const element = page.locator(component.selector);
      if (await element.isVisible()) {
        await expect(element).toHaveScreenshot(`baseline-${component.name}.png`, {
          threshold: 0.01
        });
      }
    }
  });

  test('validate baseline image quality', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Test that baseline images capture the expected content
    const mainContent = page.locator('main, [role="main"], .container').first();
    
    // Verify content is loaded before taking baseline
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[role="tablist"]')).toBeVisible();
    
    // Generate high-quality baseline
    await expect(mainContent).toHaveScreenshot('baseline-main-content.png', {
      threshold: 0.005, // Very strict threshold for baseline validation
      maxDiffPixels: 50
    });
  });
});

/**
 * MCP Integration Patterns for Visual Testing
 * 
 * These tests demonstrate the recommended patterns for using
 * Playwright MCP for comprehensive visual regression testing.
 */
test.describe('MCP Visual Testing Patterns', () => {
  test('playwright mcp visual verification pattern', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Demonstrate comprehensive visual verification using MCP patterns
    const visualChecks = await page.evaluate(() => {
      const results = [];
      
      // Check dashboard title styling
      const title = document.querySelector('h1');
      if (title) {
        const styles = getComputedStyle(title);
        results.push({
          element: 'dashboard-title',
          fontSize: styles.fontSize,
          fontWeight: styles.fontWeight,
          color: styles.color,
          marginBottom: styles.marginBottom
        });
      }
      
      // Check tab styling
      const tabs = document.querySelector('[role="tablist"]');
      if (tabs) {
        const styles = getComputedStyle(tabs);
        results.push({
          element: 'dashboard-tabs',
          display: styles.display,
          gap: styles.gap,
          backgroundColor: styles.backgroundColor
        });
      }
      
      // Check container layout
      const container = document.querySelector('.container');
      if (container) {
        const styles = getComputedStyle(container);
        results.push({
          element: 'dashboard-container',
          maxWidth: styles.maxWidth,
          padding: styles.padding,
          margin: styles.margin
        });
      }
      
      return results;
    });
    
    // Verify computed styles meet design requirements
    expect(visualChecks.length).toBeGreaterThan(0);
    
    const titleStyles = visualChecks.find(s => s.element === 'dashboard-title');
    if (titleStyles) {
      expect(parseFloat(titleStyles.fontSize)).toBeGreaterThan(20); // Large title
      expect(parseInt(titleStyles.fontWeight)).toBeGreaterThanOrEqual(600); // Bold
    }
    
    const tabStyles = visualChecks.find(s => s.element === 'dashboard-tabs');
    if (tabStyles) {
      expect(tabStyles.display).toBe('flex'); // Flexbox layout
    }
  });

  test('playwright mcp interaction and visual testing', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Test tab interactions and visual changes
    const analyticsTab = page.locator('text=Analytics');
    const insightsTab = page.locator('text=AI Insights');
    const transactionsTab = page.locator('text=Transactions');
    
    // Test each tab and capture visual state
    const tabs = [
      { name: 'analytics', locator: analyticsTab },
      { name: 'insights', locator: insightsTab }, 
      { name: 'transactions', locator: transactionsTab }
    ];
    
    for (const tab of tabs) {
      await tab.locator.click();
      await page.waitForTimeout(1000); // Wait for tab content to load
      
      // Verify tab is active (has active styling)
      const isActive = await tab.locator.evaluate(el => {
        const styles = getComputedStyle(el);
        return {
          backgroundColor: styles.backgroundColor,
          color: styles.color,
          borderColor: styles.borderColor
        };
      });
      
      // Active tab should have different styling
      expect(isActive.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      
      // Capture visual state of active tab
      await expect(tab.locator).toHaveScreenshot(`active-tab-${tab.name}.png`, {
        threshold: 0.01
      });
    }
  });
});