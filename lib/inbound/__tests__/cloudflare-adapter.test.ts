import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { CloudflareAdapter } from '../providers/cloudflare-adapter';
import { ProviderVerificationError, ProviderParsingError, ProviderConfigurationError } from '../types';

// Mock config
vi.mock('@/lib/config', () => ({
  config: {
    inboundProvider: {
      cloudflareSecret: 'test-secret-key',
    },
    app: {
      isDevelopment: true,
      isProduction: false,
      nodeEnv: 'test',
    },
  },
}));

// Helper functions
const createValidCloudflarePayload = () => ({
  personalizations: [{
    to: [{
      email: 'u_testorg@inbox.chiphi.ai',
      name: 'Test User',
    }],
  }],
  from: {
    email: 'sender@example.com',
    name: 'Test Sender',
  },
  subject: 'Test Receipt',
  content: [
    {
      type: 'text/plain',
      value: 'This is a test receipt email.',
    },
    {
      type: 'text/html',
      value: '<p>This is a test receipt email.</p>',
    },
  ],
  headers: {
    'message-id': 'test-message-id-123',
  },
  attachments: [
    {
      filename: 'receipt.pdf',
      type: 'application/pdf',
      content: 'base64-encoded-content',
      disposition: 'attachment',
    },
  ],
});

