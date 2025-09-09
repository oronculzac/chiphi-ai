import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserSession } from '@/lib/database/utils';
import { config } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    // Get user session and verify access to organization
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const orgId = session.org.id;
    const supabase = await createClient();

    // Try to get existing active alias
    let { data: existingAlias, error: fetchError } = await supabase
      .from('inbox_aliases')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .single();

    // If no alias exists, create one
    if (fetchError && fetchError.code === 'PGRST116') {
      // Generate new alias in the format u_<slug>@chiphi.oronculzac.com
      const aliasSlug = generateAliasSlug();
      const aliasEmail = `u_${aliasSlug}@${config.aws.ses.emailDomain}`;

      const { data: newAlias, error: createError } = await supabase
        .from('inbox_aliases')
        .insert({
          org_id: orgId,
          alias_email: aliasEmail,
          is_active: true,
        })
        .select()
        .single();

      if (createError) {
        console.error('Failed to create alias:', createError);
        return NextResponse.json(
          { error: 'Failed to create email alias' },
          { status: 500 }
        );
      }

      existingAlias = newAlias;
    } else if (fetchError) {
      console.error('Failed to fetch alias:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch email alias' },
        { status: 500 }
      );
    }

    // Return the alias
    return NextResponse.json({
      alias: {
        id: existingAlias.id,
        aliasEmail: existingAlias.alias_email,
        isActive: existingAlias.is_active,
        createdAt: existingAlias.created_at,
      },
    });
  } catch (error) {
    console.error('Alias API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Generate a unique alias slug in the format expected by the system
 * Uses a combination of random characters to create a unique identifier
 */
function generateAliasSlug(): string {
  // Generate a random 8-character string using alphanumeric characters
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}