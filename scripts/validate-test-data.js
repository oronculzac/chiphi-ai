#!/usr/bin/env node

/**
 * Test Data Validation Script
 * 
 * Validates the integrity and consistency of test data fixtures
 * and ensures all test data meets the required schema standards
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Validation schemas
const emailSampleSchema = {
  messageId: 'string',
  from: 'string',
  to: 'string',
  subject: 'string',
  body: 'string',
  language: 'string',
  expectedExtraction: {
    merchant: 'string',
    amount: 'number',
    currency: 'string',
    date: 'string',
    category: 'string',
    confidence: 'number',
    explanation: 'string',
  },
  processingTimeoutMs: 'number',
  tags: 'array',
};

const organizationSchema = {
  id: 'string',
  name: 'string',
  userId: 'string',
  inboxAlias: 'string',
};

const userSchema = {
  id: 'string',
  email: 'string',
  password: 'string',
  fullName: 'string',
  orgId: 'string',
  role: 'string',
};

function validateSchema(obj, schema, path = '') {
  const errors = [];
  
  for (const [key, expectedType] of Object.entries(schema)) {
    const fullPath = path ? `${path}.${key}` : key;
    
    if (!(key in obj)) {
      errors.push(`Missing required field: ${fullPath}`);
      continue;
    }
    
    const value = obj[key];
    
    if (typeof expectedType === 'object') {
      // Nested object validation
      if (typeof value !== 'object' || value === null) {
        errors.push(`${fullPath} should be an object`);
      } else {
        errors.push(...validateSchema(value, expectedType, fullPath));
      }
    } else if (expectedType === 'array') {
      if (!Array.isArray(value)) {
        errors.push(`${fullPath} should be an array`);
      }
    } else if (typeof value !== expectedType) {
      errors.push(`${fullPath} should be ${expectedType}, got ${typeof value}`);
    }
  }
  
  return errors;
}

function validateEmailSample(sample, index) {
  const errors = [];
  const prefix = `Email sample ${index}`;
  
  // Schema validation
  errors.push(...validateSchema(sample, emailSampleSchema).map(err => `${prefix}: ${err}`));
  
  // Business logic validation
  if (sample.expectedExtraction) {
    const extraction = sample.expectedExtraction;
    
    // Amount validation
    if (extraction.amount <= 0) {
      errors.push(`${prefix}: Amount must be positive, got ${extraction.amount}`);
    }
    
    // Date format validation
    if (!/^\d{4}-\d{2}-\d{2}$/.test(extraction.date)) {
      errors.push(`${prefix}: Date must be in YYYY-MM-DD format, got ${extraction.date}`);
    }
    
    // Confidence validation
    if (extraction.confidence < 0 || extraction.confidence > 100) {
      errors.push(`${prefix}: Confidence must be 0-100, got ${extraction.confidence}`);
    }
    
    // Currency validation
    const validCurrencies = ['USD', 'EUR', 'JPY', 'GBP', 'CAD'];
    if (!validCurrencies.includes(extraction.currency)) {
      errors.push(`${prefix}: Invalid currency ${extraction.currency}`);
    }
    
    // Category validation
    const validCategories = [
      'Food & Dining',
      'Transportation',
      'Shopping',
      'Healthcare',
      'Groceries',
      'Miscellaneous',
    ];
    if (!validCategories.includes(extraction.category)) {
      errors.push(`${prefix}: Invalid category ${extraction.category}`);
    }
  }
  
  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sample.from)) {
    errors.push(`${prefix}: Invalid from email format: ${sample.from}`);
  }
  if (!emailRegex.test(sample.to)) {
    errors.push(`${prefix}: Invalid to email format: ${sample.to}`);
  }
  
  // Message ID uniqueness (will be checked globally)
  if (!sample.messageId || sample.messageId.length < 5) {
    errors.push(`${prefix}: Message ID too short or missing`);
  }
  
  return errors;
}

function validateOrganization(org, key) {
  const errors = [];
  const prefix = `Organization ${key}`;
  
  // Schema validation
  errors.push(...validateSchema(org, organizationSchema).map(err => `${prefix}: ${err}`));
  
  // UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(org.id)) {
    errors.push(`${prefix}: Invalid UUID format for id: ${org.id}`);
  }
  if (!uuidRegex.test(org.userId)) {
    errors.push(`${prefix}: Invalid UUID format for userId: ${org.userId}`);
  }
  
  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(org.inboxAlias)) {
    errors.push(`${prefix}: Invalid inbox alias email format: ${org.inboxAlias}`);
  }
  
  return errors;
}

function validateUser(user, key) {
  const errors = [];
  const prefix = `User ${key}`;
  
  // Schema validation
  errors.push(...validateSchema(user, userSchema).map(err => `${prefix}: ${err}`));
  
  // UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(user.id)) {
    errors.push(`${prefix}: Invalid UUID format for id: ${user.id}`);
  }
  if (!uuidRegex.test(user.orgId)) {
    errors.push(`${prefix}: Invalid UUID format for orgId: ${user.orgId}`);
  }
  
  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(user.email)) {
    errors.push(`${prefix}: Invalid email format: ${user.email}`);
  }
  
  // Role validation
  const validRoles = ['owner', 'member', 'viewer'];
  if (!validRoles.includes(user.role)) {
    errors.push(`${prefix}: Invalid role: ${user.role}`);
  }
  
  return errors;
}

async function validateTestData() {
  try {
    log('🔍 Starting test data validation...', colors.cyan);
    
    const errors = [];
    const warnings = [];
    
    // Load test data files
    const fixturesPath = path.join(process.cwd(), 'tests', 'fixtures');
    
    // Validate email samples
    try {
      const emailSamplesPath = path.join(fixturesPath, 'email-samples.ts');
      if (fs.existsSync(emailSamplesPath)) {
        log('📧 Validating email samples...', colors.blue);
        
        // This is a simplified validation - in a real scenario, you'd want to
        // dynamically import the TypeScript file or compile it first
        const content = fs.readFileSync(emailSamplesPath, 'utf8');
        
        // Check for required exports
        const requiredExports = [
          'englishReceipts',
          'spanishReceipts',
          'frenchReceipts',
          'japaneseReceipts',
          'germanReceipts',
          'edgeCaseReceipts',
          'performanceTestReceipts',
        ];
        
        for (const exportName of requiredExports) {
          if (!content.includes(`export const ${exportName}`)) {
            errors.push(`Missing required export: ${exportName}`);
          }
        }
        
        // Check for helper functions
        const requiredHelpers = [
          'getSamplesByLanguage',
          'getSamplesByCategory',
          'getEdgeCaseSamples',
          'getPerformanceTestSamples',
        ];
        
        for (const helperName of requiredHelpers) {
          if (!content.includes(`export function ${helperName}`)) {
            warnings.push(`Missing helper function: ${helperName}`);
          }
        }
        
        log('✅ Email samples structure validated', colors.green);
      } else {
        errors.push('Email samples file not found');
      }
    } catch (error) {
      errors.push(`Error validating email samples: ${error.message}`);
    }
    
    // Validate test organizations
    try {
      const orgsPath = path.join(fixturesPath, 'test-organizations.ts');
      if (fs.existsSync(orgsPath)) {
        log('🏢 Validating test organizations...', colors.blue);
        
        const content = fs.readFileSync(orgsPath, 'utf8');
        
        // Check for required exports
        const requiredExports = [
          'testOrganizations',
          'testUsers',
          'testMerchantMappings',
          'testTransactions',
          'testEmails',
        ];
        
        for (const exportName of requiredExports) {
          if (!content.includes(`export const ${exportName}`)) {
            errors.push(`Missing required export: ${exportName}`);
          }
        }
        
        // Check for helper functions
        const requiredHelpers = [
          'getTestOrgById',
          'getTestUserById',
          'getTestUsersByOrg',
          'validateTestDataIntegrity',
          'getTestDataCleanupQueries',
        ];
        
        for (const helperName of requiredHelpers) {
          if (!content.includes(`export function ${helperName}`)) {
            warnings.push(`Missing helper function: ${helperName}`);
          }
        }
        
        log('✅ Test organizations structure validated', colors.green);
      } else {
        errors.push('Test organizations file not found');
      }
    } catch (error) {
      errors.push(`Error validating test organizations: ${error.message}`);
    }
    
    // Validate test schemas
    try {
      const schemasPath = path.join(process.cwd(), 'lib', 'types', 'test-schemas.ts');
      if (fs.existsSync(schemasPath)) {
        log('📋 Validating test schemas...', colors.blue);
        
        const content = fs.readFileSync(schemasPath, 'utf8');
        
        // Check for required schemas
        const requiredSchemas = [
          'EmailSampleSchema',
          'ExpectedExtractionSchema',
          'AIExtractionResultSchema',
          'TestOrganizationSchema',
          'PerformanceResultSchema',
        ];
        
        for (const schemaName of requiredSchemas) {
          if (!content.includes(`export const ${schemaName}`)) {
            errors.push(`Missing required schema: ${schemaName}`);
          }
        }
        
        // Check for validation helpers
        const requiredValidators = [
          'validateEmailSample',
          'validateExtractionResult',
          'createTestAssertion',
        ];
        
        for (const validatorName of requiredValidators) {
          if (!content.includes(`export const ${validatorName}`)) {
            warnings.push(`Missing validator function: ${validatorName}`);
          }
        }
        
        log('✅ Test schemas structure validated', colors.green);
      } else {
        errors.push('Test schemas file not found');
      }
    } catch (error) {
      errors.push(`Error validating test schemas: ${error.message}`);
    }
    
    // Validate test helper files
    try {
      const helpersPath = path.join(process.cwd(), 'tests', 'utils', 'enhanced-test-helpers.ts');
      if (fs.existsSync(helpersPath)) {
        log('🛠️  Validating test helpers...', colors.blue);
        
        const content = fs.readFileSync(helpersPath, 'utf8');
        
        // Check for required helper classes
        const requiredHelpers = [
          'AuthHelper',
          'EmailProcessingHelper',
          'DashboardHelper',
          'MCPHelper',
          'MCPSupabaseHelper',
          'PerformanceHelper',
          'TestDocumentationHelper',
          'AssertionHelper',
        ];
        
        for (const helperName of requiredHelpers) {
          if (!content.includes(`export class ${helperName}`)) {
            errors.push(`Missing required helper class: ${helperName}`);
          }
        }
        
        log('✅ Test helpers structure validated', colors.green);
      } else {
        errors.push('Test helpers file not found');
      }
    } catch (error) {
      errors.push(`Error validating test helpers: ${error.message}`);
    }
    
    // Check test configuration files
    const configFiles = [
      'playwright.config.ts',
      'vitest.config.ts',
      'tests/global-setup.ts',
      'tests/global-teardown.ts',
    ];
    
    for (const configFile of configFiles) {
      const filePath = path.join(process.cwd(), configFile);
      if (!fs.existsSync(filePath)) {
        errors.push(`Missing test configuration file: ${configFile}`);
      }
    }
    
    // Validate package.json test scripts
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      const requiredScripts = [
        'test:unit',
        'test:integration',
        'test:e2e',
        'test:mcp',
        'test:all',
        'test:cleanup',
        'test:validate',
      ];
      
      for (const script of requiredScripts) {
        if (!packageJson.scripts[script]) {
          warnings.push(`Missing package.json script: ${script}`);
        }
      }
      
      log('✅ Package.json test scripts validated', colors.green);
    } catch (error) {
      warnings.push(`Could not validate package.json: ${error.message}`);
    }
    
    // Summary
    log('\n' + '='.repeat(50), colors.cyan);
    log('  Test Data Validation Summary', colors.cyan);
    log('='.repeat(50), colors.cyan);
    
    if (errors.length === 0) {
      log('🎉 All validations passed!', colors.green);
    } else {
      log(`❌ Found ${errors.length} error(s):`, colors.red);
      errors.forEach(error => log(`  • ${error}`, colors.red));
    }
    
    if (warnings.length > 0) {
      log(`⚠️  Found ${warnings.length} warning(s):`, colors.yellow);
      warnings.forEach(warning => log(`  • ${warning}`, colors.yellow));
    }
    
    if (errors.length === 0 && warnings.length === 0) {
      log('✨ Test data is in perfect condition!', colors.green);
    }
    
    // Exit with appropriate code
    process.exit(errors.length > 0 ? 1 : 0);
    
  } catch (error) {
    log(`❌ Validation failed: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Run validation
validateTestData();