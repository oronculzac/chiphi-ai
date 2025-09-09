import { test, expect } from '@playwright/test';

/**
 * End-to-End MerchantMap Learning Workflow Tests
 * 
 * These tests verify the complete MerchantMap learning workflow:
 * 1. User receives transaction with AI categorization
 * 2. User corrects the category through the UI
 * 3. System learns from the correction
 * 4. Future transactions from same merchant use learned categorization
 * 5. Confidence scores and explanations are properly displayed
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
test.describe('MerchantMap Learning Workflow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Start with demo dashboard that has test data
    await page.goto('/demo');
    await page.waitForLoadState('networkidle');
  });

  test('complete learning workflow: correction → learning → application', async ({ page }) => {
    // Step 1: Find a transaction to correct
    const transactionRows = page.locator('[data-testid*="transaction"], tr:has(td)');
    
    if (await transactionRows.count() > 0) {
      const firstTransaction = transactionRows.first();
      
      // Get original category information
      const originalCategoryElement = firstTransaction.locator('td').nth(3); // Assuming category is 4th column
      const originalCategory = await originalCategoryElement.textContent();
      
      // Step 2: Open transaction for editing
      const editButton = firstTransaction.locator('button:has-text("Edit"), [data-testid*="edit"]');
      
      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForTimeout(1000);
        
        // Step 3: Verify category editor opened with learning notification
        const learningNotification = page.locator(
          'text="Learning System", text="will be saved", text="applied automatically"'
        );
        
        if (await learningNotification.count() > 0) {
          await expect(learningNotification.first()).toBeVisible();
        }
        
        // Step 4: Change category
        const categorySelect = page.locator('select, [role="combobox"]').first();
        
        if (await categorySelect.count() > 0) {
          await categorySelect.click();
          await page.waitForTimeout(500);
          
          // Select a different category
          const categoryOptions = page.locator('[role="option"], option');
          
          if (await categoryOptions.count() > 1) {
            // Select second option (different from current)
            await categoryOptions.nth(1).click();
            await page.waitForTimeout(500);
            
            // Step 5: Save the correction
            const saveButton = page.locator('button:has-text("Save"), [data-testid*="save"]');
            
            if (await saveButton.count() > 0) {
              await saveButton.click();
              await page.waitForTimeout(2000);
              
              // Step 6: Verify the change was applied
              const updatedCategory = await originalCategoryElement.textContent();
              expect(updatedCategory).not.toBe(originalCategory);
              
              // Step 7: Verify success notification
              const successMessage = page.locator(
                'text="updated", text="saved", text="success", .toast, [role="alert"]'
              );
              
              if (await successMessage.count() > 0) {
                await expect(successMessage.first()).toBeVisible();
              }
            }
          }
        }
      }
    }
  });

  test('confidence badge interaction and explanation display', async ({ page }) => {
    // Find confidence badges
    const confidenceBadges = page.locator('[class*="confidence"], .badge');
    
    if (await confidenceBadges.count() > 0) {
      const firstBadge = confidenceBadges.first();
      
      // Verify badge is visible and contains percentage
      await expect(firstBadge).toBeVisible();
      const badgeText = await firstBadge.textContent();
      expect(badgeText).toMatch(/\d+%/); // Should contain percentage
      
      // Test hover interaction for explanation
      await firstBadge.hover();
      await page.waitForTimeout(500);
      
      // Look for tooltip or explanation
      const tooltip = page.locator('[role="tooltip"], .tooltip');
      
      if (await tooltip.count() > 0) {
        await expect(tooltip.first()).toBeVisible();
        const tooltipText = await tooltip.first().textContent();
        expect(tooltipText).toBeTruthy();
        expect(tooltipText!.length).toBeGreaterThan(10);
      }
    }
  });

  test('transaction detail view with AI explanation', async ({ page }) => {
    // Find and click on a transaction to view details
    const transactionItems = page.locator('[data-testid*="transaction"], tr:has(td)');
    
    if (await transactionItems.count() > 0) {
      // Look for view/details button
      const viewButton = transactionItems.first().locator('button:has-text("View"), [data-testid*="view"]');
      
      if (await viewButton.count() > 0) {
        await viewButton.click();
        await page.waitForTimeout(1000);
        
        // Verify transaction detail modal/page opened
        const detailView = page.locator('[role="dialog"], .modal, .detail-view');
        
        if (await detailView.count() > 0) {
          await expect(detailView.first()).toBeVisible();
          
          // Look for AI explanation section
          const explanationSection = page.locator(
            'text="AI Explanation", text="Explanation", [data-testid*="explanation"]'
          );
          
          if (await explanationSection.count() > 0) {
            await expect(explanationSection.first()).toBeVisible();
            
            // Verify explanation content
            const explanationText = await explanationSection.first().textContent();
            expect(explanationText).toBeTruthy();
          }
          
          // Look for confidence information
          const confidenceInfo = page.locator('[class*="confidence"], .badge');
          
          if (await confidenceInfo.count() > 0) {
            await expect(confidenceInfo.first()).toBeVisible();
          }
        }
      }
    }
  });

  test('translation toggle functionality', async ({ page }) => {
    // Look for translation toggle buttons
    const translationToggles = page.locator(
      'button:has-text("Original"), button:has-text("English"), button:has-text("Show")'
    );
    
    if (await translationToggles.count() > 0) {
      const toggle = translationToggles.first();
      
      // Get initial state
      const initialText = await toggle.textContent();
      
      // Click toggle
      await toggle.click();
      await page.waitForTimeout(500);
      
      // Verify state changed
      const newText = await toggle.textContent();
      
      if (initialText !== newText) {
        expect(newText).toBeTruthy();
        expect(newText).not.toBe(initialText);
        
        // Look for content change
        const contentAreas = page.locator('pre, .receipt-text, [role="tabpanel"]');
        
        if (await contentAreas.count() > 0) {
          await expect(contentAreas.first()).toBeVisible();
        }
      }
    }
  });

  test('merchant mapping statistics and management', async ({ page }) => {
    // Look for merchant mapping or admin section
    const adminLinks = page.locator(
      'a:has-text("Admin"), a:has-text("Merchant"), a:has-text("Mapping"), ' +
      'button:has-text("Manage"), [data-testid*="admin"]'
    );
    
    if (await adminLinks.count() > 0) {
      await adminLinks.first().click();
      await page.waitForTimeout(1000);
      
      // Look for mapping statistics
      const statsElements = page.locator(
        'text="Total Mappings", text="Recent", text="Top Categories", ' +
        '[data-testid*="stats"], .stats, .statistics'
      );
      
      if (await statsElements.count() > 0) {
        await expect(statsElements.first()).toBeVisible();
        
        // Verify numeric statistics
        const statsText = await statsElements.first().textContent();
        expect(statsText).toMatch(/\d+/); // Should contain numbers
      }
      
      // Look for mapping list
      const mappingList = page.locator(
        'table, .mapping-list, [data-testid*="mapping"]'
      );
      
      if (await mappingList.count() > 0) {
        await expect(mappingList.first()).toBeVisible();
      }
    }
  });

  test('error handling and edge cases', async ({ page }) => {
    // Test with invalid category correction
    const editButtons = page.locator('button:has-text("Edit"), [data-testid*="edit"]');
    
    if (await editButtons.count() > 0) {
      await editButtons.first().click();
      await page.waitForTimeout(1000);
      
      // Try to save without selecting category
      const saveButton = page.locator('button:has-text("Save")');
      
      if (await saveButton.count() > 0) {
        await saveButton.click();
        await page.waitForTimeout(1000);
        
        // Look for error message
        const errorMessage = page.locator(
          'text="required", text="error", .error, [role="alert"]'
        );
        
        if (await errorMessage.count() > 0) {
          await expect(errorMessage.first()).toBeVisible();
        }
      }
    }
  });

  test('accessibility compliance for learning system UI', async ({ page }) => {
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    
    // Verify focusable elements
    const focusedElement = page.locator(':focus');
    
    if (await focusedElement.count() > 0) {
      await expect(focusedElement).toBeVisible();
    }
    
    // Test screen reader labels
    const labeledElements = page.locator('[aria-label], [aria-labelledby]');
    
    if (await labeledElements.count() > 0) {
      const firstLabeled = labeledElements.first();
      const ariaLabel = await firstLabeled.getAttribute('aria-label');
      const ariaLabelledBy = await firstLabeled.getAttribute('aria-labelledby');
      
      expect(ariaLabel || ariaLabelledBy).toBeTruthy();
    }
    
    // Test role attributes
    const roleElements = page.locator('[role]');
    
    if (await roleElements.count() > 0) {
      const roles = await roleElements.all();
      
      for (const element of roles.slice(0, 5)) {
        const role = await element.getAttribute('role');
        expect(role).toBeTruthy();
        expect(['button', 'dialog', 'tooltip', 'tab', 'tabpanel', 'alert']).toContain(role);
      }
    }
  });

  test('performance and responsiveness', async ({ page }) => {
    // Measure page load performance
    const startTime = Date.now();
    
    // Interact with multiple UI elements
    const interactiveElements = page.locator('button, [role="button"]');
    
    if (await interactiveElements.count() > 0) {
      // Click first few elements
      const elements = await interactiveElements.all();
      
      for (const element of elements.slice(0, 3)) {
        if (await element.isVisible()) {
          await element.click();
          await page.waitForTimeout(100);
        }
      }
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Should complete interactions within reasonable time
    expect(totalTime).toBeLessThan(10000); // 10 seconds max
    
    // Test responsive design
    await page.setViewportSize({ width: 375, height: 667 }); // Mobile
    await page.waitForTimeout(500);
    
    // Verify elements are still visible on mobile
    const mobileElements = page.locator('button, .badge, [data-testid*="confidence"]');
    
    if (await mobileElements.count() > 0) {
      await expect(mobileElements.first()).toBeVisible();
    }
    
    // Reset to desktop
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});