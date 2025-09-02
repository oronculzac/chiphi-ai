import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { config } from '@/lib/config';
import { randomBytes } from 'crypto';

export interface InboxAlias {
  id: string;
  orgId: string;
  aliasEmail: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class InboxAliasService {
  /**
   * Generate a unique email alias for an organization
   */
  private static generateAlias(): string {
    // Generate a random 12-character string
    const randomString = randomBytes(6).toString('hex');
    return `receipts-${randomString}@${config.email.domain}`;
  }

  /**
   * Create a new inbox alias for an organization
   */
  static async createInboxAlias(orgId: string): Promise<{
    alias: InboxAlias | null;
    error?: string;
  }> {
    try {
      const supabase = createServiceClient();

      // Check if organization already has an active alias
      const { data: existingAlias } = await supabase
        .from('inbox_aliases')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .single();

      if (existingAlias) {
        const alias: InboxAlias = {
          id: existingAlias.id,
          orgId: existingAlias.org_id,
          aliasEmail: existingAlias.alias_email,
          isActive: existingAlias.is_active,
          createdAt: new Date(existingAlias.created_at),
          updatedAt: new Date(existingAlias.updated_at),
        };
        return { alias };
      }

      // Generate a unique alias
      let aliasEmail: string;
      let attempts = 0;
      const maxAttempts = 10;

      do {
        aliasEmail = this.generateAlias();
        attempts++;

        // Check if this alias already exists
        const { data: duplicate } = await supabase
          .from('inbox_aliases')
          .select('id')
          .eq('alias_email', aliasEmail)
          .single();

        if (!duplicate) {
          break;
        }

        if (attempts >= maxAttempts) {
          return { alias: null, error: 'Failed to generate unique alias' };
        }
      } while (attempts < maxAttempts);

      // Create the new alias
      const { data, error } = await supabase
        .from('inbox_aliases')
        .insert({
          org_id: orgId,
          alias_email: aliasEmail,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        return { alias: null, error: error.message };
      }

      const alias: InboxAlias = {
        id: data.id,
        orgId: data.org_id,
        aliasEmail: data.alias_email,
        isActive: data.is_active,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };

      return { alias };
    } catch (error) {
      return { alias: null, error: 'Failed to create inbox alias' };
    }
  }

  /**
   * Get organization's inbox aliases
   */
  static async getOrganizationAliases(orgId: string): Promise<{
    aliases: InboxAlias[];
    error?: string;
  }> {
    try {
      const supabase = await createServerClient();

      const { data, error } = await supabase
        .from('inbox_aliases')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (error) {
        return { aliases: [], error: error.message };
      }

      const aliases: InboxAlias[] = data.map((alias) => ({
        id: alias.id,
        orgId: alias.org_id,
        aliasEmail: alias.alias_email,
        isActive: alias.is_active,
        createdAt: new Date(alias.created_at),
        updatedAt: new Date(alias.updated_at),
      }));

      return { aliases };
    } catch (error) {
      return { aliases: [], error: 'Failed to get organization aliases' };
    }
  }

  /**
   * Get active inbox alias for organization
   */
  static async getActiveAlias(orgId: string): Promise<{
    alias: InboxAlias | null;
    error?: string;
  }> {
    try {
      const supabase = await createServerClient();

      const { data, error } = await supabase
        .from('inbox_aliases')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No active alias found
          return { alias: null };
        }
        return { alias: null, error: error.message };
      }

      const alias: InboxAlias = {
        id: data.id,
        orgId: data.org_id,
        aliasEmail: data.alias_email,
        isActive: data.is_active,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };

      return { alias };
    } catch (error) {
      return { alias: null, error: 'Failed to get active alias' };
    }
  }

  /**
   * Deactivate an inbox alias
   */
  static async deactivateAlias(aliasId: string): Promise<{ error?: string }> {
    try {
      const supabase = await createServerClient();

      const { error } = await supabase
        .from('inbox_aliases')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', aliasId);

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error) {
      return { error: 'Failed to deactivate alias' };
    }
  }

  /**
   * Reactivate an inbox alias (and deactivate others for the same org)
   */
  static async reactivateAlias(aliasId: string, orgId: string): Promise<{ error?: string }> {
    try {
      const supabase = await createServerClient();

      // First deactivate all aliases for this org
      await supabase
        .from('inbox_aliases')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('org_id', orgId);

      // Then activate the specified alias
      const { error } = await supabase
        .from('inbox_aliases')
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', aliasId);

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error) {
      return { error: 'Failed to reactivate alias' };
    }
  }

  /**
   * Find organization by email alias (used by webhook processing)
   */
  static async findOrganizationByAlias(aliasEmail: string): Promise<{
    orgId: string | null;
    error?: string;
  }> {
    try {
      const supabase = createServiceClient();

      const { data, error } = await supabase
        .from('inbox_aliases')
        .select('org_id')
        .eq('alias_email', aliasEmail)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { orgId: null, error: 'Alias not found' };
        }
        return { orgId: null, error: error.message };
      }

      return { orgId: data.org_id };
    } catch (error) {
      return { orgId: null, error: 'Failed to find organization by alias' };
    }
  }
}