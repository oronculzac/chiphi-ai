'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { v4 as uuidv4 } from 'uuid';
import { REPORTS_SWR_CONFIG } from '@/lib/performance/reports-config';

// Types for report data
interface MTDData {
  current: number;
  previous: number;
  change: number;
  changePercentage: number;
}

interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  count: number;
}

interface SpendingTrendPoint {
  date: string;
  amount: number;
  transactionCount: number;
}

interface ReportsDataResponse {
  mtd: MTDData;
  categories: CategoryBreakdown[];
  trend: SpendingTrendPoint[];
  correlationId: string;
}

// Filter types
export interface ReportFilters {
  timeRange: 'last7' | 'last30' | 'last90' | 'mtd' | 'custom';
  startDate?: string;
  endDate?: string;
  categories?: string[];
  search?: string;
}

interface UseReportsDataOptions {
  orgId: string;
  filters: ReportFilters;
  refreshInterval?: number;
  enabled?: boolean; // Allow disabling the hook
}

interface UseReportsDataReturn {
  mtdData: MTDData | null;
  categoryData: CategoryBreakdown[];
  trendData: SpendingTrendPoint[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  correlationId: string | null;
  retryCount: number;
  lastUpdated: Date | null;
}

// Generate correlation ID for request tracking
function generateCorrelationId(): string {
  return `client_${uuidv4().substring(0, 8)}_${Date.now()}`;
}

// Enhanced fetcher function with correlation ID tracking and better error handling
const fetcher = async (url: string): Promise<ReportsDataResponse> => {
  const correlationId = generateCorrelationId();
  
  try {
    const response = await fetch(url, {
      headers: {
        'X-Correlation-ID': correlationId,
        'Content-Type': 'application/json',
      },
    });
    
    // Handle non-200 responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
      
      // Add specific error handling for different status codes
      switch (response.status) {
        case 401:
          throw new Error('Authentication required. Please log in again.');
        case 403:
          throw new Error('Access denied. You do not have permission to view this data.');
        case 404:
          throw new Error('Organization not found. Please set up your organization first.');
        case 429:
          throw new Error('Too many requests. Please wait a moment and try again.');
        case 500:
          throw new Error('Server error. Please try again later.');
        default:
          throw new Error(errorMessage);
      }
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch reports data');
    }
    
    // Log successful fetch for debugging
    console.log(`[${correlationId}] Reports data fetched successfully`);
    
    return result.data;
  } catch (error) {
    // Log error with correlation ID for debugging
    console.error(`[${correlationId}] Reports data fetch failed:`, error);
    throw error;
  }
};

// Build query string from filters
function buildQueryString(filters: ReportFilters): string {
  const params = new URLSearchParams();
  
  params.set('timeRange', filters.timeRange);
  
  if (filters.startDate) {
    params.set('startDate', filters.startDate);
  }
  
  if (filters.endDate) {
    params.set('endDate', filters.endDate);
  }
  
  if (filters.categories && filters.categories.length > 0) {
    params.set('categories', filters.categories.join(','));
  }
  
  if (filters.search && filters.search.trim()) {
    params.set('search', filters.search.trim());
  }
  
  return params.toString();
}

export function useReportsData({ 
  orgId, 
  filters, 
  refreshInterval = 30000, // 30 seconds default
  enabled = true
}: UseReportsDataOptions): UseReportsDataReturn {
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Build the API URL with query parameters
  const queryString = buildQueryString(filters);
  const apiUrl = `/api/reports/data?${queryString}`;
  
  // Don't fetch if no orgId is provided or if orgId is empty/invalid
  const shouldFetch = orgId && enabled && orgId.trim() !== '' && orgId !== 'undefined' && orgId !== 'null';
  
  // Enhanced SWR configuration using performance config
  const {
    data,
    error,
    isLoading,
    mutate
  } = useSWR<ReportsDataResponse>(
    // Only fetch if we have a valid orgId and hook is enabled
    shouldFetch ? apiUrl : null,
    fetcher,
    {
      // Use optimized SWR configuration
      ...REPORTS_SWR_CONFIG,
      
      // Override refresh interval from options - disable automatic refresh
      refreshInterval: 0,
      
      // Additional safeguards to prevent excessive requests
      revalidateOnMount: true, // Only revalidate on initial mount
      revalidateOnFocus: false, // Never revalidate on focus
      revalidateOnReconnect: false, // Never revalidate on reconnect
      
      // Callbacks for state management
      onSuccess: (data) => {
        setCorrelationId(data.correlationId);
        setRetryCount(0); // Reset retry count on success
        setLastUpdated(new Date());
        
        // Only log in development to reduce noise
        if (process.env.NODE_ENV === 'development') {
          console.log(`Reports data updated successfully at ${new Date().toISOString()}`);
        }
      },
      onError: (error) => {
        setRetryCount(prev => prev + 1);
        console.error(`Reports data fetch error (attempt ${retryCount + 1}):`, error);
      },
      onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
        // Don't retry on 4xx errors (client errors) or organization not found
        if (error.message.includes('401') || 
            error.message.includes('403') || 
            error.message.includes('404') ||
            error.message.includes('Organization not found')) {
          console.log('Not retrying due to client error or missing organization:', error.message);
          return;
        }
        
        // Don't retry more than 3 times
        if (retryCount >= REPORTS_SWR_CONFIG.errorRetryCount) return;
        
        // Use configured retry interval
        setTimeout(() => revalidate({ retryCount }), 
          REPORTS_SWR_CONFIG.errorRetryInterval(retryCount));
      }
    }
  );
  
  // Manual refetch function with retry count reset
  const refetch = useCallback(() => {
    setRetryCount(0);
    mutate();
  }, [mutate]);
  
  // Handle visibility change to refresh stale data
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && data && lastUpdated) {
        // Refresh if data is older than 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (lastUpdated < fiveMinutesAgo) {
          console.log('Refreshing stale reports data after tab focus');
          refetch();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [data, lastUpdated, refetch]);
  
  return {
    mtdData: data?.mtd || null,
    categoryData: data?.categories || [],
    trendData: data?.trend || [],
    loading: isLoading,
    error: error?.message || null,
    refetch,
    correlationId,
    retryCount,
    lastUpdated
  };
}