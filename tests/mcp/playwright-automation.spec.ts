import { test, expect } from '@playwright/test';
import { MCPHelper, EmailProcessingHelper, DashboardHelper } from '../utils/test-helpers';
import { englishReceipts } from '../fixtures/email-samples';

/**
 * Playwright MCP Automation Tests
 * 
 * Tests the integration between Playwright MCP server and browser automation
 * for testing email processing workflows and UI interactions.
 */

test.describe('Playwright MCP Automation', () => {
  let mcpHelper: MCPHelper;
  let emailHelper: EmailProcessingHelper;
  let dashboardHelper: DashboardHelper;

  test.beforeEach(async ({ page }) => {
    mcpHelper = new MCPHelper(page);
    emailHelper = new EmailProcessingHelper(page);
    dashboardHelper = new DashboardHelper(page);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await dashboardHelper.waitForDashboardLoad();
  });

  test('should automate email processing workflow via MCP', async ({ page }) => {
    // Take initial screenshot via MCP
    const initialScreenshot = await mcpHelper.callPlaywrightMCP('browser_take_screenshot', {
      filename: 'initial-dashboard.png',
      fullPage: true,
    });

    expect(initialScreenshot.success).toBe(true);

    // Get initial dashboard state
    const initialTotal = await dashboardHelper.getMonthToDateTotal();
    const initialCategories = await dashboardHelper.getCategoryBreakdown();

    // Simulate email processing via MCP browser automation
    const emailData = englishReceipts[0]; // Starbucks receipt

    // Navigate to email simulation page via MCP
    await mcpHelper.callPlaywrightMCP('browser_navigate', {
      url: '/test/email-simulator',
    });

    // Fill email form via MCP
    await mcpHelper.callPlaywrightMCP('browser_fill', {
      selector: 'input[name="from"]',
      value: emailData.from,
    });

    await mcpHelper.callPlaywrightMCP('browser_fill', {
      selector: 'input[name="to"]',
      value: emailData.to,
    });

    await mcpHelper.callPlaywrightMCP('browser_fill', {
      selector: 'input[name="subject"]',
      value: emailData.subject,
    });

    await mcpHelper.callPlaywrightMCP('browser_fill', {
      selector: 'textarea[name="body"]',
      value: emailData.body,
    });

    // Submit email via MCP
    await mcpHelper.callPlaywrightMCP('browser_click', {
      selector: 'button[type="submit"]',
    });

    // Wait for processing completion via MCP
    await mcpHelper.callPlaywrightMCP('browser_wait_for_selector', {
      selector: 'text=Email processed successfully',
      timeout: 30000,
    });

    // Navigate back to dashboard via MCP
    await mcpHelper.callPlaywrightMCP('browser_navigate', {
      url: '/dashboard',
    });

    // Wait for dashboard update via MCP
    await mcpHelper.callPlaywrightMCP('browser_wait_for_selector', {
      selector: '[data-testid="transaction-item"]',
      timeout: 10000,
    });

    // Take final screenshot via MCP
    const finalScreenshot = await mcpHelper.callPlaywrightMCP('browser_take_screenshot', {
      filename: 'final-dashboard.png',
      fullPage: true,
    });

    expect(finalScreenshot.success).toBe(true);

    // Verify dashboard updates
    const finalTotal = await dashboardHelper.getMonthToDateTotal();
    expect(finalTotal).toBeGreaterThan(initialTotal);

    // Verify transaction was created
    const transactionElement = page.locator('[data-testid="transaction-item"]').first();
    await expect(transactionElement).toBeVisible();

    const merchant = await transactionElement.locator('[data-testid="transaction-merchant"]').textContent();
    expect(merchant).toContain('Starbucks');
  });

  test('should capture page snapshots via MCP', async ({ page }) => {
    // Take accessibility snapshot via MCP
    const snapshot = await mcpHelper.callPlaywrightMCP('browser_snapshot', {});

    expect(snapshot.success).toBe(true);
    expect(snapshot.data).toBeDefined();
    expect(snapshot.data).toContain('Dashboard');
  });

  test('should interact with forms via MCP', async ({ page }) => {
    // Navigate to transaction form
    await dashboardHelper.navigateToTransactions();

    // Click add transaction button via MCP
    await mcpHelper.callPlaywrightMCP('browser_click', {
      selector: 'button:has-text("Add Transaction")',
    });

    // Fill transaction form via MCP
    const formData = {
      merchant: 'Test Merchant MCP',
      amount: '50.00',
      category: 'Shopping',
      date: '2024-01-15',
    };

    await mcpHelper.callPlaywrightMCP('browser_fill', {
      selector: 'input[name="merchant"]',
      value: formData.merchant,
    });

    await mcpHelper.callPlaywrightMCP('browser_fill', {
      selector: 'input[name="amount"]',
      value: formData.amount,
    });

    await mcpHelper.callPlaywrightMCP('browser_select', {
      selector: 'select[name="category"]',
      value: formData.category,
    });

    await mcpHelper.callPlaywrightMCP('browser_fill', {
      selector: 'input[name="date"]',
      value: formData.date,
    });

    // Submit form via MCP
    await mcpHelper.callPlaywrightMCP('browser_click', {
      selector: 'button[type="submit"]',
    });

    // Wait for success message via MCP
    await mcpHelper.callPlaywrightMCP('browser_wait_for_selector', {
      selector: 'text=Transaction created successfully',
      timeout: 5000,
    });

    // Verify transaction appears in list
    const transactionList = page.locator('[data-testid="transactions-list"]');
    await expect(transactionList.locator('text=Test Merchant MCP')).toBeVisible();
  });

  test('should handle hover interactions via MCP', async ({ page }) => {
    // Navigate to analytics
    await dashboardHelper.navigateToAnalytics();

    // Hover over chart elements via MCP
    const chartElement = page.locator('[data-testid="spending-chart"]').first();
    if (await chartElement.isVisible()) {
      await mcpHelper.callPlaywrightMCP('browser_hover', {
        selector: '[data-testid="spending-chart"] .recharts-bar',
      });

      // Wait for tooltip to appear
      await mcpHelper.callPlaywrightMCP('browser_wait_for_selector', {
        selector: '.recharts-tooltip',
        timeout: 2000,
      });

      // Verify tooltip is visible
      const tooltip = page.locator('.recharts-tooltip');
      await expect(tooltip).toBeVisible();
    }
  });

  test('should evaluate JavaScript via MCP', async ({ page }) => {
    // Execute JavaScript to get page data via MCP
    const pageData = await mcpHelper.callPlaywrightMCP('browser_evaluate', {
      function: `() => {
        return {
          url: window.location.href,
          title: document.title,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        };
      }`,
    });

    expect(pageData.success).toBe(true);
    expect(pageData.data.url).toContain('/dashboard');
    expect(pageData.data.title).toBeDefined();
    expect(pageData.data.userAgent).toBeDefined();
    expect(pageData.data.timestamp).toBeDefined();
  });

  test('should handle keyboard interactions via MCP', async ({ page }) => {
    // Navigate to insights panel
    await dashboardHelper.navigateToInsights();

    // Focus on search input via MCP
    await mcpHelper.callPlaywrightMCP('browser_click', {
      selector: 'input[placeholder*="Ask about your spending"]',
    });

    // Type query via MCP
    await mcpHelper.callPlaywrightMCP('browser_type', {
      selector: 'input[placeholder*="Ask about your spending"]',
      text: 'monthly spending',
    });

    // Press Enter via MCP
    await mcpHelper.callPlaywrightMCP('browser_press_key', {
      key: 'Enter',
    });

    // Wait for result via MCP
    await mcpHelper.callPlaywrightMCP('browser_wait_for_selector', {
      selector: 'text=Insight Result, text=Could not understand',
      timeout: 10000,
    });

    // Verify some response was generated
    const hasResult = await page.locator('text=Insight Result').isVisible();
    const hasError = await page.locator('text=Could not understand').isVisible();
    expect(hasResult || hasError).toBeTruthy();
  });

  test('should handle drag and drop via MCP', async ({ page }) => {
    // Navigate to a page with drag and drop functionality
    await page.goto('/test/drag-drop');

    // Perform drag and drop via MCP
    await mcpHelper.callPlaywrightMCP('browser_drag', {
      startSelector: '[data-testid="draggable-item"]',
      endSelector: '[data-testid="drop-zone"]',
    });

    // Verify drop was successful
    const dropZone = page.locator('[data-testid="drop-zone"]');
    await expect(dropZone.locator('[data-testid="draggable-item"]')).toBeVisible();
  });

  test('should capture network requests via MCP', async ({ page }) => {
    // Start network monitoring
    await page.route('**/*', route => {
      console.log(`Request: ${route.request().method()} ${route.request().url()}`);
      route.continue();
    });

    // Trigger API calls by navigating to analytics
    await dashboardHelper.navigateToAnalytics();

    // Wait for API calls to complete
    await page.waitForLoadState('networkidle');

    // Get network logs via MCP evaluation
    const networkLogs = await mcpHelper.callPlaywrightMCP('browser_evaluate', {
      function: `() => {
        return performance.getEntriesByType('resource')
          .filter(entry => entry.name.includes('/api/'))
          .map(entry => ({
            url: entry.name,
            duration: entry.duration,
            size: entry.transferSize,
          }));
      }`,
    });

    expect(networkLogs.success).toBe(true);
    expect(Array.isArray(networkLogs.data)).toBe(true);

    // Verify API calls were made
    const apiCalls = networkLogs.data.filter((log: any) => log.url.includes('/api/'));
    expect(apiCalls.length).toBeGreaterThan(0);
  });

  test('should handle multiple browser tabs via MCP', async ({ page, context }) => {
    // Open new tab via MCP
    const newTab = await context.newPage();
    const newTabMCP = new MCPHelper(newTab);

    // Navigate to different pages in each tab
    await mcpHelper.callPlaywrightMCP('browser_navigate', {
      url: '/dashboard',
    });

    await newTabMCP.callPlaywrightMCP('browser_navigate', {
      url: '/transactions',
    });

    // Take screenshots of both tabs
    const dashboardScreenshot = await mcpHelper.callPlaywrightMCP('browser_take_screenshot', {
      filename: 'tab1-dashboard.png',
    });

    const transactionsScreenshot = await newTabMCP.callPlaywrightMCP('browser_take_screenshot', {
      filename: 'tab2-transactions.png',
    });

    expect(dashboardScreenshot.success).toBe(true);
    expect(transactionsScreenshot.success).toBe(true);

    // Close new tab
    await newTab.close();
  });

  test('should handle responsive design testing via MCP', async ({ page }) => {
    // Test mobile viewport via MCP
    await mcpHelper.callPlaywrightMCP('browser_resize', {
      width: 375,
      height: 667,
    });

    // Take mobile screenshot
    const mobileScreenshot = await mcpHelper.callPlaywrightMCP('browser_take_screenshot', {
      filename: 'mobile-dashboard.png',
    });

    expect(mobileScreenshot.success).toBe(true);

    // Test tablet viewport via MCP
    await mcpHelper.callPlaywrightMCP('browser_resize', {
      width: 768,
      height: 1024,
    });

    // Take tablet screenshot
    const tabletScreenshot = await mcpHelper.callPlaywrightMCP('browser_take_screenshot', {
      filename: 'tablet-dashboard.png',
    });

    expect(tabletScreenshot.success).toBe(true);

    // Test desktop viewport via MCP
    await mcpHelper.callPlaywrightMCP('browser_resize', {
      width: 1920,
      height: 1080,
    });

    // Take desktop screenshot
    const desktopScreenshot = await mcpHelper.callPlaywrightMCP('browser_take_screenshot', {
      filename: 'desktop-dashboard.png',
    });

    expect(desktopScreenshot.success).toBe(true);
  });
});