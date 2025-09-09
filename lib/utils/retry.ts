/**
 * Retry utility for API calls with exponential backoff
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryCondition?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

export class RetryError extends Error {
  public readonly attempts: number;
  public readonly lastError: Error;

  constructor(message: string, attempts: number, lastError: Error) {
    super(message);
    this.name = 'RetryError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

/**
 * Default retry condition - retry on network errors and 5xx status codes
 */
const defaultRetryCondition = (error: any): boolean => {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // HTTP errors
  if (error.status >= 500 && error.status < 600) {
    return true;
  }

  // Rate limiting
  if (error.status === 429) {
    return true;
  }

  // Timeout errors
  if (error.name === 'AbortError' || error.code === 'TIMEOUT') {
    return true;
  }

  return false;
};

/**
 * Sleep utility for delays
 */
const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate delay with exponential backoff and jitter
 */
const calculateDelay = (
  attempt: number, 
  baseDelay: number, 
  maxDelay: number, 
  backoffFactor: number
): number => {
  const exponentialDelay = baseDelay * Math.pow(backoffFactor, attempt - 1);
  const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
  return Math.min(exponentialDelay + jitter, maxDelay);
};

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    retryCondition = defaultRetryCondition,
    onRetry
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on the last attempt
      if (attempt === maxAttempts) {
        break;
      }

      // Check if we should retry this error
      if (!retryCondition(lastError)) {
        throw lastError;
      }

      // Call retry callback if provided
      onRetry?.(attempt, lastError);

      // Calculate delay and wait
      const delay = calculateDelay(attempt, baseDelay, maxDelay, backoffFactor);
      await sleep(delay);
    }
  }

  throw new RetryError(
    `Failed after ${maxAttempts} attempts: ${lastError!.message}`,
    maxAttempts,
    lastError!
  );
}

/**
 * Retry wrapper specifically for fetch requests
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  return withRetry(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      // Throw error for non-ok responses to trigger retry logic
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).response = response;
        throw error;
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }, {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 5000,
    ...retryOptions
  });
}

/**
 * Retry wrapper for API calls that return JSON
 */
export async function apiCallWithRetry<T>(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<T> {
  const response = await fetchWithRetry(url, options, retryOptions);
  return response.json();
}

/**
 * Hook-friendly retry wrapper that includes loading state management
 */
export interface RetryState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  retry: () => Promise<void>;
  attempt: number;
}

export function createRetryState<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): RetryState<T> {
  let state: RetryState<T> = {
    data: null,
    loading: false,
    error: null,
    attempt: 0,
    retry: async () => {
      state.loading = true;
      state.error = null;
      state.attempt++;

      try {
        state.data = await withRetry(fn, {
          ...options,
          onRetry: (attempt, error) => {
            state.attempt = attempt;
            options.onRetry?.(attempt, error);
          }
        });
      } catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
      } finally {
        state.loading = false;
      }
    }
  };

  return state;
}