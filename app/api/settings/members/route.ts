import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserSession } from '@/lib/database/utils';
import { z } from 'zod';

// Validation schemas
const inviteSchema = z.object({
  email: z.string().email().trim(),
  role: z.enum(['admin', 'member']),
});

const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'member']),
});

const removeMemberSchema = z.object({
  userId: z.string().uuid(),
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

    // Get all members of the organization
    const { data: members, error: membersError } = await supabase
      .from('org_members')
      .select(`
        user_id,
        role,
        created_at,
        users!inner(
          email,
          full_name
        )
      `)
      .eq('org_id', session.org.id)
      .order('created_at', { ascending: true });

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    // Transform the data
    const transformedMembers = members?.map(member => ({
      id: member.user_id, // Use user_id as the identifier
      email: member.users.email,
      full_name: member.users.full_name,
      role: member.role,
      joined_at: member.created_at,
    })) || [];

    // For now, return empty invitations array since we don't have that table yet
    const invitations: any[] = [];

    return NextResponse.json({
      success: true,
      data: {
        members: transformedMembers,
        invitations,
      },
    });

  } catch (error) {
    console.error('Error in members API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, role } = inviteSchema.parse(body);

    // Get user session for authentication and org context
    const session = await getUserSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has permission to invite (admin or owner)
    if (!['admin', 'owner'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to invite members' },
        { status: 403 }
      );
    }

    // For now, return a placeholder response since we don't have invitation system yet
    return NextResponse.json({
      success: true,
      message: 'Invitation feature coming soon',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    console.error('Error inviting member:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, role } = updateRoleSchema.parse(body);

    // Get user session for authentication and org context
    const session = await getUserSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has permission to manage roles (admin or owner)
    if (!['admin', 'owner'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to manage member roles' },
        { status: 403 }
      );
    }

    const supabase = await createClient();

    // Update member role
    const { error: updateError } = await supabase
      .from('org_members')
      .update({ role })
      .eq('user_id', userId)
      .eq('org_id', session.org.id);

    if (updateError) {
      console.error('Error updating member role:', updateError);
      return NextResponse.json({ error: 'Failed to update member role' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Member role updated successfully',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    console.error('Error updating member role:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = removeMemberSchema.parse(body);

    // Get user session for authentication and org context
    const session = await getUserSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has permission to remove members (admin or owner)
    if (!['admin', 'owner'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to remove members' },
        { status: 403 }
      );
    }

    const supabase = await createClient();

    // Remove member
    const { error: deleteError } = await supabase
      .from('org_members')
      .delete()
      .eq('user_id', userId)
      .eq('org_id', session.org.id);

    if (deleteError) {
      console.error('Error removing member:', deleteError);
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Member removed successfully',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    console.error('Error removing member:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}