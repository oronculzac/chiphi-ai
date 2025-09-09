import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OrganizationService } from '@/lib/services/organization';
import { z } from 'zod';

// Validation schema for creating organization
const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(100, 'Organization name must be less than 100 characters').trim(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = createOrganizationSchema.parse(body);

    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user already has an organization
    const { data: existingMembership } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (existingMembership) {
      return NextResponse.json({ 
        error: 'You already belong to an organization' 
      }, { status: 400 });
    }

    // Create organization
    const { organization, error } = await OrganizationService.createOrganization({
      name,
      userId: user.id,
    });

    if (error || !organization) {
      return NextResponse.json({ 
        error: error || 'Failed to create organization' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      organization,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    console.error('Error creating organization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organizations
    const { data: memberships, error: membershipError } = await supabase
      .from('org_members')
      .select(`
        org_id,
        role,
        orgs (
          id,
          name,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (membershipError) {
      console.error('Error fetching organizations:', membershipError);
      return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
    }

    const organizations = memberships?.map(membership => ({
      id: membership.orgs.id,
      name: membership.orgs.name,
      role: membership.role,
      createdAt: membership.orgs.created_at,
      updatedAt: membership.orgs.updated_at,
    })) || [];

    return NextResponse.json({
      success: true,
      organizations,
    });

  } catch (error) {
    console.error('Error in organization API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}