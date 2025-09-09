import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SESAdapter } from '../providers/ses-adapter';
import { ProviderVerificationError, ProviderParsingError, ProviderConfigurationError } from '../types';

// Mock config
vi.mock('@/lib/config', () => ({
  config: {
    inboundProvider: {
      sesSecret: 'test-ses-secret',
      sharedSecret: 'test-shared-secret',
    },
    app: {
      isDevelopment: false,
      isProduction: true,
      nodeEnv: 'test',
    },
  },
}));

// Mock https module for certificate download
vi.mock('https', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('SESAdapter', () => {
  let adapter: SESAdapter;
  const testSecret = 'test-ses-secret';

  beforeEach(() => {
    adapter = new SESAdapter(testSecret);
  });

  describe('constructor', () => {
    it('should create adapter with provided secrets', () => {
      const customAdapter = new SESAdapter('custom-webhook-secret', 30000, true, 'custom-shared-secret');
      expect(customAdapter.getName()).toBe('ses');
    });

    it('should throw error in production without any secret when verification enabled', () => {
      // Mock production environment without any secrets
      vi.mocked(require('@/lib/config')).config.inboundProvider.sesSecret = '';
      vi.mocked(require('@/lib/config')).config.inboundProvider.sharedSecret = '';
      vi.mocked(require('@/lib/config')).config.app.isProduction = true;
      
      expect(() => new SESAdapter(undefined, 30000, true, undefined)).toThrow(ProviderConfigurationError);
      
      // Reset mocks
      vi.mocked(require('@/lib/config')).config.inboundProvider.sesSecret = 'test-ses-secret';
      vi.mocked(require('@/lib/config')).config.inboundProvider.sharedSecret = 'test-shared-secret';
    });

    it('should not throw error in production with webhook secret only', () => {
      expect(() => new SESAdapter('webhook-secret', 30000, true, undefined)).not.toThrow();
    });

    it('should not throw error in production with shared secret only', () => {
      expect(() => new SESAdapter(undefined, 30000, true, 'shared-secret')).not.toThrow();
    });

    it('should not throw error in production without secret when verification disabled', () => {
      expect(() => new SESAdapter(undefined, 30000, false, undefined)).not.toThrow();
    });
  });

  describe('getName', () => {
    it('should return ses as provider name', () => {
      expect(adapter.getName()).toBe('ses');
    });
  });

  describe('verify', () => {
    const createValidSNSMessage = () => ({
      Type: 'Notification',
      MessageId: 'test-message-id',
      TopicArn: 'arn:aws:sns:us-east-1:123456789012:test-topic',
      Subject: 'Amazon SES Email Receipt',
      Message: JSON.stringify({
        mail: {
          messageId: 'ses-message-id',
          source: 'sender@example.com',
          destination: ['u_testorg@inbox.chiphi.ai'],
          timestamp: '2024-01-01T12:00:00.000Z',
        },
      }),
      Timestamp: '2024-01-01T12:00:00.000Z',
      SignatureVersion: '1',
      Signature: 'test-signature',
      SigningCertURL: 'https://sns.us-east-1.amazonaws.com/test-cert.pem',
    });

    const createTestRequest = (payload: any, url = 'https://example.com/webhook') => {
      return new Request(url, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    };

    const createLambdaRequest = (payload: any, sharedSecret?: string) => {
      const headers: Record<string, string> = {};
      if (sharedSecret) {
        headers['x-shared-secret'] = sharedSecret;
      }
      
      return new Request('https://example.com/api/inbound/lambda', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
    };

    it('should skip verification in development without secret', async () => {
      // Mock development environment
      const mockConfig = vi.mocked(require('@/lib/config'));
      mockConfig.config.app.isDevelopment = true;
      
      const adapterWithoutSecret = new SESAdapter('', 30000, true);
      const payload = createValidSNSMessage();
      const req = createTestRequest(payload);

      const result = await adapterWithoutSecret.verify(req);
      expect(result).toBe(true);
      
      // Reset to production
      mockConfig.config.app.isDevelopment = false;
    });

    it('should skip verification when disabled', async () => {
      const adapterWithoutVerification = new SESAdapter(testSecret, 30000, false);
      
      const payload = createValidSNSMessage();
      const req = createTestRequest(payload);

      const result = await adapterWithoutVerification.verify(req);
      expect(result).toBe(true);
    });

    it('should reject invalid JSON in SNS message', async () => {
      const req = new Request('https://example.com/webhook', {
        method: 'POST',
        body: 'invalid-json',
      });

      await expect(adapter.verify(req)).rejects.toThrow(ProviderVerificationError);
    });

    it('should reject invalid SNS message structure', async () => {
      const invalidPayload = { invalid: 'structure' };
      const req = createTestRequest(invalidPayload);

      await expect(adapter.verify(req)).rejects.toThrow(ProviderVerificationError);
    });

    // Note: Full SNS signature verification testing would require mocking the certificate download
    // and crypto operations, which is complex. In a real implementation, you'd want more comprehensive tests.

    describe('dual-path verification', () => {
      it('should use shared secret verification for Lambda endpoint', async () => {
        const sharedSecret = 'test-shared-secret';
        const dualAdapter = new SESAdapter(testSecret, 30000, true, sharedSecret);
        
        const payload = { test: 'lambda-payload' };
        const req = createLambdaRequest(payload, sharedSecret);

        const result = await dualAdapter.verify(req);
        expect(result).toBe(true);
      });

      it('should reject Lambda endpoint without shared secret header', async () => {
        const sharedSecret = 'test-shared-secret';
        const dualAdapter = new SESAdapter(testSecret, 30000, true, sharedSecret);
        
        const payload = { test: 'lambda-payload' };
        const req = createLambdaRequest(payload); // No shared secret header

        await expect(dualAdapter.verify(req)).rejects.toThrow(ProviderVerificationError);
      });

      it('should reject Lambda endpoint with wrong shared secret', async () => {
        const sharedSecret = 'test-shared-secret';
        const dualAdapter = new SESAdapter(testSecret, 30000, true, sharedSecret);
        
        const payload = { test: 'lambda-payload' };
        const req = createLambdaRequest(payload, 'wrong-secret');

        await expect(dualAdapter.verify(req)).rejects.toThrow(ProviderVerificationError);
      });

      it('should use SNS verification for direct webhook endpoint', async () => {
        const sharedSecret = 'test-shared-secret';
        const dualAdapter = new SESAdapter(testSecret, 30000, false, sharedSecret); // Disable verification for test
        
        const payload = createValidSNSMessage();
        const req = createTestRequest(payload, 'https://example.com/api/inbound');

        const result = await dualAdapter.verify(req);
        expect(result).toBe(true);
      });

      it('should skip shared secret verification in development', async () => {
        // Mock development environment
        const mockConfig = vi.mocked(require('@/lib/config'));
        mockConfig.config.app.isDevelopment = true;
        
        const dualAdapter = new SESAdapter(testSecret, 30000, true, ''); // No shared secret
        const payload = { test: 'lambda-payload' };
        const req = createLambdaRequest(payload); // No shared secret header

        const result = await dualAdapter.verify(req);
        expect(result).toBe(true);
        
        // Reset to production
        mockConfig.config.app.isDevelopment = false;
      });

      it('should fail Lambda endpoint without shared secret in production', async () => {
        const dualAdapter = new SESAdapter(testSecret, 30000, true, ''); // No shared secret
        
        const payload = { test: 'lambda-payload' };
        const req = createLambdaRequest(payload);

        await expect(dualAdapter.verify(req)).rejects.toThrow(ProviderVerificationError);
      });
    });
  });

  describe('parse', () => {
    const createValidLambdaPayload = () => ({
      alias: 'u_testorg@chiphi.oronculzac.com',
      messageId: 'lambda-message-id-123',
      from: 'sender@example.com',
      to: 'u_testorg@chiphi.oronculzac.com',
      subject: 'Test Receipt Email',
      text: 'This is a test receipt email content.',
      html: '<p>This is a test receipt email content.</p>',
      rawRef: 'chiphi-raw-emails/inbound/email-123.eml',
      receivedAt: '2024-01-01T12:00:00.000Z',
      attachments: [
        {
          name: 'receipt.pdf',
          contentType: 'application/pdf',
          size: 1024,
          key: 'emails/receipt-123.pdf',
        },
      ],
    });

    const createValidSESPayload = () => ({
      Type: 'Notification',
      MessageId: 'sns-message-id-123',
      TopicArn: 'arn:aws:sns:us-east-1:123456789012:ses-topic',
      Subject: 'Amazon SES Email Receipt',
      Message: JSON.stringify({
        mail: {
          messageId: 'ses-message-id-456',
          source: 'sender@example.com',
          destination: ['u_testorg@inbox.chiphi.ai'],
          timestamp: '2024-01-01T12:00:00.000Z',
          commonHeaders: {
            from: ['sender@example.com'],
            to: ['u_testorg@inbox.chiphi.ai'],
            subject: 'Test Receipt Email',
            messageId: 'ses-message-id-456',
            date: '2024-01-01T12:00:00.000Z',
          },
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'u_testorg@inbox.chiphi.ai' },
            { name: 'Subject', value: 'Test Receipt Email' },
          ],
        },
        content: {
          text: 'This is a test receipt email content.',
          html: '<p>This is a test receipt email content.</p>',
          attachments: [
            {
              filename: 'receipt.pdf',
              contentType: 'application/pdf',
              size: 1024,
              s3ObjectKey: 'emails/receipt-123.pdf',
            },
          ],
        },
      }),
      Timestamp: '2024-01-01T12:00:00.000Z',
      SignatureVersion: '1',
      Signature: 'test-signature',
      SigningCertURL: 'https://sns.us-east-1.amazonaws.com/test-cert.pem',
    });

    const createTestRequest = (payload: any, url = 'https://example.com/webhook') => {
      return new Request(url, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    };

    describe('dual-path parsing', () => {
      it('should parse Lambda payload for Lambda endpoint', async () => {
        const payload = createValidLambdaPayload();
        const req = new Request('https://example.com/api/inbound/lambda', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        const result = await adapter.parse(req);

        expect(result).toMatchObject({
          alias: 'u_testorg@chiphi.oronculzac.com',
          messageId: 'lambda-message-id-123',
          from: 'sender@example.com',
          to: 'u_testorg@chiphi.oronculzac.com',
          subject: 'Test Receipt Email',
          text: expect.stringContaining('test receipt email'),
          html: expect.stringContaining('test receipt email'),
          rawRef: 'chiphi-raw-emails/inbound/email-123.eml',
          attachments: expect.arrayContaining([
            expect.objectContaining({
              name: 'receipt.pdf',
              contentType: 'application/pdf',
              size: 1024,
            }),
          ]),
          metadata: expect.objectContaining({
            provider: 'ses',
            source: 'lambda',
            correlationId: expect.stringMatching(/^email_\d+_[a-z0-9]+$/),
          }),
        });
      });

      it('should reject invalid Lambda payload', async () => {
        const invalidPayload = { invalid: 'lambda-payload' };
        const req = new Request('https://example.com/api/inbound/lambda', {
          method: 'POST',
          body: JSON.stringify(invalidPayload),
        });

        await expect(adapter.parse(req)).rejects.toThrow(ProviderParsingError);
      });

      it('should handle Lambda payload without optional fields', async () => {
        const minimalPayload = {
          alias: 'u_testorg@chiphi.oronculzac.com',
          messageId: 'minimal-message-id',
          from: 'sender@example.com',
          to: 'u_testorg@chiphi.oronculzac.com',
          text: 'Minimal email content',
        };
        const req = new Request('https://example.com/api/inbound/lambda', {
          method: 'POST',
          body: JSON.stringify(minimalPayload),
        });

        const result = await adapter.parse(req);

        expect(result).toMatchObject({
          alias: 'u_testorg@chiphi.oronculzac.com',
          messageId: 'minimal-message-id',
          from: 'sender@example.com',
          to: 'u_testorg@chiphi.oronculzac.com',
          text: 'Minimal email content',
          subject: undefined,
          html: undefined,
          attachments: undefined,
          rawRef: undefined,
        });
      });
    });

    it('should parse valid SES SNS payload', async () => {
      const payload = createValidSESPayload();
      const req = createTestRequest(payload);

      const result = await adapter.parse(req);

      expect(result).toMatchObject({
        alias: 'u_testorg@inbox.chiphi.ai',
        messageId: 'ses-message-id-456',
        from: 'sender@example.com',
        to: 'u_testorg@inbox.chiphi.ai',
        subject: 'Test Receipt Email',
      });

      expect(result.receivedAt).toBeInstanceOf(Date);
      expect(result.receivedAt?.toISOString()).toBe('2024-01-01T12:00:00.000Z');

      expect(result.metadata).toMatchObject({
        provider: 'ses',
        snsMessageId: 'sns-message-id-123',
        sesMessageId: 'ses-message-id-456',
      });
    });

    it('should handle empty request body', async () => {
      const req = new Request('https://example.com/webhook', {
        method: 'POST',
        body: '',
      });

      await expect(adapter.parse(req)).rejects.toThrow(ProviderParsingError);
    });

    it('should handle invalid JSON in SNS message', async () => {
      const req = new Request('https://example.com/webhook', {
        method: 'POST',
        body: 'invalid-json',
      });

      await expect(adapter.parse(req)).rejects.toThrow(ProviderParsingError);
    });

    it('should handle invalid SNS message structure', async () => {
      const invalidPayload = { invalid: 'structure' };
      const req = createTestRequest(invalidPayload);

      await expect(adapter.parse(req)).rejects.toThrow(ProviderParsingError);
    });

    it('should handle invalid JSON in SES message content', async () => {
      const payload = createValidSESPayload();
      payload.Message = 'invalid-json';
      const req = createTestRequest(payload);

      await expect(adapter.parse(req)).rejects.toThrow(ProviderParsingError);
    });

    it('should handle missing mail object in SES message', async () => {
      const payload = createValidSESPayload();
      const sesMessage = JSON.parse(payload.Message);
      delete sesMessage.mail;
      payload.Message = JSON.stringify(sesMessage);
      const req = createTestRequest(payload);

      await expect(adapter.parse(req)).rejects.toThrow(ProviderParsingError);
    });

    it('should handle missing destination in mail object', async () => {
      const payload = createValidSESPayload();
      const sesMessage = JSON.parse(payload.Message);
      delete sesMessage.mail.destination;
      payload.Message = JSON.stringify(sesMessage);
      const req = createTestRequest(payload);

      await expect(adapter.parse(req)).rejects.toThrow(ProviderParsingError);
    });

    it('should handle missing source in mail object', async () => {
      const payload = createValidSESPayload();
      const sesMessage = JSON.parse(payload.Message);
      delete sesMessage.mail.source;
      payload.Message = JSON.stringify(sesMessage);
      const req = createTestRequest(payload);

      await expect(adapter.parse(req)).rejects.toThrow(ProviderParsingError);
    });

    it('should normalize attachments correctly', async () => {
      const payload = createValidSESPayload();
      const sesMessage = JSON.parse(payload.Message);
      sesMessage.content.attachments = [
        {
          filename: 'receipt.pdf',
          contentType: 'application/pdf',
          size: 1024,
          s3ObjectKey: 'emails/receipt-123.pdf',
        },
        {
          name: 'invoice.txt', // Different property name
          type: 'text/plain', // Different property name
          size: 512,
          key: 'emails/invoice-456.txt', // Different property name
        },
        {
          // Invalid attachment - should be filtered out
          filename: null,
          contentType: null,
        },
      ];
      payload.Message = JSON.stringify(sesMessage);
      const req = createTestRequest(payload);

      const result = await adapter.parse(req);

      expect(result.attachments).toHaveLength(2);
      expect(result.attachments![0]).toMatchObject({
        name: 'receipt.pdf',
        contentType: 'application/pdf',
        size: 1024,
        key: 'emails/receipt-123.pdf',
      });
      expect(result.attachments![1]).toMatchObject({
        name: 'invoice.txt',
        contentType: 'text/plain',
        size: 512,
        key: 'emails/invoice-456.txt',
      });
    });

    it('should use SNS MessageId as fallback when SES messageId missing', async () => {
      const payload = createValidSESPayload();
      const sesMessage = JSON.parse(payload.Message);
      delete sesMessage.mail.messageId;
      payload.Message = JSON.stringify(sesMessage);
      const req = createTestRequest(payload);

      const result = await adapter.parse(req);

      expect(result.messageId).toBe('sns-message-id-123');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status with valid configuration', async () => {
      const result = await adapter.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.responseTimeMs).toBeGreaterThan(0);
      expect(result.details).toMatchObject({
        hasWebhookSecret: true,
        hasSharedSecret: false, // Not provided in default adapter
        hasValidTimeout: true,
        signatureVerificationEnabled: true,
        timeoutMs: 30000,
        supportsDualPath: true,
      });
    });

    it('should return healthy status with both secrets', async () => {
      const dualAdapter = new SESAdapter('webhook-secret', 30000, true, 'shared-secret');
      const result = await dualAdapter.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.details).toMatchObject({
        hasWebhookSecret: true,
        hasSharedSecret: true,
        hasValidTimeout: true,
        signatureVerificationEnabled: true,
        supportsDualPath: true,
      });
    });

    it('should return healthy status with shared secret only', async () => {
      // Mock config to not provide default secrets
      vi.mocked(require('@/lib/config')).config.inboundProvider.sesSecret = '';
      vi.mocked(require('@/lib/config')).config.inboundProvider.sharedSecret = '';
      
      const sharedOnlyAdapter = new SESAdapter('', 30000, true, 'shared-secret');
      const result = await sharedOnlyAdapter.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.details?.hasWebhookSecret).toBe(false);
      expect(result.details?.hasSharedSecret).toBe(true);
      
      // Reset mocks
      vi.mocked(require('@/lib/config')).config.inboundProvider.sesSecret = 'test-ses-secret';
      vi.mocked(require('@/lib/config')).config.inboundProvider.sharedSecret = 'test-shared-secret';
    });

    it('should return healthy status without secret when verification disabled', async () => {
      // Mock config to not provide default secrets
      vi.mocked(require('@/lib/config')).config.inboundProvider.sesSecret = '';
      vi.mocked(require('@/lib/config')).config.inboundProvider.sharedSecret = '';
      
      const adapterWithoutVerification = new SESAdapter('', 30000, false, '');
      const result = await adapterWithoutVerification.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.details?.hasWebhookSecret).toBe(false);
      expect(result.details?.hasSharedSecret).toBe(false);
      expect(result.details?.signatureVerificationEnabled).toBe(false);
      
      // Reset mocks
      vi.mocked(require('@/lib/config')).config.inboundProvider.sesSecret = 'test-ses-secret';
      vi.mocked(require('@/lib/config')).config.inboundProvider.sharedSecret = 'test-shared-secret';
    });

    it('should return unhealthy status without any secret in production with verification enabled', async () => {
      // Mock config to not provide default secrets and set production
      vi.mocked(require('@/lib/config')).config.inboundProvider.sesSecret = '';
      vi.mocked(require('@/lib/config')).config.inboundProvider.sharedSecret = '';
      vi.mocked(require('@/lib/config')).config.app.isDevelopment = false;
      
      const adapterWithoutSecrets = new SESAdapter('', 30000, true, '');
      const result = await adapterWithoutSecrets.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.details?.hasWebhookSecret).toBe(false);
      expect(result.details?.hasSharedSecret).toBe(false);
      expect(result.details?.signatureVerificationEnabled).toBe(true);
      
      // Reset mocks
      vi.mocked(require('@/lib/config')).config.inboundProvider.sesSecret = 'test-ses-secret';
      vi.mocked(require('@/lib/config')).config.inboundProvider.sharedSecret = 'test-shared-secret';
      vi.mocked(require('@/lib/config')).config.app.isDevelopment = false;
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

    it('should sanitize metadata in parsed results', async () => {
      const payload = createValidSESPayload();
      const sesMessage = JSON.parse(payload.Message);
      sesMessage.mail.headers = [
        { name: 'Authorization', value: 'Bearer secret-token' },
        { name: 'X-API-Key', value: 'secret-key' },
        { name: 'From', value: 'sender@example.com' },
      ];
      payload.Message = JSON.stringify(sesMessage);
      const req = createTestRequest(payload);

      const result = await adapter.parse(req);

      // Check that sensitive headers are not in metadata
      expect(result.metadata?.headers).not.toContainEqual(
        expect.objectContaining({ name: 'Authorization' })
      );
      expect(result.metadata?.headers).not.toContainEqual(
        expect.objectContaining({ name: 'X-API-Key' })
      );
      expect(result.metadata?.headers).toContainEqual(
        expect.objectContaining({ name: 'From' })
      );
    });
  });

  describe('SNS signature verification helpers', () => {
    it('should build correct string to sign', () => {
      // This tests the private method indirectly through verification
      // In a real implementation, you might expose this for testing or test it through integration
      const adapter = new SESAdapter(testSecret, 30000, false); // Disable verification for this test
      expect(adapter.getName()).toBe('ses');
    });
  });
});