# Test Data Management Guide

## Overview

This guide covers the comprehensive test data management strategy for ChiPhi AI, including test organizations, users, email samples, and data lifecycle management.

## Test Data Architecture

### Data Isolation Levels

1. **Global Test Data**: Shared across all test suites
2. **Suite-Specific Data**: Isolated to specific test suites
3. **Test-Specific Data**: Created and cleaned up per test
4. **Tenant-Specific Data**: Isolated by organization

### Data Categories

```
Test Data
├── Organizations (Multi-tenant isolation)
├── Users (Authentication and roles)
├── Email Samples (Multilingual receipts)
├── Transactions (Expected outcomes)
├── Merchant Mappings (Learning system)
└── Configuration (Test environment)
```

## Test Organizations

### Organization Structure

```typescript
// tests/fixtures/test-organizations.ts
export const testOrganizations = {
  primary: {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'ChiPhi Test Org Primary',
    userId: '550e8400-e29b-41d4-a716-446655440011',
    inboxAlias: 'test-primary@chiphi-test.com',
    settings: {
      timezone: 'America/New_York',
      currency: 'USD',
      language: 'en',
    },
  },
  // ... more organizations
};
```

### Organization Usage Patterns

#### Primary Organization
- **Purpose**: Main testing scenarios
- **Usage**: Standard email processing, dashboard tests
- **Data**: English receipts, basic transactions

#### Secondary Organization  
- **Purpose**: Multi-tenant isolation testing
- **Usage**: Cross-tenant access verification
- **Data**: Separate transaction set

#### Multilingual Organization
- **Purpose**: Translation and internationalization
- **Usage**: Non-English receipt processing
- **Data**: Spanish, French, Japanese, German receipts

#### Performance Organization
- **Purpose**: Load and performance testing
- **Usage**: Concurrent processing, stress tests
- **Data**: Large volumes of test transactions

#### Security Organization
- **Purpose**: Security and penetration testing
- **Usage**: XSS, SQL injection, PII redaction tests
- **Data**: Malicious payloads, sensitive data

### Organization Selection Guide

```typescript
// Choose organization based on test type
const getTestOrg = (testType: string) => {
  switch (testType) {
    case 'basic':
    case 'workflow':
      return testOrganizations.primary;
    
    case 'isolation':
    case 'multi-tenant':
      return testOrganizations.secondary;
    
    case 'translation':
    case 'multilingual':
      return testOrganizations.multilingual;
    
    case 'performance':
    case 'load':
      return testOrganizations.performance;
    
    case 'security':
    case 'penetration':
      return testOrganizations.security;
    
    default:
      return testOrganizations.primary;
  }
};
```

## Test Users

### User Roles and Permissions

```typescript
export const testUsers = {
  // Organization owners
  primaryOwner: {
    id: '550e8400-e29b-41d4-a716-446655440011',
    email: 'owner@chiphi-test.com',
    role: 'owner',
    permissions: ['all'],
  },
  
  // Organization admins
  primaryAdmin: {
    id: '550e8400-e29b-41d4-a716-446655440021',
    email: 'admin@chiphi-test.com',
    role: 'admin',
    permissions: ['manage_users', 'view_analytics', 'edit_settings'],
  },
  
  // Organization members
  primaryMember: {
    id: '550e8400-e29b-41d4-a716-446655440031',
    email: 'member@chiphi-test.com',
    role: 'member',
    permissions: ['view_transactions', 'edit_categories'],
  },
};
```

### User Authentication Patterns

```typescript
// Standard authentication
test.beforeEach(async ({ page }) => {
  const authHelper = new AuthHelper(page);
  await authHelper.loginAsUser('primaryOwner');
});

// Role-based testing
const testRoles = ['owner', 'admin', 'member'];
for (const role of testRoles) {
  test(`should handle ${role} permissions`, async ({ page }) => {
    const authHelper = new AuthHelper(page);
    await authHelper.loginAsUser(`primary${role.charAt(0).toUpperCase() + role.slice(1)}`);
    // ... role-specific tests
  });
}

// Multi-user scenarios
test('should handle concurrent users', async ({ page, context }) => {
  const user1Context = await context.browser()?.newContext();
  const user2Context = await context.browser()?.newContext();
  
  const user1Page = await user1Context.newPage();
  const user2Page = await user2Context.newPage();
  
  await new AuthHelper(user1Page).loginAsUser('primaryOwner');
  await new AuthHelper(user2Page).loginAsUser('primaryAdmin');
  
  // ... concurrent user tests
});
```

## Email Sample Management

### Sample Categories

#### Language-Based Samples

