import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

// Test configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

test.describe('Notifications Preferences E2E', () => {
  let supabase: ReturnType<typeof createClient<Database>>;
  let testOrgId: string;
  let testUserId: string;
  let testUserEmail: string;

  test.beforeEach(async ({ page }) => {
    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Create test organization
    const { data: org, error: orgError } = await supabase
      .from('orgs')
      .insert({ name: 'E2E Notifications Test Org' })
      .select()
      .single();

    if (orgError) throw orgError;
    testOrgId = org.id;

    // Create test user
    testUserEmail = `notifications-e2e-${Date.now()}@example.com`;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testUserEmail,
      password: 'test-password-123',
      email_confirm: true,
    });

    if (authError) throw authError;
    testUserId = authData.user.id;

    // Add user to organization
    const { error: memberError } = await supabase
      .from('org_members')
      .insert({
        org_id: testOrgId,
        user_id: testUserId,
        role: 'owner',
      });

    if (memberError) throw memberError;

    // Sign in the user
    await page.goto('/auth/signin');
    await page.fill('input[type="email"]', testUserEmail);
    await page.fill('input[type="password"]', 'test-password-123');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard');
  });

  test.afterEach(async () => {
    // Clean up test data
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
    if (testOrgId) {
      await supabase.from('orgs').delete().eq('id', testOrgId);
    }
  });

  test('should display default notification preferences', async ({ page }) => {
    // Navigate to settings notifications tab
    await page.goto('/settings?tab=notifications');

    // Wait for the page to load
    await expect(page.locator('h2')).toContainText('Notification Preferences');

    // Check default toggle states
    const receiptToggle = page.locator('input[id="receipt-processed"]');
    const dailyToggle = page.locator('input[id="daily-summary"]');
    const weeklyToggle = page.locator('input[id="weekly-summary"]');

    await expect(receiptToggle).toBeChecked();
    await expect(dailyToggle).not.toBeChecked();
    await expect(weeklyToggle).not.toBeChecked();

    // Check that no additional emails are shown
    await expect(page.locator('text=No additional email recipients configured')).toBeVisible();
  });

  test('should toggle notification preferences', async ({ page }) => {
    await page.goto('/settings?tab=notifications');

    // Wait for the page to load
    await expect(page.locator('h2')).toContainText('Notification Preferences');

    // Toggle daily summary on
    const dailyToggle = page.locator('input[id="daily-summary"]');
    await dailyToggle.click();

    // Wait for success toast
    await expect(page.locator('.toast')).toContainText('Notification preferences updated successfully');

    // Verify the toggle is now checked
    await expect(dailyToggle).toBeChecked();

    // Refresh page and verify persistence
    await page.reload();
    await expect(page.locator('input[id="daily-summary"]')).toBeChecked();
  });

  test('should add and remove email addresses', async ({ page }) => {
    await page.goto('/settings?tab=notifications');

    // Wait for the page to load
    await expect(page.locator('h2')).toContainText('Notification Preferences');

    // Click add email button
    await page.click('button:has-text("Add email address")');

    // Enter email address
    const emailInput = page.locator('input[placeholder="Enter email address"]');
    await emailInput.fill('test-notification@example.com');

    // Click add button
    await page.click('button:has-text("Add")');

    // Wait for success toast
    await expect(page.locator('.toast')).toContainText('Notification preferences updated successfully');

    // Verify email is displayed
    await expect(page.locator('text=test-notification@example.com')).toBeVisible();

    // Remove the email
    const removeButton = page.locator('[data-testid="remove-email-test-notification@example.com"]').first();
    await removeButton.click();

    // Wait for success toast
    await expect(page.locator('.toast')).toContainText('Notification preferences updated successfully');

    // Verify email is removed
    await expect(page.locator('text=test-notification@example.com')).not.toBeVisible();
    await expect(page.locator('text=No additional email recipients configured')).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/settings?tab=notifications');

    // Wait for the page to load
    await expect(page.locator('h2')).toContainText('Notification Preferences');

    // Click add email button
    await page.click('button:has-text("Add email address")');

    // Enter invalid email
    const emailInput = page.locator('input[placeholder="Enter email address"]');
    await emailInput.fill('invalid-email');

    // Click add button
    await page.click('button:has-text("Add")');

    // Wait for error toast
    await expect(page.locator('.toast')).toContainText('Please enter a valid email address');

    // Verify email was not added
    await expect(page.locator('text=invalid-email')).not.toBeVisible();
  });

  test('should prevent duplicate email addresses', async ({ page }) => {
    await page.goto('/settings?tab=notifications');

    // Wait for the page to load
    await expect(page.locator('h2')).toContainText('Notification Preferences');

    // Add first email
    await page.click('button:has-text("Add email address")');
    const emailInput = page.locator('input[placeholder="Enter email address"]');
    await emailInput.fill('duplicate@example.com');
    await page.click('button:has-text("Add")');

    // Wait for success toast
    await expect(page.locator('.toast')).toContainText('Notification preferences updated successfully');

    // Try to add the same email again
    await page.click('button:has-text("Add email address")');
    const emailInput2 = page.locator('input[placeholder="Enter email address"]');
    await emailInput2.fill('duplicate@example.com');
    await page.click('button:has-text("Add")');

    // Wait for error toast
    await expect(page.locator('.toast')).toContainText('This email address is already in your notification list');

    // Verify only one instance of the email exists
    const emailElements = page.locator('text=duplicate@example.com');
    await expect(emailElements).toHaveCount(1);
  });

  test('should handle keyboard navigation for email input', async ({ page }) => {
    await page.goto('/settings?tab=notifications');

    // Wait for the page to load
    await expect(page.locator('h2')).toContainText('Notification Preferences');

    // Click add email button
    await page.click('button:has-text("Add email address")');

    // Enter email and press Enter
    const emailInput = page.locator('input[placeholder="Enter email address"]');
    await emailInput.fill('keyboard@example.com');
    await emailInput.press('Enter');

    // Wait for success toast
    await expect(page.locator('.toast')).toContainText('Notification preferences updated successfully');

    // Verify email is displayed
    await expect(page.locator('text=keyboard@example.com')).toBeVisible();
  });

  test('should cancel email input with Escape key', async ({ page }) => {
    await page.goto('/settings?tab=notifications');

    // Wait for the page to load
    await expect(page.locator('h2')).toContainText('Notification Preferences');

    // Click add email button
    await page.click('button:has-text("Add email address")');

    // Enter email and press Escape
    const emailInput = page.locator('input[placeholder="Enter email address"]');
    await emailInput.fill('cancel@example.com');
    await emailInput.press('Escape');

    // Verify input is hidden and add button is shown again
    await expect(emailInput).not.toBeVisible();
    await expect(page.locator('button:has-text("Add email address")')).toBeVisible();
  });

  test('should show loading state while saving', async ({ page }) => {
    await page.goto('/settings?tab=notifications');

    // Wait for the page to load
    await expect(page.locator('h2')).toContainText('Notification Preferences');

    // Intercept the API call to add delay
    await page.route('/api/settings/notifications', async (route) => {
      // Add delay to simulate slow network
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.continue();
    });

    // Toggle a preference
    const dailyToggle = page.locator('input[id="daily-summary"]');
    await dailyToggle.click();

    // Verify toggle is disabled during save
    await expect(dailyToggle).toBeDisabled();

    // Wait for save to complete
    await expect(page.locator('.toast')).toContainText('Notification preferences updated successfully');

    // Verify toggle is enabled again
    await expect(dailyToggle).toBeEnabled();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    await page.goto('/settings?tab=notifications');

    // Wait for the page to load
    await expect(page.locator('h2')).toContainText('Notification Preferences');

    // Intercept the API call to return error
    await page.route('/api/settings/notifications', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      } else {
        await route.continue();
      }
    });

    // Try to toggle a preference
    const dailyToggle = page.locator('input[id="daily-summary"]');
    await dailyToggle.click();

    // Wait for error toast
    await expect(page.locator('.toast')).toContainText('Failed to update notification preferences');

    // Verify toggle reverted to original state
    await expect(dailyToggle).not.toBeChecked();
  });

  test('should persist preferences across page refreshes', async ({ page }) => {
    await page.goto('/settings?tab=notifications');

    // Wait for the page to load
    await expect(page.locator('h2')).toContainText('Notification Preferences');

    // Toggle all preferences and add email
    await page.click('input[id="receipt-processed"]'); // Turn off
    await page.click('input[id="daily-summary"]'); // Turn on
    await page.click('input[id="weekly-summary"]'); // Turn on

    // Add email
    await page.click('button:has-text("Add email address")');
    await page.fill('input[placeholder="Enter email address"]', 'persist@example.com');
    await page.click('button:has-text("Add")');

    // Wait for all updates to complete
    await page.waitForTimeout(1000);

    // Refresh the page
    await page.reload();

    // Verify all preferences are persisted
    await expect(page.locator('input[id="receipt-processed"]')).not.toBeChecked();
    await expect(page.locator('input[id="daily-summary"]')).toBeChecked();
    await expect(page.locator('input[id="weekly-summary"]')).toBeChecked();
    await expect(page.locator('text=persist@example.com')).toBeVisible();
  });

  test('should be accessible with keyboard navigation', async ({ page }) => {
    await page.goto('/settings?tab=notifications');

    // Wait for the page to load
    await expect(page.locator('h2')).toContainText('Notification Preferences');

    // Test keyboard navigation through toggles
    await page.keyboard.press('Tab'); // Focus first toggle
    await page.keyboard.press('Space'); // Toggle it
    
    // Wait for update
    await expect(page.locator('.toast')).toContainText('Notification preferences updated successfully');

    // Continue tabbing to other elements
    await page.keyboard.press('Tab'); // Next toggle
    await page.keyboard.press('Tab'); // Next toggle
    await page.keyboard.press('Tab'); // Add email button
    await page.keyboard.press('Enter'); // Activate add email

    // Verify email input is focused
    const emailInput = page.locator('input[placeholder="Enter email address"]');
    await expect(emailInput).toBeFocused();
  });
});