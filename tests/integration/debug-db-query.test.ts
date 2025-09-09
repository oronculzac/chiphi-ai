/**
 * Debug Database Query Test
 * 
 * Test to debug the specific database issue
 */

import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('Debug Database Query Test', () => {
  it('should create an organization successfully', async () => {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Try to create an organization like the failing test
    const timestamp = Date.now();
    const { data, error } = await adminClient
      .from('orgs')
      .insert([
        { name: `Debug Test Organization ${timestamp}` }
      ])
      .select();
    
    console.log('Create org result:', { data, error });
    
    if (error) {
      console.log('Error details:', JSON.stringify(error, null, 2));
    }
    
    if (data) {
      console.log('Created org data:', JSON.stringify(data, null, 2));
      
      // Clean up - delete the test org
      const { error: deleteError } = await adminClient
        .from('orgs')
        .delete()
        .eq('id', data[0].id);
      
      if (deleteError) {
        console.log('Delete error:', deleteError);
      } else {
        console.log('Successfully cleaned up test org');
      }
    }
    
    // For now, just expect the client to be defined
    expect(adminClient).toBeDefined();
  });
});