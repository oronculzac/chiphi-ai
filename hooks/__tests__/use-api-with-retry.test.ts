import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { useApiWithRetry, useSettingsApi } from '../use-api-with-retry';
import { useToast } from '../use-toast';

// Mock the toast hook
vi.mock('../use-toast', () => ({
  useToast: vi.fn()
}));

const mockToast = vi.fn();
(useToast as any).mockReturnValue({ toast: mockToast });

// Mock fetch
global.fetch = vi.fn();

describe('useApiWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as any).mockClear();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useApiWithRetry());

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.attempt).toBe(0);
    expect(result.current.isRetrying).toBe(false);
  });

  it('should initialize with provided initial data', () => {
    const initialData = { id: 1, name: 'Test' };
    const { result } = renderHook(() => useApiWithRetry(initialData));

    expect(result.current.data).toEqual(initialData);
  });

  it('should execute API call successfully', async () => {
    const mockData = { id: 1, name: 'Success' };
    const mockApiCall = vi.fn().mockResolvedValue(mockData);

    const { result } = renderHook(() => useApiWithRetry());

    await act(async () => {
      const response = await result.current.execute(mockApiCall);
      expect(response).toEqual(mockData);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockApiCall).toHaveBeenCalledTimes(1);
  });

  it('should handle API call failure', async () => {
    const mockError = new Error('API Error');
    const mockApiCall = jest.fn().mockRejectedValue(mockError);

    const { result } = renderHook(() => useApiWithRetry(null, {
      showToastOnError: false
    }));

    await act(async () => {
      const response = await result.current.execute(mockApiCall);
      expect(response).toBeNull();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toEqual(mockError);
  });

  it('should retry failed API calls', async () => {
    const mockError = new Error('Network error');
    const mockApiCall = jest.fn()
      .mockRejectedValueOnce(mockError)
      .mockRejectedValueOnce(mockError)
      .mockResolvedValue({ success: true });

    const { result } = renderHook(() => useApiWithRetry(null, {
      maxAttempts: 3,
      baseDelay: 10, // Short delay for testing
      showToastOnError: false
    }));

    await act(async () => {
      const response = await result.current.execute(mockApiCall);
      expect(response).toEqual({ success: true });
    });

    expect(mockApiCall).toHaveBeenCalledTimes(3);
    expect(result.current.data).toEqual({ success: true });
    expect(result.current.error).toBeNull();
  });

  it('should apply optimistic updates', async () => {
    const initialData = { count: 0 };
    const mockApiCall = jest.fn().mockResolvedValue({ count: 1 });

    const { result } = renderHook(() => useApiWithRetry(initialData));

    await act(async () => {
      await result.current.execute(mockApiCall, {
        optimisticUpdate: (current) => current ? { ...current, count: current.count + 1 } : null
      });
    });

    expect(result.current.data).toEqual({ count: 1 });
  });

  it('should rollback optimistic updates on error', async () => {
    const initialData = { count: 0 };
    const mockError = new Error('API Error');
    const mockApiCall = jest.fn().mockRejectedValue(mockError);

    const { result } = renderHook(() => useApiWithRetry(initialData, {
      showToastOnError: false
    }));

    await act(async () => {
      await result.current.execute(mockApiCall, {
        optimisticUpdate: (current) => current ? { ...current, count: current.count + 1 } : null,
        rollbackOnError: true
      });
    });

    expect(result.current.data).toEqual(initialData); // Should be rolled back
    expect(result.current.error).toEqual(mockError);
  });

  it('should show success toast when enabled', async () => {
    const mockData = { success: true };
    const mockApiCall = jest.fn().mockResolvedValue(mockData);

    const { result } = renderHook(() => useApiWithRetry(null, {
      showToastOnSuccess: true,
      successMessage: 'Operation successful'
    }));

    await act(async () => {
      await result.current.execute(mockApiCall);
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Success',
      description: 'Operation successful'
    });
  });

  it('should show error toast when enabled', async () => {
    const mockError = new Error('API Error');
    const mockApiCall = jest.fn().mockRejectedValue(mockError);

    const { result } = renderHook(() => useApiWithRetry(null, {
      showToastOnError: true,
      errorMessage: 'Operation failed'
    }));

    await act(async () => {
      await result.current.execute(mockApiCall);
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error',
      description: 'Operation failed',
      variant: 'destructive'
    });
  });

  it('should call success callback', async () => {
    const mockData = { success: true };
    const mockApiCall = jest.fn().mockResolvedValue(mockData);
    const onSuccess = jest.fn();

    const { result } = renderHook(() => useApiWithRetry(null, {
      onSuccess
    }));

    await act(async () => {
      await result.current.execute(mockApiCall);
    });

    expect(onSuccess).toHaveBeenCalledWith(mockData);
  });

  it('should call error callback', async () => {
    const mockError = new Error('API Error');
    const mockApiCall = jest.fn().mockRejectedValue(mockError);
    const onError = jest.fn();

    const { result } = renderHook(() => useApiWithRetry(null, {
      onError,
      showToastOnError: false
    }));

    await act(async () => {
      await result.current.execute(mockApiCall);
    });

    expect(onError).toHaveBeenCalledWith(mockError);
  });

  it('should cancel ongoing requests', async () => {
    const mockApiCall = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ data: 'test' }), 1000))
    );

    const { result } = renderHook(() => useApiWithRetry());

    act(() => {
      result.current.execute(mockApiCall);
    });

    act(() => {
      result.current.cancel();
    });

    expect(result.current.loading).toBe(false);
  });

  it('should reset state', () => {
    const initialData = { id: 1 };
    const { result } = renderHook(() => useApiWithRetry(initialData));

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toEqual(initialData);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.attempt).toBe(0);
  });
});

describe('useSettingsApi', () => {
  it('should use default settings API configuration', () => {
    const { result } = renderHook(() => useSettingsApi());

    // Should have default error message
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should merge custom options with defaults', async () => {
    const mockError = new Error('Custom error');
    const mockApiCall = jest.fn().mockRejectedValue(mockError);
    const customOnError = jest.fn();

    const { result } = renderHook(() => useSettingsApi(null, {
      onError: customOnError,
      maxAttempts: 5
    }));

    await act(async () => {
      await result.current.execute(mockApiCall);
    });

    expect(customOnError).toHaveBeenCalledWith(mockError);
    // Should still show toast on error (default behavior)
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error',
      description: 'Failed to update settings. Please try again.',
      variant: 'destructive'
    });
  });
});