```typescript
// English samples
export const englishEmailSamples = {
  starbucksCoffee: {
    messageId: 'starbucks-001@test.com',
    language: 'en',
    expectedCategory: 'Food & Dining',
    expectedMerchant: 'Starbucks Coffee',
    expectedAmount: 5.95,
    // ... full email content
  },
  // ... more English samples
};

// Spanish samples
export const spanishEmailSamples = {
  restaurantReceipt: {
    messageId: 'restaurant-es-001@test.com',
    language: 'es',
    expectedCategory: 'Food & Dining',
    expectedMerchant: 'Restaurante El Patio',
    expectedAmount: 44.66,
    // ... full email content
  },
  // ... more Spanish samples
};
```

#### Category-Based Samples

```typescript
// Organize by spending category
const samplesByCategory = {
  'Food & Dining': [
    'starbucksCoffee',
    'restaurantReceipt',
    'cafeReceipt',
  ],
  'Groceries': [
    'wholeFoodsGrocery',
    'supermarket',
  ],
  'Transportation': [
    'uberRide',
    'gasStation',
  ],
  'Health & Medical': [
    'pharmacyReceipt',
    'pharmacieReceipt',
  ],
};
```

#### Edge Case Samples

```typescript
export const edgeCaseEmailSamples = {
  malformedReceipt: {
    // Incomplete or corrupted receipt data
    textContent: 'INCOMPLETE RECEIPT\nStore: ???\nTotal: ERROR',
    expectedCategory: 'Other',
    expectedConfidence: 'low',
  },
  
  duplicateReceipt: {
    // Exact duplicate of existing receipt
    messageId: 'duplicate-001@test.com',
    isDuplicate: true,
    originalMessageId: 'starbucks-001@test.com',
  },
  
  forwardedEmail: {
    // Email forwarded from another address
    isForwarded: true,
    originalSender: 'receipts@restaurant.com',
    forwardedBy: 'user@example.com',
  },
  
  pdfAttachment: {
    // Receipt as PDF attachment
    hasAttachment: true,
    attachmentType: 'application/pdf',
    attachmentSize: 15432,
  },
  
  suspiciousContent: {
    // Potentially malicious content
    containsXSS: true,
    containsPII: true,
    containsSQLInjection: true,
    expectedBlocked: true,
  },
};
```

### Sample Selection Strategies

#### Random Selection

```typescript
// Get random sample for variety
const getRandomEmailSample = () => {
  const allSamples = Object.keys(allEmailSamples);
  const randomKey = allSamples[Math.floor(Math.random() * allSamples.length)];
  return allEmailSamples[randomKey];
};

// Get random sample by category
const getRandomSampleByCategory = (category: string) => {
  const categorySamples = getEmailSamplesByCategory(category);
  return categorySamples[Math.floor(Math.random() * categorySamples.length)];
};
```

#### Weighted Selection

```typescript
// Weight samples by test importance
const sampleWeights = {
  starbucksCoffee: 10,    // High - common use case
  wholeFoodsGrocery: 8,   // High - different category
  restaurantReceipt: 6,   // Medium - translation test
  malformedReceipt: 3,    // Low - edge case
  suspiciousContent: 1,   // Very low - security test
};

const getWeightedRandomSample = () => {
  const totalWeight = Object.values(sampleWeights).reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const [sampleKey, weight] of Object.entries(sampleWeights)) {
    random -= weight;
    if (random <= 0) {
      return allEmailSamples[sampleKey];
    }
  }
  
  return allEmailSamples.starbucksCoffee; // Fallback
};
```

#### Systematic Selection

```typescript
// Ensure coverage of all categories
const getSystematicSamples = (count: number) => {
  const categories = Object.keys(samplesByCategory);
  const samples = [];
  
  for (let i = 0; i < count; i++) {
    const category = categories[i % categories.length];
    const categorySamples = samplesByCategory[category];
    const sample = categorySamples[Math.floor(i / categories.length) % categorySamples.length];
    samples.push(getEmailSample(sample));
  }
  
  return samples;
};
```

## Transaction Templates

### Template Structure

```typescript
export const testTransactionTemplates = {
  englishCoffee: {
    merchant: 'Starbucks Coffee',
    amount: 5.47,
    currency: 'USD',
    category: 'Food & Dining',
    subcategory: 'Coffee Shops',
    date: '2024-01-15',
    last4: '1234',
    language: 'en',
    confidence: 95,
    explanation: 'Coffee shop transaction with high confidence',
  },
  
  spanishRestaurant: {
    merchant: 'Restaurante El Patio',
    amount: 45.60,
    currency: 'EUR',
    category: 'Food & Dining',
    subcategory: 'Restaurants',
    date: '2024-01-13',
    last4: '9012',
    language: 'es',
    confidence: 89,
    explanation: 'Restaurant transaction requiring translation',
  },
};
```

### Template Usage

