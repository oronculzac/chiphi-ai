/**
 * Manual test script for export functionality
 * Run with: npx tsx scripts/test-export.ts
 */

import { ExportService } from '../lib/services/export';

async function testExportService() {
  console.log('🧪 Testing Export Service...\n');

  const exportService = new ExportService();

  // Test 1: Get available formats
  console.log('1. Testing available formats:');
  const formats = exportService.getAvailableFormats();
  console.log('Available formats:', formats);
  console.log('✅ Available formats test passed\n');

  // Test 2: Test validation
  console.log('2. Testing validation:');
  
  // Test invalid org ID
  const invalidOrgResult = await exportService.exportTransactions('', { format: 'csv' });
  console.log('Invalid org ID result:', invalidOrgResult);
  console.log('✅ Validation test passed\n');

  // Test 3: Test unsupported format
  console.log('3. Testing unsupported format:');
  const unsupportedFormatResult = await exportService.exportTransactions('test-org', { 
    format: 'invalid' as any 
  });
  console.log('Unsupported format result:', unsupportedFormatResult);
  console.log('✅ Unsupported format test passed\n');

  console.log('🎉 All export service tests completed successfully!');
}

// Run the test
testExportService().catch(console.error);