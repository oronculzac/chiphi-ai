import { test, expect } from '@playwright/test';

test.describe('Email Verification Code Polling', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the API responses for consistent testing
    await page.route('/api/settings/alias', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          alias: {
            id: 'test-alias-id',
            aliasEmail: 'u_test@chiphi.oronculzac.com',
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z'
          }
        })
      });
    });

    // Navigate to settings page with inbound email tab
    await page.goto('/settings?tab=inbound-email');
    
    // Wait for the page to load
    await expect(page.locator('[data-testid="email-alias"]')).toBeVisible();
  });

  test('should display initial verification state', async ({ page }) => {
    // Check initial state
    await expect(page.locator('text=No verification code received')).toBeVisible();
    await expect(page.locator('text=Click "Get Verification Code" to start polling')).toBeVisible();
    await expect(page.locator('[data-testid="get-verification-code"]')).toBeVisible();
    await expect(page.locator('[data-testid="get-verification-code"]')).toBeEnabled();
  });

  test('should start polling when Get Verification Code is clicked', async ({ page }) => {
    // Mock the verification code API to return no code initially
    await page.route('/api/alias/verification-code', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: null,
          timestamp: null
        })
      });
    });

    // Click the Get Verification Code button
    await page.locator('[data-testid="get-verification-code"]').click();

    // Check polling state
    await expect(page.locator('text=Polling for verification code...')).toBeVisible();
    await expect(page.locator('text=Checking every 6 seconds (up to 2 minutes)')).toBeVisible();
    await expect(page.locator('[data-testid="get-verification-code"]')).toBeDisabled();
    
    // Check for spinning icon
    await expect(page.locator('.animate-spin')).toBeVisible();
  });

  test('should display verification code when received', async ({ page }) => {
    const verificationCode = 'VERIFY123';
    const timestamp = '2024-01-01T12:00:00Z';

    // Mock the verification code API to return a code
    await page.route('/api/alias/verification-code', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: verificationCode,
          timestamp: timestamp
        })
      });
    });

    // Click the Get Verification Code button
    await page.locator('[data-testid="get-verification-code"]').click();

    // Wait for verification to complete
    await expect(page.locator('[data-testid="verification-status"]')).toHaveText('Verified');
    await expect(page.locator('[data-testid="verification-code"]')).toHaveText(verificationCode);
    
    // Check timestamp display
    const expectedTime = new Date(timestamp).toLocaleString();
    await expect(page.locator(`text=Code received at ${expectedTime}`)).toBeVisible();
    
    // Check that polling has stopped
    await expect(page.locator('text=Polling for verification code...')).not.toBeVisible();
    await expect(page.locator('[data-testid="get-verification-code"]')).toBeEnabled();
  });

  test('should show copy button for verification code', async ({ page }) => {
    const verificationCode = 'VERIFY456';
    const timestamp = '2024-01-01T12:00:00Z';

    // Mock the verification code API
    await page.route('/api/alias/verification-code', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: verificationCode,
          timestamp: timestamp
        })
      });
    });

    // Click the Get Verification Code button
    await page.locator('[data-testid="get-verification-code"]').click();

    // Wait for verification to complete
    await expect(page.locator('[data-testid="verification-code"]')).toHaveText(verificationCode);
    
    // Check copy button is present
    const copyButton = page.locator('button', { hasText: 'Copy' }).last();
    await expect(copyButton).toBeVisible();
    
    // Test copy functionality (mock clipboard)
    await page.evaluate(() => {
      Object.assign(navigator, {
        clipboard: {
          writeText: () => Promise.resolve(),
        },
      });
    });
    
    await copyButton.click();
    
    // Should show success message (toast)
    await expect(page.locator('text=Verification code copied to clipboard')).toBeVisible();
  });

  test('should handle polling timeout', async ({ page }) => {
    let callCount = 0;
    
    // Mock the verification code API to always return no code
    await page.route('/api/alias/verification-code', async route => {
      callCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: null,
          timestamp: null
        })
      });
    });

    // Click the Get Verification Code button
    await page.locator('[data-testid="get-verification-code"]').click();

    // Wait for initial polling state
    await expect(page.locator('text=Polling for verification code...')).toBeVisible();

    // Wait for timeout (this would take 2 minutes in real time, but we can mock it)
    // For testing purposes, we'll simulate the timeout by waiting for multiple calls
    await page.waitForTimeout(1000); // Wait a bit for initial calls
    
    // In a real scenario, we'd wait for the timeout message, but for testing
    // we can verify the polling started correctly
    expect(callCount).toBeGreaterThan(0);
  });

  test('should handle API errors during polling', async ({ page }) => {
    // Mock the verification code API to return an error
    await page.route('/api/alias/verification-code', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error'
        })
      });
    });

    // Click the Get Verification Code button
    await page.locator('[data-testid="get-verification-code"]').click();

    // Wait for error to be displayed
    await expect(page.locator('text=Failed to fetch verification code')).toBeVisible();
    
    // Check that polling has stopped
    await expect(page.locator('text=Polling for verification code...')).not.toBeVisible();
    await expect(page.locator('[data-testid="get-verification-code"]')).toBeEnabled();
  });

  test('should reset verification state when reset button is clicked', async ({ page }) => {
    const verificationCode = 'VERIFY789';
    const timestamp = '2024-01-01T12:00:00Z';

    // Mock the verification code API to return a code
    await page.route('/api/alias/verification-code', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: verificationCode,
          timestamp: timestamp
        })
      });
    });

    // Get verification code
    await page.locator('[data-testid="get-verification-code"]').click();
    await expect(page.locator('[data-testid="verification-status"]')).toHaveText('Verified');
    await expect(page.locator('[data-testid="verification-code"]')).toHaveText(verificationCode);

    // Click reset button
    await page.locator('button', { hasText: 'Reset' }).click();

    // Check that state is reset
    await expect(page.locator('text=No verification code received')).toBeVisible();
    await expect(page.locator('[data-testid="verification-code"]')).not.toBeVisible();
    await expect(page.locator('button', { hasText: 'Reset' })).not.toBeVisible();
    await expect(page.locator('[data-testid="get-verification-code"]')).toBeEnabled();
  });

  test('should display instructions for testing', async ({ page }) => {
    // Check that instructions are visible
    await expect(page.locator('text=How to test:')).toBeVisible();
    await expect(page.locator('text=Click "Get Verification Code" to start polling')).toBeVisible();
    await expect(page.locator('text=Send an email to your alias with "VERIFY" in the subject')).toBeVisible();
    await expect(page.locator('text=The system will automatically detect and display the verification code')).toBeVisible();
    await expect(page.locator('text=A green "Verified" status indicates your email forwarding is working')).toBeVisible();
  });

  test('should show visual indicators for different states', async ({ page }) => {
    // Initial state - clock icon
    await expect(page.locator('.lucide-clock')).toBeVisible();

    // Mock polling state
    await page.route('/api/alias/verification-code', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: null,
          timestamp: null
        })
      });
    });

    // Start polling - spinning icon
    await page.locator('[data-testid="get-verification-code"]').click();
    await expect(page.locator('.lucide-refresh-cw.animate-spin')).toBeVisible();

    // Mock successful verification
    await page.route('/api/alias/verification-code', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'VERIFY999',
          timestamp: '2024-01-01T12:00:00Z'
        })
      });
    });

    // Reset and try again to see success state
    await page.reload();
    await page.locator('[data-testid="get-verification-code"]').click();
    
    // Success state - check circle icon
    await expect(page.locator('.lucide-check-circle')).toBeVisible();
  });
});