```typescript
// Create transaction from template
const createTestTransaction = async (templateKey: string, overrides = {}) => {
  const template = getTestTransactionTemplate(templateKey);
  const transactionData = { ...template, ...overrides };
  
  const response = await page.request.post('/api/transactions', {
    data: transactionData,
  });
  
  return response.json();
};

// Batch create transactions
const createTestTransactions = async (templates: string[]) => {
  const promises = templates.map(template => createTestTransaction(template));
  return Promise.all(promises);
};
```

## Merchant Mapping Data

### Mapping Structure

```typescript
export const testMerchantMappings = {
  starbucks: {
    merchant: 'Starbucks Coffee',
    category: 'Food & Dining',
    subcategory: 'Coffee Shops',
    confidence: 95,
    learnedFrom: 'user_correction',
    correctionCount: 5,
    lastUpdated: '2024-01-15T10:30:00Z',
  },
  
  wholeFoods: {
    merchant: 'Whole Foods Market',
    category: 'Groceries',
    subcategory: 'Supermarkets',
    confidence: 98,
    learnedFrom: 'user_correction',
    correctionCount: 12,
    lastUpdated: '2024-01-14T15:45:00Z',
  },
};
```

### Learning System Testing

```typescript
// Test merchant mapping learning
test('should learn from user corrections', async ({ page }) => {
  const emailHelper = new EmailHelper(page);
  
  // Send initial email
  const emailData = getEmailSample('starbucksCoffee');
  await emailHelper.sendTestEmail(emailData);
  await emailHelper.waitForEmailProcessing(emailData.messageId);
  
  // Correct the category
  await page.goto('/dashboard/transactions');
  const transactionRow = page.locator('[data-testid^="transaction-"]').first();
  await transactionRow.click();
  
  await page.click('[data-testid="edit-category-button"]');
  await page.selectOption('[data-testid="category-select"]', 'Entertainment');
  await page.click('[data-testid="save-category-button"]');
  
  // Send another email from same merchant
  const secondEmail = {
    ...emailData,
    messageId: 'starbucks-002@test.com',
  };
  
  await emailHelper.sendTestEmail(secondEmail);
  await emailHelper.waitForEmailProcessing(secondEmail.messageId);
  
  // Verify learned mapping was applied
  const transaction = await emailHelper.verifyTransactionCreated(
    secondEmail.messageId,
    { expectedCategory: 'Entertainment' }
  );
  
  expect(transaction.category).toBe('Entertainment');
  expect(transaction.confidence).toBeGreaterThan(95); // High confidence from learning
});
```

## Data Lifecycle Management

### Setup Phase

```typescript
// Global setup - runs once before all tests
export default async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global test setup...');
  
  // 1. Validate test data integrity
  const dataIssues = validateTestDataIntegrity();
  if (dataIssues.length > 0) {
    throw new Error(`Test data integrity issues: ${dataIssues.join(', ')}`);
  }
  
  // 2. Setup test organizations
  for (const [key, org] of Object.entries(testOrganizations)) {
    await setupTestOrganization(org);
  }
  
  // 3. Setup test users
  for (const [key, user] of Object.entries(testUsers)) {
    await setupTestUser(user);
  }
  
  // 4. Verify MCP server connectivity
  await verifyMCPConnectivity();
  
  console.log('✅ Global test setup completed');
}
```

### Test-Level Setup

```typescript
// Test suite setup
test.describe('Email Processing', () => {
  test.beforeAll(async () => {
    // Suite-specific setup
    await setupEmailProcessingTestData();
  });
  
  test.beforeEach(async ({ page }) => {
    // Test-specific setup
    const authHelper = new AuthHelper(page);
    await authHelper.loginAsUser('primaryOwner');
    
    // Clear any existing test data for this test
    await clearTestData(test.info().title);
  });
  
  test.afterEach(async ({ page }) => {
    // Test-specific cleanup
    await cleanupTestData(test.info().title);
    
    const authHelper = new AuthHelper(page);
    await authHelper.logout();
  });
  
  test.afterAll(async () => {
    // Suite-specific cleanup
    await cleanupEmailProcessingTestData();
  });
});
```

### Cleanup Phase

```typescript
// Global teardown - runs once after all tests
export default async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global test teardown...');
  
  try {
    // 1. Clean up test database data
    const cleanupQueries = getTestDataCleanupQueries();
    await executeCleanupQueries(cleanupQueries);
    
    // 2. Clean up test artifacts
    await cleanupTestArtifacts();
    
    // 3. Close MCP connections
    await closeMCPConnections();
    
    console.log('✅ Global test teardown completed');
  } catch (error) {
    console.error('❌ Global test teardown failed:', error);
    // Don't throw to avoid masking test failures
  }
}
```

### Data Validation

