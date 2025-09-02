import { NextRequest, NextResponse } from 'next/server';
import { ServerAuthService } from '@/lib/services/server-auth';
import { UserProfileService } from '@/lib/services/organization';
import { InboxAliasService } from '@/lib/services/inbox-alias';

export async function GET() {
  try {
    const user = await ServerAuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current organization
    const { organization, error: orgError } = await UserProfileService.getUserCurrentOrganization(user.id);
    if (orgError || !organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    // Get organization's aliases
    const { aliases, error: aliasError } = await InboxAliasService.getOrganizationAliases(organization.id);
    if (aliasError) {
      return NextResponse.json({ error: aliasError }, { status: 400 });
    }

    return NextResponse.json({ aliases });
  } catch (error) {
    console.error('Get inbox aliases error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const user = await ServerAuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current organization
    const { organization, error: orgError } = await UserProfileService.getUserCurrentOrganization(user.id);
    if (orgError || !organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    // Create new alias
    const { alias, error: aliasError } = await InboxAliasService.createInboxAlias(organization.id);
    if (aliasError) {
      return NextResponse.json({ error: aliasError }, { status: 400 });
    }

    return NextResponse.json({ alias });
  } catch (error) {
    console.error('Create inbox alias error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}