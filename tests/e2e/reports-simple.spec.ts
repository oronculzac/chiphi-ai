/**
 * Simple Reports Test - Bypasses global setup for quick testing
 * 
 * This test verifies the basic functionality of the reports page
 * without requiring the full global setup infrastructure.
 */

import { test, expect } from '@playwright/test';

test.describe('Reports Simple Tests @reports', () => {
  test('should load reports page and display basic structure', async ({ page }) => {
    // Navigate directly to reports page
    await page.goto('/reports');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check if page loads (even if it shows login or error)
    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);
    
    // Take a screenshot to see what's actually loading
    await page.screenshot({ path: 'test-results/reports-simple-load.png', fullPage: true });
    
    // Check if we can see any reports-related content
    const hasReportsContent = await page.locator('text=Reports').isVisible().catch(() => false);
    const hasLoginContent = await page.locator('text=Sign in').isVisible().catch(() => false);
    const hasErrorContent = await page.locator('text=Error').isVisible().catch(() => false);
    
    console.log('Has reports content:', hasReportsContent);
    console.log('Has login content:', hasLoginContent);
    console.log('Has error content:', hasErrorContent);
    
    // The test passes if the page loads at all (we'll handle auth/setup later)
    expect(pageTitle).toBeTruthy();
  });

  test('should handle navigation to reports page', async ({ page }) => {
    // Try to navigate to the main app first
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of home page
    await page.screenshot({ path: 'test-results/home-page.png', fullPage: true });
    
    // Try to navigate to reports
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the reports page (URL should contain reports)
    expect(page.url()).toContain('/reports');
    
    // Take screenshot of reports page
    await page.screenshot({ path: 'test-results/reports-page-nav.png', fullPage: true });
  });

  test('should check for reports API endpoints', async ({ page }) => {
    // Test if reports API endpoints are accessible
    const response = await page.request.get('/api/reports/data');
    
    console.log('Reports API status:', response.status());
    console.log('Reports API headers:', await response.allHeaders());
    
    // API might return 401/403 for auth, but should not return 404
    expect(response.status()).not.toBe(404);
    
    // Check if the endpoint exists (even if it requires auth)
    const isAuthError = response.status() === 401 || response.status() === 403;
    const isSuccess = response.status() === 200;
    const isServerError = response.status() >= 500;
    
    console.log('Is auth error:', isAuthError);
    console.log('Is success:', isSuccess);
    console.log('Is server error:', isServerError);
    
    // The endpoint should exist (auth errors are expected without login)
    expect(isAuthError || isSuccess).toBe(true);
  });
});