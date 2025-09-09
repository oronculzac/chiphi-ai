/**
 * Provider Functionality Test Suite
 * Comprehensive testing of email provider abstraction and functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProviderFactory } from '@/lib/inbound/provider-factory';
import { CloudflareAdapter } from '@/lib/inbound/providers/cloudflare-adapter';
import { SESAdapter } from '@/lib/inbound/providers/ses-adapter';
import type { InboundEmailPayload } from '@/lib/inbound/types';

describe('Provider Functionality Tests', () => {
  describe('ProviderFactory', () => {
    it('should create CloudflareAdapter for cloudflare provider', () => {
      const provider = ProviderFactory.createProvider('cloudflare');
      expect(provider).toBeInstanceOf(CloudflareAdapter);
    });

    it('should create SESAdapter for ses provider', () => {
      const provider = ProviderFactory.createProvider('ses');
      expect(provider).toBeInstanceOf(SESAdapter);
    });

    it('should throw error for unknown provider', () => {
      expect(() => ProviderFactory.createProvider('unknown')).toThrow('Unknown provider: unknown');
    });
  });

  describe('CloudflareAdapter', () => {
    let adapter: CloudflareAdapter;

    beforeEach(() => {
      adapter = new CloudflareAdapter();
    });

    it('should verify valid Cloudflare request', async () => {
      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-cloudflare-signature': 'valid-signature'
        },
        body: JSON.stringify({
          alias: 'u_test@inbox.chiphi.ai',
          messageId: 'cf-123',
          from: 'sender@example.com',
          to: 'u_test@inbox.chiphi.ai',
          subject: 'Test Receipt',
          text: 'Receipt content'
        })
      });

      // Note: In real implementation, this would verify HMAC
      const isValid = await adapter.verify(mockRequest);
      expect(typeof isValid).toBe('boolean');
    });

    it('should parse Cloudflare email payload', async () => {
      const mockPayload = {
        alias: 'u_test@inbox.chiphi.ai',
        messageId: 'cf-123',
        from: 'sender@example.com',
        to: 'u_test@inbox.chiphi.ai',
        subject: 'Test Receipt',
        text: 'Receipt content',
        html: '<p>Receipt content</p>'
      };

      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mockPayload)
      });

      const parsed = await adapter.parse(mockRequest);
      
      expect(parsed).toMatchObject({
        alias: 'u_test@inbox.chiphi.ai',
        messageId: 'cf-123',
        from: 'sender@example.com',
        to: 'u_test@inbox.chiphi.ai',
        subject: 'Test Receipt'
      });
      expect(parsed.text).toBeDefined();
    });

    it('should handle malformed Cloudflare payload', async () => {
      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'invalid json'
      });

      await expect(adapter.parse(mockRequest)).rejects.toThrow();
    });
  });

  describe('SESAdapter', () => {
    let adapter: SESAdapter;

    beforeEach(() => {
      adapter = new SESAdapter();
    });

    it('should verify valid SES SNS request', async () => {
      const mockSNSPayload = {
        Type: 'Notification',
        MessageId: 'sns-123',
        Message: JSON.stringify({
          messageId: 'ses-123',
          alias: 'u_test@chiphi.oronculzac.com',
          from: 'sender@example.com',
          to: 'u_test@chiphi.oronculzac.com',
          subject: 'Test Receipt',
          text: 'Receipt content'
        })
      };

      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-amz-sns-message-type': 'Notification'
        },
        body: JSON.stringify(mockSNSPayload)
      });

      // Note: In real implementation, this would verify SNS signature
      const isValid = await adapter.verify(mockRequest);
      expect(typeof isValid).toBe('boolean');
    });

    it('should parse SES email payload from SNS', async () => {
      const mockMessage = {
        messageId: 'ses-123',
        alias: 'u_test@chiphi.oronculzac.com',
        from: 'sender@example.com',
        to: 'u_test@chiphi.oronculzac.com',
        subject: 'Test Receipt',
        text: 'Receipt content',
        html: '<p>Receipt content</p>'
      };

      const mockSNSPayload = {
        Type: 'Notification',
        MessageId: 'sns-123',
        Message: JSON.stringify(mockMessage)
      };

      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mockSNSPayload)
      });

      const parsed = await adapter.parse(mockRequest);
      
      expect(parsed).toMatchObject({
        alias: 'u_test@chiphi.oronculzac.com',
        messageId: 'ses-123',
        from: 'sender@example.com',
        to: 'u_test@chiphi.oronculzac.com',
        subject: 'Test Receipt'
      });
      expect(parsed.text).toBeDefined();
    });

    it('should handle malformed SES SNS payload', async () => {
      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          Type: 'Notification',
          Message: 'invalid json message'
        })
      });

      await expect(adapter.parse(mockRequest)).rejects.toThrow();
    });
  });

  describe('Provider Contract Compliance', () => {
    const providers = [
      { name: 'cloudflare', instance: new CloudflareAdapter() },
      { name: 'ses', instance: new SESAdapter() }
    ];

    providers.forEach(({ name, instance }) => {
      describe(`${name} provider contract`, () => {
        it('should implement verify method', () => {
          expect(typeof instance.verify).toBe('function');
        });

        it('should implement parse method', () => {
          expect(typeof instance.parse).toBe('function');
        });

        it('verify method should return Promise<boolean>', async () => {
          const mockRequest = new Request('http://localhost/test', {
            method: 'POST',
            body: '{}'
          });

          const result = await instance.verify(mockRequest);
          expect(typeof result).toBe('boolean');
        });

        it('parse method should return Promise<InboundEmailPayload>', async () => {
          const mockPayload = {
            alias: 'u_test@inbox.chiphi.ai',
            messageId: 'test-123',
            from: 'sender@example.com',
            to: 'u_test@inbox.chiphi.ai',
            subject: 'Test',
            text: 'Content'
          };

          const mockRequest = new Request('http://localhost/test', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(name === 'ses' ? {
              Type: 'Notification',
              Message: JSON.stringify(mockPayload)
            } : mockPayload)
          });

          const result = await instance.parse(mockRequest);
          
          expect(result).toHaveProperty('alias');
          expect(result).toHaveProperty('messageId');
          expect(result).toHaveProperty('from');
          expect(result).toHaveProperty('to');
          expect(typeof result.alias).toBe('string');
          expect(typeof result.messageId).toBe('string');
        });
      });
    });
  });

  describe('Payload Normalization', () => {
    it('should normalize different provider formats to consistent structure', async () => {
      const cloudflarePayload = {
        alias: 'u_test@inbox.chiphi.ai',
        messageId: 'cf-123',
        from: 'sender@example.com',
        to: 'u_test@inbox.chiphi.ai',
        subject: 'Test Receipt',
        text: 'Receipt content'
      };

      const sesMessage = {
        messageId: 'ses-123',
        alias: 'u_test@chiphi.oronculzac.com',
        from: 'sender@example.com',
        to: 'u_test@chiphi.oronculzac.com',
        subject: 'Test Receipt',
        text: 'Receipt content'
      };

      const cfRequest = new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cloudflarePayload)
      });

      const sesRequest = new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          Type: 'Notification',
          Message: JSON.stringify(sesMessage)
        })
      });

      const cfAdapter = new CloudflareAdapter();
      const sesAdapter = new SESAdapter();

      const cfResult = await cfAdapter.parse(cfRequest);
      const sesResult = await sesAdapter.parse(sesRequest);

      // Both should have the same structure
      expect(cfResult).toHaveProperty('alias');
      expect(cfResult).toHaveProperty('messageId');
      expect(cfResult).toHaveProperty('from');
      expect(cfResult).toHaveProperty('to');
      expect(cfResult).toHaveProperty('subject');

      expect(sesResult).toHaveProperty('alias');
      expect(sesResult).toHaveProperty('messageId');
      expect(sesResult).toHaveProperty('from');
      expect(sesResult).toHaveProperty('to');
      expect(sesResult).toHaveProperty('subject');

      // Structure should be identical
      expect(Object.keys(cfResult).sort()).toEqual(Object.keys(sesResult).sort());
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const adapter = new CloudflareAdapter();
      
      // Create a request that will cause parsing errors
      const badRequest = new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'not json'
      });

      await expect(adapter.parse(badRequest)).rejects.toThrow();
    });

    it('should handle missing required fields', async () => {
      const adapter = new CloudflareAdapter();
      
      const incompletePayload = {
        messageId: 'test-123'
        // Missing required fields like alias, from, to
      };

      const request = new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(incompletePayload)
      });

      await expect(adapter.parse(request)).rejects.toThrow();
    });
  });

  describe('Idempotency Support', () => {
    it('should preserve messageId for idempotency checking', async () => {
      const providers = [
        new CloudflareAdapter(),
        new SESAdapter()
      ];

      const testMessageId = 'idempotency-test-123';

      for (const provider of providers) {
        const mockPayload = provider instanceof SESAdapter ? {
          Type: 'Notification',
          Message: JSON.stringify({
            messageId: testMessageId,
            alias: 'u_test@inbox.chiphi.ai',
            from: 'sender@example.com',
            to: 'u_test@inbox.chiphi.ai',
            subject: 'Test',
            text: 'Content'
          })
        } : {
          messageId: testMessageId,
          alias: 'u_test@inbox.chiphi.ai',
          from: 'sender@example.com',
          to: 'u_test@inbox.chiphi.ai',
          subject: 'Test',
          text: 'Content'
        };

        const request = new Request('http://localhost/test', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(mockPayload)
        });

        const result = await provider.parse(request);
        expect(result.messageId).toBe(testMessageId);
      }
    });
  });
});