import { createClient as createServerClient } from '@/lib/supabase/server';
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

/**
 * Server-side auth utilities
 */
/**
 * Get server-side authentication context
 */
export async function getServerAuth(): Promise<{
  user: User | null;
  org: Organization | null;
}> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { user: null, org: null };
    }

    // Get user's primary organization (first one for now)
    const { data: orgData } = await supabase
      .from('org_members')
      .select(`
        org_id,
        orgs (
          id,
          name,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', user.id)
      .limit(1)
      .single();

    const org = orgData?.orgs ? {
      id: orgData.orgs.id,
      name: orgData.orgs.name,
      createdAt: new Date(orgData.orgs.created_at),
      updatedAt: new Date(orgData.orgs.updated_at),
    } : null;

    return { user, org };
  } catch (error) {
    return { user: null, org: null };
  }
}

export class ServerAuthService {
  /**
   * Get current user from server-side context
   */
  static async getCurrentUser(): Promise<User | null> {
    try {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get user profile with organization memberships
   */
  static async getUserProfile(userId: string): Promise<{
    user: AuthUser | null;
    organizations: Organization[];
    error?: string;
  }> {
    try {
      const supabase = await createServerClient();

      // Get user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) {
        return { user: null, organizations: [], error: userError.message };
      }

      // Get user's organizations
      const { data: orgData, error: orgError } = await supabase
        .from('org_members')
        .select(`
          org_id,
          role,
          created_at,
          orgs (
            id,
            name,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', userId);

      if (orgError) {
        return { user: null, organizations: [], error: orgError.message };
      }

      const user: AuthUser = {
        id: userData.id,
        email: userData.email,
        fullName: userData.full_name,
        createdAt: new Date(userData.created_at),
        updatedAt: new Date(userData.updated_at),
      };

      const organizations: Organization[] = orgData.map((member: any) => ({
        id: member.orgs.id,
        name: member.orgs.name,
        createdAt: new Date(member.orgs.created_at),
        updatedAt: new Date(member.orgs.updated_at),
      }));

      return { user, organizations };
    } catch (error) {
      return { user: null, organizations: [], error: 'Failed to get user profile' };
    }
  }
}