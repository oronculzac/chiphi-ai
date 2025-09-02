import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { Organization, OrganizationMember } from './auth';

export interface CreateOrganizationRequest {
  name: string;
  userId: string;
}

export interface UpdateUserProfileRequest {
  userId: string;
  fullName?: string;
  email?: string;
}

export class OrganizationService {
  /**
   * Create a new organization with the user as owner
   */
  static async createOrganization({ name, userId }: CreateOrganizationRequest): Promise<{
    organization: Organization | null;
    error?: string;
  }> {
    try {
      const supabase = createServiceClient();

      // Start a transaction by creating the organization first
      const { data: orgData, error: orgError } = await supabase
        .from('orgs')
        .insert({
          name: name.trim(),
        })
        .select()
        .single();

      if (orgError) {
        return { organization: null, error: orgError.message };
      }

      // Add user as owner of the organization
      const { error: memberError } = await supabase
        .from('org_members')
        .insert({
          org_id: orgData.id,
          user_id: userId,
          role: 'owner',
        });

      if (memberError) {
        // Cleanup: delete the organization if member creation fails
        await supabase.from('orgs').delete().eq('id', orgData.id);
        return { organization: null, error: memberError.message };
      }

      const organization: Organization = {
        id: orgData.id,
        name: orgData.name,
        createdAt: new Date(orgData.created_at),
        updatedAt: new Date(orgData.updated_at),
      };

      return { organization };
    } catch (error) {
      return { organization: null, error: 'Failed to create organization' };
    }
  }

  /**
   * Update organization details
   */
  static async updateOrganization(orgId: string, updates: { name?: string }): Promise<{
    organization: Organization | null;
    error?: string;
  }> {
    try {
      const supabase = await createServerClient();

      const { data, error } = await supabase
        .from('orgs')
        .update({
          name: updates.name?.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', orgId)
        .select()
        .single();

      if (error) {
        return { organization: null, error: error.message };
      }

      const organization: Organization = {
        id: data.id,
        name: data.name,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };

      return { organization };
    } catch (error) {
      return { organization: null, error: 'Failed to update organization' };
    }
  }

  /**
   * Get organization members
   */
  static async getOrganizationMembers(orgId: string): Promise<{
    members: (OrganizationMember & { user: { email: string; fullName?: string } })[];
    error?: string;
  }> {
    try {
      const supabase = await createServerClient();

      const { data, error } = await supabase
        .from('org_members')
        .select(`
          org_id,
          user_id,
          role,
          created_at,
          users (
            email,
            full_name
          )
        `)
        .eq('org_id', orgId);

      if (error) {
        return { members: [], error: error.message };
      }

      const members = data.map((member: any) => ({
        orgId: member.org_id,
        userId: member.user_id,
        role: member.role,
        createdAt: new Date(member.created_at),
        user: {
          email: member.users.email,
          fullName: member.users.full_name,
        },
      }));

      return { members };
    } catch (error) {
      return { members: [], error: 'Failed to get organization members' };
    }
  }

  /**
   * Add member to organization
   */
  static async addOrganizationMember(
    orgId: string,
    userEmail: string,
    role: 'admin' | 'member' = 'member'
  ): Promise<{ error?: string }> {
    try {
      const supabase = createServiceClient();

      // First, find the user by email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', userEmail)
        .single();

      if (userError) {
        return { error: 'User not found' };
      }

      // Add user to organization
      const { error: memberError } = await supabase
        .from('org_members')
        .insert({
          org_id: orgId,
          user_id: userData.id,
          role,
        });

      if (memberError) {
        return { error: memberError.message };
      }

      return {};
    } catch (error) {
      return { error: 'Failed to add organization member' };
    }
  }

  /**
   * Remove member from organization
   */
  static async removeOrganizationMember(orgId: string, userId: string): Promise<{ error?: string }> {
    try {
      const supabase = await createServerClient();

      const { error } = await supabase
        .from('org_members')
        .delete()
        .eq('org_id', orgId)
        .eq('user_id', userId);

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error) {
      return { error: 'Failed to remove organization member' };
    }
  }
}

export class UserProfileService {
  /**
   * Create or update user profile
   */
  static async upsertUserProfile({ userId, fullName, email }: UpdateUserProfileRequest): Promise<{
    error?: string;
  }> {
    try {
      const supabase = createServiceClient();

      const { error } = await supabase
        .from('users')
        .upsert({
          id: userId,
          email: email!,
          full_name: fullName,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error) {
      return { error: 'Failed to update user profile' };
    }
  }

  /**
   * Get user's current organization (first one they belong to)
   */
  static async getUserCurrentOrganization(userId: string): Promise<{
    organization: Organization | null;
    error?: string;
  }> {
    try {
      const supabase = await createServerClient();

      const { data, error } = await supabase
        .from('org_members')
        .select(`
          orgs (
            id,
            name,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (error) {
        return { organization: null, error: error.message };
      }

      const organization: Organization = {
        id: data.orgs.id,
        name: data.orgs.name,
        createdAt: new Date(data.orgs.created_at),
        updatedAt: new Date(data.orgs.updated_at),
      };

      return { organization };
    } catch (error) {
      return { organization: null, error: 'Failed to get user organization' };
    }
  }
}