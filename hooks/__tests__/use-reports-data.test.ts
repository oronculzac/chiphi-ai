import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useReportsData } from '../use-reports-data';

// Mock SWR
vi.mock('swr', () => {
  return {
    default: vi.fn((key, fetcher, options) => {
    const mockData = {
      mtd: {
        current: 1500.00,
        previous: 1200.00,
        change: 300.00,
        changePercentage: 25.0,
      },
      categories: [
        {
          category: 'Food & Dining',
          amount: 500.00,
          percentage: 33.33,
          count: 15,
        },
        {
          category: 'Transportation',
          amount: 300.00,
          percentage: 20.0,
          count: 8,
        },
      ],
      trend: [
        {
          date: '2024-01-01',
          amount: 50.00,
          transactionCount: 2,
        },
        {
          date: '2024-01-02',
          amount: 75.00,
          transactionCount: 3,
        },
      ],
      correlationId: 'test-correlation-id',
    };

    // Simulate onSuccess callback if data exists
    if (key && options?.onSuccess) {
      setTimeout(() => options.onSuccess(mockData), 0);
    }

    return {
      data: key ? mockData : undefined,
      error: null,
      isLoading: false,
      mutate: vi.fn(),
    };
  }),
  };
});

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'mock-uuid-1234',
}));

describe('useReportsData', () => {
  const defaultOptions = {
    orgId: 'test-org-id',
    filters: {
      timeRange: 'last30' as const,
      startDate: undefined,
      endDate: undefined,
      categories: [],
      search: '',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return reports data when orgId is provided', () => {
    const { result } = renderHook(() => useReportsData(defaultOptions));
    
    expect(result.current.mtdData).toEqual({
      current: 1500.00,
      previous: 1200.00,
      change: 300.00,
      changePercentage: 25.0,
    });
    
    expect(result.current.categoryData).toHaveLength(2);
    expect(result.current.categoryData[0]).toEqual({
      category: 'Food & Dining',
      amount: 500.00,
      percentage: 33.33,
      count: 15,
    });
    
    expect(result.current.trendData).toHaveLength(2);
    expect(result.current.trendData[0]).toEqual({
      date: '2024-01-01',
      amount: 50.00,
      transactionCount: 2,
    });
    
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should not fetch data when orgId is not provided', () => {
    const { result } = renderHook(() => useReportsData({
      ...defaultOptions,
      orgId: '',
    }));
    
    expect(result.current.mtdData).toBeNull();
    expect(result.current.categoryData).toEqual([]);
    expect(result.current.trendData).toEqual([]);
  });

  it('should not fetch data when disabled', () => {
    const { result } = renderHook(() => useReportsData({
      ...defaultOptions,
      enabled: false,
    }));
    
    expect(result.current.mtdData).toBeNull();
    expect(result.current.categoryData).toEqual([]);
    expect(result.current.trendData).toEqual([]);
  });

  it('should build correct query string from filters', async () => {
    const filtersWithData = {
      timeRange: 'custom' as const,
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      categories: ['Food & Dining', 'Transportation'],
      search: 'test search',
    };
    
    renderHook(() => useReportsData({
      ...defaultOptions,
      filters: filtersWithData,
    }));
    
    // The SWR mock should receive the correct URL with query parameters
    // We can verify this by checking that SWR was called with the right key
    const { default: swrMock } = await import('swr');
    expect(swrMock).toHaveBeenCalledWith(
      '/api/reports/data?timeRange=custom&startDate=2024-01-01&endDate=2024-01-31&categories=Food+%26+Dining%2CTransportation&search=test+search',
      expect.any(Function),
      expect.any(Object)
    );
  });

  it('should handle empty filters correctly', async () => {
    const emptyFilters = {
      timeRange: 'last30' as const,
      startDate: undefined,
      endDate: undefined,
      categories: [],
      search: '',
    };
    
    renderHook(() => useReportsData({
      ...defaultOptions,
      filters: emptyFilters,
    }));
    
    const { default: swrMock } = await import('swr');
    expect(swrMock).toHaveBeenCalledWith(
      '/api/reports/data?timeRange=last30',
      expect.any(Function),
      expect.any(Object)
    );
  });

  it('should provide refetch function', () => {
    const { result } = renderHook(() => useReportsData(defaultOptions));
    
    expect(typeof result.current.refetch).toBe('function');
  });

  it('should track retry count', () => {
    const { result } = renderHook(() => useReportsData(defaultOptions));
    
    expect(result.current.retryCount).toBe(0);
    expect(typeof result.current.lastUpdated).toBe('object'); // Can be null initially
  });

  it('should handle filters with undefined categories', async () => {
    const filtersWithUndefinedCategories = {
      timeRange: 'last30' as const,
      startDate: undefined,
      endDate: undefined,
      categories: undefined,
      search: '',
    };
    
    renderHook(() => useReportsData({
      ...defaultOptions,
      filters: filtersWithUndefinedCategories as any,
    }));
    
    const { default: swrMock } = await import('swr');
    expect(swrMock).toHaveBeenCalledWith(
      '/api/reports/data?timeRange=last30',
      expect.any(Function),
      expect.any(Object)
    );
  });
});