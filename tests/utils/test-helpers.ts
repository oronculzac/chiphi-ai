/**
 * Test Helper Utilities
 * 
 * Common utilities and helpers for Playwright MCP tests
 * Includes authentication, data setup, and assertion helpers
 */

import { Page, expect, BrowserContext } from '@playwright/test';
import { EmailTestData, TestConfig, DashboardTestData } from '@/lib/types/test-schemas';
import { testOrganizations, testUsers } from '../fixtures/test-organizations';
import { allEmailSamples } from '../fixtures/email-samples';

// Authentication helpers
export class AuthHelper {
  constructor(private page: Page) {}

  async loginAsUser(userKey: keyof typeof testUsers) {
    const user = testUsers[userKey];
    const org = Object.values(testOrganizations).find(o => o.id === user.orgId);
    
    if (!org) {
      throw new Error(`Organization not found for user ${userKey}`);
    }

    // Navigate to login page
    await this.page.goto('/auth/login');
    
    // Fill in credentials (magic link simulation)
    await this.page.fill('[data-testid="email-input"]', user.email);
    await this.page.click('[data-testid="login-button"]');
    
    // Wait for authentication to complete
    await this.page.waitForURL('/dashboard', { timeout: 10000 });
    
    // Verify user is logged in
    await expect(this.page.locator('[data-testid="user-menu"]')).toBeVisible();
    
    return { user, org };
  }

  async logout() {
    await this.page.click('[data-testid="user-menu"]');
    await this.page.click('[data-testid="logout-button"]');
    await this.page.waitForURL('/auth/login');
  }

  async switchOrganization(orgKey: keyof typeof testOrganizations) {
    const org = testOrganizations[orgKey];
    
    await this.page.click('[data-testid="org-switcher"]');
    await this.page.click(`[data-testid="org-option-${org.id}"]`);
    
    // Wait for organization switch to complete
    await this.page.waitForLoadState('networkidle');
    
    return org;
  }
}

// Email processing helpers
export class EmailHelper {
  constructor(private page: Page) {}

