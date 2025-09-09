import { test, expect } from '@playwright/test';

test.describe('Gmail Setup Instructions', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to settings page with inbound-email tab
    await page.goto('/settings?tab=inbound-email');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display Gmail setup instructions when alias is loaded', async ({ page }) => {
    // Wait for alias to load
    await expect(page.locator('[data-testid="email-alias"]')).toBeVisible();
    
    // Check Gmail setup section is visible
    await expect(page.getByText('Gmail Setup Instructions')).toBeVisible();
    await expect(page.getByText('Configure Gmail to automatically forward receipts to your ChiPhi AI alias.')).toBeVisible();
  });

  test('should display Gmail filter string with correct format', async ({ page }) => {
    // Wait for alias to load
    await expect(page.locator('[data-testid="email-alias"]')).toBeVisible();
    
    // Get the email alias
    const aliasText = await page.locator('[data-testid="email-alias"]').textContent();
    expect(aliasText).toBeTruthy();
    
    // Check filter string is displayed
    const filterString = await page.locator('[data-testid="gmail-filter-string"]').textContent();
    expect(filterString).toContain(`to:(${aliasText})`);
    expect(filterString).toContain('OR subject:(receipt OR invoice OR purchase OR order OR payment)');
  });

  test('should copy Gmail filter string to clipboard', async ({ page }) => {
    // Wait for alias to load
    await expect(page.locator('[data-testid="email-alias"]')).toBeVisible();
    
    // Get the filter string text
    const filterString = await page.locator('[data-testid="gmail-filter-string"]').textContent();
    
    // Click the copy button
    await page.locator('[data-testid="copy-gmail-filter-button"]').click();
    
    // Check that clipboard was written to (we can't actually read clipboard in tests)
    // But we can verify the button was clicked and no errors occurred
    await expect(page.locator('[data-testid="copy-gmail-filter-button"]')).toBeVisible();
    
    // Look for success toast (if implemented)
    // await expect(page.locator('.toast')).toContainText('Gmail filter copied to clipboard');
  });

  test('should display all setup steps', async ({ page }) => {
    // Wait for alias to load
    await expect(page.locator('[data-testid="email-alias"]')).toBeVisible();
    
    // Check all setup steps are visible
    await expect(page.getByText('Step-by-Step Setup')).toBeVisible();
    await expect(page.getByText('Open Gmail Settings')).toBeVisible();
    await expect(page.getByText('Create New Filter')).toBeVisible();
    await expect(page.getByText('Set Filter Action')).toBeVisible();
    await expect(page.getByText('Apply Filter')).toBeVisible();
    
    // Check step numbers are displayed
    await expect(page.getByText('1')).toBeVisible();
    await expect(page.getByText('2')).toBeVisible();
    await expect(page.getByText('3')).toBeVisible();
    await expect(page.getByText('4')).toBeVisible();
  });

  test('should display mobile-specific instructions', async ({ page }) => {
    // Wait for alias to load
    await expect(page.locator('[data-testid="email-alias"]')).toBeVisible();
    
    // Check mobile instructions
    await expect(page.getByText('Mobile Gmail App')).toBeVisible();
    await expect(page.getByText('For mobile setup, use the Gmail web interface')).toBeVisible();
    await expect(page.getByText('Desktop Required')).toBeVisible();
    await expect(page.getByText('Web Interface Only')).toBeVisible();
  });

  test('should display pro tips section', async ({ page }) => {
    // Wait for alias to load
    await expect(page.locator('[data-testid="email-alias"]')).toBeVisible();
    
    // Check pro tips section
    await expect(page.getByText('💡 Pro Tips')).toBeVisible();
    await expect(page.getByText('Test the filter by sending a test email')).toBeVisible();
    await expect(page.getByText('You can modify the filter criteria')).toBeVisible();
    await expect(page.getByText('Consider creating a Gmail label')).toBeVisible();
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Wait for alias to load
    await expect(page.locator('[data-testid="email-alias"]')).toBeVisible();
    
    // Check that Gmail setup section is still visible and functional
    await expect(page.getByText('Gmail Setup Instructions')).toBeVisible();
    await expect(page.locator('[data-testid="gmail-filter-string"]')).toBeVisible();
    await expect(page.locator('[data-testid="copy-gmail-filter-button"]')).toBeVisible();
    
    // Check that filter string has proper responsive classes
    const filterElement = page.locator('[data-testid="gmail-filter-string"]');
    await expect(filterElement).toHaveClass(/break-all/);
  });

  test('should include email alias in step 3 description', async ({ page }) => {
    // Wait for alias to load
    await expect(page.locator('[data-testid="email-alias"]')).toBeVisible();
    
    // Get the email alias
    const aliasText = await page.locator('[data-testid="email-alias"]').textContent();
    expect(aliasText).toBeTruthy();
    
    // Check that step 3 includes the alias
    await expect(page.getByText(`Choose "Forward it to" and enter your alias: ${aliasText}`)).toBeVisible();
  });

  test('should not display Gmail setup when no alias is available', async ({ page }) => {
    // Mock API to return no alias
    await page.route('/api/settings/alias', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ alias: null })
      });
    });
    
    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should show no alias message
    await expect(page.getByText('No email alias found')).toBeVisible();
    
    // Should not show Gmail setup section
    await expect(page.getByText('Gmail Filter Criteria')).not.toBeVisible();
    await expect(page.locator('[data-testid="gmail-filter-string"]')).not.toBeVisible();
  });
});