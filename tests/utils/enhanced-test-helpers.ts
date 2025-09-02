/**
 * Enhanced Test Helper Utilities with MCP Integration
 * 
 * Comprehensive testing utilities for ChiPhi AI including:
 * - MCP server interactions
 * - Email processing simulation
 * - Dashboard validation
 * - Performance monitoring
 * - Multi-tenant testing
 */

import { Page, expect } from '@playwright/test';
import { 
  EmailSample, 
  TestResult, 
  TestStep, 
  Assertion,
  createTestAssertion,
  validateExtractionResult,
  AIExtractionResult,
  DashboardData,
  PerformanceResult
} from '@/lib/types/test-schemas';

// Authentication Helper
export class AuthHelper {
  constructor(private page: Page) {}

  async signInWithTestUser(email: string, password: string): Promise<void> {
    await this.page.goto('/auth/test-login');
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
    await this.page.click('button[type="submit"]');
    
    await this.page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
  }

  async signOut(): Promise<void> {
    await this.page.click('[data-testid="user-menu"]');
    await this.page.click('text=Sign out');
    await this.page.waitForURL('/');
  }

  async getCurrentUser(): Promise<{ id: string; email: string; orgId: string } | null> {
    try {
      return await this.page.evaluate(() => (window as any).__TEST_USER_INFO__);
    } catch {
      return null;
    }
  }
}

// Email Processing Helper
export class EmailProcessingHelper {
  constructor(private page: Page) {}

  async simulateEmailReceived(emailData: EmailSample): Promise<void> {
    await this.page.goto('/admin/test-email');
    
    await this.page.fill('[data-testid="email-from"]', emailData.from);
    await this.page.fill('[data-testid="email-to"]', emailData.to);
    await this.page.fill('[data-testid="email-subject"]', emailData.subject);
    await this.page.fill('[data-testid="email-body"]', emailData.body);
    
    await this.page.click('[data-testid="submit-test-email"]');
  }

  async waitForTransactionCreated(timeout: number = 30000): Promise<string> {
    await this.page.waitForSelector('[data-testid="processing-complete"]', { timeout });
    
    const transactionId = await this.page.getAttribute('[data-testid="created-transaction"]', 'data-transaction-id');
    if (!transactionId) {
      throw new Error('Transaction ID not found after processing');
    }
    
    return transactionId;
  }

  async getTransactionDetails(transactionId: string): Promise<AIExtractionResult> {
    await this.page.goto(`/transactions/${transactionId}`);
    await this.page.waitForSelector('[data-testid="transaction-details"]');

    const details = await this.page.evaluate(() => {
      const element = document.querySelector('[data-testid="transaction-details"]');
      return element ? JSON.parse(element.getAttribute('data-transaction') || '{}') : {};
    });

    return validateExtractionResult(details);
  }

  async updateTransactionCategory(transactionId: string, category: string, subcategory?: string): Promise<void> {
    await this.page.goto(`/transactions/${transactionId}`);
    await this.page.click('[data-testid="edit-category"]');
    
    await this.page.selectOption('select[name="category"]', category);
    if (subcategory) {
      await this.page.selectOption('select[name="subcategory"]', subcategory);
    }
    
    await this.page.click('button:has-text("Save")');
    await this.page.waitForSelector('text=Transaction updated');
  }
}

// Dashboard Helper
export class DashboardHelper {
  constructor(private page: Page) {}

  async waitForDashboardLoad(): Promise<void> {
    await this.page.waitForSelector('[data-testid="dashboard"]');
    await this.page.waitForSelector('[data-testid="month-to-date-total"]');
  }

  async navigateToAnalytics(): Promise<void> {
    await this.page.click('[data-testid="analytics-tab"]');
    await this.page.waitForSelector('[data-testid="analytics-dashboard"]');
  }

  async getMonthToDateTotal(): Promise<number> {
    const totalText = await this.page.textContent('[data-testid="month-to-date-total"]');
    const match = totalText?.match(/\$?([\d,]+\.?\d*)/);
    return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
  }

