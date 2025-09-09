'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      const supabase = createClient();
      
      try {
        // Get the current URL to extract hash parameters
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const urlParams = new URLSearchParams(window.location.search);
        
        // Check for error in URL
        const errorParam = hashParams.get('error') || urlParams.get('error');
        if (errorParam) {
          console.error('Auth callback error from URL:', errorParam);
          setError(errorParam);
          setTimeout(() => router.push('/?error=auth_failed'), 3000);
          return;
        }

        // Check for access token in hash (magic link flow)
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
          // Set the session using the tokens from the URL
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('Session setting error:', error);
            setError('Failed to set session');
            setTimeout(() => router.push('/?error=session_failed'), 3000);
            return;
          }

          if (data.session) {
            // User is authenticated, redirect to dashboard
            router.push('/dashboard');
            return;
          }
        }

        // Check for code parameter (OAuth flow)
        const code = urlParams.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error('Code exchange error:', error);
            setError('Failed to exchange code');
            setTimeout(() => router.push('/?error=code_exchange_failed'), 3000);
            return;
          }

          if (data.session) {
            // User is authenticated, redirect to dashboard
            router.push('/dashboard');
            return;
          }
        }

        // Check if we already have a session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session check error:', sessionError);
          setError('Failed to check session');
          setTimeout(() => router.push('/?error=session_check_failed'), 3000);
          return;
        }

        if (sessionData.session) {
          // User is authenticated, redirect to dashboard
          router.push('/dashboard');
        } else {
          // No session found, redirect to home page
          setTimeout(() => router.push('/'), 2000);
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setError('Authentication failed');
        setTimeout(() => router.push('/?error=callback_error'), 3000);
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-md mx-auto p-6">
        {error ? (
          <>
            <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
              <span className="text-destructive text-xl">⚠</span>
            </div>
            <h2 className="text-lg font-semibold text-destructive">Authentication Error</h2>
            <p className="text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground">Redirecting you back to the home page...</p>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <h2 className="text-lg font-semibold">Completing sign in...</h2>
            <p className="text-muted-foreground">Please wait while we verify your authentication.</p>
          </>
        )}
      </div>
    </div>
  );
}