/**
 * Basic Reports Functions Test
 * 
 * Simple test to verify the report functions exist and can be called
 */

import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('Reports Functions Basic Test', () => {
  it('should be able to call report functions', async () => {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Test fn_report_totals
    const { data: totalsData, error: totalsError } = await client.rpc('fn_report_totals', {
      p_org_id: '00000000-0000-0000-0000-000000000001',
      p_start_date: '2024-01-01',
      p_end_date: '2024-01-31',
    });
    
    console.log('fn_report_totals result:', { data: totalsData, error: totalsError });
    expect(totalsError).toBeNull();
    expect(totalsData).toBeDefined();
    expect(Array.isArray(totalsData)).toBe(true);
    
    // Test fn_report_by_category
    const { data: categoryData, error: categoryError } = await client.rpc('fn_report_by_category', {
      p_org_id: '00000000-0000-0000-0000-000000000001',
      p_start_date: '2024-01-01',
      p_end_date: '2024-01-31',
    });
    
    console.log('fn_report_by_category result:', { data: categoryData, error: categoryError });
    expect(categoryError).toBeNull();
    expect(categoryData).toBeDefined();
    expect(Array.isArray(categoryData)).toBe(true);
    
    // Test fn_report_daily
    const { data: dailyData, error: dailyError } = await client.rpc('fn_report_daily', {
      p_org_id: '00000000-0000-0000-0000-000000000001',
      p_start_date: '2024-01-01',
      p_end_date: '2024-01-03',
    });
    
    console.log('fn_report_daily result:', { data: dailyData, error: dailyError });
    expect(dailyError).toBeNull();
    expect(dailyData).toBeDefined();
    expect(Array.isArray(dailyData)).toBe(true);
    expect(dailyData).toHaveLength(3); // 3 days
  });
});