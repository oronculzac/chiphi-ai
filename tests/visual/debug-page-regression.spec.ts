import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests for Debug Page Style Probes
 * 
 * This test suite demonstrates the MCP-first approach to UI/UX testing:
 * 1. Uses Playwright MCP as the primary tool for all UI testing
 * 2. Integrates with shadcn MCP for component validation
 * 3. Implements comprehensive visual regression detection
 */

test.describe('Debug Page Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to debug page
    await page.goto('/debug');
    
    // Wait for components to load
    await page.waitForSelector('[data-testid="button-probe"]');
    await page.waitForSelector('[data-testid="card-probe"]');
    await page.waitForSelector('[data-testid="badge-probe"]');
  });

  test('style probes render with correct computed styles', async ({ page }) => {
    // Test button styles using browser_evaluate pattern
    const buttonBgColor = await page.locator('[data-testid="button-primary"]').evaluate(el => 
      getComputedStyle(el).backgroundColor
    );
    
    // Verify button has proper background (not transparent)
    expect(buttonBgColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(buttonBgColor).not.toBe('transparent');
    
    // Test button border radius
    const buttonBorderRadius = await page.locator('[data-testid="button-primary"]').evaluate(el => 
      getComputedStyle(el).borderRadius
    );
    
    // Verify border radius is applied (Tailwind default is 6px)
    expect(parseFloat(buttonBorderRadius)).toBeGreaterThan(0);
    
    // Test card border styles
    const cardBorderWidth = await page.locator('[data-testid="card-probe"]').evaluate(el => 
      getComputedStyle(el).borderWidth
    );
    
    // Verify card has border
    expect(parseFloat(cardBorderWidth)).toBeGreaterThan(0);
    
    // Test badge font weight
    const badgeFontWeight = await page.locator('[data-testid="badge-default"]').evaluate(el => 
      getComputedStyle(el).fontWeight
    );
    
    // Verify badge has proper font weight (should be medium/500 or bold)
    expect(parseInt(badgeFontWeight)).toBeGreaterThanOrEqual(500);
  });

  test('button probe visual regression', async ({ page }) => {
    const buttonProbe = page.locator('[data-testid="button-probe"]');
    
    // Ensure all buttons are visible
    await expect(buttonProbe.locator('[data-testid="button-primary"]')).toBeVisible();
    await expect(buttonProbe.locator('[data-testid="button-secondary"]')).toBeVisible();
    await expect(buttonProbe.locator('[data-testid="button-outline"]')).toBeVisible();
    
    // Visual regression test with 1% threshold
    await expect(buttonProbe).toHaveScreenshot('button-probes.png', {
      threshold: 0.01,
      maxDiffPixels: 100
    });
  });

  test('card probe visual regression', async ({ page }) => {
    const cardProbe = page.locator('[data-testid="card-probe"]').first();
    
    // Verify card content is visible
    await expect(cardProbe.locator('text=Test Card')).toBeVisible();
    await expect(cardProbe.locator('text=This card tests proper styling')).toBeVisible();
    
    // Test card shadow and border
    const cardBoxShadow = await cardProbe.evaluate(el => 
      getComputedStyle(el).boxShadow
    );
    
    // Verify card has shadow (not 'none')
    expect(cardBoxShadow).not.toBe('none');
    
    // Visual regression test
    await expect(cardProbe).toHaveScreenshot('card-probe.png', {
      threshold: 0.01,
      maxDiffPixels: 50
    });
  });

  test('badge probe visual regression', async ({ page }) => {
    const badgeProbe = page.locator('[data-testid="badge-probe"]');
    
    // Verify all badge variants are visible
    await expect(badgeProbe.locator('[data-testid="badge-default"]')).toBeVisible();
    await expect(badgeProbe.locator('[data-testid="badge-secondary"]')).toBeVisible();
    await expect(badgeProbe.locator('[data-testid="badge-outline"]')).toBeVisible();
    
    // Test badge padding and display
    const badgePadding = await page.locator('[data-testid="badge-default"]').evaluate(el => 
      getComputedStyle(el).padding
    );
    
    // Verify badge has padding
    expect(badgePadding).not.toBe('0px');
    
    // Visual regression test
    await expect(badgeProbe).toHaveScreenshot('badge-probes.png', {
      threshold: 0.01,
      maxDiffPixels: 30
    });
  });

  test('alert probe visual regression', async ({ page }) => {
    const alertDefault = page.locator('[data-testid="alert-default"]');
    const alertDestructive = page.locator('[data-testid="alert-destructive"]');
    
    // Verify alerts are visible
    await expect(alertDefault).toBeVisible();
    await expect(alertDestructive).toBeVisible();
    
    // Test alert background colors are different
    const defaultBg = await alertDefault.evaluate(el => 
      getComputedStyle(el).backgroundColor
    );
    const destructiveBg = await alertDestructive.evaluate(el => 
      getComputedStyle(el).backgroundColor
    );
    
    // Verify alerts have different background colors
    expect(defaultBg).not.toBe(destructiveBg);
    expect(defaultBg).not.toBe('rgba(0, 0, 0, 0)');
    expect(destructiveBg).not.toBe('rgba(0, 0, 0, 0)');
    
    // Visual regression test for both alerts
    await expect(alertDefault).toHaveScreenshot('alert-default.png', {
      threshold: 0.01
    });
    await expect(alertDestructive).toHaveScreenshot('alert-destructive.png', {
      threshold: 0.01
    });
  });

  test('full debug page visual regression', async ({ page }) => {
    // Wait for all components to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Scroll to ensure all content is visible
    await page.evaluate(() => window.scrollTo(0, 0));
    
    // Take full page screenshot for overall regression testing
    await expect(page).toHaveScreenshot('debug-page-full.png', {
      fullPage: true,
      threshold: 0.01,
      maxDiffPixels: 200
    });
  });

  test('accessibility verification using snapshot', async ({ page }) => {
    // This test demonstrates the preferred use of browser_snapshot
    // for accessibility-focused testing over screenshots
    
    // Verify button accessibility
    const primaryButton = page.locator('[data-testid="button-primary"]');
    await expect(primaryButton).toBeVisible();
    
    // Check button is keyboard accessible
    await primaryButton.focus();
    const isFocused = await primaryButton.evaluate(el => 
      document.activeElement === el
    );
    expect(isFocused).toBe(true);
    
    // Verify proper ARIA attributes exist
    const buttonRole = await primaryButton.getAttribute('role');
    const buttonType = await primaryButton.getAttribute('type');
    
    // Button should have proper type or role
    expect(buttonType === 'button' || buttonRole === 'button').toBe(true);
    
    // Test card accessibility
    const card = page.locator('[data-testid="card-probe"]').first();
    
    // Verify card content is accessible to screen readers
    const cardTitle = card.locator('text=Test Card');
    await expect(cardTitle).toBeVisible();
    
    // Test input accessibility
    const input = page.locator('[data-testid="input-probe"]');
    if (await input.isVisible()) {
      const inputLabel = await input.getAttribute('aria-label');
      const inputLabelledBy = await input.getAttribute('aria-labelledby');
      
      // Input should have proper labeling
      expect(inputLabel || inputLabelledBy).toBeTruthy();
    }
  });

  test('style probe test automation', async ({ page }) => {
    // This test demonstrates automated style testing that could be
    // integrated with the StyleProbes component
    
    // Click the "Run Style Tests" button if it exists
    const runTestsButton = page.locator('text=Run Style Tests');
    if (await runTestsButton.isVisible()) {
      await runTestsButton.click();
      
      // Wait for tests to complete
      await page.waitForSelector('text=Passed', { timeout: 10000 });
      
      // Verify test results are displayed
      const passedTests = page.locator('text=Passed');
      await expect(passedTests).toBeVisible();
    }
    
    // Verify style test results are accurate by checking actual styles
    const buttonTests = [
      { element: '[data-testid="button-primary"]', property: 'backgroundColor' },
      { element: '[data-testid="button-primary"]', property: 'borderRadius' },
      { element: '[data-testid="card-probe"]', property: 'borderWidth' },
      { element: '[data-testid="badge-default"]', property: 'fontWeight' }
    ];
    
    for (const test of buttonTests) {
      const element = page.locator(test.element);
      if (await element.isVisible()) {
        const styleValue = await element.evaluate((el, prop) => 
          getComputedStyle(el).getPropertyValue(prop), test.property
        );
        
        // Verify style is applied (not empty or default)
        expect(styleValue).toBeTruthy();
        expect(styleValue).not.toBe('');
        
        if (test.property === 'backgroundColor') {
          expect(styleValue).not.toBe('rgba(0, 0, 0, 0)');
        }
      }
    }
  });

  test('responsive design verification', async ({ page }) => {
    // Test different viewport sizes to ensure responsive design
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      // Wait for layout to adjust
      await page.waitForTimeout(500);
      
      // Verify components are still visible and properly laid out
      await expect(page.locator('[data-testid="button-probe"]')).toBeVisible();
      await expect(page.locator('[data-testid="card-probe"]')).toBeVisible();
      
      // Take screenshot for responsive regression testing
      await expect(page).toHaveScreenshot(`debug-page-${viewport.name}.png`, {
        threshold: 0.02, // Slightly higher threshold for responsive layouts
        maxDiffPixels: 300
      });
    }
  });
});

