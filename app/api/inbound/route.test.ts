import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock all dependencies
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { org_id: 'test-org-id', is_active: true },
      error: null,
    }),
    rpc: vi.fn().mockResolvedValue({ data: true }),
    insert: vi.fn().mockReturnThis(),
  })),
}));

vi.mock('@/lib/services/logging-service', () => ({
  loggingService: {
    logProcessingStep: vi.fn().mockResolvedValue(undefined),
    logSecurityEvent: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/services/error-handler', () => ({
  errorHandler: {
    executeWithRetry: vi.fn().mockImplementation((fn) => fn()),
    handleProcessingError: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/services/enhanced-email-processor', () => ({
  enhancedEmailProcessor: {
    processEmailToTransaction: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/inbound/provider-factory', () => ({
  getDefaultProvider: vi.fn(() => ({
    getName: () => 'cloudflare',
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
  })),
  ProviderFactory: {
    clearCache: vi.fn(),
  },
}));

vi.mock('@/lib/inbound/utils', () => ({
  normalizeAlias: vi.fn((alias) => alias.toLowerCase()),
  verifyIdempotency: vi.fn().mockResolvedValue({ isDuplicate: false }),
  enqueueProcessJob: vi.fn().mockResolvedValue({
    emailId: 'test-email-id',
    queued: true,
  }),
}));

vi.mock('@/lib/inbound/types', () => ({
  generateCorrelationId: vi.fn(() => 'test-correlation-id'),
  extractOrgSlugFromAlias: vi.fn(() => 'testorg'),
  createProcessingContext: vi.fn(),
  ProviderError: class extends Error {},
  ProviderVerificationError: class extends Error {
    constructor(provider: string) {
      super('Verification failed');
      this.provider = provider;
    }
    provider: string;
  },
  ProviderParsingError: class extends Error {
    constructor(provider: string) {
      super('Parsing failed');
      this.provider = provider;
    }
    provider: string;
  },
}));

describe('Inbound API Route with Provider Abstraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully process email through provider abstraction', async () => {
    const request = new NextRequest('http://localhost:3000/api/inbound', {
      method: 'POST',
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: 'u_testorg@inbox.chiphi.ai' }]
        }],
        from: { email: 'sender@example.com' },
        subject: 'Test Receipt',
        content: [{
          type: 'text/plain',
          value: 'Test receipt content with $25.99 total'
        }]
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.success).toBe(true);
    expect(responseData.emailId).toBe('test-email-id');
    expect(responseData.provider).toBe('cloudflare');
    expect(responseData.correlationId).toBe('test-correlation-id');
  });

  it('should handle GET requests with method not allowed', async () => {
    const request = new NextRequest('http://localhost:3000/api/inbound', {
      method: 'GET',
    });

    // Import the GET handler
    const { GET } = await import('./route');
    const response = await GET();
    const responseData = await response.json();

    expect(response.status).toBe(405);
    expect(responseData.error).toBe('Method not allowed');
  });
});