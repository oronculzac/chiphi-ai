import { createServiceClient } from '@/lib/supabase/server';
import { config } from '@/lib/config';

/**
 * Gmail Alias Generator Service
 * Generates unique email aliases using Gmail+ addressing
 */

const GMAIL_BASE = process.env.GMAIL_BASE_EMAIL || 'oronculzac@gmail.com';
const ALIAS_PREFIX = 'aichiphi_';

export class GmailAliasGenerator {
  /**
   * Generate a unique alias for an organization
   */
  static async generateAlias(orgId: string): Promise<string> {
    const supabase = createServiceClient();
    
    // Generate a unique identifier
    const uniqueId = this.generateUniqueId();
    const alias = `${GMAIL_BASE.split('@')[0]}+${ALIAS_PREFIX}${uniqueId}@gmail.com`;
    
    // Check if alias already exists
    const { data: existing } = await supabase
      .from('inbox_aliases')
      .select('id')
      .eq('alias_email', alias)
      .single();
    
    if (existing) {
      // If it exists, try again with a new ID
      return this.generateAlias(orgId);
    }
    
    // Create the alias in the database
    const { data, error } = await supabase
      .from('inbox_aliases')
      .insert({
        org_id: orgId,
        alias_email: alias,
        is_active: true,
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create alias: ${error.message}`);
    }
    
    return alias;
  }
  
  /**
   * Get existing alias for an organization
   */
  static async getAliasForOrg(orgId: string): Promise<string | null> {
    const supabase = createServiceClient();
    
    const { data } = await supabase
      .from('inbox_aliases')
      .select('alias_email')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .single();
    
    return data?.alias_email || null;
  }
  
  /**
   * Get or create alias for an organization
   */
  static async getOrCreateAlias(orgId: string): Promise<string> {
    const existing = await this.getAliasForOrg(orgId);
    if (existing) {
      return existing;
    }
    
    return this.generateAlias(orgId);
  }
  
  /**
   * Extract organization ID from Gmail alias
   */
  static extractOrgFromAlias(alias: string): string | null {
    // Extract the unique part from oronculzac+aichiphi_a4i8nps4@gmail.com
    const match = alias.match(/\+aichiphi_([a-zA-Z0-9]+)@/);
    return match ? match[1] : null;
  }
  
  /**
   * Validate if an alias follows our format
   */
  static isValidAlias(alias: string): boolean {
    const baseEmail = GMAIL_BASE.split('@')[0];
    const pattern = new RegExp(`^${baseEmail}\\+aichiphi_[a-zA-Z0-9]+@gmail\\.com$`);
    return pattern.test(alias);
  }
  
  /**
   * Generate a unique identifier for aliases
   */
  private static generateUniqueId(): string {
    // Generate a random 8-character alphanumeric string
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  /**
   * Get all active aliases (for admin purposes)
   */
  static async getAllAliases(): Promise<Array<{
    id: string;
    orgId: string;
    alias: string;
    createdAt: string;
  }>> {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('inbox_aliases')
      .select(`
        id,
        org_id,
        alias_email,
        created_at,
        orgs!inner(name)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch aliases: ${error.message}`);
    }
    
    return data?.map(item => ({
      id: item.id,
      orgId: item.org_id,
      alias: item.alias_email,
      createdAt: item.created_at,
      orgName: (item.orgs as any)?.name,
    })) || [];
  }
  
  /**
   * Deactivate an alias
   */
  static async deactivateAlias(aliasId: string): Promise<void> {
    const supabase = createServiceClient();
    
    const { error } = await supabase
      .from('inbox_aliases')
      .update({ is_active: false })
      .eq('id', aliasId);
    
    if (error) {
      throw new Error(`Failed to deactivate alias: ${error.message}`);
    }
  }
}

/**
 * Utility functions for Gmail+ addressing
 */
export const gmailUtils = {
  /**
   * Get the base Gmail address
   */
  getBaseEmail: () => GMAIL_BASE,
  
  /**
   * Check if Gmail+ addressing is properly configured
   */
  isConfigured: () => !!GMAIL_BASE && GMAIL_BASE.includes('@gmail.com'),
  
  /**
   * Generate example alias for documentation
   */
  getExampleAlias: () => `${GMAIL_BASE.split('@')[0]}+aichiphi_abc123@gmail.com`,
  
  /**
   * Get n8n filter query for polling
   */
  getN8nQuery: () => `(to:${GMAIL_BASE.split('@')[0]}+aichiphi_*@gmail.com OR subject:[AICHIPHI]) is:unread`,
  
  /**
   * Get subject flag for email forwarding
   */
  getSubjectFlag: () => '[AICHIPHI]',
};