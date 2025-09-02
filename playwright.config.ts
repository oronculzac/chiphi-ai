import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for ChiPhi AI Email Receipt Processing System
 * 
 * Configured for comprehensive testing including:
 * - Email processing workflows
 * - MCP server integration
 * - Multi-tenant isolation
 * - AI categorization accuracy
 * - Real-time dashboard updates
 */

export default defineConfig({
  // Test directory structure
  testDir: './tests',
  testMatch: [
    'tests/e2e/**/*.spec.ts',
    'tests/mcp/**/*.spec.ts',
    'tests/integration/**/*.test.ts'
  ],
  
  // Global test configuration
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  // Test timeouts
  timeout: 60000, // 60 seconds for email processing tests
  expect: {
    timeout: 10000, // 10 seconds for assertions
  },
  
  // Global setup and teardown
  globalSetup: require.resolve('./tests/global-setup.ts'),
  globalTeardown: require.resolve('./tests/global-teardown.ts'),
  
  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }],
    process.env.CI ? ['github'] : ['list']
  ],
  
  // Output directory for test artifacts
  outputDir: 'test-results/artifacts',
  
  // Global test configuration
  use: {
    // Base URL for the application
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    
    // Browser context options
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    
    // Screenshots and videos
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    
    // Test data and fixtures
    storageState: undefined, // Will be set per test as needed
    
    // API request configuration
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  },

  // Project configurations for different test types
  projects: [
    // Setup project for authentication and test data
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      teardown: 'cleanup',
    },
    
    // Cleanup project
    {
      name: 'cleanup',
      testMatch: /.*\.teardown\.ts/,
    },

    // Chrome - Primary browser for comprehensive testing
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Enable additional Chrome features for email testing
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--no-sandbox',
            '--disable-setuid-sandbox'
          ]
        }
      },
      dependencies: ['setup'],
    },

    // Firefox - Cross-browser compatibility
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },

    // Safari - WebKit testing
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },

    // Mobile Chrome - Mobile responsiveness
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup'],
    },

    // Mobile Safari - iOS testing
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      dependencies: ['setup'],
    },

    // API Testing - For webhook and MCP integration tests
    {
      name: 'api',
      testMatch: /.*\.api\.spec\.ts/,
      use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
      },
    },

    // MCP Integration Tests - Specific configuration for MCP server testing
    {
      name: 'mcp',
      testMatch: /tests\/mcp\/.*\.spec\.ts/,
      use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
        // Extended timeout for MCP operations
        actionTimeout: 30000,
        navigationTimeout: 30000,
      },
      dependencies: ['setup'],
    },

    // Performance Tests - Optimized for load testing
    {
      name: 'performance',
      testMatch: /.*performance.*\.spec\.ts/,
      use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
        // Reduced timeouts for performance testing
        actionTimeout: 5000,
        navigationTimeout: 10000,
      },
      dependencies: ['setup'],
    },
  ],

  // Development server configuration
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 minutes to start
    env: {
      NODE_ENV: 'test',
      // Test-specific environment variables
      NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL || 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || 'test-webhook-secret',
    },
  },

  // Test metadata and tags
  metadata: {
    'test-type': 'e2e',
    'application': 'chiphi-ai',
    'version': process.env.npm_package_version || '1.0.0',
  },
});