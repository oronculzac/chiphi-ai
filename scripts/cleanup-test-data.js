#!/usr/bin/env node

/**
 * Test Data Cleanup Script
 * 
 * Cleans up test data from the database to prevent accumulation
 * of test records in development and testing environments
 */

const { createClient } = require('@supabase/supabase-js');

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

async function cleanupTestData() {
  try {
    log('🧹 Starting test data cleanup...', colors.cyan);
    
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Define test data patterns
    const testPatterns = [
      'test_%',
      '%test%',
      'msg-perf-%',
      'receipts-test@%',
      'owner-%@test.%',
      'member-%@test.%',
    ];
    
    // Define cleanup queries in dependency order
    const cleanupQueries = [
      {
        table: 'transactions',
        query: `DELETE FROM transactions WHERE 
          org_id LIKE ANY($1) OR 
          email_id LIKE ANY($1) OR 
          merchant LIKE ANY($1) OR
          explanation LIKE '%test%' OR
          explanation LIKE '%Test%'`,
        description: 'test transactions',
      },
      {
        table: 'merchant_map',
        query: `DELETE FROM merchant_map WHERE 
          org_id LIKE ANY($1) OR 
          merchant_name LIKE ANY($1) OR
          merchant_name LIKE '%test%'`,
        description: 'test merchant mappings',
      },
      {
        table: 'emails',
        query: `DELETE FROM emails WHERE 
          org_id LIKE ANY($1) OR 
          message_id LIKE ANY($1) OR
          from_email LIKE ANY($1) OR
          to_email LIKE ANY($1)`,
        description: 'test emails',
      },
      {
        table: 'inbox_aliases',
        query: `DELETE FROM inbox_aliases WHERE 
          org_id LIKE ANY($1) OR 
          alias_email LIKE ANY($1)`,
        description: 'test inbox aliases',
      },
      {
        table: 'org_members',
        query: `DELETE FROM org_members WHERE 
          org_id LIKE ANY($1) OR 
          user_id LIKE ANY($1)`,
        description: 'test organization memberships',
      },
      {
        table: 'users',
        query: `DELETE FROM users WHERE 
          id LIKE ANY($1) OR 
          email LIKE ANY($1)`,
        description: 'test users',
      },
      {
        table: 'orgs',
        query: `DELETE FROM orgs WHERE 
          id LIKE ANY($1) OR 
          name LIKE ANY($1) OR
          name LIKE '%Test%'`,
        description: 'test organizations',
      },
    ];
    
    let totalDeleted = 0;
    
    // Execute cleanup queries
    for (const cleanup of cleanupQueries) {
      try {
        log(`🗑️  Cleaning up ${cleanup.description}...`, colors.yellow);
        
        const { data, error, count } = await supabase
          .rpc('execute_cleanup_query', {
            query_text: cleanup.query,
            patterns: testPatterns
          });
        
        if (error) {
          // Fallback to direct query if RPC doesn't exist
          const { data: directData, error: directError } = await supabase
            .from(cleanup.table)
            .delete()
            .or(testPatterns.map(pattern => `id.like.${pattern}`).join(','));
          
          if (directError) {
            log(`⚠️  Warning: Could not clean ${cleanup.table}: ${directError.message}`, colors.yellow);
            continue;
          }
        }
        
        const deletedCount = count || (Array.isArray(data) ? data.length : 0);
        totalDeleted += deletedCount;
        
        if (deletedCount > 0) {
          log(`✅ Deleted ${deletedCount} ${cleanup.description}`, colors.green);
        } else {
          log(`ℹ️  No ${cleanup.description} found to delete`, colors.blue);
        }
        
      } catch (error) {
        log(`⚠️  Warning: Error cleaning ${cleanup.table}: ${error.message}`, colors.yellow);
      }
    }
    
    // Clean up performance metrics
    try {
      log('🗑️  Cleaning up test performance metrics...', colors.yellow);
      
      const { data, error } = await supabase
        .from('performance_metrics')
        .delete()
        .or('metric_name.like.%test%,org_id.like.test_%');
      
      if (!error) {
        const metricsDeleted = Array.isArray(data) ? data.length : 0;
        totalDeleted += metricsDeleted;
        if (metricsDeleted > 0) {
          log(`✅ Deleted ${metricsDeleted} test performance metrics`, colors.green);
        }
      }
    } catch (error) {
      log(`ℹ️  Performance metrics table not found (this is normal)`, colors.blue);
    }
    
    // Verify cleanup
    log('🔍 Verifying cleanup...', colors.cyan);
    
    const verificationQueries = [
      'SELECT COUNT(*) as count FROM transactions WHERE explanation LIKE \'%test%\'',
      'SELECT COUNT(*) as count FROM orgs WHERE name LIKE \'%Test%\'',
      'SELECT COUNT(*) as count FROM users WHERE email LIKE \'%@test.%\'',
    ];
    
    let remainingTestData = 0;
    for (const query of verificationQueries) {
      try {
        const { data, error } = await supabase.rpc('execute_query', { query_text: query });
        if (!error && data && data.length > 0) {
          remainingTestData += parseInt(data[0].count || 0);
        }
      } catch (error) {
        // Ignore verification errors
      }
    }
    
    // Summary
    log('\n' + '='.repeat(50), colors.cyan);
    log('  Test Data Cleanup Summary', colors.cyan);
    log('='.repeat(50), colors.cyan);
    log(`📊 Total records deleted: ${totalDeleted}`, colors.green);
    log(`🔍 Remaining test data: ${remainingTestData}`, remainingTestData > 0 ? colors.yellow : colors.green);
    
    if (remainingTestData > 0) {
      log(`⚠️  Some test data may remain due to foreign key constraints`, colors.yellow);
      log(`   Run the cleanup script again if needed`, colors.yellow);
    } else {
      log(`🎉 Cleanup completed successfully!`, colors.green);
    }
    
  } catch (error) {
    log(`❌ Cleanup failed: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

if (dryRun) {
  log('🔍 Dry run mode - no data will be deleted', colors.blue);
  // TODO: Implement dry run logic
  process.exit(0);
}

if (!force && process.env.NODE_ENV === 'production') {
  log('❌ Cleanup is disabled in production environment', colors.red);
  log('   Use --force flag if you really want to run cleanup in production', colors.yellow);
  process.exit(1);
}

// Run cleanup
cleanupTestData();