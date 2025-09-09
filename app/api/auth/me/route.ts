import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
      },
      organizations,
    });

  } catch (error) {
    console.error('Error in auth/me API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}