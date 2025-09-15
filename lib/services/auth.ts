import { createClient } from '@/lib/supabase/client';
import { config } from '@/lib/config';
import type { User } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMember {
  orgId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: Date;
}

export class AuthService {
  private supabase = createClient();

  /**
   * Send magic link to user's email
   */
  async signInWithMagicLink(email: string): Promise<{ error?: string }> {
    try {
      const { error } = await this.supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${config.app.nextAuthUrl}/auth/callback`,
        },
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error) {
      return { error: 'Failed to send magic link' };
    }
  }

  /**
   * Sign in with email and password
   */
  async signInWithPassword(email: string, password: string): Promise<{ error?: string }> {
    try {
      const { error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error) {
      return { error: 'Failed to sign in with password' };
    }
  }

  /**
   * Sign up with email and password
   */
  async signUpWithPassword(email: string, password: string): Promise<{ error?: string }> {
    try {
      const { error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${config.app.nextAuthUrl}/auth/callback`,
        },
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error) {
      return { error: 'Failed to create account' };
    }
  }

  /**
   * Reset password - send reset email
   */
  async resetPassword(email: string): Promise<{ error?: string }> {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${config.app.nextAuthUrl}/auth/reset-password`,
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error) {
      return { error: 'Failed to send reset email' };
    }
  }

  /**
   * Update password (used after reset)
   */
  async updatePassword(newPassword: string): Promise<{ error?: string }> {
    try {
      const { error } = await this.supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error) {
      return { error: 'Failed to update password' };
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<{ error?: string }> {
    try {
      const { error } = await this.supabase.auth.signOut();
      
      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error) {
      return { error: 'Failed to sign out' };
    }
  }

  /**
   * Get current user session
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      return user;
    } catch (error) {
      return null;
    }
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (user: User | null) => void) {
    return this.supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user || null);
    });
  }
}



export const authService = new AuthService();