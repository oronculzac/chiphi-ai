'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building, UserPlus, Crown, Shield, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface InvitationDetails {
  id: string;
  email: string;
  role: string;
  organizationName: string;
  inviterName: string | null;
  expiresAt: string;
  acceptedAt: string | null;
}

interface InviteAcceptanceProps {
  token: string;
  invitation: InvitationDetails;
}

export default function InviteAcceptance({ token, invitation }: InviteAcceptanceProps) {
  const [accepting, setAccepting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  React.useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      setUser(user);
      
      // If user is signed in but email doesn&apos;t match invitation
      if (user && user.email !== invitation.email) {
        toast({
          title: 'Email Mismatch',
          description: `This invitation is for ${invitation.email}, but you&apos;re signed in as ${user.email}. Please sign out and sign in with the correct email.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!user) {
      // Redirect to sign in with the invitation email pre-filled
      router.push(`/auth/signin?email=${encodeURIComponent(invitation.email)}&redirect=${encodeURIComponent(`/invite/${token}`)}`);
      return;
    }

    if (user.email !== invitation.email) {
      toast({
        title: 'Email Mismatch',
        description: 'Please sign in with the email address that received the invitation.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setAccepting(true);

      const response = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to accept invitation');
      }

      if (result.success) {
        toast({
          title: 'Welcome!',
          description: `You've successfully joined ${invitation.organizationName}`,
        });
        
        // Redirect to dashboard
        router.push('/dashboard');
      } else {
        throw new Error(result.error || 'Failed to accept invitation');
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to accept invitation',
        variant: 'destructive',
      });
    } finally {
      setAccepting(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4" />;
      case 'admin':
        return <Shield className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default' as const;
      case 'admin':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <Building className="h-6 w-6 text-blue-600" />
        </div>
        <CardTitle>You're Invited!</CardTitle>
        <CardDescription>
          {invitation.inviterName 
            ? `${invitation.inviterName} has invited you to join` 
            : 'You have been invited to join'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">{invitation.organizationName}</h3>
          <div className="flex items-center justify-center space-x-2">
            {getRoleIcon(invitation.role)}
            <Badge variant={getRoleBadgeVariant(invitation.role)}>
              {invitation.role}
            </Badge>
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground text-center">
            <p>Invitation for: <strong>{invitation.email}</strong></p>
            <p>Expires: {new Date(invitation.expiresAt).toLocaleDateString()}</p>
          </div>

          {!user ? (
            <div className="space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                You need to sign in to accept this invitation.
              </p>
              <Button
                onClick={handleAcceptInvitation}
                className="w-full"
                size="lg"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Sign In to Accept
              </Button>
            </div>
          ) : user.email !== invitation.email ? (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  You're signed in as <strong>{user.email}</strong>, but this invitation is for <strong>{invitation.email}</strong>.
                </p>
              </div>
              <Button
                onClick={() => supabase.auth.signOut().then(() => router.push(`/auth/signin?email=${encodeURIComponent(invitation.email)}`))}
                variant=&quot;outline&quot;
                className="w-full"
              >
                Sign Out and Sign In with Correct Email
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 text-center">
                  Ready to join <strong>{invitation.organizationName}</strong> as a <strong>{invitation.role}</strong>!
                </p>
              </div>
              <Button
                onClick={handleAcceptInvitation}
                disabled={accepting}
                className="w-full"
                size="lg"
              >
                {accepting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Accepting Invitation...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Accept Invitation
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        <div className="text-xs text-center text-muted-foreground">
          <p>ChiPhi AI helps you automatically process and categorize receipts from your email.</p>
        </div>
      </CardContent>
    </Card>
  );
}