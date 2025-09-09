/**
 * RLS Global Teardown
 * 
 * Global teardown for RLS verification test suite
 */

import { createClient } from '@supabase/supabase-js';
import { testConfig } from '@/lib/config/test';

export default async function globalTeardown() {
  console.log('🧹 Starting RLS Global Teardown...');

  const adminClient = createClient(
    testConfig.supabase.url,
    testConfig.supabase.serviceRoleKey
  );

  try {
    // Final cleanup of any remaining test data
    await finalCleanup(adminClient);

    console.log('✅ RLS Global Teardown Complete');

  } catch (error) {
    console.error('❌ RLS Global Teardown Error:', error);
    // Don't fail teardown - just log the error
  }
}

async function finalCleanup(adminClient: any) {
  try {
    // Clean up any remaining test data that might have been left behind
    
    // Clean up test emails
    await adminClient
      .from('emails')
      .delete()
      .or('message_id.ilike.*test*,from_email.ilike.*test*');

    // Clean up test transactions
    await adminClient
      .from('transactions')
      .delete()
      .or('merchant.ilike.*Test*,notes.ilike.*test*');

    // Clean up test provider logs
    await adminClient
      .from('email_provider_logs')
      .delete()
      .or('message_id.ilike.*test*,payload->>test.is.not.null');

    // Clean up test processing logs
    await adminClient
      .from('processing_logs')
      .delete()
      .or('step.ilike.*test*,details->>test.is.not.null');

    // Clean up test diagnostic checks
    await adminClient
      .from('diagnostic_checks')
      .delete()
      .or('check_name.ilike.*test*,details->>test.is.not.null');

    console.log('🧹 Final test data cleanup complete');

  } catch (error) {
    console.warn('⚠️  Final cleanup warning:', error);
  }
}