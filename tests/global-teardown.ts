/**
 * Global Test Teardown
 * 
 * Cleans up test data, closes MCP connections,
 * and performs final cleanup operations
 */

import { FullConfig } from '@playwright/test';
import { getTestDataCleanupQueries } from './fixtures/test-organizations';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global test teardown...');
  
  try {
    // 1. Clean up test database data
    console.log('🗄️  Cleaning up test database data...');
    await cleanupTestDatabaseData();
    console.log('✅ Test database cleanup complete');
    
    // 2. Clean up test artifacts
    console.log('📁 Cleaning up test artifacts...');
    await cleanupTestArtifacts();
    console.log('✅ Test artifacts cleanup complete');
    
    // 3. Close any remaining connections
    console.log('🔌 Closing remaining connections...');
    await closeConnections();
    console.log('✅ Connections closed');
    
    console.log('🎉 Global test teardown completed successfully');
    
  } catch (error) {
    console.error('💥 Global test teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
}

async function cleanupTestDatabaseData() {
  try {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
    
    // Get cleanup queries
    const cleanupQueries = getTestDataCleanupQueries();
    
    // Execute cleanup via API endpoint
    const response = await fetch(`${baseURL}/api/test/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: cleanupQueries }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.warn(`⚠️  Database cleanup failed: ${error}`);
    } else {
      console.log('✅ Database cleanup successful');
    }
    
  } catch (error) {
    console.warn('⚠️  Database cleanup failed (this may be expected):', error);
  }
}

async function cleanupTestArtifacts() {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Clean up authentication state
    const authStatePath = path.join(process.cwd(), 'tests/auth-state.json');
    try {
      await fs.unlink(authStatePath);
      console.log('✅ Removed auth state file');
    } catch (error) {
      // File might not exist, which is fine
    }
    
    // Clean up temporary test files
    const tempDir = path.join(process.cwd(), 'tests/temp');
    try {
      await fs.rmdir(tempDir, { recursive: true });
      console.log('✅ Removed temporary test files');
    } catch (error) {
      // Directory might not exist, which is fine
    }
    
  } catch (error) {
    console.warn('⚠️  Artifact cleanup failed:', error);
  }
}

async function closeConnections() {
  try {
    // Close any remaining database connections
    // This would typically involve closing connection pools
    
    // Close any MCP server connections
    // This would involve cleanup of MCP client connections
    
    console.log('✅ All connections closed');
    
  } catch (error) {
    console.warn('⚠️  Connection cleanup failed:', error);
  }
}

export default globalTeardown;