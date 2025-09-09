/**
 * RLS Test Configuration
 * 
 * Configuration for multi-tenant RLS verification tests
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    name: 'RLS Verification Tests',
    environment: 'node',
    testTimeout: 60000, // 60 seconds per test
    hookTimeout: 30000, // 30 seconds for setup/teardown
    teardownTimeout: 30000,
    setupFiles: ['./tests/integration/rls-setup.ts'],
    globalSetup: ['./tests/integration/rls-global-setup.ts'],
    globalTeardown: ['./tests/integration/rls-global-teardown.ts'],
    include: [
      'tests/integration/rls-verification.test.ts',
      'tests/integration/provider-rls-verification.test.ts',
      'tests/integration/transaction-provider-rls.test.ts'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.next/**'
    ],
    reporters: ['verbose', 'junit'],
    outputFile: {
      junit: './test-results/rls-verification-results.xml'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './test-results/rls-coverage',
      include: [
        'lib/**/*.ts',
        'app/api/**/*.ts'
      ],
      exclude: [
        'lib/types/**',
        '**/*.test.ts',
        '**/*.spec.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../../')
    }
  }
});