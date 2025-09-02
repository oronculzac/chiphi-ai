import { NextResponse } from 'next/server';
import { ServerAuthService } from '@/lib/services/server-auth';

export async function GET() {
  try {
    const user = await ServerAuthService.getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user: profile, organizations, error } = await ServerAuthService.getUserProfile(user.id);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({
      user: profile,
      organizations,
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}