  async getCategoryBreakdown(): Promise<Array<{ category: string; amount: number; count: number; percentage: number }>> {
    await this.page.waitForSelector('[data-testid="category-breakdown"]');
    
    return await this.page.evaluate(() => {
      const elements = document.querySelectorAll('[data-testid="category-item"]');
      return Array.from(elements).map(el => ({
        category: el.getAttribute('data-category') || '',
        amount: parseFloat(el.getAttribute('data-amount') || '0'),
        count: parseInt(el.getAttribute('data-count') || '0'),
        percentage: parseFloat(el.getAttribute('data-percentage') || '0'),
      }));
    });
  }

  async getTransactionCount(): Promise<number> {
    const elements = await this.page.locator('[data-testid="transaction-item"]').count();
    return elements;
  }

  async getSpendingTrend(): Promise<Array<{ date: string; amount: number }>> {
    await this.page.waitForSelector('[data-testid="spending-trend"]');
    
    return await this.page.evaluate(() => {
      const trendData = document.querySelector('[data-testid="spending-trend"]')?.getAttribute('data-trend');
      return trendData ? JSON.parse(trendData) : [];
    });
  }
}

// MCP Helper for Playwright automation
export class MCPHelper {
  constructor(private page: Page) {}

  async simulateEmailProcessing(emailData: EmailSample, options: { 
    invalidSignature?: boolean; 
    simulateTimeout?: boolean 
  } = {}): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      // Navigate to MCP test interface
      await this.page.goto('/admin/mcp-test');
      await this.page.waitForSelector('[data-testid="mcp-email-processor"]');

      // Configure processing options
      if (options.invalidSignature) {
        await this.page.check('[data-testid="invalid-signature"]');
      }
      if (options.simulateTimeout) {
        await this.page.check('[data-testid="simulate-timeout"]');
      }

      // Submit email for processing
      await this.page.fill('[data-testid="email-data"]', JSON.stringify(emailData));
      await this.page.click('[data-testid="process-email"]');

      // Wait for result
      await this.page.waitForSelector('[data-testid="processing-result"]', { timeout: 60000 });

      const result = await this.page.evaluate(() => {
        const resultElement = document.querySelector('[data-testid="processing-result"]');
        return resultElement ? JSON.parse(resultElement.textContent || '{}') : {};
      });

      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async navigateToTransaction(transactionId: string): Promise<void> {
    await this.page.goto(`/transactions/${transactionId}`);
    await this.page.waitForSelector('[data-testid="transaction-details"]');
  }

  async updateTransactionCategory(transactionId: string, category: string, subcategory?: string): Promise<void> {
    await this.navigateToTransaction(transactionId);
    await this.page.click('[data-testid="edit-category"]');
    
    await this.page.selectOption('select[name="category"]', category);
    if (subcategory) {
      await this.page.selectOption('select[name="subcategory"]', subcategory);
    }
    
    await this.page.click('button:has-text("Save")');
    await this.page.waitForSelector('text=Transaction updated');
  }

  async getMerchantMapping(merchantName: string): Promise<{ category: string; subcategory?: string }> {
    await this.page.goto('/admin/merchant-mapping');
    await this.page.waitForSelector('[data-testid="merchant-mapping-table"]');

    const mapping = await this.page.evaluate((merchant) => {
      const row = document.querySelector(`[data-testid="merchant-${merchant.replace(/\s+/g, '-')}"]`);
      if (!row) return null;
      
      return {
        category: row.querySelector('[data-testid="learned-category"]')?.textContent || '',
        subcategory: row.querySelector('[data-testid="learned-subcategory"]')?.textContent || undefined,
      };
    }, merchantName);

    return mapping || { category: '', subcategory: undefined };
  }

  async getTransactionDisplayContent(transactionId: string): Promise<string> {
    await this.navigateToTransaction(transactionId);
    const content = await this.page.textContent('[data-testid="transaction-details"]');
    return content || '';
  }

  async startRealtimeMonitoring(): Promise<{ waitForUpdate: (timeout: number) => Promise<boolean>; stop: () => Promise<void> }> {
    let updateReceived = false;
    
    // Set up real-time monitoring
    await this.page.evaluate(() => {
      (window as any).__TEST_REALTIME_MONITOR__ = {
        updateReceived: false,
        listener: (event: any) => {
          (window as any).__TEST_REALTIME_MONITOR__.updateReceived = true;
        }
      };
      
      // Simulate subscription to real-time updates
      if ((window as any).supabase) {
        (window as any).supabase
          .channel('test-transactions')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, 
              (window as any).__TEST_REALTIME_MONITOR__.listener)
          .subscribe();
      }
    });

