/**
 * Reports Test Suite Configuration
 * 
 * Comprehensive test configuration for running all reports-related tests
 * Includes setup for different test types and environments
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  
  // Test patterns for reports
  testMatch: [
    '**/reports-comprehensive.spec.ts',
    '**/reports-performance.spec.ts', 
    '**/reports-edge-cases.spec.ts',
    '**/reports-visual-regression.spec.ts'
  ],

  // Global test configuration
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'test-results/reports-html-report' }],
    ['json', { outputFile: 'test-results/reports-results.json' }],
    ['junit', { outputFile: 'test-results/reports-junit.xml' }],
    ['line']
  ],

  // Global test settings
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Extended timeouts for reports tests
    actionTimeout: 30000,
    navigationTimeout: 60000,
  },

  // Test setup and teardown
  globalSetup: require.resolve('./tests/global-setup.ts'),
  globalTeardown: require.resolve('./tests/global-teardown.ts'),

  // Project configurations for different test types
  projects: [
    // Comprehensive E2E tests
    {
      name: 'reports-comprehensive',
      testMatch: '**/reports-comprehensive.spec.ts',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
    },

    // Performance tests
    {
      name: 'reports-performance',
      testMatch: '**/reports-performance.spec.ts',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
      timeout: 120000, // Extended timeout for performance tests
    },

    // Edge cases and error scenarios
    {
      name: 'reports-edge-cases',
      testMatch: '**/reports-edge-cases.spec.ts',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
    },

    // Visual regression tests - Desktop
    {
      name: 'reports-visual-desktop',
      testMatch: '**/reports-visual-regression.spec.ts',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
    },

    // Visual regression tests - Tablet
    {
      name: 'reports-visual-tablet',
      testMatch: '**/reports-visual-regression.spec.ts',
      use: { 
        ...devices['iPad Pro'],
        viewport: { width: 768, height: 1024 }
      },
    },

    // Visual regression tests - Mobile
    {
      name: 'reports-visual-mobile',
      testMatch: '**/reports-visual-regression.spec.ts',
      use: { 
        ...devices['iPhone 12'],
        viewport: { width: 375, height: 667 }
      },
    },

    // Cross-browser testing
    {
      name: 'reports-firefox',
      testMatch: '**/reports-comprehensive.spec.ts',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 }
      },
    },

    {
      name: 'reports-safari',
      testMatch: '**/reports-comprehensive.spec.ts',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 }
      },
    },
  ],

  // Output directories
  outputDir: 'test-results/reports-artifacts',
  
  // Web server configuration for local testing
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // Expect configuration for visual tests
  expect: {
    // Visual comparison threshold
    threshold: 0.01, // 1% difference allowed
    
    // Screenshot comparison options
    toHaveScreenshot: {
      threshold: 0.01,
      mode: 'strict',
    },
    
    // Timeout for assertions
    timeout: 30000,
  },
});