```typescript
// Validate test data integrity
export function validateTestDataIntegrity(): string[] {
  const issues: string[] = [];
  
  // Check for duplicate IDs
  const allIds = [
    ...Object.values(testOrganizations).map(org => org.id),
    ...Object.values(testUsers).map(user => user.id),
  ];
  
  const duplicateIds = allIds.filter((id, index) => allIds.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    issues.push(`Duplicate IDs found: ${duplicateIds.join(', ')}`);
  }
  
  // Check user-organization relationships
  Object.entries(testUsers).forEach(([key, user]) => {
    const orgExists = Object.values(testOrganizations).some(org => org.id === user.orgId);
    if (!orgExists) {
      issues.push(`User ${key} references non-existent organization ${user.orgId}`);
    }
  });
  
  // Validate email samples
  Object.entries(allEmailSamples).forEach(([key, sample]) => {
    try {
      validateEmailTestData(sample);
    } catch (error) {
      issues.push(`Invalid email sample ${key}: ${error.message}`);
    }
  });
  
  return issues;
}
```

## Data Generation Utilities

### Dynamic Data Generation

```typescript
// Generate unique test data
export const generateTestData = {
  email: () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `test-${timestamp}-${random}@chiphi-test.com`;
  },
  
  amount: (min = 1, max = 1000) => {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100;
  },
  
  merchant: () => {
    const merchants = ['Coffee Shop', 'Restaurant', 'Gas Station', 'Grocery Store'];
    const adjectives = ['Downtown', 'Main Street', 'Corner', 'Express'];
    
    const merchant = merchants[Math.floor(Math.random() * merchants.length)];
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    
    return `${adjective} ${merchant}`;
  },
  
  messageId: () => {
    return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
  },
};

// Generate test email with variations
export const generateTestEmail = (baseEmail: EmailTestData, variations: Partial<EmailTestData> = {}) => {
  return {
    ...baseEmail,
    messageId: generateTestData.messageId(),
    expectedAmount: generateTestData.amount(),
    expectedMerchant: generateTestData.merchant(),
    ...variations,
  };
};
```

### Bulk Data Operations

```typescript
// Create multiple test transactions
export const createBulkTestData = async (count: number, template: string) => {
  const baseTemplate = getTestTransactionTemplate(template);
  const transactions = [];
  
  for (let i = 0; i < count; i++) {
    const transaction = {
      ...baseTemplate,
      id: `bulk-test-${i}-${Date.now()}`,
      amount: baseTemplate.amount + (i * 0.01), // Slight variation
      date: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
    };
    
    transactions.push(transaction);
  }
  
  return transactions;
};

// Clean up bulk test data
export const cleanupBulkTestData = async (pattern: string) => {
  const response = await fetch('/api/test/cleanup-bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pattern }),
  });
  
  return response.json();
};
```

## Performance Considerations

### Data Size Management

```typescript
// Limit test data size for performance
const MAX_TEST_TRANSACTIONS = 1000;
const MAX_EMAIL_SAMPLES = 100;
const MAX_CONCURRENT_TESTS = 10;

// Paginate large datasets
const getPaginatedTestData = (data: any[], page: number, size: number = 50) => {
  const start = page * size;
  const end = start + size;
  return data.slice(start, end);
};
```

### Memory Management

```typescript
// Clean up large objects
test.afterEach(async () => {
  // Clear large test data from memory
  if (global.testEmailCache) {
    global.testEmailCache.clear();
  }
  
  // Force garbage collection in test environment
  if (global.gc) {
    global.gc();
  }
});
```

### Database Optimization

```typescript
// Use transactions for bulk operations
const setupTestDataInTransaction = async (testData: any[]) => {
  const supabase = createClient();
  
  const { error } = await supabase.rpc('setup_test_data_bulk', {
    test_data: testData,
  });
  
  if (error) throw error;
};

// Use prepared statements for repeated operations
const insertTestTransaction = supabase
  .from('transactions')
  .insert()
  .prepare();
```

## Best Practices

### 1. Data Isolation

- Use unique identifiers for each test run
- Clean up data after each test
- Use separate organizations for different test types
- Avoid shared mutable state

### 2. Data Consistency

- Validate data schemas before use
- Use consistent naming conventions
- Maintain referential integrity
- Version test data changes

### 3. Data Reusability

- Create reusable data templates
- Use parameterized data generation
- Share common data across similar tests
- Document data usage patterns

### 4. Data Security

- Use fake/synthetic data only
- Redact any real PII from samples
- Secure test database access
- Rotate test credentials regularly

### 5. Data Maintenance

- Regular integrity checks
- Automated cleanup processes
- Monitor data growth
- Update samples for new features

This comprehensive test data management strategy ensures reliable, maintainable, and scalable testing for the ChiPhi AI system while maintaining data integrity and security.