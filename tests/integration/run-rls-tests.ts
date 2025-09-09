/**
 * RLS Test Runner
 * 
 * This script runs all RLS verification tests and provides a comprehensive
 * report on multi-tenant security compliance.
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

interface TestResult {
  testFile: string;
  passed: boolean;
  duration: number;
  output: string;
  error?: string;
}

interface TestSuite {
  name: string;
  description: string;
  testFile: string;
  requirements: string[];
}

const RLS_TEST_SUITES: TestSuite[] = [
  {
    name: 'Core Multi-tenant RLS',
    description: 'Verifies basic RLS policies across all core tables',
    testFile: 'rls-verification.test.ts',
    requirements: ['3.1', '3.2', '3.3', '3.4']
  },
  {
    name: 'Provider System RLS',
    description: 'Verifies RLS policies for email provider abstraction system',
    testFile: 'provider-rls-verification.test.ts',
    requirements: ['3.1', '3.2', '3.4']
  },
  {
    name: 'Transaction Provider Integration RLS',
    description: 'Verifies RLS policies for transaction processing with provider system',
    testFile: 'transaction-provider-rls.test.ts',
    requirements: ['3.1', '3.2', '3.3', '3.4']
  }
];

async function runRLSTests(): Promise<void> {
  console.log('🔒 Multi-tenant RLS Verification Test Suite');
  console.log('==========================================\n');

  const results: TestResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of RLS_TEST_SUITES) {
    console.log(`📋 Running: ${suite.name}`);
    console.log(`   Description: ${suite.description}`);
    console.log(`   Requirements: ${suite.requirements.join(', ')}`);
    console.log(`   File: ${suite.testFile}\n`);

    const startTime = Date.now();
    let result: TestResult;

    try {
      const output = execSync(
        `npx vitest run tests/integration/${suite.testFile} --reporter=verbose`,
        { 
          encoding: 'utf-8',
          cwd: process.cwd(),
          timeout: 120000 // 2 minute timeout per test suite
        }
      );

      const duration = Date.now() - startTime;
      result = {
        testFile: suite.testFile,
        passed: true,
        duration,
        output
      };

      console.log(`✅ ${suite.name} - PASSED (${duration}ms)\n`);
      totalPassed++;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      result = {
        testFile: suite.testFile,
        passed: false,
        duration,
        output: error.stdout || '',
        error: error.stderr || error.message
      };

      console.log(`❌ ${suite.name} - FAILED (${duration}ms)`);
      console.log(`   Error: ${error.message}\n`);
      totalFailed++;
    }

    results.push(result);
  }

  // Generate summary report
  console.log('\n📊 RLS Test Summary');
  console.log('===================');
  console.log(`Total Test Suites: ${RLS_TEST_SUITES.length}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Success Rate: ${((totalPassed / RLS_TEST_SUITES.length) * 100).toFixed(1)}%\n`);

  // Detailed results
  console.log('📋 Detailed Results');
  console.log('===================');
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const suite = RLS_TEST_SUITES[i];
    
    console.log(`\n${i + 1}. ${suite.name}`);
    console.log(`   Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Duration: ${result.duration}ms`);
    console.log(`   Requirements: ${suite.requirements.join(', ')}`);
    
    if (!result.passed && result.error) {
      console.log(`   Error Details:`);
      console.log(`   ${result.error.split('\n').join('\n   ')}`);
    }
  }

  // Requirements coverage report
  console.log('\n🎯 Requirements Coverage');
  console.log('========================');
  
  const allRequirements = ['3.1', '3.2', '3.3', '3.4'];
  const passedRequirements = new Set<string>();
  
  for (let i = 0; i < results.length; i++) {
    if (results[i].passed) {
      RLS_TEST_SUITES[i].requirements.forEach(req => passedRequirements.add(req));
    }
  }

  for (const req of allRequirements) {
    const status = passedRequirements.has(req) ? '✅' : '❌';
    console.log(`   ${req}: ${status} ${getRequirementDescription(req)}`);
  }

  // Security compliance summary
  console.log('\n🛡️  Security Compliance Summary');
  console.log('===============================');
  
  const complianceScore = (passedRequirements.size / allRequirements.length) * 100;
  console.log(`Compliance Score: ${complianceScore.toFixed(1)}%`);
  
  if (complianceScore === 100) {
    console.log('🎉 FULL COMPLIANCE - All RLS policies are properly enforced');
  } else if (complianceScore >= 75) {
    console.log('⚠️  PARTIAL COMPLIANCE - Some RLS policies need attention');
  } else {
    console.log('🚨 CRITICAL - Major RLS policy violations detected');
  }

  // Exit with appropriate code
  if (totalFailed > 0) {
    console.log('\n❌ RLS verification failed. Please fix the issues before deploying.');
    process.exit(1);
  } else {
    console.log('\n✅ All RLS verification tests passed. Multi-tenant security is properly enforced.');
    process.exit(0);
  }
}

function getRequirementDescription(requirement: string): string {
  const descriptions: Record<string, string> = {
    '3.1': 'Users can only access data belonging to their organization through RLS policies',
    '3.2': 'Attempting to access another user\'s data returns appropriate error responses',
    '3.3': 'Inbound emails are correctly associated with the proper organization based on email alias',
    '3.4': 'Database queries enforce row-level security policies for all data access'
  };
  
  return descriptions[requirement] || 'Unknown requirement';
}

// Run the tests if this script is executed directly
if (require.main === module) {
  runRLSTests().catch(error => {
    console.error('❌ Failed to run RLS tests:', error);
    process.exit(1);
  });
}

export { runRLSTests, RLS_TEST_SUITES };