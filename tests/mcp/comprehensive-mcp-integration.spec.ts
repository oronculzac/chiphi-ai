/**
 * Comprehensive MCP Integration Tests
 * 
 * Tests for all MCP server integrations including Supabase, Playwright,
 * Context7, and MagicUI servers with the ChiPhi AI system
 */

import { test, expect } from '@playwright/test';
import { MCPHelper, AuthHelper } from '../utils/test-helpers';
import { getTestOrg, getTestUser } from '../fixtures/test-organizations';
import { validateMCPTestConfig, validateMCPOperationResult } from '@/lib/types/test-schemas';

test.describe('Comprehensive MCP Integration', () => {
  let mcpHelper: MCPHelper;
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    mcpHelper = new MCPHelper(page);
    authHelper = new AuthHelper(page);
    
    // Login for authenticated MCP operations
    await authHelper.loginAsUser('primaryOwner');
  });

  test.afterEach(async ({ page }) => {
    await authHelper.logout();
  });

  test('should integrate with Supabase MCP server', async ({ page }) => {
    const mcpConfig = {
      serverName: 'supabase',
      serverType: 'supabase' as const,
      enabled: true,
      testOperations: [
        {
          operation: 'list_projects',
          parameters: {},
          timeout: 10000,
        },
        {
          operation: 'get_project',
          parameters: { id: process.env.SUPABASE_PROJECT_ID || 'test-project' },
          timeout: 10000,
        },
        {
          operation: 'execute_sql',
          parameters: {
            project_id: process.env.SUPABASE_PROJECT_ID || 'test-project',
            query: 'SELECT COUNT(*) as transaction_count FROM transactions WHERE org_id = $1',
          },
          timeout: 15000,
        },
        {
          operation: 'apply_migration',
          parameters: {
            project_id: process.env.SUPABASE_PROJECT_ID || 'test-project',
            name: 'test_mcp_integration',
            query: 'CREATE TABLE IF NOT EXISTS mcp_test (id SERIAL PRIMARY KEY, created_at TIMESTAMP DEFAULT NOW());',
          },
          timeout: 20000,
        },
      ],
    };

    validateMCPTestConfig(mcpConfig);

    // Test each Supabase MCP operation
    for (const operation of mcpConfig.testOperations) {
      const startTime = Date.now();
      
      try {
        const response = await page.request.post('/api/mcp/supabase', {
          data: {
            operation: operation.operation,
            parameters: operation.parameters,
          },
          timeout: operation.timeout,
        });

        const executionTime = Date.now() - startTime;
        const result = await response.json();

        const operationResult = {
          operation: operation.operation,
          success: response.ok(),
          result,
          executionTime,
          serverResponse: result,
        };

        validateMCPOperationResult(operationResult);

        // Verify operation succeeded
        expect(operationResult.success).toBe(true);
        expect(operationResult.executionTime).toBeLessThan(operation.timeout);

        // Operation-specific validations
        switch (operation.operation) {
          case 'list_projects':
            expect(result.data).toBeDefined();
            expect(Array.isArray(result.data)).toBe(true);
            break;

          case 'get_project':
            expect(result.data).toBeDefined();
            expect(result.data.id).toBeTruthy();
            expect(result.data.name).toBeTruthy();
            break;

          case 'execute_sql':
            expect(result.data).toBeDefined();
            expect(result.data.rows).toBeDefined();
            expect(Array.isArray(result.data.rows)).toBe(true);
            break;

          case 'apply_migration':
            expect(result.success).toBe(true);
            expect(result.data.migration_name).toBe('test_mcp_integration');
            break;
        }

        console.log(`✅ Supabase MCP ${operation.operation} completed in ${executionTime}ms`);

      } catch (error) {
        console.error(`❌ Supabase MCP ${operation.operation} failed:`, error);
        throw error;
      }
    }

    // Test error handling
    const errorResponse = await page.request.post('/api/mcp/supabase', {
      data: {
        operation: 'invalid_operation',
        parameters: {},
      },
    });

    expect(errorResponse.status()).toBe(400);
    const errorResult = await errorResponse.json();
    expect(errorResult.error).toBeTruthy();
  });

  test('should integrate with Playwright MCP server', async ({ page }) => {
    const mcpConfig = {
      serverName: 'playwright',
      serverType: 'playwright' as const,
      enabled: true,
      testOperations: [
        {
          operation: 'browser_navigate',
          parameters: { url: 'https://example.com' },
          timeout: 10000,
        },
        {
          operation: 'browser_screenshot',
          parameters: { filename: 'mcp-test-screenshot.png' },
          timeout: 10000,
        },
        {
          operation: 'browser_get_page_content',
          parameters: {},
          timeout: 10000,
        },
        {
          operation: 'browser_evaluate',
          parameters: {
            function: '() => document.title',
          },
          timeout: 10000,
        },
      ],
    };

    validateMCPTestConfig(mcpConfig);

    // Test each Playwright MCP operation
    for (const operation of mcpConfig.testOperations) {
      const startTime = Date.now();
      
      try {
        const response = await page.request.post('/api/mcp/playwright', {
          data: {
            operation: operation.operation,
            parameters: operation.parameters,
          },
          timeout: operation.timeout,
        });

        const executionTime = Date.now() - startTime;
        const result = await response.json();

        const operationResult = {
          operation: operation.operation,
          success: response.ok(),
          result,
          executionTime,
          serverResponse: result,
        };

        validateMCPOperationResult(operationResult);

        // Verify operation succeeded
        expect(operationResult.success).toBe(true);
        expect(operationResult.executionTime).toBeLessThan(operation.timeout);

        // Operation-specific validations
        switch (operation.operation) {
          case 'browser_navigate':
            expect(result.success).toBe(true);
            expect(result.url).toBe('https://example.com');
            break;

          case 'browser_screenshot':
            expect(result.success).toBe(true);
            expect(result.screenshot).toBeTruthy();
            expect(result.filename).toBe('mcp-test-screenshot.png');
            break;

          case 'browser_get_page_content':
            expect(result.success).toBe(true);
            expect(result.content).toBeTruthy();
            expect(result.content).toContain('Example Domain');
            break;

          case 'browser_evaluate':
            expect(result.success).toBe(true);
            expect(result.result).toBe('Example Domain');
            break;
        }

        console.log(`✅ Playwright MCP ${operation.operation} completed in ${executionTime}ms`);

      } catch (error) {
        console.error(`❌ Playwright MCP ${operation.operation} failed:`, error);
        throw error;
      }
    }

    // Test browser automation for email workflow testing
    const emailWorkflowTest = await page.request.post('/api/mcp/playwright', {
      data: {
        operation: 'test_email_workflow',
        parameters: {
          baseUrl: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
          testEmail: 'test@example.com',
          testPassword: 'test123',
        },
      },
    });

    expect(emailWorkflowTest.ok()).toBe(true);
    const workflowResult = await emailWorkflowTest.json();
    expect(workflowResult.success).toBe(true);
    expect(workflowResult.steps_completed).toBeGreaterThan(0);
  });

  test('should integrate with Context7 MCP server', async ({ page }) => {
    const mcpConfig = {
      serverName: 'context7',
      serverType: 'context7' as const,
      enabled: true,
      testOperations: [
        {
          operation: 'resolve-library-id',
          parameters: { libraryName: 'supabase' },
          timeout: 10000,
        },
        {
          operation: 'get-library-docs',
          parameters: {
            context7CompatibleLibraryID: '/supabase/supabase',
            topic: 'authentication',
            tokens: 5000,
          },
          timeout: 15000,
        },
        {
          operation: 'resolve-library-id',
          parameters: { libraryName: 'next.js' },
          timeout: 10000,
        },
        {
          operation: 'get-library-docs',
          parameters: {
            context7CompatibleLibraryID: '/vercel/next.js',
            topic: 'api-routes',
            tokens: 3000,
          },
          timeout: 15000,
        },
      ],
    };

    validateMCPTestConfig(mcpConfig);

    // Test Context7 library resolution and documentation retrieval
    for (const operation of mcpConfig.testOperations) {
      const startTime = Date.now();
      
      try {
        const response = await page.request.post('/api/mcp/context7', {
          data: {
            operation: operation.operation,
            parameters: operation.parameters,
          },
          timeout: operation.timeout,
        });

        const executionTime = Date.now() - startTime;
        const result = await response.json();

        const operationResult = {
          operation: operation.operation,
          success: response.ok(),
          result,
          executionTime,
          serverResponse: result,
        };

        validateMCPOperationResult(operationResult);

        // Verify operation succeeded
        expect(operationResult.success).toBe(true);
        expect(operationResult.executionTime).toBeLessThan(operation.timeout);

        // Operation-specific validations
        switch (operation.operation) {
          case 'resolve-library-id':
            expect(result.libraryId).toBeTruthy();
            expect(result.libraryId).toMatch(/^\/[^\/]+\/[^\/]+/); // Format: /org/project
            break;

          case 'get-library-docs':
            expect(result.documentation).toBeTruthy();
            expect(result.documentation.length).toBeGreaterThan(100);
            expect(result.tokens_used).toBeGreaterThan(0);
            expect(result.tokens_used).toBeLessThanOrEqual(operation.parameters.tokens);
            break;
        }

        console.log(`✅ Context7 MCP ${operation.operation} completed in ${executionTime}ms`);

      } catch (error) {
        console.error(`❌ Context7 MCP ${operation.operation} failed:`, error);
        throw error;
      }
    }

    // Test documentation search for ChiPhi AI specific topics
    const chipHiTopics = ['email processing', 'receipt extraction', 'multi-tenant', 'row level security'];
    
    for (const topic of chipHiTopics) {
      const searchResponse = await page.request.post('/api/mcp/context7', {
        data: {
          operation: 'search-documentation',
          parameters: {
            query: topic,
            maxResults: 5,
          },
        },
      });

      if (searchResponse.ok()) {
        const searchResult = await searchResponse.json();
        expect(searchResult.results).toBeDefined();
        expect(Array.isArray(searchResult.results)).toBe(true);
        console.log(`✅ Context7 search for "${topic}" returned ${searchResult.results.length} results`);
      }
    }
  });

  test('should integrate with MagicUI MCP server', async ({ page }) => {
    const mcpConfig = {
      serverName: 'magicui',
      serverType: 'magicui' as const,
      enabled: true,
      testOperations: [
        {
          operation: 'getAllComponents',
          parameters: {},
          timeout: 10000,
        },
        {
          operation: 'getComponent',
          parameters: { name: 'button' },
          timeout: 10000,
        },
        {
          operation: 'getComponentsByType',
          parameters: { type: 'form' },
          timeout: 10000,
        },
        {
          operation: 'searchComponents',
          parameters: { query: 'dashboard' },
          timeout: 10000,
        },
      ],
    };

    validateMCPTestConfig(mcpConfig);

    // Test MagicUI component operations
    for (const operation of mcpConfig.testOperations) {
      const startTime = Date.now();
      
      try {
        const response = await page.request.post('/api/mcp/magicui', {
          data: {
            operation: operation.operation,
            parameters: operation.parameters,
          },
          timeout: operation.timeout,
        });

        const executionTime = Date.now() - startTime;
        const result = await response.json();

        const operationResult = {
          operation: operation.operation,
          success: response.ok(),
          result,
          executionTime,
          serverResponse: result,
        };

        validateMCPOperationResult(operationResult);

        // Verify operation succeeded
        expect(operationResult.success).toBe(true);
        expect(operationResult.executionTime).toBeLessThan(operation.timeout);

        // Operation-specific validations
        switch (operation.operation) {
          case 'getAllComponents':
            expect(result.components).toBeDefined();
            expect(Array.isArray(result.components)).toBe(true);
            expect(result.components.length).toBeGreaterThan(0);
            break;

          case 'getComponent':
            expect(result.component).toBeDefined();
            expect(result.component.name).toBe('button');
            expect(result.component.code).toBeTruthy();
            break;

          case 'getComponentsByType':
            expect(result.components).toBeDefined();
            expect(Array.isArray(result.components)).toBe(true);
            result.components.forEach((component: any) => {
              expect(component.type).toBe('form');
            });
            break;

          case 'searchComponents':
            expect(result.components).toBeDefined();
            expect(Array.isArray(result.components)).toBe(true);
            result.components.forEach((component: any) => {
              expect(component.name.toLowerCase()).toContain('dashboard');
            });
            break;
        }

        console.log(`✅ MagicUI MCP ${operation.operation} completed in ${executionTime}ms`);

      } catch (error) {
        console.error(`❌ MagicUI MCP ${operation.operation} failed:`, error);
        throw error;
      }
    }

    // Test component generation for ChiPhi AI specific needs
    const chipHiComponents = [
      { name: 'receipt-processor', type: 'form' },
      { name: 'transaction-list', type: 'table' },
      { name: 'confidence-badge', type: 'indicator' },
      { name: 'category-selector', type: 'dropdown' },
    ];

    for (const componentSpec of chipHiComponents) {
      const generateResponse = await page.request.post('/api/mcp/magicui', {
        data: {
          operation: 'generateComponent',
          parameters: {
            name: componentSpec.name,
            type: componentSpec.type,
            requirements: `Component for ChiPhi AI ${componentSpec.name.replace('-', ' ')} functionality`,
          },
        },
      });

      if (generateResponse.ok()) {
        const generateResult = await generateResponse.json();
        expect(generateResult.component).toBeDefined();
        expect(generateResult.component.code).toBeTruthy();
        console.log(`✅ MagicUI generated ${componentSpec.name} component`);
      }
    }
  });

  test('should handle MCP server failures gracefully', async ({ page }) => {
    // Test timeout handling
    const timeoutResponse = await page.request.post('/api/mcp/supabase', {
      data: {
        operation: 'execute_sql',
        parameters: {
          project_id: 'invalid-project',
          query: 'SELECT pg_sleep(60);', // Long-running query
        },
      },
      timeout: 5000, // Short timeout
    });

    expect(timeoutResponse.status()).toBe(408); // Timeout
    const timeoutResult = await timeoutResponse.json();
    expect(timeoutResult.error).toContain('timeout');

    // Test invalid operation handling
    const invalidResponse = await page.request.post('/api/mcp/supabase', {
      data: {
        operation: 'nonexistent_operation',
        parameters: {},
      },
    });

    expect(invalidResponse.status()).toBe(400);
    const invalidResult = await invalidResponse.json();
    expect(invalidResult.error).toBeTruthy();

    // Test malformed parameters
    const malformedResponse = await page.request.post('/api/mcp/playwright', {
      data: {
        operation: 'browser_navigate',
        parameters: {
          url: 'not-a-valid-url',
        },
      },
    });

    expect(malformedResponse.status()).toBe(400);
    const malformedResult = await malformedResponse.json();
    expect(malformedResult.error).toBeTruthy();

    // Test server unavailable scenario
    const unavailableResponse = await page.request.post('/api/mcp/nonexistent-server', {
      data: {
        operation: 'test',
        parameters: {},
      },
    });

    expect(unavailableResponse.status()).toBe(404);
  });

  test('should maintain MCP operation performance', async ({ page }) => {
    const performanceTests = [
      {
        server: 'supabase',
        operation: 'execute_sql',
        parameters: {
          project_id: process.env.SUPABASE_PROJECT_ID || 'test-project',
          query: 'SELECT 1 as test',
        },
        maxTime: 5000,
      },
      {
        server: 'playwright',
        operation: 'browser_evaluate',
        parameters: {
          function: '() => "performance test"',
        },
        maxTime: 3000,
      },
      {
        server: 'context7',
        operation: 'resolve-library-id',
        parameters: {
          libraryName: 'react',
        },
        maxTime: 8000,
      },
      {
        server: 'magicui',
        operation: 'getComponent',
        parameters: {
          name: 'button',
        },
        maxTime: 5000,
      },
    ];

    const performanceResults = [];

    for (const test of performanceTests) {
      const startTime = Date.now();
      
      const response = await page.request.post(`/api/mcp/${test.server}`, {
        data: {
          operation: test.operation,
          parameters: test.parameters,
        },
        timeout: test.maxTime,
      });

      const executionTime = Date.now() - startTime;
      
      expect(response.ok()).toBe(true);
      expect(executionTime).toBeLessThan(test.maxTime);

      performanceResults.push({
        server: test.server,
        operation: test.operation,
        executionTime,
        maxTime: test.maxTime,
        performanceRatio: executionTime / test.maxTime,
      });

      console.log(`⚡ ${test.server} ${test.operation}: ${executionTime}ms (${((executionTime / test.maxTime) * 100).toFixed(1)}% of max)`);
    }

    // Verify overall performance
    const averagePerformanceRatio = performanceResults.reduce((sum, result) => sum + result.performanceRatio, 0) / performanceResults.length;
    expect(averagePerformanceRatio).toBeLessThan(0.8); // Should use less than 80% of max time on average

    console.log(`📊 Average MCP performance: ${(averagePerformanceRatio * 100).toFixed(1)}% of maximum allowed time`);
  });

  test('should integrate MCP operations with ChiPhi AI workflows', async ({ page }) => {
    // Test end-to-end workflow using multiple MCP servers
    
    // Step 1: Use Supabase MCP to check database state
    const dbCheckResponse = await page.request.post('/api/mcp/supabase', {
      data: {
        operation: 'execute_sql',
        parameters: {
          project_id: process.env.SUPABASE_PROJECT_ID || 'test-project',
          query: 'SELECT COUNT(*) as count FROM transactions WHERE org_id = $1',
        },
      },
    });

    expect(dbCheckResponse.ok()).toBe(true);
    const dbCheckResult = await dbCheckResponse.json();
    const initialTransactionCount = dbCheckResult.data.rows[0].count;

    // Step 2: Use Playwright MCP to simulate email processing
    const emailSimulationResponse = await page.request.post('/api/mcp/playwright', {
      data: {
        operation: 'simulate_email_processing',
        parameters: {
          emailData: {
            from: 'receipts@starbucks.com',
            to: getTestOrg('primary').inboxAlias,
            subject: 'Your Starbucks Receipt',
            content: 'Grande Latte $5.47',
          },
        },
      },
    });

    expect(emailSimulationResponse.ok()).toBe(true);
    const simulationResult = await emailSimulationResponse.json();
    expect(simulationResult.success).toBe(true);

    // Step 3: Use Context7 MCP to get documentation for troubleshooting
    const docsResponse = await page.request.post('/api/mcp/context7', {
      data: {
        operation: 'get-library-docs',
        parameters: {
          context7CompatibleLibraryID: '/supabase/supabase',
          topic: 'real-time subscriptions',
          tokens: 2000,
        },
      },
    });

    expect(docsResponse.ok()).toBe(true);
    const docsResult = await docsResponse.json();
    expect(docsResult.documentation).toBeTruthy();

    // Step 4: Use MagicUI MCP to generate UI components for new features
    const componentResponse = await page.request.post('/api/mcp/magicui', {
      data: {
        operation: 'generateComponent',
        parameters: {
          name: 'mcp-status-indicator',
          type: 'status',
          requirements: 'Component to show MCP server connection status',
        },
      },
    });

    expect(componentResponse.ok()).toBe(true);
    const componentResult = await componentResponse.json();
    expect(componentResult.component.code).toBeTruthy();

    // Step 5: Verify the workflow completed successfully
    const finalDbCheckResponse = await page.request.post('/api/mcp/supabase', {
      data: {
        operation: 'execute_sql',
        parameters: {
          project_id: process.env.SUPABASE_PROJECT_ID || 'test-project',
          query: 'SELECT COUNT(*) as count FROM transactions WHERE org_id = $1',
        },
      },
    });

    expect(finalDbCheckResponse.ok()).toBe(true);
    const finalDbCheckResult = await finalDbCheckResponse.json();
    const finalTransactionCount = finalDbCheckResult.data.rows[0].count;

    // Verify transaction was processed (if email simulation actually created one)
    if (simulationResult.transaction_created) {
      expect(finalTransactionCount).toBe(initialTransactionCount + 1);
    }

    console.log(`🔄 MCP workflow completed:
      - Initial transactions: ${initialTransactionCount}
      - Final transactions: ${finalTransactionCount}
      - Email simulation: ${simulationResult.success ? 'Success' : 'Failed'}
      - Documentation retrieved: ${docsResult.documentation.length} characters
      - Component generated: ${componentResult.component.name}
    `);
  });
});