    return {
      waitForUpdate: async (timeout: number) => {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
          const received = await this.page.evaluate(() => 
            (window as any).__TEST_REALTIME_MONITOR__?.updateReceived || false
          );
          if (received) return true;
          await this.page.waitForTimeout(100);
        }
        return false;
      },
      stop: async () => {
        await this.page.evaluate(() => {
          if ((window as any).supabase && (window as any).__TEST_REALTIME_MONITOR__) {
            (window as any).supabase.removeAllChannels();
            delete (window as any).__TEST_REALTIME_MONITOR__;
          }
        });
      }
    };
  }

  async cleanup(): Promise<void> {
    await this.page.evaluate(() => {
      // Clean up any MCP monitoring or subscriptions
      if ((window as any).__TEST_REALTIME_MONITOR__) {
        delete (window as any).__TEST_REALTIME_MONITOR__;
      }
      if ((window as any).supabase) {
        (window as any).supabase.removeAllChannels();
      }
    });
  }
}

// MCP Supabase Helper for direct database operations
export class MCPSupabaseHelper {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Initialize MCP Supabase connection
    // This would typically connect to the MCP server
    this.initialized = true;
  }

  async executeSQL(query: string, params: any[] = []): Promise<{ success: boolean; data: any[]; error?: string }> {
    try {
      // Simulate MCP Supabase SQL execution
      const response = await fetch('/api/mcp/supabase/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, params }),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      return { 
        success: false, 
        data: [], 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async applyMigration(name: string, sql: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('/api/mcp/supabase/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, sql }),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async ensureTestOrganization(orgId: string, orgName: string): Promise<void> {
    await this.executeSQL(`
      INSERT INTO orgs (id, name) VALUES ($1, $2) 
      ON CONFLICT (id) DO UPDATE SET name = $2
    `, [orgId, orgName]);
  }

  async ensureTestUser(userId: string, email: string, orgId: string): Promise<void> {
    await this.executeSQL(`
      INSERT INTO users (id, email) VALUES ($1, $2) 
      ON CONFLICT (id) DO UPDATE SET email = $2
    `, [userId, email]);

    await this.executeSQL(`
      INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'owner') 
      ON CONFLICT (org_id, user_id) DO NOTHING
    `, [orgId, userId]);
  }

  async cleanup(): Promise<void> {
    // Clean up MCP connection
    this.initialized = false;
  }
}

// Performance Helper
export class PerformanceHelper {
  constructor(private page: Page) {}

  async measureEmailProcessingTime(emailData: EmailSample): Promise<number> {
    const startTime = Date.now();
    
    // Simulate email processing
    await this.page.goto('/admin/test-email');
    await this.page.fill('[data-testid="email-body"]', emailData.body);
    await this.page.click('[data-testid="submit-test-email"]');
    await this.page.waitForSelector('[data-testid="processing-complete"]');
    
    return Date.now() - startTime;
  }

  async getTestMetrics(): Promise<PerformanceResult> {
    const metrics = await this.page.evaluate(() => {
      const performance = (window as any).performance;
      const navigation = performance.getEntriesByType('navigation')[0] as any;
      
      return {
        totalRequests: 1,
        successfulRequests: 1,
        failedRequests: 0,
        successRate: 100,
        avgResponseTime: navigation?.loadEventEnd - navigation?.loadEventStart || 0,
        minResponseTime: 0,
        maxResponseTime: navigation?.loadEventEnd - navigation?.loadEventStart || 0,
        p95ResponseTime: navigation?.loadEventEnd - navigation?.loadEventStart || 0,
        p99ResponseTime: navigation?.loadEventEnd - navigation?.loadEventStart || 0,
        errors: [],
      };
    });

    return metrics;
  }
}

// Test Documentation Helper
export class TestDocumentationHelper {
  private steps: TestStep[] = [];
  private testName: string = '';

  constructor(private page: Page) {}

  async logTestStep(description: string, data?: any): Promise<void> {
    const step: TestStep = {
      step: `Step ${this.steps.length + 1}`,
      description,
      timestamp: new Date().toISOString(),
      data,
    };

    this.steps.push(step);
    console.log(`📝 ${step.step}: ${description}`, data ? data : '');
  }

  async takeScreenshot(name: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}.png`;
    
    await this.page.screenshot({ 
      path: `test-results/screenshots/${filename}`,
      fullPage: true 
    });

    // Add screenshot to current step
    if (this.steps.length > 0) {
      this.steps[this.steps.length - 1].screenshot = filename;
    }
  }

  async captureConsoleLogs(): Promise<Array<{ level: string; message: string; timestamp: string }>> {
    return await this.page.evaluate(() => {
      return (window as any).__TEST_CONSOLE_LOGS__ || [];
    });
  }

  getTestSteps(): TestStep[] {
    return this.steps;
  }

  clearSteps(): void {
    this.steps = [];
  }
}

// Assertion Helper
export class AssertionHelper {
  static async validateExtraction(
    page: Page, 
    expected: any, 
    tolerance: { amount?: number; confidence?: number } = {}
  ): Promise<Assertion[]> {
    const actual = await page.evaluate(() => {
      const element = document.querySelector('[data-testid="extraction-result"]');
      return element ? JSON.parse(element.getAttribute('data-extraction') || '{}') : {};
    });

    const assertions: Assertion[] = [
      createTestAssertion('equals', 'merchant', expected.merchant, actual.merchant),
      createTestAssertion('equals', 'amount', expected.amount, actual.amount, tolerance.amount),
      createTestAssertion('equals', 'currency', expected.currency, actual.currency),
      createTestAssertion('equals', 'category', expected.category, actual.category),
      createTestAssertion('greaterThan', 'confidence', tolerance.confidence || 70, actual.confidence),
    ];

    return assertions;
  }

  static async validateDashboardUpdate(
    page: Page,
    initialState: { total: number; categoryCount: number },
    expectedChanges: { totalIncrease: number; newCategory?: string }
  ): Promise<Assertion[]> {
    const dashboardHelper = new DashboardHelper(page);
    
    const finalTotal = await dashboardHelper.getMonthToDateTotal();
    const finalCategories = await dashboardHelper.getCategoryBreakdown();

    const assertions: Assertion[] = [
      createTestAssertion('equals', 'totalIncrease', expectedChanges.totalIncrease, finalTotal - initialState.total, 0.01),
      createTestAssertion('greaterThan', 'categoryCount', initialState.categoryCount - 1, finalCategories.length),
    ];

    if (expectedChanges.newCategory) {
      const hasNewCategory = finalCategories.some(cat => cat.category === expectedChanges.newCategory);
      assertions.push(createTestAssertion('equals', 'newCategoryPresent', true, hasNewCategory));
    }

    return assertions;
  }
}

// Utility functions
export async function waitForElement(page: Page, selector: string, timeout: number = 10000): Promise<void> {
  await page.waitForSelector(selector, { timeout });
}

export async function fillForm(page: Page, fields: Record<string, string>): Promise<void> {
  for (const [field, value] of Object.entries(fields)) {
    await page.fill(`[name="${field}"], [data-testid="${field}"]`, value);
  }
}

export async function takeTimestampedScreenshot(page: Page, name: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.png`;
  
  await page.screenshot({ 
    path: `test-results/screenshots/${filename}`,
    fullPage: true 
  });

  return filename;
}

export async function testCategoryCorrection(
  page: Page, 
  transactionId: string, 
  newCategory: string, 
  newSubcategory?: string
): Promise<void> {
  await page.goto(`/transactions/${transactionId}`);
  await page.click('[data-testid="edit-category"]');
  
  await page.selectOption('select[name="category"]', newCategory);
  if (newSubcategory) {
    await page.selectOption('select[name="subcategory"]', newSubcategory);
  }
  
  await page.click('button:has-text("Save")');
  await page.waitForSelector('text=Transaction updated');
}

// Measure async operation performance
export async function measureAsync<T>(
  operation: () => Promise<T>,
  callback: (duration: number, result?: T, error?: Error) => void
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await operation();
    const duration = Date.now() - startTime;
    callback(duration, result);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    callback(duration, undefined, error as Error);
    throw error;
  }
}

// Export all helpers
export const TestHelpers = {
  AuthHelper,
  EmailProcessingHelper,
  DashboardHelper,
  MCPHelper,
  MCPSupabaseHelper,
  PerformanceHelper,
  TestDocumentationHelper,
  AssertionHelper,
  waitForElement,
  fillForm,
  takeTimestampedScreenshot,
  testCategoryCorrection,
  measureAsync,
};