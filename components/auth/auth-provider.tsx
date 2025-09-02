'use client';

import { createContext, useContext, useEffect, useState } from 'react';
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
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = async (currentUser?: User | null) => {
    const userToUse = currentUser || user;
    console.log('refreshProfile called, user:', userToUse);
    if (!userToUse) {
      console.log('No user, skipping refresh');
      return;
    }

    try {
      console.log('Fetching /api/auth/me');
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        console.log('Profile data received:', data);
        setOrganizations(data.organizations || []);
        setCurrentOrganization(data.organizations?.[0] || null);
      } else {
        console.error('Failed to fetch profile:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    }
  };

  const signOut = async () => {
    await authService.signOut();
    setUser(null);
    setOrganizations([]);
    setCurrentOrganization(null);
  };

  useEffect(() => {
    console.log('AuthProvider useEffect running');
    
    // Get initial session
    authService.getCurrentUser().then((user) => {
      console.log('Initial user:', user);
      setUser(user);
      setIsLoading(false);
      
      if (user) {
        console.log('User found, calling refreshProfile');
        refreshProfile(user);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = authService.onAuthStateChange((user) => {
      console.log('Auth state changed, user:', user);
      setUser(user);
      setIsLoading(false);
      
      if (user) {
        console.log('User authenticated, calling refreshProfile');
        refreshProfile(user);
      } else {
        console.log('User signed out, clearing organizations');
        setOrganizations([]);
        setCurrentOrganization(null);
      }
    });

    return () => subscription.unsubscribe();
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