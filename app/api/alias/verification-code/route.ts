import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserSession } from '@/lib/database/utils';

export async function GET(request: NextRequest) {
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

    // Get the latest verification code for the organization
    const { data: verificationCode, error: codeError } = await supabase
      .rpc('get_latest_verification_code', {
        p_org_id: session.org.id
      });

    if (codeError) {
      console.error('Error fetching verification code:', codeError);
      return NextResponse.json(
        { error: 'Failed to fetch verification code' },
        { status: 500 }
      );
    }

    // Return the code if found, or null if no code available
    return NextResponse.json({
      code: verificationCode,
      timestamp: verificationCode ? new Date().toISOString() : null
    });

  } catch (error) {
    console.error('Verification code API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}