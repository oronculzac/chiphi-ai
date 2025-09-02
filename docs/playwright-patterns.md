# Playwright Testing Patterns for ChiPhi AI

## Overview

This document outlines common Playwright testing patterns specifically designed for the ChiPhi AI email receipt processing system. These patterns ensure consistent, reliable, and maintainable tests across the application.

## Core Testing Patterns

### 1. Authentication Pattern

```typescript
// Standard authentication setup
test.beforeEach(async ({ page }) => {
  const authHelper = new AuthHelper(page);
  await authHelper.loginAsUser('primaryOwner');
});

test.afterEach(async ({ page }) => {
  const authHelper = new AuthHelper(page);
  await authHelper.logout();
});

// Multi-tenant authentication
test('should handle multi-tenant access', async ({ page }) => {
  const authHelper = new AuthHelper(page);
  
  // Test as Org1 user
  await authHelper.loginAsUser('primaryOwner');
  // ... perform org1 tests
  await authHelper.logout();
  
  // Test as Org2 user
  await authHelper.loginAsUser('secondaryOwner');
  // ... perform org2 tests
  await authHelper.logout();
});
```

### 2. Email Processing Pattern

```typescript
// Basic email processing test
test('should process email receipt', async ({ page }) => {
  const emailHelper = new EmailHelper(page);
  const emailData = getEmailSample('starbucksCoffee');
  
  // Send email
  const response = await emailHelper.sendTestEmail(emailData);
  expect(response.status()).toBe(200);
  
  // Wait for processing
  const result = await emailHelper.waitForEmailProcessing(emailData.messageId);
  expect(result.success).toBe(true);
  
  // Verify transaction creation
  const transaction = await emailHelper.verifyTransactionCreated(
    emailData.messageId, 
    emailData
  );
  expect(transaction.amount).toBeCloseTo(emailData.expectedAmount, 2);
});

// Concurrent email processing pattern
test('should handle concurrent emails', async ({ page }) => {
  const emailHelper = new EmailHelper(page);
  const emails = [
    getEmailSample('starbucksCoffee'),
    getEmailSample('wholeFoodsGrocery'),
    getEmailSample('uberRide'),
  ];
  
  // Send all emails concurrently
  const sendPromises = emails.map(email => 
    emailHelper.sendTestEmail({
      ...email,
      messageId: `${email.messageId}-${Date.now()}`,
    })
  );
  
  const responses = await Promise.all(sendPromises);
  responses.forEach(response => expect(response.status()).toBe(200));
  
  // Wait for all processing
  const processingPromises = emails.map((email, index) => 
    emailHelper.waitForEmailProcessing(`${email.messageId}-${Date.now()}`)
  );
  
  const results = await Promise.all(processingPromises);
  results.forEach(result => expect(result.success).toBe(true));
});
```

### 3. Dashboard Interaction Pattern

```typescript
// Dashboard verification pattern
test('should update dashboard in real-time', async ({ page }) => {
  const dashboardHelper = new DashboardHelper(page);
  const emailHelper = new EmailHelper(page);
  
  // Navigate to dashboard
  await dashboardHelper.navigateToDashboard();
  
  // Send email
  const emailData = getEmailSample('starbucksCoffee');
  await emailHelper.sendTestEmail(emailData);
  
  // Wait for real-time update
  await dashboardHelper.verifyRealtimeUpdate({
    merchant: emailData.expectedMerchant,
    amount: emailData.expectedAmount,
    category: emailData.expectedCategory,
  });
  
  // Verify stats update
  await dashboardHelper.waitForStatsUpdate({
    monthToDateTotal: emailData.expectedAmount,
    transactionCount: 1,
    categoryBreakdown: [{
      category: emailData.expectedCategory,
      amount: emailData.expectedAmount,
      percentage: 100,
      count: 1,
    }],
    spendingTrend: [],
  });
});

// Category breakdown verification pattern
test('should display accurate category breakdown', async ({ page }) => {
  const dashboardHelper = new DashboardHelper(page);
  
  await dashboardHelper.navigateToDashboard();
  
  const expectedBreakdown = [
    { category: 'Food & Dining', amount: 25.50, percentage: 45.5, count: 2 },
    { category: 'Groceries', amount: 30.50, percentage: 54.5, count: 1 },
  ];
  
  await dashboardHelper.verifyCategoryBreakdown(expectedBreakdown);
});
```

