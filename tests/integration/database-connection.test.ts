/**
 * Database Connection Test
 * 
 * Simple test to verify database connectivity before running RLS tests
 */

import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { testConfig } from '@/lib/config/test';

describe('Database Connection', () => {
  it('should connect to Supabase database', async () => {
    const client = createClient(
      testConfig.supabase.url,
      testConfig.supabase.anonKey
    );

    // Simple query to test connection
    const { data, error } = await client
      .from('orgs')
      .select('count')
      .limit(1);

    console.log('Database connection test result:', { data, error });
    
    expect(error).toBeNull();
  });

  it('should connect with service role key', async () => {
    const adminClient = createClient(
      testConfig.supabase.url,
      testConfig.supabase.serviceRoleKey
    );

    // Test admin connection
    const { data, error } = await adminClient
      .from('orgs')
      .select('id, name')
      .limit(1);

    console.log('Admin connection test result:', { data, error });
    
    expect(error).toBeNull();
  });

  it('should be able to create and delete a test organization', async () => {
    const adminClient = createClient(
      testConfig.supabase.url,
      testConfig.supabase.serviceRoleKey
    );

    // Create test org
    const { data: createData, error: createError } = await adminClient
      .from('orgs')
      .insert({ name: 'Database Connection Test Org' })
      .select()
      .single();

    console.log('Create test result:', { createData, createError });
    
    expect(createError).toBeNull();
    expect(createData).toBeDefined();
    expect(createData!.name).toBe('Database Connection Test Org');

    // Clean up - delete the test org
    const { error: deleteError } = await adminClient
      .from('orgs')
      .delete()
      .eq('id', createData!.id);

    console.log('Delete test result:', { deleteError });
    
    expect(deleteError).toBeNull();
  });
});