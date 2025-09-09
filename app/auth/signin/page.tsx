'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';

export default function SignInPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    if (hasRedirected) return;

    // If user is already authenticated, redirect to dashboard
    if (!isLoading && user) {
      setHasRedirected(true);
      router.replace('/dashboard');
    }
    // If not authenticated, redirect to home page which shows the sign-in form
    else if (!isLoading && !user) {
      setHasRedirected(true);
      router.replace('/');
    }
  }, [user, isLoading, router, hasRedirected]);

  // Show loading while checking auth state
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">Redirecting to sign in...</p>
      </div>
    </div>
  );
}