### 4. Multi-Language Processing Pattern

```typescript
// Translation testing pattern
test('should process multilingual receipts', async ({ page }) => {
  const emailHelper = new EmailHelper(page);
  const languages = ['es', 'fr', 'ja', 'de'];
  
  for (const lang of languages) {
    const emailSamples = getEmailSamplesByLanguage(lang);
    
    for (const emailData of emailSamples) {
      // Send email
      await emailHelper.sendTestEmail(emailData);
      
      // Wait for processing (translation takes longer)
      const result = await emailHelper.waitForEmailProcessing(
        emailData.messageId, 
        45000 // Extended timeout for translation
      );
      
      expect(result.success).toBe(true);
      expect(result.steps.translated).toBe(true);
      
      // Verify transaction with translation data
      const transaction = await emailHelper.verifyTransactionCreated(
        emailData.messageId, 
        emailData
      );
      
      expect(transaction.original_text).toBeTruthy();
      expect(transaction.translated_text).toBeTruthy();
      expect(transaction.source_language).toBe(lang);
    }
  }
});

// Translation UI verification pattern
test('should toggle between original and translated text', async ({ page }) => {
  const emailHelper = new EmailHelper(page);
  const emailData = getEmailSample('restaurantReceipt'); // Spanish
  
  await emailHelper.sendTestEmail(emailData);
  await emailHelper.waitForEmailProcessing(emailData.messageId);
  
  // Navigate to transaction detail
  await page.goto('/dashboard/transactions');
  const transactionRow = page.locator('[data-testid^="transaction-"]').first();
  await transactionRow.click();
  
  // Test translation toggle
  const translationToggle = page.locator('[data-testid="translation-toggle"]');
  await expect(translationToggle).toBeVisible();
  
  // Toggle to original
  await translationToggle.click();
  await expect(page.locator('[data-testid="original-text"]'))
    .toContainText('PAELLA VALENCIANA');
  
  // Toggle to translated
  await translationToggle.click();
  await expect(page.locator('[data-testid="translated-text"]'))
    .toContainText('Valencian Paella');
});
```

### 5. Error Handling Pattern

```typescript
// Graceful error handling pattern
test('should handle processing errors gracefully', async ({ page }) => {
  const emailHelper = new EmailHelper(page);
  const dashboardHelper = new DashboardHelper(page);
  
  // Send malformed email
  const errorEmail = {
    messageId: 'error-test@test.com',
    from: 'test@example.com',
    to: 'test-primary@chiphi-test.com',
    subject: 'Malformed Receipt',
    textContent: '', // Empty content
    language: 'en',
  };
  
  await emailHelper.sendTestEmail(errorEmail);
  
  // Expect processing to fail gracefully
  try {
    await emailHelper.waitForEmailProcessing(errorEmail.messageId);
    throw new Error('Should have failed');
  } catch (error) {
    expect(error.message).toContain('processing failed');
  }
  
  // Verify error notification in dashboard
  await dashboardHelper.navigateToDashboard();
  await expect(page.locator('[data-testid="processing-error-notification"]'))
    .toBeVisible();
  
  // Verify no transaction was created
  const transactionResponse = await page.request.get(
    `/api/transactions?messageId=${errorEmail.messageId}`
  );
  const transactions = await transactionResponse.json();
  expect(transactions.data).toHaveLength(0);
});

// Retry mechanism pattern
test('should retry failed operations', async ({ page }) => {
  const emailHelper = new EmailHelper(page);
  
  // Mock temporary failure
  await page.route('/api/ai/extract', route => {
    if (route.request().url().includes('retry-test')) {
      // Fail first attempt, succeed on retry
      const attempt = route.request().headers()['x-attempt'] || '1';
      if (attempt === '1') {
        route.fulfill({ status: 500, body: 'Temporary failure' });
      } else {
        route.continue();
      }
    } else {
      route.continue();
    }
  });
  
  const emailData = {
    ...getEmailSample('starbucksCoffee'),
    messageId: 'retry-test@test.com',
  };
  
  await emailHelper.sendTestEmail(emailData);
  const result = await emailHelper.waitForEmailProcessing(emailData.messageId);
  
  expect(result.success).toBe(true);
  expect(result.retry_count).toBeGreaterThan(0);
});
```

