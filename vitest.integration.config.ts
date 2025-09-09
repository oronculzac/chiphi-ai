import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'Integration Tests',
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/utils/integration-setup.ts'],
    testTimeout: 60000, // 60 seconds for integration tests
    hookTimeout: 30000,
    teardownTimeout: 30000,
    include: [
      'tests/integration/**/*.{test,spec}.{js,ts}',
    ],
    exclude: [
      'node_modules/',
      'tests/e2e/',
      'tests/mcp/',
      'tests/fixtures/',
      'tests/utils/',
      'tests/visual/',
      '.next/',
      'dist/',
    ],
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './test-results/integration-coverage',
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
      '@': path.resolve(__dirname, '.'),
    },
  },
});