/**
 * Simple Supabase Connection Test
 * 
 * Basic test to verify Supabase client initialization
 */

import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('Simple Supabase Test', () => {
  it('should create a Supabase client', () => {
    console.log('Environment variables:');
    console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Present' : 'Missing');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Present' : 'Missing');
    
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined();
    expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeDefined();
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeDefined();
    
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    expect(client).toBeDefined();
    expect(client.from).toBeDefined();
  });
  
  it('should create an admin client', () => {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    expect(adminClient).toBeDefined();
    expect(adminClient.from).toBeDefined();
  });
});