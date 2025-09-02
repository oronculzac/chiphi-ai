/**
 * Script to verify performance indexes are properly applied
 * This script checks if all performance optimization indexes exist in the database
 */

import { createClient } from '@/lib/supabase/server';

interface IndexInfo {
  schemaname: string;
  tablename: string;
  indexname: string;
  indexdef: string;
}

const EXPECTED_INDEXES = [
  'idx_transactions_org_date',
  'idx_transactions_org_merchant',
  'idx_transactions_org_category',
  'idx_transactions_org_created_at',
  'idx_transactions_confidence',
  'idx_merchant_map_org_merchant',
  'idx_merchant_map_updated_at',
  'idx_emails_org_created_at',
  'idx_emails_message_id',
  'idx_emails_processed_at',
  'idx_inbox_aliases_email_active',
  'idx_org_members_user_id',
  'idx_transactions_dashboard_stats',
  'idx_transactions_monthly',
  'idx_performance_metrics_name_created',
  'idx_performance_metrics_org_endpoint'
];

async function verifyPerformanceIndexes() {
  try {
    const supabase = createClient();
    
    console.log('🔍 Checking performance indexes...\n');

    // Query to get all indexes
    const { data: indexes, error } = await supabase
      .from('pg_indexes')
      .select('schemaname, tablename, indexname, indexdef')
      .eq('schemaname', 'public');

    if (error) {
      throw error;
    }

    const existingIndexes = indexes?.map(idx => idx.indexname) || [];
    
    console.log('📊 Index Status Report:');
    console.log('='.repeat(50));
    
    let foundCount = 0;
    let missingCount = 0;

    for (const expectedIndex of EXPECTED_INDEXES) {
      const exists = existingIndexes.includes(expectedIndex);
      const status = exists ? '✅' : '❌';
      const statusText = exists ? 'EXISTS' : 'MISSING';
      
      console.log(`${status} ${expectedIndex.padEnd(35)} ${statusText}`);
      
      if (exists) {
        foundCount++;
      } else {
        missingCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📈 Summary: ${foundCount}/${EXPECTED_INDEXES.length} indexes found`);
    
    if (missingCount > 0) {
      console.log(`⚠️  ${missingCount} indexes are missing. Run the migration to create them.`);
      console.log('\nTo apply missing indexes, run:');
      console.log('supabase db push');
    } else {
      console.log('🎉 All performance indexes are properly configured!');
    }

    // Check for additional performance-related indexes
    const performanceIndexes = indexes?.filter(idx => 
      idx.indexname.includes('performance') || 
      idx.indexname.includes('idx_')
    ) || [];

    if (performanceIndexes.length > EXPECTED_INDEXES.length) {
      console.log('\n📋 Additional performance indexes found:');
      performanceIndexes.forEach(idx => {
        if (!EXPECTED_INDEXES.includes(idx.indexname)) {
          console.log(`   • ${idx.indexname} on ${idx.tablename}`);
        }
      });
    }

    // Performance metrics table check
    console.log('\n🔧 Checking performance metrics table...');
    const { data: perfTable, error: perfError } = await supabase
      .from('performance_metrics')
      .select('count')
      .limit(1);

    if (perfError) {
      console.log('❌ Performance metrics table not found or not accessible');
    } else {
      console.log('✅ Performance metrics table is ready');
    }

    // Check RLS policies
    console.log('\n🔒 Checking RLS policies...');
    const { data: policies, error: policyError } = await supabase
      .rpc('get_policies_for_table', { table_name: 'performance_metrics' })
      .single();

    if (policyError) {
      console.log('⚠️  Could not verify RLS policies (this is normal for non-admin users)');
    } else {
      console.log('✅ RLS policies are configured');
    }

    return {
      totalExpected: EXPECTED_INDEXES.length,
      found: foundCount,
      missing: missingCount,
      success: missingCount === 0
    };

  } catch (error) {
    console.error('❌ Error verifying performance indexes:', error);
    throw error;
  }
}

// Run verification if called directly
if (require.main === module) {
  verifyPerformanceIndexes()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Verification failed:', error);
      process.exit(1);
    });
}

export { verifyPerformanceIndexes };