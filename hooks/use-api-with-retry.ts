'use client';

import { useState, useCallback, useRef } from 'react';
import { withRetry, RetryOptions } from '@/lib/utils/retry';
import { useToast } from '@/hooks/use-toast';

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  attempt: number;
}

export interface OptimisticUpdateOptions<T> {
  optimisticUpdate?: (currentData: T | null) => T | null;
  rollbackOnError?: boolean;
}

export interface UseApiWithRetryOptions<T> extends RetryOptions {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  showToastOnError?: boolean;
  showToastOnSuccess?: boolean;
  successMessage?: string;
  errorMessage?: string;
}

export function useApiWithRetry<T>(
  initialData: T | null = null,
  options: UseApiWithRetryOptions<T> = {}
) {
  const [state, setState] = useState<ApiState<T>>({
    data: initialData,
    loading: false,
    error: null,
    attempt: 0
  });

  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);
  const previousDataRef = useRef<T | null>(initialData);

  const {
    onSuccess,
    onError,
    showToastOnError = true,
    showToastOnSuccess = false,
    successMessage = 'Operation completed successfully',
    errorMessage = 'Operation failed',
    ...retryOptions
  } = options;

  // Memoize retry options to prevent unnecessary re-renders
  const stableRetryOptions = useRef(retryOptions);
  stableRetryOptions.current = retryOptions;

  const execute = useCallback(async <R = T>(
    apiCall: () => Promise<R>,
    optimisticOptions: OptimisticUpdateOptions<T> = {}
  ): Promise<R | null> => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    // Store current data for potential rollback using setState callback to get latest value
    setState(prev => {
      previousDataRef.current = prev.data;
      return prev;
    });

    // Apply optimistic update if provided
    if (optimisticOptions.optimisticUpdate) {
      setState(prev => ({
        ...prev,
        data: optimisticOptions.optimisticUpdate!(prev.data),
        error: null
      }));
    }

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      attempt: 0
    }));

    try {
      const result = await withRetry(
        async () => {
          // Check if request was aborted
          if (abortControllerRef.current?.signal.aborted) {
            throw new Error('Request aborted');
          }
          return await apiCall();
        },
        {
          ...stableRetryOptions.current,
          onRetry: (attempt, error) => {
            setState(prev => ({ ...prev, attempt }));
            stableRetryOptions.current.onRetry?.(attempt, error);
          }
        }
      );

      // Update state with successful result
      setState(prev => ({
        ...prev,
        data: result as T,
        loading: false,
        error: null
      }));

      // Call success callback
      onSuccess?.(result as T);

      // Show success toast if enabled
      if (showToastOnSuccess) {
        toast({
          title: 'Success',
          description: successMessage,
        });
      }

      return result;

    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));

      // Rollback optimistic update if enabled
      if (optimisticOptions.rollbackOnError && optimisticOptions.optimisticUpdate) {
        setState(prev => ({
          ...prev,
          data: previousDataRef.current,
          loading: false,
          error: errorObj
        }));
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: errorObj
        }));
      }

      // Call error callback
      onError?.(errorObj);

      // Show error toast if enabled
      if (showToastOnError && !abortControllerRef.current?.signal.aborted) {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }

      return null;
    }
  }, [onSuccess, onError, showToastOnError, showToastOnSuccess, successMessage, errorMessage, toast]);

  const retry = useCallback(async () => {
    setState(prev => {
      if (prev.error) {
        return {
          ...prev,
          loading: true,
          error: null,
          attempt: 0
        };
      }
      return prev;
    });
  }, []);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({
      data: initialData,
      loading: false,
      error: null,
      attempt: 0
    });
  }, [initialData]);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState(prev => ({
      ...prev,
      loading: false
    }));
  }, []);

  return {
    ...state,
    execute,
    retry,
    reset,
    cancel,
    isRetrying: state.attempt > 0
  };
}

// Specialized hook for settings API calls
export function useSettingsApi<T>(
  initialData: T | null = null,
  options: UseApiWithRetryOptions<T> = {}
) {
  return useApiWithRetry(initialData, {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 5000,
    showToastOnError: true,
    errorMessage: 'Failed to update settings. Please try again.',
    ...options
  });
}