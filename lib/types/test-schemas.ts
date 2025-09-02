/**
 * Test Schemas for ChiPhi AI Email Receipt Processing System
 * 
 * Zod schemas for validating test inputs, outputs, and data structures
 * Used across Playwright MCP tests for type safety and validation
 */

import { z } from 'zod';

// Base test configuration schemas
export const TestConfigSchema = z.object({
  orgId: z.string().uuid(),
  userId: z.string().uuid(),
  inboxAlias: z.string().email(),
  testName: z.string(),
  timeout: z.number().optional().default(30000),
  retries: z.number().optional().default(2),
});

export const TestEnvironmentSchema = z.object({
  baseURL: z.string().url(),
  supabaseUrl: z.string().url(),
  openaiApiKey: z.string().min(1),
  webhookSecret: z.string().min(1),
  mcpEnabled: z.boolean().optional().default(true),
});

// Email processing pipeline schemas
export const EmailTestDataSchema = z.object({
  messageId: z.string(),
  from: z.string().email(),
  to: z.string().email(),
  subject: z.string(),
  textContent: z.string(),
  htmlContent: z.string().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    contentType: z.string(),
    size: z.number(),
    content: z.string(), // Base64 encoded
  })).optional().default([]),
  language: z.string().optional().default('en'),
  expectedCategory: z.string().optional(),
  expectedMerchant: z.string().optional(),
  expectedAmount: z.number().optional(),
});

export const EmailProcessingResultSchema = z.object({
  success: z.boolean(),
  messageId: z.string(),
  processingTime: z.number(),
  steps: z.object({
    received: z.boolean(),
    parsed: z.boolean(),
    translated: z.boolean(),
    extracted: z.boolean(),
    stored: z.boolean(),
  }),
  error: z.string().optional(),
});

// AI extraction and translation schemas
export const TranslationTestSchema = z.object({
  originalText: z.string(),
  originalLanguage: z.string(),
  translatedText: z.string(),
  targetLanguage: z.string().default('en'),
  confidence: z.number().min(0).max(100),
  processingTime: z.number(),
});

export const ExtractionTestSchema = z.object({
  inputText: z.string(),
  expectedOutput: z.object({
    date: z.string(),
    amount: z.number(),
    currency: z.string(),
    merchant: z.string(),
    category: z.string(),
    subcategory: z.string().optional(),
    last4: z.string().optional(),
    notes: z.string().optional(),
  }),
  actualOutput: z.object({
    date: z.string(),
    amount: z.number(),
    currency: z.string(),
    merchant: z.string(),
    category: z.string(),
    subcategory: z.string().optional(),
    last4: z.string().optional(),
    notes: z.string().optional(),
    confidence: z.number().min(0).max(100),
    explanation: z.string(),
  }),
  accuracy: z.object({
    dateMatch: z.boolean(),
    amountMatch: z.boolean(),
    merchantMatch: z.boolean(),
    categoryMatch: z.boolean(),
    overallScore: z.number().min(0).max(100),
  }),
});

// Dashboard and real-time update schemas
export const DashboardTestDataSchema = z.object({
  orgId: z.string().uuid(),
  expectedStats: z.object({
    monthToDateTotal: z.number(),
    transactionCount: z.number(),
    categoryBreakdown: z.array(z.object({
      category: z.string(),
      amount: z.number(),
      percentage: z.number(),
      count: z.number(),
    })),
    spendingTrend: z.array(z.object({
      date: z.string(),
      amount: z.number(),
    })),
  }),
  realtimeUpdates: z.object({
    enabled: z.boolean(),
    updateDelay: z.number().optional().default(1000),
    maxWaitTime: z.number().optional().default(10000),
  }),
});

export const DashboardUpdateEventSchema = z.object({
  type: z.enum(['transaction_added', 'transaction_updated', 'stats_updated']),
  orgId: z.string().uuid(),
  data: z.record(z.any()),
  timestamp: z.string().datetime(),
});

