/**
 * Test Organizations and Users
 * 
 * Predefined test data for multi-tenant testing scenarios
 * Used across all test suites for consistent test data
 */

import { z } from 'zod';

// Test organization schema
const TestOrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  userId: z.string().uuid(),
  inboxAlias: z.string().email(),
  createdAt: z.string().datetime(),
  settings: z.object({
    timezone: z.string(),
    currency: z.string(),
    language: z.string(),
  }),
});

// Test user schema
const TestUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  orgId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'member']),
  createdAt: z.string().datetime(),
});

// Test organizations for different scenarios
export const testOrganizations = {
  // Primary test organization - used for most tests
  primary: {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'ChiPhi Test Org Primary',
    userId: '550e8400-e29b-41d4-a716-446655440011',
    inboxAlias: 'test-primary@chiphi-test.com',
    createdAt: '2024-01-01T00:00:00Z',
    settings: {
      timezone: 'America/New_York',
      currency: 'USD',
      language: 'en',
    },
  },
  
  // Secondary test organization - used for isolation testing
  secondary: {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'ChiPhi Test Org Secondary',
    userId: '550e8400-e29b-41d4-a716-446655440012',
    inboxAlias: 'test-secondary@chiphi-test.com',
    createdAt: '2024-01-01T00:00:00Z',
    settings: {
      timezone: 'America/Los_Angeles',
      currency: 'USD',
      language: 'en',
    },
  },
  
  // Multilingual test organization - used for translation testing
  multilingual: {
    id: '550e8400-e29b-41d4-a716-446655440003',
    name: 'ChiPhi Test Org Multilingual',
    userId: '550e8400-e29b-41d4-a716-446655440013',
    inboxAlias: 'test-multilingual@chiphi-test.com',
    createdAt: '2024-01-01T00:00:00Z',
    settings: {
      timezone: 'Europe/London',
      currency: 'EUR',
      language: 'es',
    },
  },
  
  // Performance test organization - used for load testing
  performance: {
    id: '550e8400-e29b-41d4-a716-446655440004',
    name: 'ChiPhi Test Org Performance',
    userId: '550e8400-e29b-41d4-a716-446655440014',
    inboxAlias: 'test-performance@chiphi-test.com',
    createdAt: '2024-01-01T00:00:00Z',
    settings: {
      timezone: 'UTC',
      currency: 'USD',
      language: 'en',
    },
  },
  
  // Security test organization - used for security testing
  security: {
    id: '550e8400-e29b-41d4-a716-446655440005',
    name: 'ChiPhi Test Org Security',
    userId: '550e8400-e29b-41d4-a716-446655440015',
    inboxAlias: 'test-security@chiphi-test.com',
    createdAt: '2024-01-01T00:00:00Z',
    settings: {
      timezone: 'UTC',
      currency: 'USD',
      language: 'en',
    },
  },
} as const;

// Test users for different roles and scenarios
export const testUsers = {
  // Primary organization users
  primaryOwner: {
    id: '550e8400-e29b-41d4-a716-446655440011',
    email: 'owner@chiphi-test.com',
    fullName: 'Test Owner Primary',
    orgId: '550e8400-e29b-41d4-a716-446655440001',
    role: 'owner' as const,
    createdAt: '2024-01-01T00:00:00Z',
  },
  
  primaryAdmin: {
    id: '550e8400-e29b-41d4-a716-446655440021',
    email: 'admin@chiphi-test.com',
    fullName: 'Test Admin Primary',
    orgId: '550e8400-e29b-41d4-a716-446655440001',
    role: 'admin' as const,
    createdAt: '2024-01-01T00:00:00Z',
  },
  
  primaryMember: {
    id: '550e8400-e29b-41d4-a716-446655440031',
    email: 'member@chiphi-test.com',
    fullName: 'Test Member Primary',
    orgId: '550e8400-e29b-41d4-a716-446655440001',
    role: 'member' as const,
    createdAt: '2024-01-01T00:00:00Z',
  },
  
  // Secondary organization users
  secondaryOwner: {
    id: '550e8400-e29b-41d4-a716-446655440012',
    email: 'owner2@chiphi-test.com',
    fullName: 'Test Owner Secondary',
    orgId: '550e8400-e29b-41d4-a716-446655440002',
    role: 'owner' as const,
    createdAt: '2024-01-01T00:00:00Z',
  },
  
  // Multilingual organization users
  multilingualOwner: {
    id: '550e8400-e29b-41d4-a716-446655440013',
    email: 'owner-es@chiphi-test.com',
    fullName: 'Test Owner Multilingual',
    orgId: '550e8400-e29b-41d4-a716-446655440003',
    role: 'owner' as const,
    createdAt: '2024-01-01T00:00:00Z',
  },
  
  // Performance test users
  performanceOwner: {
    id: '550e8400-e29b-41d4-a716-446655440014',
    email: 'perf@chiphi-test.com',
    fullName: 'Test Owner Performance',
    orgId: '550e8400-e29b-41d4-a716-446655440004',
    role: 'owner' as const,
    createdAt: '2024-01-01T00:00:00Z',
  },
  
  // Security test users
  securityOwner: {
    id: '550e8400-e29b-41d4-a716-446655440015',
    email: 'security@chiphi-test.com',
    fullName: 'Test Owner Security',
    orgId: '550e8400-e29b-41d4-a716-446655440005',
    role: 'owner' as const,
    createdAt: '2024-01-01T00:00:00Z',
  },
} as const;

