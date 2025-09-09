import { test, expect } from '@playwright/test';

test.describe('Inbound Email Alias Display and Copy', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to settings page with inbound-email tab
    await page.goto('/settings?tab=inbound-email');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display email alias in correct format', async ({ page }) => {
    // Wait for the alias to load
    await expect(page.locator('[data-testid="email-alias"]')).toBeVisible({ timeout: 10000 });
    
    // Verify the alias format
    const aliasElement = page.locator('[data-testid="email-alias"]');
    const aliasText = await aliasElement.textContent();
    
    expect(aliasText).toMatch(/^u_[a-z0-9]{8}@chiphi\.oronculzac\.com$/);
    
    // Verify the element has monospace font
    await expect(aliasElement).toHaveClass(/font-mono/);
  });

  test('should copy email alias to clipboard when copy button is clicked', async ({ page }) => {
    // Wait for the alias and copy button to load
    await expect(page.locator('[data-testid="email-alias"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="copy-alias-button"]')).toBeVisible();
    
    // Get the alias text
    const aliasText = await page.locator('[data-testid="email-alias"]').textContent();
    
    // Click the copy button
    await page.locator('[data-testid="copy-alias-button"]').click();
    
    // Verify clipboard content (note: this requires clipboard permissions in test environment)
    const clipboardText = await page.evaluate(async () => {
      try {
        return await navigator.clipboard.readText();
      } catch (error) {
        // Fallback for environments without clipboard access
        return 'clipboard-not-accessible';
      }
    });
    
    if (clipboardText !== 'clipboard-not-accessible') {
      expect(clipboardText).toBe(aliasText);
    }
    
    // Verify success toast appears
    await expect(page.locator('.toast')).toContainText('Email alias copied to clipboard', { timeout: 5000 });
  });

  test('should show creation date for the alias', async ({ page }) => {
    // Wait for the alias to load
    await expect(page.locator('[data-testid="email-alias"]')).toBeVisible({ timeout: 10000 });
    
    // Check that creation date is displayed
    await expect(page.locator('text=/Created on \\d{1,2}\\/\\d{1,2}\\/\\d{4}/')).toBeVisible();
  });

  test('should display proper card structure and content', async ({ page }) => {
    // Verify main heading
    await expect(page.locator('h2')).toContainText('Inbound Email Configuration');
    
    // Verify description
    await expect(page.locator('text=View your email alias, set up Gmail forwarding, and verify your email configuration.')).toBeVisible();
    
    // Verify email alias card
    await expect(page.locator('text=Your Email Alias')).toBeVisible();
    await expect(page.locator('text=Forward receipts to this unique email address for automatic processing.')).toBeVisible();
    
    // Verify Gmail setup card (placeholder)
    await expect(page.locator('text=Gmail Setup Instructions')).toBeVisible();
    await expect(page.locator('text=Gmail setup instructions will be implemented in upcoming tasks.')).toBeVisible();
    
    // Verify verification card (placeholder)
    await expect(page.locator('text=Email Verification')).toBeVisible();
    await expect(page.locator('text=Email verification polling will be implemented in upcoming tasks.')).toBeVisible();
  });

  test('should show loading state initially', async ({ page }) => {
    // Navigate to page and immediately check for loading state
    await page.goto('/settings?tab=inbound-email');
    
    // Should show skeleton loading initially
    const skeletons = page.locator('.animate-pulse');
    await expect(skeletons.first()).toBeVisible({ timeout: 1000 });
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Mock API to return error
    await page.route('/api/settings/alias', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });
    
    await page.goto('/settings?tab=inbound-email');
    
    // Should show error message
    await expect(page.locator('[role="alert"]')).toContainText('Failed to fetch email alias');
    await expect(page.locator('[role="alert"]')).toHaveClass(/border-destructive/);
  });

  test('should handle no alias found state', async ({ page }) => {
    // Mock API to return no alias
    await page.route('/api/settings/alias', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ alias: null }),
      });
    });
    
    await page.goto('/settings?tab=inbound-email');
    
    // Should show no alias message
    await expect(page.locator('text=No email alias found. Please contact support if this issue persists.')).toBeVisible();
  });

  test('should be accessible with proper ARIA labels', async ({ page }) => {
    // Wait for content to load
    await expect(page.locator('[data-testid="email-alias"]')).toBeVisible({ timeout: 10000 });
    
    // Check copy button has proper aria-label
    const copyButton = page.locator('[data-testid="copy-alias-button"]');
    const ariaLabel = await copyButton.getAttribute('aria-label');
    expect(ariaLabel).toContain('Copy');
    
    // Check that the alias text is included in the aria-label
    const aliasText = await page.locator('[data-testid="email-alias"]').textContent();
    expect(ariaLabel).toContain(aliasText);
  });

  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/settings?tab=inbound-email');
    
    // Wait for content to load
    await expect(page.locator('[data-testid="email-alias"]')).toBeVisible({ timeout: 10000 });
    
    // Verify layout is responsive
    const aliasContainer = page.locator('[data-testid="email-alias"]').locator('..');
    await expect(aliasContainer).toBeVisible();
    
    // Copy button should still be accessible
    await expect(page.locator('[data-testid="copy-alias-button"]')).toBeVisible();
    
    // Click copy button on mobile
    await page.locator('[data-testid="copy-alias-button"]').click();
    
    // Verify toast appears
    await expect(page.locator('.toast')).toContainText('Email alias copied to clipboard', { timeout: 5000 });
  });

  test('should maintain alias format consistency', async ({ page }) => {
    // Navigate multiple times to ensure consistent format
    for (let i = 0; i < 3; i++) {
      await page.goto('/settings?tab=inbound-email');
      await expect(page.locator('[data-testid="email-alias"]')).toBeVisible({ timeout: 10000 });
      
      const aliasText = await page.locator('[data-testid="email-alias"]').textContent();
      
      // Should always match the expected format
      expect(aliasText).toMatch(/^u_[a-z0-9]{8}@chiphi\.oronculzac\.com$/);
      
      // Should use the correct domain
      expect(aliasText).toContain('@chiphi.oronculzac.com');
      
      // Should start with u_ prefix
      expect(aliasText).toMatch(/^u_/);
    }
  });
});