// Multi-tenant isolation schemas
export const TenantIsolationTestSchema = z.object({
  tenant1: z.object({
    orgId: z.string().uuid(),
    userId: z.string().uuid(),
    inboxAlias: z.string().email(),
    testTransactions: z.array(z.object({
      id: z.string().uuid(),
      amount: z.number(),
      merchant: z.string(),
      category: z.string(),
    })),
  }),
  tenant2: z.object({
    orgId: z.string().uuid(),
    userId: z.string().uuid(),
    inboxAlias: z.string().email(),
    testTransactions: z.array(z.object({
      id: z.string().uuid(),
      amount: z.number(),
      merchant: z.string(),
      category: z.string(),
    })),
  }),
  isolationTests: z.array(z.object({
    testName: z.string(),
    description: z.string(),
    expectedIsolation: z.boolean(),
  })),
});

// MCP integration schemas
export const MCPTestConfigSchema = z.object({
  serverName: z.string(),
  serverType: z.enum(['supabase', 'playwright', 'context7', 'magicui']),
  enabled: z.boolean(),
  testOperations: z.array(z.object({
    operation: z.string(),
    parameters: z.record(z.any()),
    expectedResult: z.record(z.any()).optional(),
    timeout: z.number().optional().default(10000),
  })),
});

export const MCPOperationResultSchema = z.object({
  operation: z.string(),
  success: z.boolean(),
  result: z.record(z.any()).optional(),
  error: z.string().optional(),
  executionTime: z.number(),
  serverResponse: z.record(z.any()).optional(),
});

// Performance and load testing schemas
export const PerformanceTestSchema = z.object({
  testType: z.enum(['load', 'stress', 'spike', 'volume']),
  concurrentUsers: z.number().min(1),
  duration: z.number().min(1000), // milliseconds
  rampUpTime: z.number().min(0),
  emailsPerUser: z.number().min(1),
  expectedMetrics: z.object({
    maxResponseTime: z.number(),
    maxErrorRate: z.number().min(0).max(100),
    minThroughput: z.number(),
  }),
});

export const PerformanceResultSchema = z.object({
  testType: z.string(),
  duration: z.number(),
  totalRequests: z.number(),
  successfulRequests: z.number(),
  failedRequests: z.number(),
  averageResponseTime: z.number(),
  maxResponseTime: z.number(),
  minResponseTime: z.number(),
  throughput: z.number(),
  errorRate: z.number(),
  memoryUsage: z.object({
    peak: z.number(),
    average: z.number(),
  }).optional(),
});

// Security testing schemas
export const SecurityTestSchema = z.object({
  testType: z.enum(['pii_redaction', 'hmac_verification', 'rls_isolation', 'xss_prevention', 'sql_injection']),
  testData: z.record(z.any()),
  expectedBehavior: z.object({
    shouldBlock: z.boolean(),
    shouldRedact: z.boolean().optional(),
    shouldIsolate: z.boolean().optional(),
    expectedError: z.string().optional(),
  }),
});

export const SecurityTestResultSchema = z.object({
  testType: z.string(),
  passed: z.boolean(),
  actualBehavior: z.object({
    blocked: z.boolean(),
    redacted: z.boolean().optional(),
    isolated: z.boolean().optional(),
    error: z.string().optional(),
  }),
  securityIssues: z.array(z.object({
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string(),
    recommendation: z.string(),
  })),
});

// Accessibility testing schemas
export const AccessibilityTestSchema = z.object({
  page: z.string(),
  wcagLevel: z.enum(['A', 'AA', 'AAA']).default('AA'),
  testTypes: z.array(z.enum([
    'keyboard_navigation',
    'screen_reader',
    'color_contrast',
    'focus_management',
    'aria_labels',
    'semantic_html'
  ])),
  expectedCompliance: z.boolean().default(true),
});

export const AccessibilityResultSchema = z.object({
  page: z.string(),
  wcagLevel: z.string(),
  overallScore: z.number().min(0).max(100),
  violations: z.array(z.object({
    rule: z.string(),
    severity: z.enum(['minor', 'moderate', 'serious', 'critical']),
    description: z.string(),
    element: z.string(),
    recommendation: z.string(),
  })),
  passes: z.array(z.object({
    rule: z.string(),
    description: z.string(),
  })),
});

