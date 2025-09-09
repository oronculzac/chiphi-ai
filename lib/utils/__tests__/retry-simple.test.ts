import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withRetry, RetryError } from '../retry';

describe('withRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should succeed on first attempt', async () => {
    const mockFn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(mockFn);

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue('success');

    const result = await withRetry(mockFn, {
      maxAttempts: 3,
      baseDelay: 10 // Short delay for testing
    });

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should throw RetryError after max attempts', async () => {
    const mockError = new Error('Persistent error');
    const mockFn = vi.fn().mockRejectedValue(mockError);

    await expect(withRetry(mockFn, {
      maxAttempts: 2,
      baseDelay: 10
    })).rejects.toThrow(RetryError);

    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should not retry when retry condition returns false', async () => {
    const mockError = new Error('Non-retryable error');
    const mockFn = vi.fn().mockRejectedValue(mockError);

    await expect(withRetry(mockFn, {
      maxAttempts: 3,
      retryCondition: () => false
    })).rejects.toThrow('Non-retryable error');

    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should call onRetry callback', async () => {
    const mockError = new Error('Network error');
    const mockFn = vi.fn()
      .mockRejectedValueOnce(mockError)
      .mockResolvedValue('success');
    const onRetry = vi.fn();

    await withRetry(mockFn, {
      maxAttempts: 2,
      baseDelay: 10,
      onRetry
    });

    expect(onRetry).toHaveBeenCalledWith(1, mockError);
  });

  it('should handle string errors', async () => {
    const mockFn = vi.fn().mockRejectedValue('String error');

    await expect(withRetry(mockFn, {
      maxAttempts: 1
    })).rejects.toThrow(RetryError);

    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should respect maxDelay', async () => {
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('Error'))
      .mockResolvedValue('success');

    const result = await withRetry(mockFn, {
      maxAttempts: 2,
      baseDelay: 1000,
      backoffFactor: 10,
      maxDelay: 50 // Should cap the delay
    });

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});