import { describe, it, expect, vi } from 'vitest';
import { CloudflareAdapter, SESAdapter, ProviderFactory } from '../providers';
import { ProviderVerificationError, ProviderParsingError } from '../types';

// Mock config
vi.mock('@/lib/config', () => ({
  config: {
    inboundProvider: {
      provider: 'cloudflare',
      cloudflareSecret: 'test-cloudflare-secret',
      sesSecret: 'test-ses-secret',
    },
    app: {
      isDevelopment: true,
      isProduction: false,
      nodeEnv: 'test',
    },
  },
}));

describe('Provider Integration Tests', () => {
  describe('CloudflareAdapter Integration', () => {
    it('should handle complete Cloudflare email processing workflow', async () => {
      const adapter = new CloudflareAdapter('test-secret');
      
      const cloudflarePayload = {
        personalizations: [{
          to: [{
            email: 'u_testorg@inbox.chiphi.ai',
            name: 'Test User',
          }],
        }],
        from: {
          email: 'receipt@store.com',
          name: 'Store Receipt',
        },
        subject: 'Your Receipt #12345',
        content: [
          {
            type: 'text/plain',
            value: 'Thank you for your purchase. Total: $25.99',
          },
          {
            type: 'text/html',
            value: '<p>Thank you for your purchase. Total: <strong>$25.99</strong></p>',
          },
        ],
        headers: {
          'message-id': 'cf-msg-12345',
        },
      };

      const request = new Request('https://example.com/webhook', {
        method: 'POST',
        body: JSON.stringify(cloudflarePayload),
      });

      // Test parsing
      const result = await adapter.parse(request);

      expect(result).toMatchObject({
        alias: 'u_testorg@inbox.chiphi.ai',
        messageId: 'cf-msg-12345',
        from: 'receipt@store.com',
        to: 'u_testorg@inbox.chiphi.ai',
        subject: 'Your Receipt #12345',
        text: 'Thank you for your purchase. Total: $25.99',
        html: '<p>Thank you for your purchase. Total: <strong>$25.99</strong></p>',
      });

      expect(result.metadata?.provider).toBe('cloudflare');
      expect(result.receivedAt).toBeInstanceOf(Date);
    });

    it('should handle Cloudflare payload with attachments', async () => {
      const adapter = new CloudflareAdapter('test-secret');
      
      const payloadWithAttachments = {
        personalizations: [{
          to: [{ email: 'u_testorg@inbox.chiphi.ai' }],
        }],
        from: { email: 'receipt@store.com' },
        subject: 'Receipt with PDF',
        content: [
          { type: 'text/plain', value: 'Receipt attached.' },
        ],
        attachments: [
          {
            filename: 'receipt.pdf',
            type: 'application/pdf',
            content: 'JVBERi0xLjQK', // Base64 PDF header
            disposition: 'attachment',
          },
        ],
      };

      const request = new Request('https://example.com/webhook', {
        method: 'POST',
        body: JSON.stringify(payloadWithAttachments),
      });

      const result = await adapter.parse(request);

      expect(result.attachments).toHaveLength(1);
      expect(result.attachments![0]).toMatchObject({
        name: 'receipt.pdf',
        contentType: 'application/pdf',
        size: expect.any(Number),
      });
    });
  });

  describe('SESAdapter Integration', () => {
    it('should handle complete SES email processing workflow', async () => {
      const adapter = new SESAdapter('test-secret', 30000, false); // Disable signature verification for test
      
      const sesPayload = {
        Type: 'Notification',
        MessageId: 'sns-msg-12345',
        TopicArn: 'arn:aws:sns:us-east-1:123456789012:ses-topic',
        Subject: 'Amazon SES Email Receipt',
        Message: JSON.stringify({
          mail: {
            messageId: 'ses-msg-67890',
            source: 'receipt@store.com',
            destination: ['u_testorg@inbox.chiphi.ai'],
            timestamp: '2024-01-15T10:30:00.000Z',
            commonHeaders: {
              from: ['receipt@store.com'],
              to: ['u_testorg@inbox.chiphi.ai'],
              subject: 'Your Receipt #67890',
              messageId: 'ses-msg-67890',
              date: '2024-01-15T10:30:00.000Z',
            },
          },
          content: {
            text: 'Thank you for your purchase. Total: $45.99',
            html: '<p>Thank you for your purchase. Total: <strong>$45.99</strong></p>',
          },
        }),
        Timestamp: '2024-01-15T10:30:00.000Z',
        SignatureVersion: '1',
        Signature: 'test-signature',
        SigningCertURL: 'https://sns.us-east-1.amazonaws.com/test-cert.pem',
      };

      const request = new Request('https://example.com/webhook', {
        method: 'POST',
        body: JSON.stringify(sesPayload),
      });

      // Test parsing
      const result = await adapter.parse(request);

      expect(result).toMatchObject({
        alias: 'u_testorg@inbox.chiphi.ai',
        messageId: 'ses-msg-67890',
        from: 'receipt@store.com',
        to: 'u_testorg@inbox.chiphi.ai',
        subject: 'Your Receipt #67890',
      });

      expect(result.metadata?.provider).toBe('ses');
      expect(result.metadata?.snsMessageId).toBe('sns-msg-12345');
      expect(result.receivedAt).toBeInstanceOf(Date);
      expect(result.receivedAt?.toISOString()).toBe('2024-01-15T10:30:00.000Z');
    });
  });

  describe('Provider Factory Integration', () => {
    it('should create and use providers through factory', async () => {
      const cloudflareProvider = ProviderFactory.createProvider('cloudflare', {
        webhookSecret: 'test-cf-secret',
      });

      const sesProvider = ProviderFactory.createProvider('ses', {
        webhookSecret: 'test-ses-secret',
        verifySignature: false,
      });

      expect(cloudflareProvider.getName()).toBe('cloudflare');
      expect(sesProvider.getName()).toBe('ses');

      // Test health checks
      const cfHealth = await cloudflareProvider.healthCheck?.();
      const sesHealth = await sesProvider.healthCheck?.();

      expect(cfHealth?.healthy).toBe(true);
      expect(sesHealth?.healthy).toBe(true);
    });

    it('should support provider switching', () => {
      const providers = ['cloudflare', 'ses'];
      
      providers.forEach(providerName => {
        const provider = ProviderFactory.createProvider(providerName);
        expect(provider.getName()).toBe(providerName);
        expect(ProviderFactory.isProviderSupported(providerName)).toBe(true);
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle malformed Cloudflare payloads gracefully', async () => {
      const adapter = new CloudflareAdapter('test-secret');
      
      const malformedPayload = {
        // Missing required fields
        from: { email: 'test@example.com' },
        subject: 'Test',
      };

      const request = new Request('https://example.com/webhook', {
        method: 'POST',
        body: JSON.stringify(malformedPayload),
      });

      await expect(adapter.parse(request)).rejects.toThrow(ProviderParsingError);
    });

    it('should handle malformed SES payloads gracefully', async () => {
      const adapter = new SESAdapter('test-secret', 30000, false);
      
      const malformedPayload = {
        Type: 'Notification',
        MessageId: 'test-id',
        // Missing required SNS fields
      };

      const request = new Request('https://example.com/webhook', {
        method: 'POST',
        body: JSON.stringify(malformedPayload),
      });

      await expect(adapter.parse(request)).rejects.toThrow(ProviderParsingError);
    });

    it('should include correlation IDs in error contexts', async () => {
      const adapter = new CloudflareAdapter('test-secret');
      
      const request = new Request('https://example.com/webhook', {
        method: 'POST',
        body: 'invalid-json',
      });

      try {
        await adapter.parse(request);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderParsingError);
        expect((error as ProviderParsingError).details?.correlationId).toMatch(/^email_\d+_[a-z0-9]+$/);
      }
    });
  });

  describe('Provider Health Checks', () => {
    it('should perform health checks on all providers', async () => {
      const providers = [
        ProviderFactory.createProvider('cloudflare'),
        ProviderFactory.createProvider('ses', { verifySignature: false }),
      ];

      for (const provider of providers) {
        if ('healthCheck' in provider && typeof provider.healthCheck === 'function') {
          const health = await provider.healthCheck();
          
          expect(health).toMatchObject({
            healthy: expect.any(Boolean),
            responseTimeMs: expect.any(Number),
            details: expect.any(Object),
          });
          
          expect(health.responseTimeMs).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Payload Normalization', () => {
    it('should normalize different provider formats to consistent structure', async () => {
      const cloudflareAdapter = new CloudflareAdapter('test-secret');
      const sesAdapter = new SESAdapter('test-secret', 30000, false);

      // Create similar payloads for both providers
      const cloudflarePayload = {
        personalizations: [{ to: [{ email: 'u_test@inbox.chiphi.ai' }] }],
        from: { email: 'sender@example.com' },
        subject: 'Test Email',
        content: [{ type: 'text/plain', value: 'Test content' }],
      };

      const sesPayload = {
        Type: 'Notification',
        MessageId: 'sns-123',
        TopicArn: 'arn:aws:sns:us-east-1:123456789012:test',
        Message: JSON.stringify({
          mail: {
            messageId: 'ses-123',
            source: 'sender@example.com',
            destination: ['u_test@inbox.chiphi.ai'],
            timestamp: '2024-01-15T10:00:00.000Z',
            commonHeaders: { subject: 'Test Email' },
          },
          content: { text: 'Test content' },
        }),
        Timestamp: '2024-01-15T10:00:00.000Z',
        SignatureVersion: '1',
        Signature: 'test',
        SigningCertURL: 'https://sns.us-east-1.amazonaws.com/test.pem',
      };

      const cfRequest = new Request('https://example.com/webhook', {
        method: 'POST',
        body: JSON.stringify(cloudflarePayload),
      });

      const sesRequest = new Request('https://example.com/webhook', {
        method: 'POST',
        body: JSON.stringify(sesPayload),
      });

      const cfResult = await cloudflareAdapter.parse(cfRequest);
      const sesResult = await sesAdapter.parse(sesRequest);

      // Both should have the same normalized structure
      expect(cfResult).toMatchObject({
        alias: 'u_test@inbox.chiphi.ai',
        from: 'sender@example.com',
        to: 'u_test@inbox.chiphi.ai',
        subject: 'Test Email',
        text: 'Test content',
      });

      expect(sesResult).toMatchObject({
        alias: 'u_test@inbox.chiphi.ai',
        from: 'sender@example.com',
        to: 'u_test@inbox.chiphi.ai',
        subject: 'Test Email',
      });

      // Both should have provider-specific metadata
      expect(cfResult.metadata?.provider).toBe('cloudflare');
      expect(sesResult.metadata?.provider).toBe('ses');
    });
  });
});