/**
 * Simple Database Query Test
 * 
 * Test basic database operations to identify the issue
 */

import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('Simple Database Query Test', () => {
  it('should perform a simple query', async () => {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Try a simple query to see what happens
    const { data, error } = await client
      .from('orgs')
      .select('id, name')
      .limit(1);
    
    console.log('Query result:', { data, error });
    
    // Don't assert success/failure, just log what happens
    expect(client).toBeDefined();
  });
  
  it('should perform a query with admin client', async () => {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Try a simple query with admin client
    const { data, error } = await adminClient
      .from('orgs')
      .select('id, name')
      .limit(1);
    
    console.log('Admin query result:', { data, error });
    
    // Don't assert success/failure, just log what happens
    expect(adminClient).toBeDefined();
  });
});