// Test merchant mappings for learning system testing
export const testMerchantMappings = {
  starbucks: {
    merchant: 'Starbucks Coffee',
    category: 'Food & Dining',
    subcategory: 'Coffee Shops',
    confidence: 95,
    learnedFrom: 'user_correction',
  },
  
  wholeFoods: {
    merchant: 'Whole Foods Market',
    category: 'Groceries',
    subcategory: 'Supermarkets',
    confidence: 98,
    learnedFrom: 'user_correction',
  },
  
  uber: {
    merchant: 'Uber',
    category: 'Transportation',
    subcategory: 'Rideshare',
    confidence: 92,
    learnedFrom: 'ai_extraction',
  },
  
  amazon: {
    merchant: 'Amazon',
    category: 'Shopping',
    subcategory: 'Online',
    confidence: 88,
    learnedFrom: 'ai_extraction',
  },
} as const;

// Test transaction templates for different scenarios
export const testTransactionTemplates = {
  // English receipts
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
  },
  
  englishGrocery: {
    merchant: 'Whole Foods Market',
    amount: 87.32,
    currency: 'USD',
    category: 'Groceries',
    subcategory: 'Supermarkets',
    date: '2024-01-14',
    last4: '5678',
    language: 'en',
    confidence: 98,
  },
  
  // Spanish receipts
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
  },
  
  // French receipts
  frenchPharmacy: {
    merchant: 'Pharmacie de la Paix',
    amount: 23.45,
    currency: 'EUR',
    category: 'Health & Medical',
    subcategory: 'Pharmacy',
    date: '2024-01-12',
    last4: '3456',
    language: 'fr',
    confidence: 91,
  },
  
  // Japanese receipts
  japaneseConvenience: {
    merchant: 'セブンイレブン',
    amount: 1250,
    currency: 'JPY',
    category: 'Shopping',
    subcategory: 'Convenience Store',
    date: '2024-01-11',
    last4: '7890',
    language: 'ja',
    confidence: 87,
  },
  
  // German receipts
  germanGas: {
    merchant: 'Shell Tankstelle',
    amount: 65.80,
    currency: 'EUR',
    category: 'Transportation',
    subcategory: 'Gas Stations',
    date: '2024-01-10',
    last4: '2345',
    language: 'de',
    confidence: 93,
  },
} as const;

// Data integrity validation
export function validateTestDataIntegrity(): string[] {
  const issues: string[] = [];
  
  try {
    // Validate organizations
    Object.entries(testOrganizations).forEach(([key, org]) => {
      try {
        TestOrganizationSchema.parse(org);
      } catch (error) {
        issues.push(`Invalid organization ${key}: ${error}`);
      }
    });
    
    // Validate users
    Object.entries(testUsers).forEach(([key, user]) => {
      try {
        TestUserSchema.parse(user);
      } catch (error) {
        issues.push(`Invalid user ${key}: ${error}`);
      }
    });
    
    // Check user-organization relationships
    Object.entries(testUsers).forEach(([key, user]) => {
      const orgExists = Object.values(testOrganizations).some(org => org.id === user.orgId);
      if (!orgExists) {
        issues.push(`User ${key} references non-existent organization ${user.orgId}`);
      }
    });
    
    // Check for duplicate IDs
    const allIds = [
      ...Object.values(testOrganizations).map(org => org.id),
      ...Object.values(testUsers).map(user => user.id),
    ];
    const duplicateIds = allIds.filter((id, index) => allIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      issues.push(`Duplicate IDs found: ${duplicateIds.join(', ')}`);
    }
    
    // Check for duplicate emails
    const allEmails = [
      ...Object.values(testOrganizations).map(org => org.inboxAlias),
      ...Object.values(testUsers).map(user => user.email),
    ];
    const duplicateEmails = allEmails.filter((email, index) => allEmails.indexOf(email) !== index);
    if (duplicateEmails.length > 0) {
      issues.push(`Duplicate emails found: ${duplicateEmails.join(', ')}`);
    }
    
  } catch (error) {
    issues.push(`Data validation error: ${error}`);
  }
  
  return issues;
}

// Database cleanup queries
export function getTestDataCleanupQueries(): string[] {
  const orgIds = Object.values(testOrganizations).map(org => `'${org.id}'`).join(', ');
  const userIds = Object.values(testUsers).map(user => `'${user.id}'`).join(', ');
  
  return [
    // Clean up in dependency order
    `DELETE FROM processing_logs WHERE org_id IN (${orgIds});`,
    `DELETE FROM merchant_map WHERE org_id IN (${orgIds});`,
    `DELETE FROM transactions WHERE org_id IN (${orgIds});`,
    `DELETE FROM emails WHERE org_id IN (${orgIds});`,
    `DELETE FROM inbox_aliases WHERE org_id IN (${orgIds});`,
    `DELETE FROM rate_limits WHERE org_id IN (${orgIds});`,
    `DELETE FROM org_members WHERE org_id IN (${orgIds});`,
    `DELETE FROM orgs WHERE id IN (${orgIds});`,
    `DELETE FROM users WHERE id IN (${userIds});`,
  ];
}

// Helper functions for test data access
export function getTestOrg(key: keyof typeof testOrganizations) {
  return testOrganizations[key];
}

export function getTestUser(key: keyof typeof testUsers) {
  return testUsers[key];
}

export function getTestMerchantMapping(key: keyof typeof testMerchantMappings) {
  return testMerchantMappings[key];
}

export function getTestTransactionTemplate(key: keyof typeof testTransactionTemplates) {
  return testTransactionTemplates[key];
}

// Export types
export type TestOrganization = z.infer<typeof TestOrganizationSchema>;
export type TestUser = z.infer<typeof TestUserSchema>;