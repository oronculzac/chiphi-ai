import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Validation schema
const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

// POST - Accept organization invitation
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const validatedData = acceptInvitationSchema.parse(body);

    // Use the database function to accept the invitation
    const { data: success, error: acceptError } = await supabase
      .rpc('accept_org_invitation', {
        p_token: validatedData.token,
        p_user_id: user.id,
      });

    if (acceptError) {
      console.error('Error accepting invitation:', acceptError);
      
      if (acceptError.message?.includes('User not found')) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { success: false, error: 'Failed to accept invitation' },
        { status: 500 }
      );
    }

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired invitation' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Invitation accepted successfully',
      },
    });

  } catch (error) {
    console.error('Error in POST /api/invite/accept:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}