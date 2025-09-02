'use client';

import { useAuth } from './auth-provider';
import AuthForm from './auth-form';
import OnboardingFlow from './onboarding-flow';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, organizations, currentOrganization, isLoading, refreshProfile } = useAuth();

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth form if user is not authenticated
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <AuthForm />
      </div>
    );
  }

  // Show onboarding if user has no organizations
  if (organizations.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <OnboardingFlow
          userId={user.id}
          userEmail={user.email!}
          onComplete={(orgId) => {
            // Refresh profile to get the new organization
            refreshProfile();
          }}
        />
      </div>
    );
  }

  // User is authenticated and has organizations - show the app
  return <>{children}</>;
}