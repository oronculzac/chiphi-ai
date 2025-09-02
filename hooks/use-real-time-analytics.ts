'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardStats } from '@/lib/types';
import { dashboardSubscriptionManager } from '@/lib/services/realtime-optimizer';

interface UseRealTimeAnalyticsOptions {
  orgId: string;
  refreshInterval?: number; // in milliseconds
}

interface AnalyticsData extends DashboardStats {
  monthToDateTotal: number;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
    count: number;
  }>;
  spendingTrend: Array<{
    date: string;
    amount: number;
  }>;
  recentTransactions: any[];
}

export function useRealTimeAnalytics({ 
  orgId, 
  refreshInterval = 30000 // 30 seconds default
}: UseRealTimeAnalyticsOptions) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const supabase = createClient();

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch('/api/transactions/stats');
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch analytics');
      }

      setAnalytics(result.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh analytics data
  const refreshAnalytics = useCallback(() => {
    setLoading(true);
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Set up optimized real-time subscription for transaction changes
  useEffect(() => {
    if (!orgId) return;

    // Initial fetch
    fetchAnalytics();

    // Set up optimized real-time subscription with throttling
    const subscriptionId = dashboardSubscriptionManager.subscribeToTransactions(
      orgId,
      (updates) => {
        console.log('Optimized transaction updates received:', updates.length);
        // Refresh analytics when transactions change (throttled)
        fetchAnalytics();
      }
    );

    // Set up periodic refresh as fallback (less frequent due to real-time updates)
    const intervalId = setInterval(() => {
      fetchAnalytics();
    }, refreshInterval * 2); // Double the interval since we have real-time updates

    // Cleanup
    return () => {
      dashboardSubscriptionManager.cleanup();
      clearInterval(intervalId);
    };
  }, [orgId, refreshInterval, fetchAnalytics]);

  // Handle visibility change to refresh when tab becomes active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && analytics) {
        // Refresh if data is older than 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (!lastUpdated || lastUpdated < fiveMinutesAgo) {
          fetchAnalytics();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [analytics, lastUpdated, fetchAnalytics]);

  return {
    analytics,
    loading,
    error,
    lastUpdated,
    refreshAnalytics
  };
}