### 6. Performance Testing Pattern

```typescript
// Load testing pattern
test('should maintain performance under load', async ({ page }) => {
  const emailHelper = new EmailHelper(page);
  const performanceHelper = new PerformanceHelper(page);
  
  const emailCount = 10;
  const maxProcessingTime = 30000;
  
  // Generate test emails
  const emails = Array.from({ length: emailCount }, (_, i) => ({
    ...getEmailSample('starbucksCoffee'),
    messageId: `load-test-${i}@test.com`,
    expectedAmount: 5.95 + i,
  }));
  
  // Measure concurrent processing
  const startTime = Date.now();
  
  const sendPromises = emails.map(email => emailHelper.sendTestEmail(email));
  await Promise.all(sendPromises);
  
  const processingPromises = emails.map(email => 
    emailHelper.waitForEmailProcessing(email.messageId, maxProcessingTime)
  );
  
  const results = await Promise.all(processingPromises);
  const totalTime = Date.now() - startTime;
  
  // Performance assertions
  results.forEach(result => {
    expect(result.success).toBe(true);
    expect(result.processingTime).toBeLessThan(maxProcessingTime);
  });
  
  const averageTime = results.reduce((sum, r) => sum + r.processingTime, 0) / emailCount;
  expect(averageTime).toBeLessThan(15000); // Under 15 seconds average
  
  // Memory usage check
  const memoryUsage = await performanceHelper.monitorMemoryUsage();
  expect(memoryUsage.used).toBeLessThan(500 * 1024 * 1024); // Under 500MB
});

// Response time pattern
test('should maintain fast API response times', async ({ page }) => {
  const performanceHelper = new PerformanceHelper(page);
  
  const endpoints = [
    '/api/transactions',
    '/api/dashboard/stats',
    '/api/categories',
    '/api/merchants',
  ];
  
  for (const endpoint of endpoints) {
    const responseTime = await performanceHelper.measureApiResponseTime(endpoint);
    expect(responseTime).toBeLessThan(1000); // Under 1 second
    
    console.log(`${endpoint}: ${responseTime}ms`);
  }
});
```

### 7. Security Testing Pattern

```typescript
// XSS prevention pattern
test('should prevent XSS attacks', async ({ page }) => {
  const securityHelper = new SecurityHelper(page);
  
  const xssPayloads = [
    '<script>alert("xss")</script>',
    'javascript:alert("xss")',
    '<img src="x" onerror="alert(\'xss\')">',
    '<iframe src="javascript:alert(\'xss\')"></iframe>',
  ];
  
  for (const payload of xssPayloads) {
    const prevented = await securityHelper.testXSSPrevention(
      payload,
      '[data-testid="merchant-input"]'
    );
    expect(prevented).toBe(true);
  }
});

// PII redaction pattern
test('should redact sensitive information', async ({ page }) => {
  const securityHelper = new SecurityHelper(page);
  const emailHelper = new EmailHelper(page);
  
  const sensitiveEmail = {
    ...getEmailSample('suspiciousContent'),
    textContent: `
      Receipt from Store
      Credit Card: 4111-1111-1111-1111
      CVV: 123
      SSN: 123-45-6789
      Total: $25.99
    `,
  };
  
  await emailHelper.sendTestEmail(sensitiveEmail);
  await emailHelper.waitForEmailProcessing(sensitiveEmail.messageId);
  
  // Verify PII was redacted
  const transaction = await emailHelper.verifyTransactionCreated(
    sensitiveEmail.messageId,
    { expectedAmount: 25.99 }
  );
  
  expect(transaction.last4).toBe('1111'); // Only last 4 digits
  expect(transaction.notes).not.toContain('4111-1111-1111-1111'); // Full PAN redacted
  expect(transaction.notes).not.toContain('123-45-6789'); // SSN redacted
});

// SQL injection prevention pattern
test('should prevent SQL injection', async ({ page }) => {
  const securityHelper = new SecurityHelper(page);
  
  const sqlInjectionPayloads = [
    "'; DROP TABLE transactions; --",
    "' OR '1'='1",
    "'; UPDATE transactions SET amount = 0; --",
    "' UNION SELECT * FROM users; --",
  ];
  
  for (const payload of sqlInjectionPayloads) {
    const prevented = await securityHelper.testSQLInjection(
      payload,
      '/api/transactions'
    );
    expect(prevented).toBe(true);
  }
});
```