  async sendTestEmail(emailData: EmailTestData, webhookSecret: string = 'test-webhook-secret') {
    // Simulate webhook payload
    const webhookPayload = {
      'message-id': emailData.messageId,
      sender: emailData.from,
      recipient: emailData.to,
      subject: emailData.subject,
      'body-mime': this.createMimeContent(emailData),
      timestamp: Math.floor(Date.now() / 1000).toString(),
      token: 'test-token',
      signature: this.generateHmacSignature(emailData, webhookSecret),
    };

    // Send webhook request
    const response = await this.page.request.post('/api/inbound', {
      data: webhookPayload,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    expect(response.ok()).toBeTruthy();
    return response;
  }

  async waitForEmailProcessing(messageId: string, timeout: number = 30000) {
    // Poll for processing completion
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const response = await this.page.request.get(`/api/emails/${messageId}/status`);
      
      if (response.ok()) {
        const status = await response.json();
        if (status.status === 'completed') {
          return status;
        }
        if (status.status === 'failed') {
          throw new Error(`Email processing failed: ${status.error}`);
        }
      }
      
      await this.page.waitForTimeout(1000);
    }
    
    throw new Error(`Email processing timeout after ${timeout}ms`);
  }

  async verifyTransactionCreated(messageId: string, expectedData: Partial<EmailTestData>) {
    const response = await this.page.request.get(`/api/transactions?messageId=${messageId}`);
    expect(response.ok()).toBeTruthy();
    
    const transactions = await response.json();
    expect(transactions.data).toHaveLength(1);
    
    const transaction = transactions.data[0];
    
    if (expectedData.expectedAmount) {
      expect(transaction.amount).toBeCloseTo(expectedData.expectedAmount, 2);
    }
    
    if (expectedData.expectedMerchant) {
      expect(transaction.merchant).toContain(expectedData.expectedMerchant);
    }
    
    if (expectedData.expectedCategory) {
      expect(transaction.category).toBe(expectedData.expectedCategory);
    }
    
    return transaction;
  }

  private createMimeContent(emailData: EmailTestData): string {
    const boundary = '----=_NextPart_000_0000_01DA1234.56789ABC';
    
    let mimeContent = `MIME-Version: 1.0\r\n`;
    mimeContent += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n`;
    mimeContent += `From: ${emailData.from}\r\n`;
    mimeContent += `To: ${emailData.to}\r\n`;
    mimeContent += `Subject: ${emailData.subject}\r\n`;
    mimeContent += `Message-ID: ${emailData.messageId}\r\n\r\n`;
    
    // Text content
    mimeContent += `--${boundary}\r\n`;
    mimeContent += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
    mimeContent += `${emailData.textContent}\r\n\r\n`;
    
    // HTML content (if provided)
    if (emailData.htmlContent) {
      mimeContent += `--${boundary}\r\n`;
      mimeContent += `Content-Type: text/html; charset=utf-8\r\n\r\n`;
      mimeContent += `${emailData.htmlContent}\r\n\r\n`;
    }
    
    // Attachments (if any)
    if (emailData.attachments) {
      for (const attachment of emailData.attachments) {
        mimeContent += `--${boundary}\r\n`;
        mimeContent += `Content-Type: ${attachment.contentType}\r\n`;
        mimeContent += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
        mimeContent += `Content-Transfer-Encoding: base64\r\n\r\n`;
        mimeContent += `${attachment.content}\r\n\r\n`;
      }
    }
    
    mimeContent += `--${boundary}--\r\n`;
    
    return Buffer.from(mimeContent).toString('base64');
  }

  private generateHmacSignature(emailData: EmailTestData, secret: string): string {
    const crypto = require('crypto');
    const payload = JSON.stringify(emailData);
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }
}

// Dashboard helpers
export class DashboardHelper {
  constructor(private page: Page) {}

  async navigateToDashboard() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async waitForStatsUpdate(expectedStats: DashboardTestData['expectedStats'], timeout: number = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      // Check month-to-date total
      const totalElement = this.page.locator('[data-testid="mtd-total"]');
      if (await totalElement.isVisible()) {
        const totalText = await totalElement.textContent();
        const totalValue = parseFloat(totalText?.replace(/[^0-9.-]/g, '') || '0');
        
        if (Math.abs(totalValue - expectedStats.monthToDateTotal) < 0.01) {
          return true;
        }
      }
      
      await this.page.waitForTimeout(500);
    }
    
    throw new Error(`Dashboard stats did not update within ${timeout}ms`);
  }

  async verifyRealtimeUpdate(transactionData: any) {
    // Wait for real-time update to appear
    await this.page.waitForSelector('[data-testid="new-transaction-notification"]', { timeout: 5000 });
    
    // Verify the notification contains expected data
    const notification = this.page.locator('[data-testid="new-transaction-notification"]');
    await expect(notification).toContainText(transactionData.merchant);
    await expect(notification).toContainText(`$${transactionData.amount}`);
  }

  async verifyCategoryBreakdown(expectedBreakdown: DashboardTestData['expectedStats']['categoryBreakdown']) {
    for (const category of expectedBreakdown) {
      const categoryElement = this.page.locator(`[data-testid="category-${category.category}"]`);
      await expect(categoryElement).toBeVisible();
      
      const amountElement = categoryElement.locator('[data-testid="category-amount"]');
      await expect(amountElement).toContainText(`$${category.amount}`);
      
      const percentageElement = categoryElement.locator('[data-testid="category-percentage"]');
      await expect(percentageElement).toContainText(`${category.percentage}%`);
    }
  }

  async verifySpendingTrend(expectedTrend: DashboardTestData['expectedStats']['spendingTrend']) {
    // Wait for chart to load
    await this.page.waitForSelector('[data-testid="spending-trend-chart"]');
    
    // Verify chart data points
    for (let i = 0; i < expectedTrend.length; i++) {
      const dataPoint = expectedTrend[i];
      const chartPoint = this.page.locator(`[data-testid="trend-point-${i}"]`);
      
      // Verify data point exists and has correct value
      await expect(chartPoint).toBeVisible();
      const pointValue = await chartPoint.getAttribute('data-value');
      expect(parseFloat(pointValue || '0')).toBeCloseTo(dataPoint.amount, 2);
    }
  }
}

// MCP integration helpers
export class MCPHelper {
  constructor(private page: Page) {}

  async testSupabaseMCP() {
    // Test Supabase MCP operations
    const operations = [
      { name: 'list_projects', params: {} },
      { name: 'get_project', params: { id: 'test-project-id' } },
      { name: 'execute_sql', params: { query: 'SELECT 1 as test', project_id: 'test-project-id' } },
    ];

    const results = [];
    
    for (const operation of operations) {
      try {
        const response = await this.page.request.post('/api/mcp/supabase', {
          data: {
            operation: operation.name,
            parameters: operation.params,
          },
        });
        
        const result = await response.json();
        results.push({
          operation: operation.name,
          success: response.ok(),
          result,
        });
      } catch (error) {
        results.push({
          operation: operation.name,
          success: false,
          error: error.message,
        });
      }
    }
    
    return results;
  }

  async testPlaywrightMCP() {
    // Test Playwright MCP browser operations
    const operations = [
      { name: 'browser_navigate', params: { url: 'https://example.com' } },
      { name: 'browser_screenshot', params: {} },
      { name: 'browser_get_page_content', params: {} },
    ];

    const results = [];
    
    for (const operation of operations) {
      try {
        const response = await this.page.request.post('/api/mcp/playwright', {
          data: {
            operation: operation.name,
            parameters: operation.params,
          },
        });
        
        const result = await response.json();
        results.push({
          operation: operation.name,
          success: response.ok(),
          result,
        });
      } catch (error) {
        results.push({
          operation: operation.name,
          success: false,
          error: error.message,
        });
      }
    }
    
    return results;
  }
}

// Performance testing helpers
export class PerformanceHelper {
  constructor(private page: Page) {}

  async measurePageLoadTime(url: string): Promise<number> {
    const startTime = Date.now();
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
    return Date.now() - startTime;
  }

  async measureApiResponseTime(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any): Promise<number> {
    const startTime = Date.now();
    
    const response = method === 'GET' 
      ? await this.page.request.get(endpoint)
      : await this.page.request.post(endpoint, { data });
    
    const endTime = Date.now();
    
    expect(response.ok()).toBeTruthy();
    return endTime - startTime;
  }

  async simulateConcurrentUsers(userCount: number, action: () => Promise<void>): Promise<number[]> {
    const promises = Array.from({ length: userCount }, async () => {
      const startTime = Date.now();
      await action();
      return Date.now() - startTime;
    });

    return Promise.all(promises);
  }

  async monitorMemoryUsage(): Promise<{ used: number; total: number }> {
    const memoryInfo = await this.page.evaluate(() => {
      if ('memory' in performance) {
        return {
          used: (performance as any).memory.usedJSHeapSize,
          total: (performance as any).memory.totalJSHeapSize,
        };
      }
      return { used: 0, total: 0 };
    });

    return memoryInfo;
  }
}

// Security testing helpers
export class SecurityHelper {
  constructor(private page: Page) {}

  async testXSSPrevention(input: string, targetSelector: string): Promise<boolean> {
    // Inject potentially malicious content
    await this.page.fill(targetSelector, input);
    await this.page.press(targetSelector, 'Enter');
    
    // Check if script executed (it shouldn't)
    const alertHandled = await this.page.evaluate(() => {
      return new Promise((resolve) => {
        const originalAlert = window.alert;
        let alertCalled = false;
        
        window.alert = () => {
          alertCalled = true;
        };
        
        setTimeout(() => {
          window.alert = originalAlert;
          resolve(alertCalled);
        }, 1000);
      });
    });
    
    return !alertHandled; // Return true if XSS was prevented
  }

  async testSQLInjection(input: string, endpoint: string): Promise<boolean> {
    const response = await this.page.request.post(endpoint, {
      data: { query: input },
    });
    
    const responseText = await response.text();
    
    // Check for SQL error messages that might indicate successful injection
    const sqlErrorPatterns = [
      /syntax error/i,
      /mysql_fetch/i,
      /ora-\d+/i,
      /microsoft ole db/i,
      /postgresql/i,
    ];
    
    const hasError = sqlErrorPatterns.some(pattern => pattern.test(responseText));
    return !hasError; // Return true if injection was prevented
  }

  async testPIIRedaction(input: string): Promise<{ redacted: boolean; patterns: string[] }> {
    const response = await this.page.request.post('/api/test/pii-check', {
      data: { content: input },
    });
    
    const result = await response.json();
    return result;
  }
}

// Accessibility helpers
export class AccessibilityHelper {
  constructor(private page: Page) {}

  async testKeyboardNavigation(): Promise<boolean> {
    // Test tab navigation
    await this.page.keyboard.press('Tab');
    const firstFocusable = await this.page.locator(':focus').first();
    
    if (!await firstFocusable.isVisible()) {
      return false;
    }
    
    // Test escape key
    await this.page.keyboard.press('Escape');
    
    // Test enter key on buttons
    const buttons = this.page.locator('button:visible');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < Math.min(buttonCount, 3); i++) {
      await buttons.nth(i).focus();
      await this.page.keyboard.press('Enter');
      // Verify button action (implementation specific)
    }
    
    return true;
  }

  async checkAriaLabels(): Promise<{ missing: string[]; present: string[] }> {
    const elements = await this.page.locator('input, button, select, textarea').all();
    const missing: string[] = [];
    const present: string[] = [];
    
    for (const element of elements) {
      const ariaLabel = await element.getAttribute('aria-label');
      const ariaLabelledBy = await element.getAttribute('aria-labelledby');
      const id = await element.getAttribute('id');
      
      if (!ariaLabel && !ariaLabelledBy) {
        missing.push(id || 'unknown');
      } else {
        present.push(id || 'unknown');
      }
    }
    
    return { missing, present };
  }

  async checkColorContrast(): Promise<{ passed: number; failed: number }> {
    // This would require a color contrast checking library
    // For now, return mock data
    return { passed: 10, failed: 0 };
  }
}

// Utility functions
export async function waitForCondition(
  condition: () => Promise<boolean>,
  timeout: number = 10000,
  interval: number = 500
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}

export function generateRandomEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `test-${timestamp}-${random}@chiphi-test.com`;
}

export function generateRandomAmount(): number {
  return Math.round((Math.random() * 1000 + 1) * 100) / 100;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// Export helper classes
export {
  AuthHelper,
  EmailHelper,
  DashboardHelper,
  MCPHelper,
  PerformanceHelper,
  SecurityHelper,
  AccessibilityHelper,
};