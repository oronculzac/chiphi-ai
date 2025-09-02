import { NextRequest, NextResponse } from 'next/server';
import { ServerAuthService } from '@/lib/services/server-auth';
import { UserProfileService } from '@/lib/services/organization';
import { z } from 'zod';

const updateProfileSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const user = await ServerAuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, fullName, email } = updateProfileSchema.parse(body);

    // Verify the user is updating their own profile
    if (user.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await UserProfileService.upsertUserProfile({
      userId,
      fullName,
      email,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile update error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}