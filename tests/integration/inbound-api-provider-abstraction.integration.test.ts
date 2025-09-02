import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/inbound/route';
import { createServiceClient } from '@/lib/supabase/server';
import { ProviderFactory } from '@/lib/inbound/provider-factory';

// Mock dependencies
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/services/logging-service');
vi.mock('@/lib/services/error-handler');
vi.mock('@/lib/services/enhanced-email-processor');

describe('Inbound API Route with Provider Abstraction', () => {
  let mockSupabase: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { org_id: 'test-org-id', is_active: true },
        error: null,
      }),
      rpc: vi.fn().mockResolvedValue({ data: true }),
      insert: vi.fn().mockReturnThis(),
    };
    
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase);
    
    // Mock logging service
    const mockLoggingService = {
      logProcessingStep: vi.fn().mockResolvedValue(undefined),
      logSecurityEvent: vi.fn().mockResolvedValue(undefined),
    };
    
    vi.doMock('@/lib/services/logging-service', () => ({
      loggingService: mockLoggingService,
    }));
    
    // Mock error handler
    const mockErrorHandler = {
      executeWithRetry: vi.fn().mockImplementation((fn) => fn()),
      handleProcessingError: vi.fn().mockResolvedValue(undefined),
    };
    
    vi.doMock('@/lib/services/error-handler', () => ({
      errorHandler: mockErrorHandler,
    }));
    
    // Mock enhanced email processor
    vi.doMock('@/lib/services/enhanced-email-processor', () => ({
      enhancedEmailProcessor: {
        processEmailToTransaction: vi.fn().mockResolvedValue(undefined),
      },
    }));
  });

  afterEach(() => {
    ProviderFactory.clearCache();
  });

  it('should process Cloudflare email through provider abstraction', async () => {
    // Create a mock Cloudflare email payload
    const cloudflarePayload = {
      personalizations: [{
        to: [{ email: 'u_testorg@inbox.chiphi.ai' }]
      }],
      from: { email: 'sender@example.com' },
      subject: 'Test Receipt',
      content: [{
        type: 'text/plain',
        value: 'Test receipt content with $25.99 total'
      }]
    };

    // Mock provider verification and parsing
    const mockProvider = {
      getName: vi.fn().mockReturnValue('cloudflare'),
      verify: vi.fn().mockResolvedValue(true),
      parse: vi.fn().mockResolvedValue({
        alias: 'u_testorg@inbox.chiphi.ai',
        messageId: 'test-message-id',
        from: 'sender@example.com',
        to: 'u_testorg@inbox.chiphi.ai',
        subject: 'Test Receipt',
        text: 'Test receipt content with $25.99 total',
        receivedAt: new Date(),
      }),
    };

    // Mock ProviderFactory to return our mock provider
    vi.spyOn(ProviderFactory, 'getDefaultProvider').mockReturnValue(mockProvider as any);

    // Mock successful email storage
    mockSupabase.insert.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'test-email-id' },
        error: null,
      }),
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/inbound', {
      method: 'POST',
      body: JSON.stringify(cloudflarePayload),
      headers: {
        'content-type': 'application/json',
        'x-cloudflare-signature': 'test-signature',
      },
    });

    // Call the API route
    const response = await POST(request);
    const responseData = await response.json();

    // Verify response
    expect(response.status).toBe(200);
    expect(responseData.success).toBe(true);
    expect(responseData.emailId).toBe('test-email-id');
    expect(responseData.provider).toBe('cloudflare');
    expect(responseData.correlationId).toBeDefined();

    // Verify provider methods were called
    expect(mockProvider.verify).toHaveBeenCalledWith(request);
    expect(mockProvider.parse).toHaveBeenCalledWith(request);

    // Verify database operations
    expect(mockSupabase.from).toHaveBeenCalledWith('inbox_aliases');
    expect(mockSupabase.insert).toHaveBeenCalled();
  });

  it('should handle provider verification failure', async () => {
    // Mock provider that fails verification
    const mockProvider = {
      getName: vi.fn().mockReturnValue('cloudflare'),
      verify: vi.fn().mockResolvedValue(false),
      parse: vi.fn(),
    };

    vi.spyOn(ProviderFactory, 'getDefaultProvider').mockReturnValue(mockProvider as any);

    const request = new NextRequest('http://localhost:3000/api/inbound', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(401);
    expect(responseData.error).toBe('Invalid request signature');
    expect(mockProvider.verify).toHaveBeenCalled();
    expect(mockProvider.parse).not.toHaveBeenCalled();
  });

  it('should handle invalid recipient alias', async () => {
    const mockProvider = {
      getName: vi.fn().mockReturnValue('cloudflare'),
      verify: vi.fn().mockResolvedValue(true),
      parse: vi.fn().mockResolvedValue({
        alias: 'u_nonexistent@inbox.chiphi.ai',
        messageId: 'test-message-id',
        from: 'sender@example.com',
        to: 'u_nonexistent@inbox.chiphi.ai',
        subject: 'Test Receipt',
        text: 'Test receipt content',
      }),
    };

    vi.spyOn(ProviderFactory, 'getDefaultProvider').mockReturnValue(mockProvider as any);

    // Mock alias not found
    mockSupabase.single.mockResolvedValue({
      data: null,
      error: { message: 'No rows returned' },
    });

    const request = new NextRequest('http://localhost:3000/api/inbound', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(404);
    expect(responseData.error).toBe('Invalid recipient');
  });

  it('should handle duplicate email detection', async () => {
    const mockProvider = {
      getName: vi.fn().mockReturnValue('cloudflare'),
      verify: vi.fn().mockResolvedValue(true),
      parse: vi.fn().mockResolvedValue({
        alias: 'u_testorg@inbox.chiphi.ai',
        messageId: 'duplicate-message-id',
        from: 'sender@example.com',
        to: 'u_testorg@inbox.chiphi.ai',
        subject: 'Test Receipt',
        text: 'Test receipt content',
      }),
    };

    vi.spyOn(ProviderFactory, 'getDefaultProvider').mockReturnValue(mockProvider as any);

    // Mock existing email found (duplicate)
    mockSupabase.single
      .mockResolvedValueOnce({
        data: { org_id: 'test-org-id', is_active: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'existing-email-id', message_id: 'duplicate-message-id' },
        error: null,
      });

    const request = new NextRequest('http://localhost:3000/api/inbound', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.success).toBe(true);
    expect(responseData.message).toBe('Email already processed');
    expect(responseData.emailId).toBe('existing-email-id');
  });

  it('should handle rate limiting', async () => {
    const mockProvider = {
      getName: vi.fn().mockReturnValue('cloudflare'),
      verify: vi.fn().mockResolvedValue(true),
      parse: vi.fn().mockResolvedValue({
        alias: 'u_testorg@inbox.chiphi.ai',
        messageId: 'test-message-id',
        from: 'sender@example.com',
        to: 'u_testorg@inbox.chiphi.ai',
        subject: 'Test Receipt',
        text: 'Test receipt content',
      }),
    };

    vi.spyOn(ProviderFactory, 'getDefaultProvider').mockReturnValue(mockProvider as any);

    // Mock rate limit exceeded
    mockSupabase.rpc.mockResolvedValue({ data: false });

    const request = new NextRequest('http://localhost:3000/api/inbound', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(429);
    expect(responseData.error).toBe('Rate limit exceeded');
  });
});