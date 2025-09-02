import { createClient } from '@/lib/supabase/server';
import { 
  MerchantMapping, 
  InsertMerchantMapping,
  ReceiptData 
} from '@/lib/types';
import { merchantMapCache } from './merchant-map-cache';

/**
 * MerchantMap Learning System
 * 
 * This service handles the learning system that improves categorization accuracy
 * from user corrections. It provides tenant-scoped merchant mapping to ensure
 * multi-tenant isolation while learning from user feedback.
 */
export class MerchantMapService {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Look up existing merchant mapping for a given merchant and organization
   * Uses caching for improved performance
   * Requirements: 4.1, 7.2
   */
  async lookupMapping(
    merchantName: string, 
    orgId: string
  ): Promise<MerchantMapping | null> {
    try {
      // Normalize merchant name for consistent lookup
      const normalizedMerchant = this.normalizeMerchantName(merchantName);

      // Check cache first
      const cachedResult = merchantMapCache.get(orgId, normalizedMerchant);
      if (cachedResult !== undefined) {
        return cachedResult;
      }

      const { data, error } = await this.supabase
        .from('merchant_map')
        .select('*')
        .eq('org_id', orgId)
        .eq('merchant_name', normalizedMerchant)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - cache the null result
          merchantMapCache.set(orgId, normalizedMerchant, null);
          return null;
        }
        throw error;
      }

      // Cache the result
      merchantMapCache.set(orgId, normalizedMerchant, data);
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
      // Normalize merchant name for consistent storage
      const normalizedMerchant = this.normalizeMerchantName(merchantName);

      const mappingData: InsertMerchantMapping = {
        org_id: orgId,
        merchant_name: normalizedMerchant,
        category,
        subcategory,
        created_by: userId,
        updated_at: new Date().toISOString()
      };

      // Use upsert to handle both create and update cases
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

      // Update cache with new mapping
      merchantMapCache.set(orgId, normalizedMerchant, data);

      return data;
    } catch (error) {
      console.error('Error updating merchant mapping:', error);
      throw new Error(`Failed to update merchant mapping: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply learned mapping to receipt data if mapping exists
   * Requirements: 4.3, 4.4
   */
  async applyMapping(
    receiptData: ReceiptData,
    orgId: string
  ): Promise<ReceiptData> {
    try {
      // Look up existing mapping for this merchant
      const mapping = await this.lookupMapping(receiptData.merchant, orgId);

      if (!mapping) {
        // No mapping exists, return original data
        return receiptData;
      }

      // Apply the learned mapping
      const updatedReceiptData: ReceiptData = {
        ...receiptData,
        category: mapping.category,
        subcategory: mapping.subcategory,
        // Increase confidence when using learned mapping
        confidence: Math.min(100, receiptData.confidence + 15),
        explanation: `Applied learned categorization from previous user correction. Original AI suggestion: ${receiptData.category}${receiptData.subcategory ? ` > ${receiptData.subcategory}` : ''}. User-corrected category: ${mapping.category}${mapping.subcategory ? ` > ${mapping.subcategory}` : ''}.`
      };

      return updatedReceiptData;
    } catch (error) {
      console.error('Error applying merchant mapping:', error);
      // Return original data if mapping application fails
      return receiptData;
    }
  }

  /**
   * Get all merchant mappings for an organization (for admin/debugging)
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
   * Delete a merchant mapping (for admin/cleanup)
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

      // Invalidate cache entry
      merchantMapCache.invalidate(orgId, normalizedMerchant);
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
   * Normalize merchant name for consistent lookup and storage
   * This helps with variations in merchant names (e.g., "McDonald's" vs "MCDONALD'S")
   */
  private normalizeMerchantName(merchantName: string): string {
    return merchantName
      .toLowerCase()
      .trim()
      // Remove common suffixes and prefixes
      .replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b\.?/gi, '')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// Export singleton instance
export const merchantMapService = new MerchantMapService();