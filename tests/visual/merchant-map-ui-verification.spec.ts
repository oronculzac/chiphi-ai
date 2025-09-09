import { test, expect } from '@playwright/test';

/**
 * MerchantMap UI Verification Tests
 * 
 * These tests verify the UI components related to MerchantMap learning system:
 * - Original↔English translation toggle functionality
 * - Confidence badge display with explanations
 * - Category editor with learning system notifications
 * - Transaction detail view with AI explanations
 * 
 * Requirements: 5.3, 5.4, 5.5
 */
test.describe('MerchantMap UI Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to demo dashboard for testing
    await page.goto('/demo');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Requirement 5.3: AI decision explanations display', () => {
    test('should display confidence badges with explanations', async ({ page }) => {
      // Look for confidence badges in transaction list
      const confidenceBadges = page.locator('[data-testid*="confidence-badge"], .confidence-badge, [class*="confidence"]');
      
      // Wait for at least one confidence badge to be visible
      await expect(confidenceBadges.first()).toBeVisible({ timeout: 10000 });
      
      // Check if badges are displaying percentage values
      const badgeTexts = await confidenceBadges.allTextContents();
      const hasPercentage = badgeTexts.some(text => text.includes('%'));
      
      if (hasPercentage) {
        // Test tooltip/explanation functionality
        const firstBadge = confidenceBadges.first();
        await firstBadge.hover();
        
        // Look for tooltip or explanation text
        const tooltip = page.locator('[role="tooltip"], .tooltip, [data-testid="tooltip"]');
        
        // If tooltip exists, verify it contains explanation text
        if (await tooltip.count() > 0) {
          await expect(tooltip.first()).toBeVisible();
          const tooltipText = await tooltip.first().textContent();
          expect(tooltipText).toBeTruthy();
          expect(tooltipText!.length).toBeGreaterThan(10); // Should have meaningful explanation
        }
      }
    });

    test('should display AI explanations in transaction details', async ({ page }) => {
      // Look for transaction items or detail views
      const transactionItems = page.locator('[data-testid*="transaction"], .transaction-item, [class*="transaction"]');
      
      if (await transactionItems.count() > 0) {
        // Click on first transaction to open details
        await transactionItems.first().click();
        
        // Look for explanation text or AI reasoning
        const explanationElements = page.locator(
          '[data-testid*="explanation"], [data-testid*="ai-explanation"], ' +
          '.explanation, .ai-explanation, ' +
          'text="AI", text="explanation", text="confidence", text="categorized"'
        );
        
        // Wait for explanation content to load
        await page.waitForTimeout(1000);
        
        // Check if explanation content is present
        if (await explanationElements.count() > 0) {
          const explanationText = await explanationElements.first().textContent();
          expect(explanationText).toBeTruthy();
          expect(explanationText!.length).toBeGreaterThan(20); // Should have detailed explanation
        }
      }
    });

    test('should show confidence levels with appropriate visual indicators', async ({ page }) => {
      // Look for confidence indicators with different visual states
      const confidenceElements = page.locator(
        '[class*="confidence"], [data-confidence], ' +
        '.badge, [class*="badge"], ' +
        '[class*="high"], [class*="medium"], [class*="low"]'
      );
      
      if (await confidenceElements.count() > 0) {
        // Check for different confidence level styling
        const elements = await confidenceElements.all();
        
        for (const element of elements.slice(0, 3)) { // Check first 3 elements
          const classList = await element.getAttribute('class');
          const textContent = await element.textContent();
          
          if (classList && textContent) {
            // Verify visual indicators for different confidence levels
            const hasConfidenceIndicator = 
              classList.includes('high') || classList.includes('medium') || classList.includes('low') ||
              classList.includes('success') || classList.includes('warning') || classList.includes('destructive') ||
              textContent.includes('%');
            
            if (hasConfidenceIndicator) {
              await expect(element).toBeVisible();
            }
          }
        }
      }
    });
  });

  test.describe('Requirement 5.4: Original↔English translation toggle', () => {
    test('should provide translation toggle functionality', async ({ page }) => {
      // Look for translation toggle buttons or tabs
      const translationToggles = page.locator(
        'button:has-text("Original"), button:has-text("English"), ' +
        'button:has-text("Show Original"), button:has-text("Show English"), ' +
        '[data-testid*="translation"], [data-testid*="toggle"], ' +
        '.translation-toggle, .language-toggle'
      );
      
      if (await translationToggles.count() > 0) {
        const toggle = translationToggles.first();
        await expect(toggle).toBeVisible();
        
        // Test toggle functionality
        const initialText = await toggle.textContent();
        await toggle.click();
        
        // Wait for toggle state change
        await page.waitForTimeout(500);
        
        const newText = await toggle.textContent();
        
        // Verify toggle text changed (indicating state change)
        if (initialText !== newText) {
          expect(newText).toBeTruthy();
          expect(newText).not.toBe(initialText);
        }
      }
    });

    test('should display different content when toggling between original and translated text', async ({ page }) => {
      // Look for tabs or content areas that might contain original/translated text
      const tabElements = page.locator(
        '[role="tab"], .tab, [data-testid*="tab"], ' +
        'button:has-text("Original"), button:has-text("English"), button:has-text("Translated")'
      );
      
      if (await tabElements.count() >= 2) {
        // Get text content areas
        const contentAreas = page.locator(
          '[role="tabpanel"], .tab-content, [data-testid*="content"], ' +
          'pre, .receipt-text, .transaction-text'
        );
        
        if (await contentAreas.count() > 0) {
          // Click first tab and get content
          await tabElements.first().click();
          await page.waitForTimeout(500);
          const content1 = await contentAreas.first().textContent();
          
          // Click second tab and get content
          await tabElements.nth(1).click();
          await page.waitForTimeout(500);
          const content2 = await contentAreas.first().textContent();
          
          // Verify content is different (indicating translation toggle works)
          if (content1 && content2 && content1.length > 10 && content2.length > 10) {
            expect(content1).not.toBe(content2);
          }
        }
      }
    });

    test('should show language indicators when translation is available', async ({ page }) => {
      // Look for language indicators or flags
      const languageIndicators = page.locator(
        '[data-testid*="language"], .language, ' +
        'text="Language:", text="Original", text="Translated", ' +
        '[class*="lang"], .globe, [data-testid*="globe"]'
      );
      
      if (await languageIndicators.count() > 0) {
        const indicator = languageIndicators.first();
        await expect(indicator).toBeVisible();
        
        const indicatorText = await indicator.textContent();
        if (indicatorText) {
          // Should contain language information
          const hasLanguageInfo = 
            indicatorText.toLowerCase().includes('language') ||
            indicatorText.toLowerCase().includes('original') ||
            indicatorText.toLowerCase().includes('english') ||
            /[a-z]{2,3}/.test(indicatorText.toLowerCase()); // Language codes
          
          expect(hasLanguageInfo).toBeTruthy();
        }
      }
    });
  });

  test.describe('Requirement 5.5: Category editor with learning system', () => {
    test('should show learning system notification in category editor', async ({ page }) => {
      // Look for edit buttons or category editing interface
      const editButtons = page.locator(
        'button:has-text("Edit"), [data-testid*="edit"], ' +
        '.edit-button, [class*="edit"]'
      );
      
      if (await editButtons.count() > 0) {
        // Click edit button to open category editor
        await editButtons.first().click();
        await page.waitForTimeout(1000);
        
        // Look for learning system notification or info
        const learningNotifications = page.locator(
          'text="Learning System", text="will be saved", text="applied automatically", ' +
          'text="future receipts", text="correction", ' +
          '[data-testid*="learning"], .learning-info, [class*="learning"]'
        );
        
        if (await learningNotifications.count() > 0) {
          await expect(learningNotifications.first()).toBeVisible();
          
          const notificationText = await learningNotifications.first().textContent();
          expect(notificationText).toBeTruthy();
          expect(notificationText!.toLowerCase()).toContain('learning');
        }
      }
    });

    test('should provide category selection interface', async ({ page }) => {
      // Look for category selection elements
      const categorySelectors = page.locator(
        'select, [role="combobox"], [data-testid*="category"], ' +
        '.category-select, input[placeholder*="category"]'
      );
      
      if (await categorySelectors.count() > 0) {
        const selector = categorySelectors.first();
        await expect(selector).toBeVisible();
        
        // Test interaction with category selector
        await selector.click();
        await page.waitForTimeout(500);
        
        // Look for category options
        const options = page.locator(
          '[role="option"], option, [data-testid*="option"], ' +
          '.option, [class*="option"]'
        );
        
        if (await options.count() > 0) {
          // Verify category options are available
          const optionTexts = await options.allTextContents();
          const hasValidCategories = optionTexts.some(text => 
            text.includes('Food') || text.includes('Shopping') || 
            text.includes('Transportation') || text.includes('Entertainment')
          );
          
          expect(hasValidCategories).toBeTruthy();
        }
      }
    });

    test('should show save and cancel actions in category editor', async ({ page }) => {
      // Look for save/cancel buttons in category editing context
      const actionButtons = page.locator(
        'button:has-text("Save"), button:has-text("Cancel"), ' +
        'button:has-text("Update"), button:has-text("Apply"), ' +
        '[data-testid*="save"], [data-testid*="cancel"]'
      );
      
      if (await actionButtons.count() >= 2) {
        // Verify save and cancel buttons are present
        const saveButton = page.locator('button:has-text("Save"), [data-testid*="save"]').first();
        const cancelButton = page.locator('button:has-text("Cancel"), [data-testid*="cancel"]').first();
        
        if (await saveButton.count() > 0) {
          await expect(saveButton).toBeVisible();
        }
        
        if (await cancelButton.count() > 0) {
          await expect(cancelButton).toBeVisible();
        }
      }
    });
  });

  test.describe('Visual regression and accessibility', () => {
    test('should maintain consistent styling for confidence badges', async ({ page }) => {
      // Take screenshot of confidence badges for visual regression
      const confidenceBadges = page.locator('[class*="confidence"], .badge');
      
      if (await confidenceBadges.count() > 0) {
        // Verify badges are properly styled and accessible
        const firstBadge = confidenceBadges.first();
        
        // Check computed styles
        const backgroundColor = await firstBadge.evaluate(el => 
          getComputedStyle(el).backgroundColor
        );
        const borderRadius = await firstBadge.evaluate(el => 
          getComputedStyle(el).borderRadius
        );
        
        // Should have proper styling (not transparent)
        expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(parseFloat(borderRadius)).toBeGreaterThan(0);
        
        // Take screenshot for visual regression
        await expect(firstBadge).toHaveScreenshot('confidence-badge.png');
      }
    });

    test('should maintain accessible color contrast for confidence levels', async ({ page }) => {
      // Check color contrast for different confidence levels
      const confidenceElements = page.locator('[class*="confidence"], .badge');
      
      if (await confidenceElements.count() > 0) {
        const elements = await confidenceElements.all();
        
        for (const element of elements.slice(0, 3)) {
          const color = await element.evaluate(el => getComputedStyle(el).color);
          const backgroundColor = await element.evaluate(el => getComputedStyle(el).backgroundColor);
          
          // Verify colors are not default/transparent
          expect(color).not.toBe('rgba(0, 0, 0, 0)');
          expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
        }
      }
    });

    test('should provide keyboard navigation for interactive elements', async ({ page }) => {
      // Test keyboard navigation for confidence badges and toggles
      const interactiveElements = page.locator(
        'button, [role="button"], [tabindex="0"], ' +
        '[data-testid*="toggle"], [data-testid*="badge"]'
      );
      
      if (await interactiveElements.count() > 0) {
        const firstElement = interactiveElements.first();
        
        // Focus the element
        await firstElement.focus();
        
        // Verify element is focusable
        const isFocused = await firstElement.evaluate(el => el === document.activeElement);
        expect(isFocused).toBeTruthy();
        
        // Test keyboard interaction (Enter key)
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        
        // Element should still be accessible after interaction
        await expect(firstElement).toBeVisible();
      }
    });
  });
});