### 8. Accessibility Testing Pattern

```typescript
// Keyboard navigation pattern
test('should support keyboard navigation', async ({ page }) => {
  const accessibilityHelper = new AccessibilityHelper(page);
  
  await page.goto('/dashboard');
  
  // Test tab navigation
  await page.keyboard.press('Tab');
  let focusedElement = await page.locator(':focus').first();
  await expect(focusedElement).toBeVisible();
  
  // Test enter key on buttons
  const buttons = page.locator('button:visible');
  const buttonCount = await buttons.count();
  
  for (let i = 0; i < Math.min(buttonCount, 3); i++) {
    await buttons.nth(i).focus();
    await page.keyboard.press('Enter');
    // Verify button action occurred
  }
  
  // Test escape key
  await page.keyboard.press('Escape');
  
  const keyboardAccessible = await accessibilityHelper.testKeyboardNavigation();
  expect(keyboardAccessible).toBe(true);
});

// ARIA compliance pattern
test('should have proper ARIA labels', async ({ page }) => {
  const accessibilityHelper = new AccessibilityHelper(page);
  
  await page.goto('/dashboard');
  
  const ariaResult = await accessibilityHelper.checkAriaLabels();
  
  // All interactive elements should have labels
  expect(ariaResult.missing.length).toBe(0);
  
  // Verify specific ARIA attributes
  await expect(page.locator('[data-testid="transaction-list"]'))
    .toHaveAttribute('role', 'table');
  
  await expect(page.locator('[data-testid="category-chart"]'))
    .toHaveAttribute('aria-label');
  
  await expect(page.locator('[data-testid="confidence-badge"]'))
    .toHaveAttribute('aria-describedby');
});

// Screen reader pattern
test('should work with screen readers', async ({ page }) => {
  // Test with screen reader simulation
  await page.goto('/dashboard/transactions');
  
  // Verify semantic HTML structure
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('table')).toHaveAttribute('role', 'table');
  
  // Verify live regions for dynamic content
  await expect(page.locator('[aria-live="polite"]')).toBeVisible();
  
  // Test focus management
  const modal = page.locator('[role="dialog"]');
  if (await modal.isVisible()) {
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  }
});
```

### 9. Mobile Testing Pattern

```typescript
// Mobile responsiveness pattern
test('should work on mobile devices', async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });
  
  await page.goto('/dashboard');
  
  // Verify mobile navigation
  const mobileMenu = page.locator('[data-testid="mobile-menu-button"]');
  await expect(mobileMenu).toBeVisible();
  
  await mobileMenu.click();
  const navigationMenu = page.locator('[data-testid="navigation-menu"]');
  await expect(navigationMenu).toBeVisible();
  
  // Test touch interactions
  const transactionCard = page.locator('[data-testid^="transaction-"]').first();
  await transactionCard.tap();
  
  // Verify mobile-optimized layouts
  const categoryChart = page.locator('[data-testid="category-chart"]');
  const chartBounds = await categoryChart.boundingBox();
  expect(chartBounds?.width).toBeLessThan(400); // Fits mobile screen
});

// Touch gesture pattern
test('should handle touch gestures', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/dashboard/transactions');
  
  // Test swipe gestures
  const transactionList = page.locator('[data-testid="transaction-list"]');
  
  // Swipe left to reveal actions
  await transactionList.hover();
  await page.mouse.down();
  await page.mouse.move(-100, 0);
  await page.mouse.up();
  
  // Verify swipe action revealed
  const swipeActions = page.locator('[data-testid="swipe-actions"]');
  await expect(swipeActions).toBeVisible();
});
```

### 10. Data Validation Pattern