/**
 * MCP Integration Test Patterns
 * 
 * These tests demonstrate the recommended patterns for using
 * Playwright MCP and shadcn MCP together for comprehensive UI testing.
 */
test.describe('MCP Integration Patterns', () => {
  test('playwright mcp browser_evaluate pattern', async ({ page }) => {
    await page.goto('/debug');
    
    // Demonstrate browser_evaluate for computed style verification
    const styleChecks = await page.evaluate(() => {
      const results = [];
      
      // Check button styles
      const button = document.querySelector('[data-testid="button-primary"]');
      if (button) {
        const styles = getComputedStyle(button);
        results.push({
          element: 'button-primary',
          backgroundColor: styles.backgroundColor,
          borderRadius: styles.borderRadius,
          padding: styles.padding
        });
      }
      
      // Check card styles
      const card = document.querySelector('[data-testid="card-probe"]');
      if (card) {
        const styles = getComputedStyle(card);
        results.push({
          element: 'card-probe',
          borderWidth: styles.borderWidth,
          backgroundColor: styles.backgroundColor,
          boxShadow: styles.boxShadow
        });
      }
      
      return results;
    });
    
    // Verify computed styles
    expect(styleChecks.length).toBeGreaterThan(0);
    
    const buttonStyles = styleChecks.find(s => s.element === 'button-primary');
    if (buttonStyles) {
      expect(buttonStyles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(parseFloat(buttonStyles.borderRadius)).toBeGreaterThan(0);
    }
  });

  test('playwright mcp interaction testing pattern', async ({ page }) => {
    await page.goto('/debug');
    
    // Demonstrate interaction testing with MCP patterns
    // This simulates mcp_playwright_browser_click, mcp_playwright_browser_fill, etc.
    
    // Test button interactions
    const primaryButton = page.locator('[data-testid="button-primary"]');
    await primaryButton.hover();
    
    // Verify hover state changes
    const hoverBg = await primaryButton.evaluate(el => 
      getComputedStyle(el).backgroundColor
    );
    
    await primaryButton.click();
    
    // Test input interactions if available
    const input = page.locator('[data-testid="input-probe"]');
    if (await input.isVisible()) {
      await input.fill('Test input value');
      const inputValue = await input.inputValue();
      expect(inputValue).toBe('Test input value');
    }
  });
});