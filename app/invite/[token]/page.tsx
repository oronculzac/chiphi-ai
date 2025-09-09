import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import InviteAcceptance from '@/components/invite/invite-acceptance';

interface InvitePageProps {
  params: {
    token: string;
  };
}

async function getInvitationDetails(token: string) {
  const supabase = await createClient();
  
  const { data: invitation, error } = await supabase
    .from('org_invitations')
    .select(`
      id,
      email,
      role,
      expires_at,
      accepted_at,
      orgs (
        name
      ),
      users!org_invitations_invited_by_fkey (
        full_name
      )
    `)
    .eq('token', token)
    .single();

  if (error || !invitation) {
    return null;
  }

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    organizationName: invitation.orgs?.name || 'Unknown Organization',
    inviterName: invitation.users?.full_name || null,
    expiresAt: invitation.expires_at,
    acceptedAt: invitation.accepted_at,
  };
}

export default async function InvitePage({ params }: InvitePageProps) {
  const invitation = await getInvitationDetails(params.token);

  if (!invitation) {
    redirect('/auth/signin?error=invalid_invitation');
  }

  // Check if invitation is expired
  if (new Date(invitation.expiresAt) < new Date()) {
    redirect('/auth/signin?error=expired_invitation');
  }

  // Check if invitation is already accepted
  if (invitation.acceptedAt) {
    redirect('/auth/signin?message=invitation_already_accepted');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <Suspense fallback={<div>Loading...</div>}>
          <InviteAcceptance
            token={params.token}
            invitation={invitation}
          />
        </Suspense>
      </div>
    </div>
  );
}