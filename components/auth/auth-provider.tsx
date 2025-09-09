'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { authService } from '@/lib/services/auth';

export interface Organization {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthContextType {
  user: User | null;
  organizations: Organization[];
  currentOrganization: Organization | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasTriedRefresh, setHasTriedRefresh] = useState(false);

  const refreshProfile = async (currentUser?: User | null) => {
    const userToUse = currentUser || user;
    if (!userToUse || hasTriedRefresh) {
      return;
    }

    setHasTriedRefresh(true);

    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setOrganizations(data.organizations || []);
          setCurrentOrganization(data.organizations?.[0] || null);
        }
      } else if (response.status === 401) {
        // User is not authenticated, clear state
        setOrganizations([]);
        setCurrentOrganization(null);
      } else {
        console.error('Failed to fetch profile:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    } finally {
      // Reset the flag after a delay to allow for retries if needed
      setTimeout(() => setHasTriedRefresh(false), 5000);
    }
  };

  const signOut = async () => {
    await authService.signOut();
    setUser(null);
    setOrganizations([]);
    setCurrentOrganization(null);
    // Redirect to home page after sign out
    router.push('/');
  };

  useEffect(() => {
    let mounted = true;
    
    // Get initial session
    authService.getCurrentUser().then((user) => {
      if (!mounted) return;
      
      setUser(user);
      setIsLoading(false);
      
      if (user) {
        refreshProfile(user);
      }
    }).catch((error) => {
      console.error('Failed to get current user:', error);
      if (mounted) {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = authService.onAuthStateChange((user) => {
      if (!mounted) return;
      
      setUser(user);
      setIsLoading(false);
      setHasTriedRefresh(false); // Reset refresh flag on auth change
      
      if (user) {
        refreshProfile(user);
      } else {
        setOrganizations([]);
        setCurrentOrganization(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    user,
    organizations,
    currentOrganization,
    isLoading,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}