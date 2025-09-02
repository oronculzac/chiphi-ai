import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/utils/vitest-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        'coverage/',
        'dist/',
        '.next/',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    include: [
      'lib/**/*.{test,spec}.{js,ts}',
      'components/**/*.{test,spec}.{js,ts,tsx}',
      'hooks/**/*.{test,spec}.{js,ts}',
      'app/**/*.{test,spec}.{js,ts}',
    ],
    exclude: [
      'node_modules/',
      'tests/e2e/',
      'tests/mcp/',
      'tests/fixtures/',
      'tests/utils/',
      '.next/',
      'dist/',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});