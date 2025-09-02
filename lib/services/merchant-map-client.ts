import { createClient } from '@/lib/supabase/client';
import { 
  MerchantMapping, 
  InsertMerchantMapping,
  ReceiptData 
} from '@/lib/types';

/**
 * Client-side MerchantMap service for use in React components
 * This provides the same functionality as the server-side service
 * but uses the client-side Supabase client
 */
export class MerchantMapClientService {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Look up existing merchant mapping for a given merchant and organization
   * Requirements: 4.1, 7.2
   */
  async lookupMapping(
    merchantName: string, 
    orgId: string
  ): Promise<MerchantMapping | null> {
    try {
      const normalizedMerchant = this.normalizeMerchantName(merchantName);

      const { data, error } = await this.supabase
        .from('merchant_map')
        .select('*')
        .eq('org_id', orgId)
        .eq('merchant_name', normalizedMerchant)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error looking up merchant mapping:', error);
      throw new Error(`Failed to lookup merchant mapping: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create or update merchant mapping based on user correction
   * Requirements: 4.2, 4.3, 7.2
   */
  async updateMapping(
    merchantName: string,
    category: string,
    subcategory: string | null,
    orgId: string,
    userId: string
  ): Promise<MerchantMapping> {
    try {
      const normalizedMerchant = this.normalizeMerchantName(merchantName);

      const mappingData: InsertMerchantMapping = {
        org_id: orgId,
        merchant_name: normalizedMerchant,
        category,
        subcategory,
        created_by: userId,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('merchant_map')
        .upsert(mappingData, {
          onConflict: 'org_id,merchant_name',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating merchant mapping:', error);
      throw new Error(`Failed to update merchant mapping: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all merchant mappings for an organization
   * Requirements: 7.2
   */
  async getMappingsForOrg(orgId: string): Promise<MerchantMapping[]> {
    try {
      const { data, error } = await this.supabase
        .from('merchant_map')
        .select('*')
        .eq('org_id', orgId)
        .order('updated_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching merchant mappings:', error);
      throw new Error(`Failed to fetch merchant mappings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a merchant mapping
   * Requirements: 7.2
   */
  async deleteMapping(
    merchantName: string,
    orgId: string
  ): Promise<void> {
    try {
      const normalizedMerchant = this.normalizeMerchantName(merchantName);

      const { error } = await this.supabase
        .from('merchant_map')
        .delete()
        .eq('org_id', orgId)
        .eq('merchant_name', normalizedMerchant);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error deleting merchant mapping:', error);
      throw new Error(`Failed to delete merchant mapping: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get mapping statistics for an organization
   * Requirements: 4.4
   */
  async getMappingStats(orgId: string): Promise<{
    totalMappings: number;
    recentMappings: number;
    topCategories: Array<{ category: string; count: number }>;
  }> {
    try {
      // Get total mappings count
      const { count: totalMappings, error: countError } = await this.supabase
        .from('merchant_map')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId);

      if (countError) {
        throw countError;
      }

      // Get recent mappings (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: recentMappings, error: recentError } = await this.supabase
        .from('merchant_map')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('updated_at', thirtyDaysAgo.toISOString());

      if (recentError) {
        throw recentError;
      }

      // Get top categories
      const { data: categoryData, error: categoryError } = await this.supabase
        .from('merchant_map')
        .select('category')
        .eq('org_id', orgId);

      if (categoryError) {
        throw categoryError;
      }

      // Count categories
      const categoryCount = (categoryData || []).reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topCategories = Object.entries(categoryCount)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalMappings: totalMappings || 0,
        recentMappings: recentMappings || 0,
        topCategories
      };
    } catch (error) {
      console.error('Error fetching mapping statistics:', error);
      throw new Error(`Failed to fetch mapping statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Subscribe to merchant mapping changes for real-time updates
   * Requirements: 4.4, 7.2
   */
  subscribeToMappingChanges(
    orgId: string,
    callback: (payload: any) => void
  ) {
    return this.supabase
      .channel('merchant_map_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'merchant_map',
          filter: `org_id=eq.${orgId}`
        },
        callback
      )
      .subscribe();
  }

  /**
   * Normalize merchant name for consistent lookup and storage
   */
  private normalizeMerchantName(merchantName: string): string {
    return merchantName
      .toLowerCase()
      .trim()
      .replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b\.?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// Export singleton instance
export const merchantMapClientService = new MerchantMapClientService();