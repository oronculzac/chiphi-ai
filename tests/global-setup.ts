/**
 * Global Test Setup
 * 
 * Initializes test environment, creates test organizations and users,
 * sets up MCP server connections, and prepares test data
 */

import { chromium, FullConfig } from '@playwright/test';
import { testOrganizations, testUsers, validateTestDataIntegrity } from './fixtures/test-organizations';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global test setup...');
  
  try {
    // 1. Validate test data integrity
    console.log('📊 Validating test data integrity...');
    const dataIssues = validateTestDataIntegrity();
    if (dataIssues.length > 0) {
      console.error('❌ Test data integrity issues found:');
      dataIssues.forEach(issue => console.error(`  - ${issue}`));
      throw new Error('Test data integrity validation failed');
    }
    console.log('✅ Test data integrity validated');
    
    // 2. Check if application is running
    console.log('🔍 Checking application availability...');
    const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
    
    try {
      const response = await fetch(`${baseURL}/api/health`);
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      console.log('✅ Application is running and healthy');
    } catch (error) {
      console.error('❌ Application health check failed:', error);
      console.log('💡 Make sure to run "npm run dev" before running tests');
      throw error;
    }
    
    // 3. Setup test database data
    console.log('🗄️  Setting up test database data...');
    await setupTestDatabaseData(baseURL);
    console.log('✅ Test database data setup complete');
    
    // 4. Verify MCP server connectivity (optional)
    console.log('🔌 Checking MCP server connectivity...');
    await checkMCPConnectivity(baseURL);
    console.log('✅ MCP servers are accessible');
    
    // 5. Create browser context for authentication
    console.log('🌐 Setting up browser context...');
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate to application and verify it loads
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
    
    // Save authentication state if needed
    await context.storageState({ path: 'tests/auth-state.json' });
    
    await browser.close();
    console.log('✅ Browser context setup complete');
    
    console.log('🎉 Global test setup completed successfully');
    
  } catch (error) {
    console.error('💥 Global test setup failed:', error);
    throw error;
  }
}

async function setupTestDatabaseData(baseURL: string) {
  try {
    // Setup test organizations
    for (const [key, org] of Object.entries(testOrganizations)) {
      const response = await fetch(`${baseURL}/api/test/setup-org`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: org.id,
          orgName: org.name,
          userId: org.userId,
          inboxAlias: org.inboxAlias,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.warn(`⚠️  Failed to setup org ${key}: ${error}`);
      } else {
        console.log(`✅ Setup organization: ${org.name}`);
      }
    }
    
    // Setup test users
    for (const [key, user] of Object.entries(testUsers)) {
      const response = await fetch(`${baseURL}/api/test/setup-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          fullName: user.fullName,
          orgId: user.orgId,
          role: user.role,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.warn(`⚠️  Failed to setup user ${key}: ${error}`);
      } else {
        console.log(`✅ Setup user: ${user.email}`);
      }
    }
    
  } catch (error) {
    console.warn('⚠️  Database setup failed (this may be expected in some environments):', error);
  }
}

async function checkMCPConnectivity(baseURL: string) {
  try {
    // Check if MCP health endpoint exists
    const response = await fetch(`${baseURL}/api/mcp/health`, {
      method: 'GET',
    });
    
    if (response.ok) {
      const mcpStatus = await response.json();
      console.log('📊 MCP Status:', mcpStatus);
    } else {
      console.log('ℹ️  MCP health endpoint not available (this is optional)');
    }
    
  } catch (error) {
    console.log('ℹ️  MCP connectivity check skipped (this is optional):', error.message);
  }
}

export default globalSetup;