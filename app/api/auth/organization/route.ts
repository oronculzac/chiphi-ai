import { NextRequest, NextResponse } from 'next/server';
import { ServerAuthService } from '@/lib/services/server-auth';
import { OrganizationService } from '@/lib/services/organization';
import { InboxAliasService } from '@/lib/services/inbox-alias';
import { z } from 'zod';

const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(100, 'Organization name too long'),
  userId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const user = await ServerAuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, userId } = createOrganizationSchema.parse(body);

    // Verify the user is creating an organization for themselves
    if (user.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create the organization
    const { organization, error: orgError } = await OrganizationService.createOrganization({
      name,
      userId,
    });

    if (orgError || !organization) {
      return NextResponse.json({ error: orgError || 'Failed to create organization' }, { status: 400 });
    }

    // Create an inbox alias for the organization
    const { alias, error: aliasError } = await InboxAliasService.createInboxAlias(organization.id);

    if (aliasError) {
      console.error('Failed to create inbox alias:', aliasError);
      // Don't fail the organization creation, just log the error
    }

    return NextResponse.json({
      organization,
      alias,
    });
  } catch (error) {
    console.error('Organization creation error:', error);
    
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