// Test result aggregation schemas
export const TestSuiteResultSchema = z.object({
  suiteName: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  duration: z.number(),
  totalTests: z.number(),
  passedTests: z.number(),
  failedTests: z.number(),
  skippedTests: z.number(),
  testResults: z.array(z.object({
    testName: z.string(),
    status: z.enum(['passed', 'failed', 'skipped']),
    duration: z.number(),
    error: z.string().optional(),
    screenshots: z.array(z.string()).optional(),
    videos: z.array(z.string()).optional(),
  })),
  coverage: z.object({
    statements: z.number().min(0).max(100),
    branches: z.number().min(0).max(100),
    functions: z.number().min(0).max(100),
    lines: z.number().min(0).max(100),
  }).optional(),
});

// Export type definitions
export type TestConfig = z.infer<typeof TestConfigSchema>;
export type TestEnvironment = z.infer<typeof TestEnvironmentSchema>;
export type EmailTestData = z.infer<typeof EmailTestDataSchema>;
export type EmailProcessingResult = z.infer<typeof EmailProcessingResultSchema>;
export type TranslationTest = z.infer<typeof TranslationTestSchema>;
export type ExtractionTest = z.infer<typeof ExtractionTestSchema>;
export type DashboardTestData = z.infer<typeof DashboardTestDataSchema>;
export type DashboardUpdateEvent = z.infer<typeof DashboardUpdateEventSchema>;
export type TenantIsolationTest = z.infer<typeof TenantIsolationTestSchema>;
export type MCPTestConfig = z.infer<typeof MCPTestConfigSchema>;
export type MCPOperationResult = z.infer<typeof MCPOperationResultSchema>;
export type PerformanceTest = z.infer<typeof PerformanceTestSchema>;
export type PerformanceResult = z.infer<typeof PerformanceResultSchema>;
export type SecurityTest = z.infer<typeof SecurityTestSchema>;
export type SecurityTestResult = z.infer<typeof SecurityTestResultSchema>;
export type AccessibilityTest = z.infer<typeof AccessibilityTestSchema>;
export type AccessibilityResult = z.infer<typeof AccessibilityResultSchema>;
export type TestSuiteResult = z.infer<typeof TestSuiteResultSchema>;

// Validation helper functions
export function validateTestConfig(config: unknown): TestConfig {
  return TestConfigSchema.parse(config);
}

export function validateEmailTestData(data: unknown): EmailTestData {
  return EmailTestDataSchema.parse(data);
}

export function validateExtractionResult(result: unknown): ExtractionTest {
  return ExtractionTestSchema.parse(result);
}

export function validatePerformanceResult(result: unknown): PerformanceResult {
  return PerformanceResultSchema.parse(result);
}

export function validateSecurityTestResult(result: unknown): SecurityTestResult {
  return SecurityTestResultSchema.parse(result);
}

// Schema validation utilities
export const SchemaValidators = {
  testConfig: TestConfigSchema,
  testEnvironment: TestEnvironmentSchema,
  emailTestData: EmailTestDataSchema,
  emailProcessingResult: EmailProcessingResultSchema,
  translationTest: TranslationTestSchema,
  extractionTest: ExtractionTestSchema,
  dashboardTestData: DashboardTestDataSchema,
  dashboardUpdateEvent: DashboardUpdateEventSchema,
  tenantIsolationTest: TenantIsolationTestSchema,
  mcpTestConfig: MCPTestConfigSchema,
  mcpOperationResult: MCPOperationResultSchema,
  performanceTest: PerformanceTestSchema,
  performanceResult: PerformanceResultSchema,
  securityTest: SecurityTestSchema,
  securityTestResult: SecurityTestResultSchema,
  accessibilityTest: AccessibilityTestSchema,
  accessibilityResult: AccessibilityResultSchema,
  testSuiteResult: TestSuiteResultSchema,
} as const;