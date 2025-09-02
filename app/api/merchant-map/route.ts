import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { merchantMapService } from '@/lib/services/merchant-map';
import { z } from 'zod';

// Validation schemas
const UpdateMappingSchema = z.object({
  merchantName: z.string().min(1, 'Merchant name is required'),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().nullable().optional(),
  orgId: z.string().uuid('Invalid organization ID'),
});

const GetMappingsSchema = z.object({
  orgId: z.string().uuid('Invalid organization ID'),
});

/**
 * GET /api/merchant-map - Get all merchant mappings for an organization
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
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Validate input
    const validation = GetMappingsSchema.safeParse({ orgId });
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

    // Get merchant mappings
    const mappings = await merchantMapService.getMappingsForOrg(orgId);
    const stats = await merchantMapService.getMappingStats(orgId);

    return NextResponse.json({
      success: true,
      data: {
        mappings,
        stats
      }
    });

  } catch (error) {
    console.error('Error fetching merchant mappings:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/merchant-map - Create or update a merchant mapping
 * Requirements: 4.2, 4.3, 7.2
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    
    // Validate input
    const validation = UpdateMappingSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { merchantName, category, subcategory, orgId } = validation.data;

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

    // Update merchant mapping
    const mapping = await merchantMapService.updateMapping(
      merchantName,
      category,
      subcategory || null,
      orgId,
      user.id
    );

    return NextResponse.json({
      success: true,
      data: mapping,
      message: 'Merchant mapping updated successfully'
    });

  } catch (error) {
    console.error('Error updating merchant mapping:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/merchant-map - Delete a merchant mapping
 * Requirements: 7.2
 */
export async function DELETE(request: NextRequest) {
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

    // Verify user has access to this organization and has admin/owner role
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

    if (!['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to delete mappings' },
        { status: 403 }
      );
    }

    // Delete merchant mapping
    await merchantMapService.deleteMapping(merchantName, orgId);

    return NextResponse.json({
      success: true,
      message: 'Merchant mapping deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting merchant mapping:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}