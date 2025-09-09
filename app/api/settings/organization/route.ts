import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/lib/database/utils';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Validation schema for organization update
const updateOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(100, 'Organization name must be less than 100 characters').trim(),
});

export async function GET() {
  try {
    // Get user session for authentication and org context
    const session = await getUserSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    
    // Get organization details
    const { data: organization, error } = await supabase
      .from('orgs')
      .select('id, name, logo_url, created_at, updated_at')
      .eq('id', session.org.id)
      .single();

    if (error) {
      console.error('Error fetching organization:', error);
      return NextResponse.json(
        { error: 'Failed to fetch organization' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: organization
    });

  } catch (error) {
    console.error('Error in GET /api/settings/organization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Get user session for authentication and org context
    const session = await getUserSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has permission to update organization (admin or owner)
    if (!['admin', 'owner'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update organization' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = updateOrganizationSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { name } = validationResult.data;
    const supabase = await createClient();

    // Use the database function to update organization with proper RLS enforcement
    const { data: updatedOrg, error } = await supabase
      .rpc('update_organization_info', {
        p_org_id: session.org.id,
        p_name: name,
        p_updated_by: session.user.id
      });

    if (error) {
      console.error('Error updating organization:', error);
      
      // Handle specific error cases
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(
          { error: 'Insufficient permissions to update organization' },
          { status: 403 }
        );
      }
      
      if (error.message.includes('Organization not found')) {
        return NextResponse.json(
          { error: 'Organization not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to update organization' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedOrg,
      message: 'Organization updated successfully'
    });

  } catch (error) {
    console.error('Error in PATCH /api/settings/organization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}