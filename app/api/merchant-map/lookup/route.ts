import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { merchantMapService } from '@/lib/services/merchant-map';
import { z } from 'zod';

// Validation schema
const LookupMappingSchema = z.object({
  merchantName: z.string().min(1, 'Merchant name is required'),
  orgId: z.string().uuid('Invalid organization ID'),
});

/**
 * GET /api/merchant-map/lookup - Look up a specific merchant mapping
 * Requirements: 4.1, 7.2
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const merchantName = searchParams.get('merchantName');
    const orgId = searchParams.get('orgId');

    if (!merchantName || !orgId) {
      return NextResponse.json(
        { success: false, error: 'Merchant name and organization ID are required' },
        { status: 400 }
      );
    }

    // Validate input
    const validation = LookupMappingSchema.safeParse({ merchantName, orgId });
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    // Verify user has access to this organization
    const { data: membership, error: membershipError } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    // Look up merchant mapping
    const mapping = await merchantMapService.lookupMapping(merchantName, orgId);

    return NextResponse.json({
      success: true,
      data: mapping
    });

  } catch (error) {
    console.error('Error looking up merchant mapping:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}