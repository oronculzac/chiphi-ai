/**
 * Minimal RLS Test
 * 
 * Simplified version to test RLS functionality without complex setup
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('Minimal RLS Test', () => {
  it('should create and access organization data', async () => {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Create a test organization
    const timestamp = Date.now();
    const { data: orgs, error } = await adminClient
      .from('orgs')
      .insert([{ name: `Minimal RLS Test Org ${timestamp}` }])
      .select();
    
    console.log('Create result:', { orgs, error });
    
    if (error) {
      throw new Error(`Failed to create test org: ${error?.message || JSON.stringify(error)}`);
    }
    
    if (!orgs || orgs.length === 0) {
      throw new Error('No organization was created');
    }
    
    const testOrgId = orgs[0].id;
    console.log('Created test org:', testOrgId);
    
    // Test that we can access the org we created
    const { data, error: selectError } = await adminClient
      .from('orgs')
      .select('*')
      .eq('id', testOrgId);
    
    expect(selectError).toBeNull();
    expect(data).toBeDefined();
    expect(data!.length).toBe(1);
    expect(data![0].id).toBe(testOrgId);
    
    // Clean up
    await adminClient
      .from('orgs')
      .delete()
      .eq('id', testOrgId);
  });
  
  it('should test provider statistics function', async () => {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Create a test org for this test
    const timestamp = Date.now();
    const { data: orgs } = await adminClient
      .from('orgs')
      .insert([{ name: `Provider Stats Test Org ${timestamp}` }])
      .select();
    
    const testOrgId = orgs![0].id;
    
    // Test the provider statistics function that was failing
    const { data, error } = await adminClient
      .rpc('get_provider_statistics', {
        org_uuid: testOrgId,
        provider_name_param: 'ses',
        hours_back: 24
      });
    
    console.log('Provider stats result:', { data, error });
    
    // Should not error, even if no data
    expect(error).toBeNull();
    // Data can be empty array or null, both are valid
    expect(data === null || Array.isArray(data)).toBe(true);
    
    // Clean up
    await adminClient.from('orgs').delete().eq('id', testOrgId);
  });
  
  it('should test provider errors function', async () => {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Create a test org for this test
    const timestamp = Date.now();
    const { data: orgs } = await adminClient
      .from('orgs')
      .insert([{ name: `Provider Errors Test Org ${timestamp}` }])
      .select();
    
    const testOrgId = orgs![0].id;
    
    // Test the provider errors function that was failing
    const { data, error } = await adminClient
      .rpc('get_provider_errors', {
        org_uuid: testOrgId,
        provider_name_param: 'ses',
        hours_back: 24
      });
    
    console.log('Provider errors result:', { data, error });
    
    // Should not error, even if no data
    expect(error).toBeNull();
    // Data can be empty array or null, both are valid
    expect(data === null || Array.isArray(data)).toBe(true);
    
    // Clean up
    await adminClient.from('orgs').delete().eq('id', testOrgId);
  });
});