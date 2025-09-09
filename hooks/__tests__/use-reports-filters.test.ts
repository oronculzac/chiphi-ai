import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useReportsFilters } from '../use-reports-filters';
import { ReportFilters } from '../use-reports-data';

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

// Mock debounce hook
vi.mock('../use-debounce', () => ({
  useDebounce: vi.fn((callback) => callback),
}));

describe('useReportsFilters', () => {
  const mockReplace = vi.fn();
  let mockSearchParams: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a proper mock for URLSearchParams
    mockSearchParams = {
      get: vi.fn(),
      set: vi.fn(),
      clear: vi.fn(),
      toString: vi.fn(() => ''),
    };
    
    (useRouter as any).mockReturnValue({
      replace: mockReplace,
    });
    
    (useSearchParams as any).mockReturnValue(mockSearchParams);
    
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/reports',
      },
      writable: true,
    });
  });

  it('should initialize with default filters when no URL params', () => {
    mockSearchParams.get.mockReturnValue(null);
    
    const { result } = renderHook(() => useReportsFilters());
    
    expect(result.current.filters).toEqual({
      timeRange: 'last30',
      startDate: undefined,
      endDate: undefined,
      categories: [],
      search: '',
    });
  });

  it('should initialize with filters from URL params', () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      switch (key) {
        case 'timeRange': return 'last7';
        case 'categories': return 'Food & Dining,Transportation';
        case 'search': return 'test search';
        default: return null;
      }
    });
    
    const { result } = renderHook(() => useReportsFilters());
    
    expect(result.current.filters).toEqual({
      timeRange: 'last7',
      startDate: undefined,
      endDate: undefined,
      categories: ['Food & Dining', 'Transportation'],
      search: 'test search',
    });
  });

  it('should update filters and URL when updateFilters is called', () => {
    const { result } = renderHook(() => useReportsFilters());
    
    act(() => {
      result.current.updateFilters({
        timeRange: 'last90',
        categories: ['Shopping'],
      });
    });
    
    expect(result.current.filters.timeRange).toBe('last90');
    expect(result.current.filters.categories).toEqual(['Shopping']);
    expect(mockReplace).toHaveBeenCalledWith('/reports?timeRange=last90&categories=Shopping', { scroll: false });
  });

  it('should clear all filters when clearFilters is called', () => {
    // Start with some filters
    mockSearchParams.get.mockImplementation((key: string) => {
      switch (key) {
        case 'timeRange': return 'last7';
        case 'categories': return 'Food & Dining';
        default: return null;
      }
    });
    
    const { result } = renderHook(() => useReportsFilters());
    
    act(() => {
      result.current.clearFilters();
    });
    
    expect(result.current.filters).toEqual({
      timeRange: 'last30',
      startDate: undefined,
      endDate: undefined,
      categories: [],
      search: '',
    });
    expect(mockReplace).toHaveBeenCalledWith('/reports', { scroll: false });
  });

  it('should validate custom date range', () => {
    const { result } = renderHook(() => useReportsFilters());
    
    // Try to set custom range without dates - should not update
    act(() => {
      result.current.updateFilters({
        timeRange: 'custom',
      });
    });
    
    // Should remain at default since validation failed
    expect(result.current.filters.timeRange).toBe('last30');
  });

  it('should validate date format', () => {
    const { result } = renderHook(() => useReportsFilters());
    
    // Try to set invalid date format - should not update
    act(() => {
      result.current.updateFilters({
        startDate: 'invalid-date',
      });
    });
    
    // Should not have updated the startDate
    expect(result.current.filters.startDate).toBeUndefined();
  });

  it('should call onFiltersChange callback when filters change', () => {
    const mockCallback = vi.fn();
    const { result } = renderHook(() => useReportsFilters({
      onFiltersChange: mockCallback,
    }));
    
    act(() => {
      result.current.updateFilters({
        timeRange: 'last7',
      });
    });
    
    expect(mockCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        timeRange: 'last7',
      })
    );
  });

  it('should provide available categories', () => {
    const { result } = renderHook(() => useReportsFilters());
    
    expect(result.current.availableCategories).toEqual([
      'Food & Dining',
      'Transportation',
      'Shopping',
      'Entertainment',
      'Healthcare',
      'Utilities',
      'Travel',
      'Education',
      'Business',
      'Other'
    ]);
  });

  it('should handle empty categories parameter correctly', () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      return key === 'categories' ? '' : null;
    });
    
    const { result } = renderHook(() => useReportsFilters());
    
    expect(result.current.filters.categories).toEqual([]);
  });

  it('should trim whitespace from categories', () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      return key === 'categories' ? ' Food & Dining , Transportation , ' : null;
    });
    
    const { result } = renderHook(() => useReportsFilters());
    
    expect(result.current.filters.categories).toEqual(['Food & Dining', 'Transportation']);
  });
});