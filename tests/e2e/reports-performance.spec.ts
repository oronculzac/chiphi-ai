/**
 * Reports Performance Tests
 * 
 * Tests performance aspects of the reports functionality including:
 * - Chart rendering performance with large datasets
 * - Filter response times
 * - Export performance with large data sets
 * - Memory usage during extended sessions
 */

import { test, expect } from '@playwright/test';
import { TestHelpers, MCPSupabaseHelper } from '../utils/enhanced-test-helpers';
import { testUsers, testOrganizations } from '../fixtures/test-organizations';

test.describe('Reports Performance Tests @reports @performance', () => {
  let authHelper: TestHelpers.AuthHelper;
  let mcpSupabase: MCPSupabaseHelper;
  let docHelper: TestHelpers.TestDocumentationHelper;
  let performanceHelper: TestHelpers.PerformanceHelper;

  test.beforeAll(async () => {
    mcpSupabase = new MCPSupabaseHelper();
    await mcpSupabase.initialize();
    
    // Set up test organization
    await mcpSupabase.ensureTestOrganization(
      testOrganizations.performance.id,
      testOrganizations.performance.name
    );
    await mcpSupabase.ensureTestUser(
      testUsers.performanceOwner.id,
      testUsers.performanceOwner.email,
      testOrganizations.performance.id
    );
  });

  test.beforeEach(async ({ page }) => {
    authHelper = new TestHelpers.AuthHelper(page);
    docHelper = new TestHelpers.TestDocumentationHelper(page);
    performanceHelper = new TestHelpers.PerformanceHelper(page);

    await authHelper.signInWithTestUser(
      testUsers.performanceOwner.email,
      'test-password'
    );
  });

  test('should handle large datasets efficiently', async ({ page }) => {
    await docHelper.logTestStep('Starting large dataset performance test');

    // Create large dataset (1000 transactions)
    const batchSize = 100;
    const totalTransactions = 1000;
    
    for (let i = 0; i < totalTransactions; i += batchSize) {
      const values = [];
      const params = [testOrganizations.performance.id];
      
      for (let j = 0; j < batchSize && (i + j) < totalTransactions; j++) {
        const dayOffset = Math.floor(Math.random() * 365);
        const amount = (Math.random() * 500 + 10).toFixed(2);
        const categories = ['Food & Dining', 'Groceries', 'Shopping', 'Transportation', 'Health & Medical'];
        const category = categories[Math.floor(Math.random() * categories.length)];
        
        values.push(`(gen_random_uuid(), $1, CURRENT_DATE - INTERVAL '${dayOffset} days', ${amount}, 'USD', 'Perf Test Merchant ${i + j}', '${category}', 'Subcategory', NOW())`);
      }
      
      await mcpSupabase.executeSQL(`
        INSERT INTO transactions (id, org_id, date, amount, currency, merchant, category, subcategory, created_at)
        VALUES ${values.join(', ')}
      `, params);
    }

    await docHelper.logTestStep(`Created ${totalTransactions} test transactions`);

    // Measure page load time
    const startTime = Date.now();
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="category-chart"]');
    const loadTime = Date.now() - startTime;

    // Performance assertions
    expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds
    await docHelper.logTestStep('Page load performance verified', { loadTime });

    // Measure chart rendering time
    const chartStartTime = Date.now();
    await page.waitForSelector('[data-testid="trend-chart"] svg');
    const chartRenderTime = Date.now() - chartStartTime;
    
    expect(chartRenderTime).toBeLessThan(5000); // Charts should render within 5 seconds
    await docHelper.logTestStep('Chart rendering performance verified', { chartRenderTime });

    // Test filter performance
    const filterStartTime = Date.now();
    await page.selectOption('[data-testid="time-range-select"]', 'last90');
    await page.waitForLoadState('networkidle');
    const filterTime = Date.now() - filterStartTime;
    
    expect(filterTime).toBeLessThan(3000); // Filters should respond within 3 seconds
    await docHelper.logTestStep('Filter performance verified', { filterTime });
  });

  test('should handle export performance with large datasets', async ({ page }) => {
    await docHelper.logTestStep('Starting export performance test');

    // Use existing large dataset from previous test or create smaller one
    await mcpSupabase.executeSQL(`
      INSERT INTO transactions (id, org_id, date, amount, currency, merchant, category, subcategory, notes, created_at)
      SELECT 
        gen_random_uuid(),
        $1,
        CURRENT_DATE - (random() * 365)::int,
        (random() * 500 + 10)::decimal(10,2),
        'USD',
        'Export Perf Test ' || generate_series,
        (ARRAY['Food & Dining', 'Groceries', 'Shopping', 'Transportation'])[floor(random() * 4 + 1)],
        'Test Subcategory',
        'Performance test note ' || generate_series,
        NOW()
      FROM generate_series(1, 500)
    `, [testOrganizations.performance.id]);

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Measure CSV export time
    const exportStartTime = Date.now();
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-csv-button"]');
    const download = await downloadPromise;
    const exportTime = Date.now() - exportStartTime;

    // Performance assertions for export
    expect(exportTime).toBeLessThan(15000); // Export should complete within 15 seconds
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    
    await docHelper.logTestStep('Export performance verified', { 
      exportTime,
      filename: download.suggestedFilename()
    });

    // Verify export file size is reasonable
    const downloadPath = await download.path();
    if (downloadPath) {
      const fs = require('fs');
      const stats = fs.statSync(downloadPath);
      const fileSizeKB = stats.size / 1024;
      
      expect(fileSizeKB).toBeGreaterThan(10); // Should have substantial content
      expect(fileSizeKB).toBeLessThan(5000); // But not excessively large
      
      await docHelper.logTestStep('Export file size verified', { fileSizeKB });
    }
  });

  test('should maintain performance during extended usage', async ({ page }) => {
    await docHelper.logTestStep('Starting extended usage performance test');

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Simulate extended usage with multiple filter changes
    const filterOperations = [
      'last7', 'last30', 'last90', 'mtd', 'custom'
    ];

    const operationTimes = [];

    for (let i = 0; i < 10; i++) {
      const filter = filterOperations[i % filterOperations.length];
      
      const operationStart = Date.now();
      
      if (filter === 'custom') {
        await page.selectOption('[data-testid="time-range-select"]', 'custom');
        await page.waitForSelector('[data-testid="custom-date-picker"]');
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 60);
        const endDate = new Date();
        
        await page.fill('[data-testid="start-date-input"]', startDate.toISOString().split('T')[0]);
        await page.fill('[data-testid="end-date-input"]', endDate.toISOString().split('T')[0]);
        await page.click('[data-testid="apply-custom-range"]');
      } else {
        await page.selectOption('[data-testid="time-range-select"]', filter);
      }
      
      await page.waitForLoadState('networkidle');
      const operationTime = Date.now() - operationStart;
      operationTimes.push(operationTime);
      
      // Each operation should complete within reasonable time
      expect(operationTime).toBeLessThan(5000);
      
      // Brief pause between operations
      await page.waitForTimeout(500);
    }

    // Verify performance doesn't degrade over time
    const firstHalf = operationTimes.slice(0, 5);
    const secondHalf = operationTimes.slice(5);
    
    const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    // Second half shouldn't be significantly slower (allow 50% degradation max)
    expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.5);
    
    await docHelper.logTestStep('Extended usage performance verified', {
      firstHalfAvg,
      secondHalfAvg,
      totalOperations: operationTimes.length
    });
  });

  test('should monitor memory usage during chart interactions', async ({ page }) => {
    await docHelper.logTestStep('Starting memory usage monitoring test');

    // Set up moderate dataset
    await mcpSupabase.executeSQL(`
      INSERT INTO transactions (id, org_id, date, amount, currency, merchant, category, subcategory, created_at)
      SELECT 
        gen_random_uuid(),
        $1,
        CURRENT_DATE - (random() * 90)::int,
        (random() * 200 + 5)::decimal(10,2),
        'USD',
        'Memory Test ' || generate_series,
        (ARRAY['Food & Dining', 'Groceries', 'Shopping'])[floor(random() * 3 + 1)],
        'Test Sub',
        NOW()
      FROM generate_series(1, 200)
    `, [testOrganizations.performance.id]);

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize
      } : null;
    });

    // Perform multiple chart interactions
    for (let i = 0; i < 20; i++) {
      // Click on different chart segments
      const segments = page.locator('[data-testid*="category-segment"]');
      const segmentCount = await segments.count();
      
      if (segmentCount > 0) {
        const randomSegment = segments.nth(i % segmentCount);
        if (await randomSegment.isVisible()) {
          await randomSegment.click();
          await page.waitForTimeout(100);
        }
      }
      
      // Change filters
      const filters = ['last7', 'last30', 'last90'];
      await page.selectOption('[data-testid="time-range-select"]', filters[i % filters.length]);
      await page.waitForTimeout(200);
    }

    // Get final memory usage
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize
      } : null;
    });

    if (initialMemory && finalMemory) {
      const memoryIncrease = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.usedJSHeapSize) * 100;
      
      // Memory increase should be reasonable (less than 100% increase)
      expect(memoryIncreasePercent).toBeLessThan(100);
      
      await docHelper.logTestStep('Memory usage monitored', {
        initialMemoryMB: Math.round(initialMemory.usedJSHeapSize / 1024 / 1024),
        finalMemoryMB: Math.round(finalMemory.usedJSHeapSize / 1024 / 1024),
        increasePercent: Math.round(memoryIncreasePercent)
      });
    }
  });

  test.afterEach(async ({ page }) => {
    // Clean up test data
    await mcpSupabase.executeSQL(`
      DELETE FROM transactions WHERE org_id = $1
    `, [testOrganizations.performance.id]);
    
    await docHelper.takeScreenshot('performance-test-completed');
  });

  test.afterAll(async () => {
    await mcpSupabase.cleanup();
  });
});