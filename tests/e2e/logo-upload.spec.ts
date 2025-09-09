import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Logo Upload Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to settings page
    await page.goto('/settings?tab=organization');
    
    // Wait for the page to load
    await expect(page.locator('h2:has-text("Organization Settings")')).toBeVisible();
  });

  test('should display logo upload section', async ({ page }) => {
    // Check that logo upload section is visible
    await expect(page.locator('text=Organization Logo')).toBeVisible();
    await expect(page.locator('text=Upload a logo for your organization.')).toBeVisible();
    
    // Should show upload button when no logo is present
    const uploadButton = page.locator('button:has-text("Upload Logo")');
    await expect(uploadButton).toBeVisible();
  });

  test('should upload a valid image file', async ({ page }) => {
    // Create a test image file path
    const testImagePath = path.join(__dirname, '../fixtures/test-logo.jpg');
    
    // Mock the API response for successful upload
    await page.route('/api/settings/organization/logo', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'org-123',
              name: 'Test Organization',
              logo_url: 'https://example.com/test-logo.jpg',
              updated_at: new Date().toISOString(),
            },
            message: 'Logo uploaded successfully'
          })
        });
      }
    });

    // Click upload button to trigger file input
    await page.locator('button:has-text("Upload Logo")').click();
    
    // Upload the file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testImagePath);

    // Wait for upload to complete and check success message
    await expect(page.locator('.toast:has-text("Logo uploaded successfully")')).toBeVisible();
    
    // Should now show "Change Logo" and "Remove" buttons
    await expect(page.locator('button:has-text("Change Logo")')).toBeVisible();
    await expect(page.locator('button:has-text("Remove")')).toBeVisible();
  });

  test('should show error for invalid file type', async ({ page }) => {
    // Create a test text file path
    const testFilePath = path.join(__dirname, '../fixtures/test-document.txt');
    
    // Click upload button
    await page.locator('button:has-text("Upload Logo")').click();
    
    // Try to upload invalid file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);

    // Should show error message
    await expect(page.locator('.toast:has-text("Please select a valid image file")')).toBeVisible();
  });

  test('should show error for file too large', async ({ page }) => {
    // Mock a large file by intercepting the file input change
    await page.evaluate(() => {
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        // Create a mock large file
        const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
        
        // Trigger change event with large file
        const event = new Event('change', { bubbles: true });
        Object.defineProperty(event, 'target', {
          value: { files: [largeFile] },
          enumerable: true
        });
        fileInput.dispatchEvent(event);
      }
    });

    // Should show error message
    await expect(page.locator('.toast:has-text("File size must be less than 5MB")')).toBeVisible();
  });

  test('should remove logo successfully', async ({ page }) => {
    // Mock organization with existing logo
    await page.route('/api/settings/organization', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'org-123',
              name: 'Test Organization',
              logo_url: 'https://example.com/existing-logo.jpg',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          })
        });
      }
    });

    // Mock successful logo removal
    await page.route('/api/settings/organization/logo', async route => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'org-123',
              name: 'Test Organization',
              logo_url: null,
              updated_at: new Date().toISOString(),
            },
            message: 'Logo removed successfully'
          })
        });
      }
    });

    // Reload page to get organization with logo
    await page.reload();
    await expect(page.locator('h2:has-text("Organization Settings")')).toBeVisible();

    // Should show existing logo and remove button
    await expect(page.locator('img[alt="Organization logo"]')).toBeVisible();
    await expect(page.locator('button:has-text("Remove")')).toBeVisible();

    // Click remove button
    await page.locator('button:has-text("Remove")').click();

    // Should show success message
    await expect(page.locator('.toast:has-text("Logo removed successfully")')).toBeVisible();
    
    // Should now show upload button again
    await expect(page.locator('button:has-text("Upload Logo")')).toBeVisible();
  });

  test('should handle upload failure gracefully', async ({ page }) => {
    const testImagePath = path.join(__dirname, '../fixtures/test-logo.jpg');
    
    // Mock API failure
    await page.route('/api/settings/organization/logo', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Failed to upload file'
          })
        });
      }
    });

    // Try to upload file
    await page.locator('button:has-text("Upload Logo")').click();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testImagePath);

    // Should show error message
    await expect(page.locator('.toast:has-text("Failed to upload file")')).toBeVisible();
  });

  test('should show loading states during operations', async ({ page }) => {
    const testImagePath = path.join(__dirname, '../fixtures/test-logo.jpg');
    
    // Mock slow API response
    await page.route('/api/settings/organization/logo', async route => {
      if (route.request().method() === 'POST') {
        // Delay response to test loading state
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'org-123',
              name: 'Test Organization',
              logo_url: 'https://example.com/test-logo.jpg',
              updated_at: new Date().toISOString(),
            }
          })
        });
      }
    });

    // Start upload
    await page.locator('button:has-text("Upload Logo")').click();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testImagePath);

    // Should show loading state
    await expect(page.locator('button:has-text("Uploading...")')).toBeVisible();
    await expect(page.locator('.animate-spin')).toBeVisible();

    // Wait for completion
    await expect(page.locator('button:has-text("Change Logo")')).toBeVisible({ timeout: 5000 });
  });

  test('should disable buttons when disabled prop is set', async ({ page }) => {
    // Mock organization in editing state (which disables logo upload)
    await page.locator('button:has-text("Edit")').click();

    // Logo upload buttons should be disabled during name editing
    const uploadButton = page.locator('button:has-text("Upload Logo")');
    await expect(uploadButton).toBeDisabled();
  });

  test('should maintain accessibility standards', async ({ page }) => {
    // Check for proper labels
    await expect(page.locator('label:has-text("Organization Logo")')).toBeVisible();
    
    // Check for alt text on logo image when present
    await page.route('/api/settings/organization', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'org-123',
              name: 'Test Organization',
              logo_url: 'https://example.com/logo.jpg',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          })
        });
      }
    });

    await page.reload();
    await expect(page.locator('img[alt="Organization logo"]')).toBeVisible();
    
    // Check that file input has proper accept attribute
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/jpg,image/png,image/webp');
  });
});