```typescript
// Schema validation pattern
test('should validate data schemas', async ({ page }) => {
  const emailHelper = new EmailHelper(page);
  const emailData = getEmailSample('starbucksCoffee');
  
  // Validate input schema
  validateEmailTestData(emailData);
  
  await emailHelper.sendTestEmail(emailData);
  const result = await emailHelper.waitForEmailProcessing(emailData.messageId);
  
  // Validate output schema
  validateEmailProcessingResult(result);
  
  const transaction = await emailHelper.verifyTransactionCreated(
    emailData.messageId,
    emailData
  );
  
  // Validate transaction schema
  expect(transaction).toMatchObject({
    id: expect.any(String),
    amount: expect.any(Number),
    merchant: expect.any(String),
    category: expect.any(String),
    confidence: expect.any(Number),
    explanation: expect.any(String),
    created_at: expect.any(String),
  });
});

// Edge case validation pattern
test('should handle edge cases', async ({ page }) => {
  const emailHelper = new EmailHelper(page);
  
  const edgeCases = [
    {
      name: 'empty_content',
      email: { ...getEmailSample('malformedReceipt'), textContent: '' },
      expectSuccess: false,
    },
    {
      name: 'very_large_amount',
      email: { ...getEmailSample('starbucksCoffee'), expectedAmount: 999999.99 },
      expectSuccess: true,
    },
    {
      name: 'negative_amount',
      email: { ...getEmailSample('starbucksCoffee'), expectedAmount: -50.00 },
      expectSuccess: true, // Refunds are valid
    },
    {
      name: 'future_date',
      email: { ...getEmailSample('starbucksCoffee'), textContent: 'Date: 2030-12-31' },
      expectSuccess: true,
    },
  ];
  
  for (const testCase of edgeCases) {
    const result = await emailHelper.sendTestEmail({
      ...testCase.email,
      messageId: `${testCase.name}@test.com`,
    });
    
    if (testCase.expectSuccess) {
      expect(result.status()).toBe(200);
      const processingResult = await emailHelper.waitForEmailProcessing(
        `${testCase.name}@test.com`
      );
      expect(processingResult.success).toBe(true);
    } else {
      // Should handle gracefully even if processing fails
      expect(result.status()).toBe(200);
    }
  }
});
```

## Best Practices

### 1. Test Organization

```typescript
// Group related tests
test.describe('Email Processing', () => {
  test.describe('English Receipts', () => {
    // English-specific tests
  });
  
  test.describe('Multilingual Receipts', () => {
    // Translation tests
  });
  
  test.describe('Error Handling', () => {
    // Error scenario tests
  });
});
```

### 2. Data-Driven Testing

```typescript
// Parameterized tests
const testCases = [
  { language: 'en', sample: 'starbucksCoffee' },
  { language: 'es', sample: 'restaurantReceipt' },
  { language: 'fr', sample: 'cafeReceipt' },
  { language: 'ja', sample: 'convenienceStore' },
];

for (const testCase of testCases) {
  test(`should process ${testCase.language} receipts`, async ({ page }) => {
    const emailData = getEmailSample(testCase.sample);
    // ... test implementation
  });
}
```

### 3. Async Handling

```typescript
// Proper async/await usage
test('should handle async operations', async ({ page }) => {
  // Wait for multiple operations
  const [response1, response2] = await Promise.all([
    emailHelper.sendTestEmail(email1),
    emailHelper.sendTestEmail(email2),
  ]);
  
  // Wait with timeout
  await expect(page.locator('[data-testid="result"]')).toBeVisible({ timeout: 30000 });
  
  // Wait for condition
  await waitForCondition(
    async () => {
      const count = await page.locator('[data-testid="transaction"]').count();
      return count === 2;
    },
    10000
  );
});
```

### 4. Error Recovery

```typescript
// Retry on failure
test('should retry on transient failures', async ({ page }) => {
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      await emailHelper.sendTestEmail(emailData);
      const result = await emailHelper.waitForEmailProcessing(emailData.messageId);
      expect(result.success).toBe(true);
      break;
    } catch (error) {
      attempts++;
      if (attempts === maxAttempts) throw error;
      await page.waitForTimeout(1000 * attempts); // Exponential backoff
    }
  }
});
```

### 5. Resource Cleanup

```typescript
// Proper cleanup
test.afterEach(async ({ page }) => {
  // Clean up test data
  await page.request.post('/api/test/cleanup', {
    data: { testId: 'current-test-id' }
  });
  
  // Close any open dialogs
  const dialog = page.locator('[role="dialog"]');
  if (await dialog.isVisible()) {
    await page.keyboard.press('Escape');
  }
  
  // Reset page state
  await page.goto('/dashboard');
});
```

These patterns provide a solid foundation for writing maintainable, reliable, and comprehensive tests for the ChiPhi AI system. They cover the most common testing scenarios while following Playwright best practices.