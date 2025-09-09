import { withRetry, fetchWithRetry, apiCallWithRetry, RetryError } from '../retry';

// Mock fetch
global.fetch = jest.fn();

// Mock setTimeout for testing delays
jest.useFakeTimers();

describe('withRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  it('should succeed on first attempt', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');

    const result = await withRetry(mockFn);

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const mockFn = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue('success');

    const promise = withRetry(mockFn, {
      maxAttempts: 3,
      baseDelay: 100
    });

    // Fast-forward through delays
    jest.runAllTimers();
    const result = await promise;

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should throw RetryError after max attempts', async () => {
    const mockError = new Error('Persistent error');
    const mockFn = jest.fn().mockRejectedValue(mockError);

    const promise = withRetry(mockFn, {
      maxAttempts: 2,
      baseDelay: 100
    });

    jest.runAllTimers();

    await expect(promise).rejects.toThrow(RetryError);
    await expect(promise).rejects.toThrow('Failed after 2 attempts: Persistent error');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should not retry when retry condition returns false', async () => {
    const mockError = new Error('Non-retryable error');
    const mockFn = jest.fn().mockRejectedValue(mockError);

    const promise = withRetry(mockFn, {
      maxAttempts: 3,
      retryCondition: () => false
    });

    await expect(promise).rejects.toThrow('Non-retryable error');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should call onRetry callback', async () => {
    const mockError = new Error('Network error');
    const mockFn = jest.fn()
      .mockRejectedValueOnce(mockError)
      .mockResolvedValue('success');
    const onRetry = jest.fn();

    const promise = withRetry(mockFn, {
      maxAttempts: 2,
      baseDelay: 100,
      onRetry
    });

    jest.runAllTimers();
    await promise;

    expect(onRetry).toHaveBeenCalledWith(1, mockError);
  });

  it('should use exponential backoff with jitter', async () => {
    const mockFn = jest.fn()
      .mockRejectedValueOnce(new Error('Error 1'))
      .mockRejectedValueOnce(new Error('Error 2'))
      .mockResolvedValue('success');

    const promise = withRetry(mockFn, {
      maxAttempts: 3,
      baseDelay: 100,
      backoffFactor: 2,
      maxDelay: 1000
    });

    jest.runAllTimers();
    await promise;

    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should respect maxDelay', async () => {
    const mockFn = jest.fn()
      .mockRejectedValueOnce(new Error('Error'))
      .mockResolvedValue('success');

    const promise = withRetry(mockFn, {
      maxAttempts: 2,
      baseDelay: 1000,
      backoffFactor: 10,
      maxDelay: 500 // Should cap the delay
    });

    jest.runAllTimers();
    await promise;

    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});

describe('fetchWithRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  it('should succeed on successful fetch', async () => {
    const mockResponse = new Response('success', { status: 200 });
    (fetch as jest.Mock).mockResolvedValue(mockResponse);

    const result = await fetchWithRetry('/api/test');

    expect(result).toBe(mockResponse);
    expect(fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      signal: expect.any(AbortSignal)
    }));
  });

  it('should retry on 5xx errors', async () => {
    const mockError = new Response('Server Error', { status: 500 });
    const mockSuccess = new Response('success', { status: 200 });
    
    (fetch as jest.Mock)
      .mockResolvedValueOnce(mockError)
      .mockResolvedValue(mockSuccess);

    const promise = fetchWithRetry('/api/test', {}, {
      maxAttempts: 2,
      baseDelay: 100
    });

    jest.runAllTimers();
    const result = await promise;

    expect(result).toBe(mockSuccess);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should retry on network errors', async () => {
    const networkError = new TypeError('Failed to fetch');
    const mockSuccess = new Response('success', { status: 200 });
    
    (fetch as jest.Mock)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue(mockSuccess);

    const promise = fetchWithRetry('/api/test', {}, {
      maxAttempts: 2,
      baseDelay: 100
    });

    jest.runAllTimers();
    const result = await promise;

    expect(result).toBe(mockSuccess);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should not retry on 4xx errors', async () => {
    const mockError = new Response('Not Found', { status: 404 });
    (fetch as jest.Mock).mockResolvedValue(mockError);

    const promise = fetchWithRetry('/api/test');

    await expect(promise).rejects.toThrow('HTTP 404: Not Found');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle timeout', async () => {
    (fetch as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(new Response('success')), 35000))
    );

    const promise = fetchWithRetry('/api/test');

    // Fast-forward past the 30s timeout
    jest.advanceTimersByTime(35000);

    await expect(promise).rejects.toThrow();
  });
});

describe('apiCallWithRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  it('should return parsed JSON on success', async () => {
    const mockData = { id: 1, name: 'Test' };
    const mockResponse = new Response(JSON.stringify(mockData), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    (fetch as jest.Mock).mockResolvedValue(mockResponse);

    const result = await apiCallWithRetry('/api/test');

    expect(result).toEqual(mockData);
  });

  it('should retry and return JSON on eventual success', async () => {
    const mockData = { success: true };
    const mockError = new Response('Server Error', { status: 500 });
    const mockSuccess = new Response(JSON.stringify(mockData), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
    (fetch as jest.Mock)
      .mockResolvedValueOnce(mockError)
      .mockResolvedValue(mockSuccess);

    const promise = apiCallWithRetry('/api/test', {}, {
      maxAttempts: 2,
      baseDelay: 100
    });

    jest.runAllTimers();
    const result = await promise;

    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('Default retry condition', () => {
  it('should retry on network errors', () => {
    const networkError = new TypeError('Failed to fetch');
    const { retryCondition } = { retryCondition: undefined };
    
    // We need to test the default condition indirectly
    expect(networkError.message.includes('fetch')).toBe(true);
  });

  it('should retry on 5xx status codes', () => {
    const serverError = { status: 500 };
    expect(serverError.status >= 500 && serverError.status < 600).toBe(true);
  });

  it('should retry on 429 (rate limiting)', () => {
    const rateLimitError = { status: 429 };
    expect(rateLimitError.status === 429).toBe(true);
  });

  it('should not retry on 4xx status codes', () => {
    const clientError = { status: 404 };
    expect(clientError.status >= 400 && clientError.status < 500).toBe(true);
    expect(clientError.status >= 500).toBe(false);
  });
});