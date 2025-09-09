/**
 * Transaction Drawer UI Tests
 * 
 * Playwright tests to verify transaction drawer shows AI explanations
 * and original/English text toggle functionality as specified in task 9.2
 * Requirements: 8.5 - Verify transaction drawer shows explanations and language toggle
 */

import { test, expect } from '@playwright/test';
import { AuthHelper, EmailHelper, DashboardHelper } from '../utils/test-helpers';
import { getTestOrg, getTestUser } from '../fixtures/test-organizations';
import { getEmailSample } from '../fixtures/email-samples';

test.describe('Transaction Drawer UI Tests', () => {
  let authHelper: AuthHelper;
  let emailHelper: EmailHelper;
  let dashboardHelper: DashboardHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    emailHelper = new EmailHelper(page);
    dashboardHelper = new DashboardHelper(page);
    
    // Login as primary test user
    await authHelper.loginAsUser('primaryOwner');
  });

  test.afterEach(async ({ page }) => {
    await authHelper.logout();
  });

  test.describe('AI Explanation Display', () => {
    test('should display AI explanation with confidence badge in transaction drawer', async ({ page }) => {
      // Step 1: Send test email and wait for processing
      const emailData = getEmailSample('starbucksCoffee');
      const testMessageId = `ui-test-explanation-${Date.now()}@example.com`;
      
      const response = await emailHelper.sendTestEmail({
        ...emailData,
        messageId: testMessageId,
      });
      expect(response.status()).toBe(200);

      // Wait for email processing
      const processingResult = await emailHelper.waitForEmailProcessing(testMessageId);
      expect(processingResult.success).toBe(true);

      // Step 2: Navigate to dashboard and find the transaction
      await dashboardHelper.navigateToDashboard();
      await page.goto('/dashboard/transactions');
      
      // Wait for transaction list to load
      await expect(page.locator('[data-testid="transaction-list"]')).toBeVisible();

      // Find the transaction row
      const transactionRow = page.locator('[data-testid^="transaction-"]').first();
      await expect(transactionRow).toBeVisible();

      // Step 3: Click transaction to open drawer/detail view
      await transactionRow.click();
      
      // Wait for transaction detail view to load
      await expect(page.locator('[data-testid="transaction-details"]')).toBeVisible();

      // Step 4: Verify AI explanation section is visible
      const explanationSection = page.locator('[data-testid="transaction-explanation"]');
      await expect(explanationSection).toBeVisible();

      // Verify explanation content exists and is meaningful
      const explanationText = await explanationSection.textContent();
      expect(explanationText).toBeTruthy();
      expect(explanationText!.length).toBeGreaterThan(10);
      expect(explanationText).toMatch(/coffee|starbucks|food|dining/i);

      // Step 5: Verify confidence badge is displayed
      const confidenceBadge = page.locator('[data-testid="confidence-badge"]');
      await expect(confidenceBadge).toBeVisible();

      // Verify confidence percentage is shown
      const confidenceText = await confidenceBadge.textContent();
      expect(confidenceText).toMatch(/\d+%/);
      
      // Extract confidence value and verify it's reasonable
      const confidenceMatch = confidenceText!.match(/(\d+)%/);
      expect(confidenceMatch).toBeTruthy();
      const confidenceValue = parseInt(confidenceMatch![1]);
      expect(confidenceValue).toBeGreaterThan(70); // Should have high confidence for Starbucks

      // Step 6: Verify confidence badge has appropriate styling
      if (confidenceValue >= 80) {
        await expect(confidenceBadge).toHaveClass(/.*high-confidence.*|.*success.*/);
      } else if (confidenceValue >= 60) {
        await expect(confidenceBadge).toHaveClass(/.*medium-confidence.*|.*warning.*/);
      } else {
        await expect(confidenceBadge).toHaveClass(/.*low-confidence.*|.*destructive.*/);
      }
    });

    test('should display detailed AI explanation in dedicated section', async ({ page }) => {
      // Step 1: Process a more complex receipt
      const emailData = getEmailSample('restaurantReceipt');
      const testMessageId = `ui-test-detailed-explanation-${Date.now()}@example.com`;
      
      const response = await emailHelper.sendTestEmail({
        ...emailData,
        messageId: testMessageId,
      });
      expect(response.status()).toBe(200);

      await emailHelper.waitForEmailProcessing(testMessageId);

      // Step 2: Navigate to transaction details
      await page.goto('/dashboard/transactions');
      const transactionRow = page.locator('[data-testid^="transaction-"]').first();
      await transactionRow.click();

      await expect(page.locator('[data-testid="transaction-details"]')).toBeVisible();

      // Step 3: Verify AI explanation section structure
      const explanationCard = page.locator('[data-testid="ai-explanation-card"]');
      await expect(explanationCard).toBeVisible();

      // Verify card header with title and confidence
      const explanationTitle = explanationCard.locator('h3, [data-testid="explanation-title"]');
      await expect(explanationTitle).toBeVisible();
      await expect(explanationTitle).toContainText(/AI Explanation|Why/i);

      // Verify explanation content is detailed
      const explanationContent = explanationCard.locator('[data-testid="explanation-content"]');
      await expect(explanationContent).toBeVisible();
      
      const explanationText = await explanationContent.textContent();
      expect(explanationText).toBeTruthy();
      expect(explanationText!.length).toBeGreaterThan(20);
      
      // Should contain reasoning about categorization
      expect(explanationText).toMatch(/restaurant|food|dining|categorized|because/i);
    });

    test('should show low confidence warning for unclear receipts', async ({ page }) => {
      // Step 1: Process a malformed/unclear receipt
      const emailData = getEmailSample('malformedReceipt');
      const testMessageId = `ui-test-low-confidence-${Date.now()}@example.com`;
      
      const response = await emailHelper.sendTestEmail({
        ...emailData,
        messageId: testMessageId,
      });
      expect(response.status()).toBe(200);

      await emailHelper.waitForEmailProcessing(testMessageId);

      // Step 2: Navigate to transaction details
      await page.goto('/dashboard/transactions');
      const transactionRow = page.locator('[data-testid^="transaction-"]').first();
      await transactionRow.click();

      await expect(page.locator('[data-testid="transaction-details"]')).toBeVisible();

      // Step 3: Verify low confidence indicators
      const confidenceBadge = page.locator('[data-testid="confidence-badge"]');
      await expect(confidenceBadge).toBeVisible();

      const confidenceText = await confidenceBadge.textContent();
      const confidenceMatch = confidenceText!.match(/(\d+)%/);
      const confidenceValue = parseInt(confidenceMatch![1]);
      
      if (confidenceValue < 70) {
        // Should show warning styling for low confidence
        await expect(confidenceBadge).toHaveClass(/.*low-confidence.*|.*destructive.*|.*warning.*/);
        
        // Should show review flag
        const reviewFlag = page.locator('[data-testid="review-flag"]');
        await expect(reviewFlag).toBeVisible();
        await expect(reviewFlag).toContainText(/review|check|verify/i);
      }
    });
  });

  test.describe('Original/English Text Toggle', () => {
    test('should display translation toggle for non-English receipts', async ({ page }) => {
      // Step 1: Process Spanish receipt
      const emailData = getEmailSample('spanishReceipt');
      const testMessageId = `ui-test-translation-toggle-${Date.now()}@example.com`;
      
      const response = await emailHelper.sendTestEmail({
        ...emailData,
        messageId: testMessageId,
      });
      expect(response.status()).toBe(200);

      // Wait for processing (translation takes longer)
      await emailHelper.waitForEmailProcessing(testMessageId, 45000);

      // Step 2: Navigate to transaction details
      await page.goto('/dashboard/transactions');
      const transactionRow = page.locator('[data-testid^="transaction-"]').first();
      await transactionRow.click();

      await expect(page.locator('[data-testid="transaction-details"]')).toBeVisible();

      // Step 3: Verify translation toggle is present
      const translationToggle = page.locator('[data-testid="translation-toggle"]');
      await expect(translationToggle).toBeVisible();

      // Verify toggle button text
      const toggleText = await translationToggle.textContent();
      expect(toggleText).toMatch(/show original|show english|original|translated/i);

      // Step 4: Verify language indicator
      const languageIndicator = page.locator('[data-testid="source-language"]');
      await expect(languageIndicator).toBeVisible();
      await expect(languageIndicator).toContainText(/spanish|es/i);
    });

    test('should toggle between original and translated text', async ({ page }) => {
      // Step 1: Process Spanish receipt
      const emailData = getEmailSample('spanishReceipt');
      const testMessageId = `ui-test-toggle-functionality-${Date.now()}@example.com`;
      
      const response = await emailHelper.sendTestEmail({
        ...emailData,
        messageId: testMessageId,
      });
      expect(response.status()).toBe(200);

      await emailHelper.waitForEmailProcessing(testMessageId, 45000);

      // Step 2: Navigate to transaction details
      await page.goto('/dashboard/transactions');
      const transactionRow = page.locator('[data-testid^="transaction-"]').first();
      await transactionRow.click();

      await expect(page.locator('[data-testid="transaction-details"]')).toBeVisible();

      // Step 3: Verify default state shows English translation
      const receiptTextArea = page.locator('[data-testid="receipt-text-content"]');
      await expect(receiptTextArea).toBeVisible();

      const initialText = await receiptTextArea.textContent();
      expect(initialText).toBeTruthy();

      // Should show English by default
      const translatedTextTab = page.locator('[data-testid="translated-text-tab"]');
      if (await translatedTextTab.isVisible()) {
        await expect(translatedTextTab).toHaveAttribute('data-state', 'active');
      }

      // Step 4: Click toggle to show original text
      const translationToggle = page.locator('[data-testid="translation-toggle"]');
      await translationToggle.click();

      // Wait for content to change
      await page.waitForTimeout(500);

      // Verify original text is now shown
      const originalTextTab = page.locator('[data-testid="original-text-tab"]');
      if (await originalTextTab.isVisible()) {
        await expect(originalTextTab).toHaveAttribute('data-state', 'active');
      }

      const originalText = await receiptTextArea.textContent();
      expect(originalText).toBeTruthy();
      expect(originalText).not.toBe(initialText); // Should be different from translated

      // Should contain Spanish text
      expect(originalText).toMatch(/restaurante|comida|total|€|precio/i);

      // Step 5: Toggle back to English
      await translationToggle.click();
      await page.waitForTimeout(500);

      const backToEnglishText = await receiptTextArea.textContent();
      expect(backToEnglishText).toBe(initialText); // Should match initial English text
    });

    test('should use tabs interface for translation toggle', async ({ page }) => {
      // Step 1: Process Spanish receipt
      const emailData = getEmailSample('spanishReceipt');
      const testMessageId = `ui-test-tabs-interface-${Date.now()}@example.com`;
      
      const response = await emailHelper.sendTestEmail({
        ...emailData,
        messageId: testMessageId,
      });
      expect(response.status()).toBe(200);

      await emailHelper.waitForEmailProcessing(testMessageId, 45000);

      // Step 2: Navigate to transaction details
      await page.goto('/dashboard/transactions');
      const transactionRow = page.locator('[data-testid^="transaction-"]').first();
      await transactionRow.click();

      await expect(page.locator('[data-testid="transaction-details"]')).toBeVisible();

      // Step 3: Verify tabs interface
      const tabsList = page.locator('[data-testid="translation-tabs"]');
      await expect(tabsList).toBeVisible();

      // Verify both tabs are present
      const englishTab = page.locator('[data-testid="translated-text-tab"]');
      const originalTab = page.locator('[data-testid="original-text-tab"]');
      
      await expect(englishTab).toBeVisible();
      await expect(originalTab).toBeVisible();

      // Verify tab labels
      await expect(englishTab).toContainText(/english|translation/i);
      await expect(originalTab).toContainText(/original|spanish|es/i);

      // Step 4: Test tab switching
      await originalTab.click();
      await expect(originalTab).toHaveAttribute('data-state', 'active');
      await expect(englishTab).toHaveAttribute('data-state', 'inactive');

      await englishTab.click();
      await expect(englishTab).toHaveAttribute('data-state', 'active');
      await expect(originalTab).toHaveAttribute('data-state', 'inactive');
    });

    test('should not show translation toggle for English-only receipts', async ({ page }) => {
      // Step 1: Process English receipt
      const emailData = getEmailSample('starbucksCoffee');
      const testMessageId = `ui-test-no-toggle-english-${Date.now()}@example.com`;
      
      const response = await emailHelper.sendTestEmail({
        ...emailData,
        messageId: testMessageId,
      });
      expect(response.status()).toBe(200);

      await emailHelper.waitForEmailProcessing(testMessageId);

      // Step 2: Navigate to transaction details
      await page.goto('/dashboard/transactions');
      const transactionRow = page.locator('[data-testid^="transaction-"]').first();
      await transactionRow.click();

      await expect(page.locator('[data-testid="transaction-details"]')).toBeVisible();

      // Step 3: Verify no translation toggle for English receipts
      const translationToggle = page.locator('[data-testid="translation-toggle"]');
      await expect(translationToggle).not.toBeVisible();

      const translationTabs = page.locator('[data-testid="translation-tabs"]');
      await expect(translationTabs).not.toBeVisible();

      // Should just show the receipt text directly
      const receiptTextArea = page.locator('[data-testid="receipt-text-content"]');
      await expect(receiptTextArea).toBeVisible();
      
      const receiptText = await receiptTextArea.textContent();
      expect(receiptText).toBeTruthy();
      expect(receiptText).toMatch(/starbucks|coffee|total/i);
    });

    test('should preserve scroll position when toggling translation', async ({ page }) => {
      // Step 1: Process long Spanish receipt
      const emailData = getEmailSample('longSpanishReceipt');
      const testMessageId = `ui-test-scroll-preservation-${Date.now()}@example.com`;
      
      const response = await emailHelper.sendTestEmail({
        ...emailData,
        messageId: testMessageId,
      });
      expect(response.status()).toBe(200);

      await emailHelper.waitForEmailProcessing(testMessageId, 45000);

      // Step 2: Navigate to transaction details
      await page.goto('/dashboard/transactions');
      const transactionRow = page.locator('[data-testid^="transaction-"]').first();
      await transactionRow.click();

      await expect(page.locator('[data-testid="transaction-details"]')).toBeVisible();

      // Step 3: Scroll down in receipt text area
      const receiptScrollArea = page.locator('[data-testid="receipt-scroll-area"]');
      await expect(receiptScrollArea).toBeVisible();

      // Scroll to middle of content
      await receiptScrollArea.evaluate(el => {
        el.scrollTop = el.scrollHeight / 2;
      });

      const scrollPosition = await receiptScrollArea.evaluate(el => el.scrollTop);
      expect(scrollPosition).toBeGreaterThan(0);

      // Step 4: Toggle translation
      const translationToggle = page.locator('[data-testid="translation-toggle"]');
      await translationToggle.click();
      await page.waitForTimeout(500);

      // Step 5: Verify scroll position is preserved
      const newScrollPosition = await receiptScrollArea.evaluate(el => el.scrollTop);
      expect(Math.abs(newScrollPosition - scrollPosition)).toBeLessThan(50); // Allow small variance
    });
  });

  test.describe('Transaction Drawer Accessibility', () => {
    test('should support keyboard navigation in transaction drawer', async ({ page }) => {
      // Step 1: Process test email
      const emailData = getEmailSample('spanishReceipt');
      const testMessageId = `ui-test-keyboard-nav-${Date.now()}@example.com`;
      
      const response = await emailHelper.sendTestEmail({
        ...emailData,
        messageId: testMessageId,
      });
      expect(response.status()).toBe(200);

      await emailHelper.waitForEmailProcessing(testMessageId, 45000);

      // Step 2: Navigate to transaction list
      await page.goto('/dashboard/transactions');
      
      // Step 3: Use keyboard to navigate to transaction
      await page.keyboard.press('Tab'); // Focus first interactive element
      
      // Find and focus transaction row
      const transactionRow = page.locator('[data-testid^="transaction-"]').first();
      await transactionRow.focus();
      
      // Press Enter to open transaction details
      await page.keyboard.press('Enter');
      
      await expect(page.locator('[data-testid="transaction-details"]')).toBeVisible();

      // Step 4: Test keyboard navigation within drawer
      // Tab to translation toggle
      await page.keyboard.press('Tab');
      const translationToggle = page.locator('[data-testid="translation-toggle"]');
      
      if (await translationToggle.isVisible()) {
        await expect(translationToggle).toBeFocused();
        
        // Press Enter to toggle
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        
        // Verify toggle worked
        const originalTab = page.locator('[data-testid="original-text-tab"]');
        if (await originalTab.isVisible()) {
          await expect(originalTab).toHaveAttribute('data-state', 'active');
        }
      }
    });

    test('should have proper ARIA labels for translation controls', async ({ page }) => {
      // Step 1: Process Spanish receipt
      const emailData = getEmailSample('spanishReceipt');
      const testMessageId = `ui-test-aria-labels-${Date.now()}@example.com`;
      
      const response = await emailHelper.sendTestEmail({
        ...emailData,
        messageId: testMessageId,
      });
      expect(response.status()).toBe(200);

      await emailHelper.waitForEmailProcessing(testMessageId, 45000);

      // Step 2: Navigate to transaction details
      await page.goto('/dashboard/transactions');
      const transactionRow = page.locator('[data-testid^="transaction-"]').first();
      await transactionRow.click();

      await expect(page.locator('[data-testid="transaction-details"]')).toBeVisible();

      // Step 3: Verify ARIA labels
      const translationToggle = page.locator('[data-testid="translation-toggle"]');
      if (await translationToggle.isVisible()) {
        const ariaLabel = await translationToggle.getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();
        expect(ariaLabel).toMatch(/toggle|translation|original|english/i);
      }

      const tabsList = page.locator('[data-testid="translation-tabs"]');
      if (await tabsList.isVisible()) {
        const tabsRole = await tabsList.getAttribute('role');
        expect(tabsRole).toBe('tablist');

        const englishTab = page.locator('[data-testid="translated-text-tab"]');
        const originalTab = page.locator('[data-testid="original-text-tab"]');
        
        const englishRole = await englishTab.getAttribute('role');
        const originalRole = await originalTab.getAttribute('role');
        
        expect(englishRole).toBe('tab');
        expect(originalRole).toBe('tab');
      }
    });

    test('should announce translation changes to screen readers', async ({ page }) => {
      // Step 1: Process Spanish receipt
      const emailData = getEmailSample('spanishReceipt');
      const testMessageId = `ui-test-screen-reader-${Date.now()}@example.com`;
      
      const response = await emailHelper.sendTestEmail({
        ...emailData,
        messageId: testMessageId,
      });
      expect(response.status()).toBe(200);

      await emailHelper.waitForEmailProcessing(testMessageId, 45000);

      // Step 2: Navigate to transaction details
      await page.goto('/dashboard/transactions');
      const transactionRow = page.locator('[data-testid^="transaction-"]').first();
      await transactionRow.click();

      await expect(page.locator('[data-testid="transaction-details"]')).toBeVisible();

      // Step 3: Verify live region for announcements
      const liveRegion = page.locator('[aria-live="polite"]');
      if (await liveRegion.isVisible()) {
        // Toggle translation
        const translationToggle = page.locator('[data-testid="translation-toggle"]');
        await translationToggle.click();
        
        // Wait for announcement
        await page.waitForTimeout(1000);
        
        const announcement = await liveRegion.textContent();
        expect(announcement).toMatch(/showing|displaying|original|translated/i);
      }
    });
  });

  test.describe('Transaction Drawer Performance', () => {
    test('should load transaction details quickly', async ({ page }) => {
      // Step 1: Process test email
      const emailData = getEmailSample('starbucksCoffee');
      const testMessageId = `ui-test-performance-${Date.now()}@example.com`;
      
      const response = await emailHelper.sendTestEmail({
        ...emailData,
        messageId: testMessageId,
      });
      expect(response.status()).toBe(200);

      await emailHelper.waitForEmailProcessing(testMessageId);

      // Step 2: Navigate to transaction list
      await page.goto('/dashboard/transactions');
      
      // Step 3: Measure time to open transaction details
      const startTime = Date.now();
      
      const transactionRow = page.locator('[data-testid^="transaction-"]').first();
      await transactionRow.click();
      
      await expect(page.locator('[data-testid="transaction-details"]')).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 2 seconds
      expect(loadTime).toBeLessThan(2000);
      
      console.log(`Transaction drawer loaded in ${loadTime}ms`);
    });

    test('should handle translation toggle without delay', async ({ page }) => {
      // Step 1: Process Spanish receipt
      const emailData = getEmailSample('spanishReceipt');
      const testMessageId = `ui-test-toggle-performance-${Date.now()}@example.com`;
      
      const response = await emailHelper.sendTestEmail({
        ...emailData,
        messageId: testMessageId,
      });
      expect(response.status()).toBe(200);

      await emailHelper.waitForEmailProcessing(testMessageId, 45000);

      // Step 2: Navigate to transaction details
      await page.goto('/dashboard/transactions');
      const transactionRow = page.locator('[data-testid^="transaction-"]').first();
      await transactionRow.click();

      await expect(page.locator('[data-testid="transaction-details"]')).toBeVisible();

      // Step 3: Measure translation toggle performance
      const translationToggle = page.locator('[data-testid="translation-toggle"]');
      if (await translationToggle.isVisible()) {
        const startTime = Date.now();
        
        await translationToggle.click();
        
        // Wait for content to change
        const originalTab = page.locator('[data-testid="original-text-tab"]');
        if (await originalTab.isVisible()) {
          await expect(originalTab).toHaveAttribute('data-state', 'active');
        }
        
        const toggleTime = Date.now() - startTime;
        
        // Should toggle within 500ms
        expect(toggleTime).toBeLessThan(500);
        
        console.log(`Translation toggle completed in ${toggleTime}ms`);
      }
    });
  });
});