const createTestRequest = (payload: any) => {
  return new Request('https://example.com/webhook', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

describe('CloudflareAdapter', () => {
  let adapter: CloudflareAdapter;
  const testSecret = 'test-secret-key';

  beforeEach(() => {
    adapter = new CloudflareAdapter(testSecret);
  });

  describe('constructor', () => {
    it('should create adapter with provided secret', () => {
      const customAdapter = new CloudflareAdapter('custom-secret');
      expect(customAdapter.getName()).toBe('cloudflare');
    });

    it('should create adapter without secret in development', () => {
      // This should work in development mode
      const devAdapter = new CloudflareAdapter('');
      expect(devAdapter.getName()).toBe('cloudflare');
    });
  });

  describe('getName', () => {
    it('should return cloudflare as provider name', () => {
      expect(adapter.getName()).toBe('cloudflare');
    });
  });

  describe('verify', () => {
    const createTestRequest = (body: string, signature?: string) => {
      const headers = new Headers();
      if (signature) {
        headers.set('x-cloudflare-signature', signature);
      }
      
      return new Request('https://example.com/webhook', {
        method: 'POST',
        headers,
        body,
      });
    };

    const generateValidSignature = (body: string) => {
      return crypto
        .createHmac('sha256', testSecret)
        .update(body, 'utf8')
        .digest('hex');
    };

    it('should verify valid HMAC signature', async () => {
      const body = JSON.stringify({ test: 'data' });
      const signature = generateValidSignature(body);
      const req = createTestRequest(body, signature);

      const result = await adapter.verify(req);
      expect(result).toBe(true);
    });

    it('should reject invalid HMAC signature', async () => {
      const body = JSON.stringify({ test: 'data' });
      const req = createTestRequest(body, 'invalid-signature');

      await expect(adapter.verify(req)).rejects.toThrow(ProviderVerificationError);
    });

    it('should reject missing signature header', async () => {
      const body = JSON.stringify({ test: 'data' });
      const req = createTestRequest(body);

      await expect(adapter.verify(req)).rejects.toThrow(ProviderVerificationError);
    });

    it('should handle verification errors gracefully', async () => {
      const body = JSON.stringify({ test: 'data' });
      const req = createTestRequest(body, 'short'); // Too short for hex comparison

      await expect(adapter.verify(req)).rejects.toThrow(ProviderVerificationError);
    });
  });

  describe('parse', () => {
    const createTestRequest = (payload: any) => {
      return new Request('https://example.com/webhook', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    };

    it('should parse valid Cloudflare payload', async () => {
      const payload = createValidCloudflarePayload();
      const req = createTestRequest(payload);

      const result = await adapter.parse(req);

      expect(result).toMatchObject({
        alias: 'u_testorg@inbox.chiphi.ai',
        messageId: 'test-message-id-123',
        from: 'sender@example.com',
        to: 'u_testorg@inbox.chiphi.ai',
        subject: 'Test Receipt',
        text: 'This is a test receipt email.',
        html: '<p>This is a test receipt email.</p>',
      });

      expect(result.attachments).toHaveLength(1);
      expect(result.attachments![0]).toMatchObject({
        name: 'receipt.pdf',
        contentType: 'application/pdf',
      });

      expect(result.metadata).toMatchObject({
        provider: 'cloudflare',
      });
    });

    it('should handle missing recipient email', async () => {
      const payload = createValidCloudflarePayload();
      delete payload.personalizations[0].to;
      const req = createTestRequest(payload);

      await expect(adapter.parse(req)).rejects.toThrow(ProviderParsingError);
    });

    it('should handle missing sender email', async () => {
      const payload = createValidCloudflarePayload();
      delete payload.from.email;
      const req = createTestRequest(payload);

      await expect(adapter.parse(req)).rejects.toThrow(ProviderParsingError);
    });

    it('should handle empty request body', async () => {
      const req = new Request('https://example.com/webhook', {
        method: 'POST',
        body: '',
      });

      await expect(adapter.parse(req)).rejects.toThrow(ProviderParsingError);
    });

    it('should handle invalid JSON', async () => {
      const req = new Request('https://example.com/webhook', {
        method: 'POST',
        body: 'invalid-json',
      });

      await expect(adapter.parse(req)).rejects.toThrow(ProviderParsingError);
    });

    it('should generate message ID when not provided', async () => {
      const payload = createValidCloudflarePayload();
      delete payload.headers;
      const req = createTestRequest(payload);

      const result = await adapter.parse(req);

      expect(result.messageId).toMatch(/^cf_\d+_[a-z0-9]+$/);
    });

    it('should handle payload without content', async () => {
      const payload = createValidCloudflarePayload();
      delete payload.content;
      const req = createTestRequest(payload);

      await expect(adapter.parse(req)).rejects.toThrow(ProviderParsingError);
    });

    it('should normalize attachments correctly', async () => {
      const payload = createValidCloudflarePayload();
      payload.attachments = [
        {
          filename: 'test.txt',
          type: 'text/plain',
          content: 'dGVzdA==', // "test" in base64
          disposition: 'attachment',
        },
      ];
      const req = createTestRequest(payload);

      const result = await adapter.parse(req);

      expect(result.attachments).toHaveLength(1);
      expect(result.attachments![0]).toMatchObject({
        name: 'test.txt',
        contentType: 'text/plain',
        size: 3, // Calculated from base64
      });
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status with valid configuration', async () => {
      const result = await adapter.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.responseTimeMs).toBeGreaterThan(0);
      expect(result.details).toMatchObject({
        hasSecret: true,
        hasValidTimeout: true,
        timeoutMs: 30000,
      });
    });

    it('should return correct secret status', async () => {
      const adapterWithoutSecret = new CloudflareAdapter('');
      const result = await adapterWithoutSecret.healthCheck();

      expect(result.healthy).toBe(true); // Should be healthy in development
      expect(result.details?.hasSecret).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should include correlation ID in parsing errors', async () => {
      const req = new Request('https://example.com/webhook', {
        method: 'POST',
        body: 'invalid-json',
      });

      try {
        await adapter.parse(req);
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderParsingError);
        expect((error as ProviderParsingError).details?.correlationId).toMatch(/^email_\d+_[a-z0-9]+$/);
      }
    });

    it('should sanitize metadata in error details', async () => {
      const payload = createValidCloudflarePayload();
      payload.headers = {
        'authorization': 'Bearer secret-token',
        'x-api-key': 'secret-key',
        'message-id': 'test-id',
      };
      const req = createTestRequest(payload);

      const result = await adapter.parse(req);

      // Check that sensitive headers are not in metadata
      expect(result.metadata?.headers).not.toHaveProperty('authorization');
      expect(result.metadata?.headers).not.toHaveProperty('x-api-key');
      expect(result.metadata?.headers).toHaveProperty('message-id');
    });
  });
});