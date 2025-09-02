import { useState, useEffect, useCallback } from 'react';
import { merchantMapClientService } from '@/lib/services/merchant-map-client';
import { MerchantMapping } from '@/lib/types';
import { toast } from 'sonner';

interface UseMerchantMapOptions {
  orgId: string;
  autoFetch?: boolean;
}

interface MerchantMapStats {
  totalMappings: number;
  recentMappings: number;
  topCategories: Array<{ category: string; count: number }>;
}

export function useMerchantMap({ orgId, autoFetch = true }: UseMerchantMapOptions) {
  const [mappings, setMappings] = useState<MerchantMapping[]>([]);
  const [stats, setStats] = useState<MerchantMapStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all mappings for the organization
  const fetchMappings = useCallback(async () => {
    if (!orgId) return;

    setLoading(true);
    setError(null);

    try {
      const [mappingsData, statsData] = await Promise.all([
        merchantMapClientService.getMappingsForOrg(orgId),
        merchantMapClientService.getMappingStats(orgId)
      ]);

      setMappings(mappingsData);
      setStats(statsData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch merchant mappings';
      setError(errorMessage);
      console.error('Error fetching merchant mappings:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  // Look up a specific merchant mapping
  const lookupMapping = useCallback(async (merchantName: string): Promise<MerchantMapping | null> => {
    if (!orgId || !merchantName) return null;

    try {
      return await merchantMapClientService.lookupMapping(merchantName, orgId);
    } catch (err) {
      console.error('Error looking up merchant mapping:', err);
      return null;
    }
  }, [orgId]);

  // Update or create a merchant mapping
  const updateMapping = useCallback(async (
    merchantName: string,
    category: string,
    subcategory: string | null,
    userId: string
  ): Promise<boolean> => {
    if (!orgId || !merchantName || !category || !userId) return false;

    try {
      const updatedMapping = await merchantMapClientService.updateMapping(
        merchantName,
        category,
        subcategory,
        orgId,
        userId
      );

      // Update local state
      setMappings(prev => {
        const existingIndex = prev.findIndex(m => 
          m.merchant_name === updatedMapping.merchant_name
        );

        if (existingIndex >= 0) {
          // Update existing mapping
          const updated = [...prev];
          updated[existingIndex] = updatedMapping;
          return updated;
        } else {
          // Add new mapping
          return [updatedMapping, ...prev];
        }
      });

      // Refresh stats
      try {
        const newStats = await merchantMapClientService.getMappingStats(orgId);
        setStats(newStats);
      } catch (statsError) {
        console.warn('Failed to refresh stats after mapping update:', statsError);
      }

      toast.success('Merchant mapping updated successfully');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update merchant mapping';
      toast.error(errorMessage);
      console.error('Error updating merchant mapping:', err);
      return false;
    }
  }, [orgId]);

  // Delete a merchant mapping
  const deleteMapping = useCallback(async (merchantName: string): Promise<boolean> => {
    if (!orgId || !merchantName) return false;

    try {
      await merchantMapClientService.deleteMapping(merchantName, orgId);

      // Update local state
      setMappings(prev => prev.filter(m => m.merchant_name !== merchantName));

      // Refresh stats
      try {
        const newStats = await merchantMapClientService.getMappingStats(orgId);
        setStats(newStats);
      } catch (statsError) {
        console.warn('Failed to refresh stats after mapping deletion:', statsError);
      }

      toast.success('Merchant mapping deleted successfully');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete merchant mapping';
      toast.error(errorMessage);
      console.error('Error deleting merchant mapping:', err);
      return false;
    }
  }, [orgId]);

  // Subscribe to real-time changes
  useEffect(() => {
    if (!orgId) return;

    const subscription = merchantMapClientService.subscribeToMappingChanges(
      orgId,
      (payload) => {
        console.log('Merchant mapping changed:', payload);
        
        // Refresh mappings when changes occur
        fetchMappings();
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [orgId, fetchMappings]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && orgId) {
      fetchMappings();
    }
  }, [autoFetch, orgId, fetchMappings]);

  return {
    mappings,
    stats,
    loading,
    error,
    fetchMappings,
    lookupMapping,
    updateMapping,
    deleteMapping,
    refresh: fetchMappings
  };
}

// Hook for looking up a single mapping
export function useMerchantLookup(merchantName: string, orgId: string) {
  const [mapping, setMapping] = useState<MerchantMapping | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupMapping = useCallback(async () => {
    if (!merchantName || !orgId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await merchantMapClientService.lookupMapping(merchantName, orgId);
      setMapping(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to lookup merchant mapping';
      setError(errorMessage);
      console.error('Error looking up merchant mapping:', err);
    } finally {
      setLoading(false);
    }
  }, [merchantName, orgId]);

  useEffect(() => {
    lookupMapping();
  }, [lookupMapping]);

  return {
    mapping,
    loading,
    error,
    refresh: lookupMapping
  };
}