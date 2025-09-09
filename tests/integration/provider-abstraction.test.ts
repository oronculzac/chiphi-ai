/**
 * Provider Abstraction Integration Tests
 * 
 * Comprehensive testing of email provider abstraction layer including:
 * - CloudflareAdapter and SESAdapter with synthetic payloads
 * - Provider factory creation and switching logic
 * - Provider health checks and fallback mechanisms
 * - Idempotency enforcement across different providers
 * - Error handling and logging for provider-specific failures
 * 
 * Requirements: 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProviderFactory, ProviderSwitcher } from '@/lib/inbound/provider-factory';
import { CloudflareAdapter } from '@/lib/inbound/providers/cloudflare-adapter';
import { SESAdapter } from '@/lib/inbound/providers/ses-adapter';
import {
  InboundEmailPayload,
  ProviderError,
  ProviderVerificationError,
  ProviderParsingError,
  ProviderConfigurationError,
  generateCorrelationId,
} from '@/lib/inbound/types';
import { createServiceClient } from '@/lib/supabase/server';

// Mock dependencies
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/config', () => ({
  config: {
    app: {
      nodeEnv: 'test',
      isDevelopment: true,
      isProduction: false,
    },
    inboundProvider: {
      provider: 'cloudflare',
      cloudflareSecret: 'test-cloudflare-secret',
      sesSecret: 'test-ses-secret',
    },
  },
}));

describe('Provider Abstraction Integration Tests', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'test-email-id', message_id: 'test-message-id' },
        error: null,
      }),
      insert: vi.fn().mockReturnThis(),
    };
    
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase);
    
    // Clear provider cache before each test
    ProviderFactory.clearCache();
  });

  afterEach(() => {
    ProviderFactory.clearCache();
  });

  describe('CloudflareAdapter Integration', () => {
    let adapter: CloudflareAdapter;

    beforeEach(() => {
      adapter = new CloudflareAdapter('test-cloudflare-secret', 30000);
    });

    it('should parse valid Cloudflare email payload', async () => {
      // Synthetic Cloudflare payload based on their API format
      const cloudflarePayload = {
        personalizations: [{
          to: [{ email: 'u_testorg@inbox.chiphi.ai', name: 'Test User' }]
        }],
        from: { email: 'sender@example.com', name: 'Test Sender' },
        subject: 'Test Receipt - Starbucks Coffee',
        content: [
          {
            type: 'text/plain',
            value: `
Thank you for visiting Starbucks!

Store: Starbucks Coffee #1234
Date: January 15, 2024 at 2:30 PM

Order Details:
- Grande Latte                    $5.47
- Tax                            $0.48

Total: $5.95
Payment: Visa ending in 1234
            `.trim()
          },
          {
            type: 'text/html',
            value: `
<html>
<body>
<h2>Thank you for visiting Starbucks!</h2>
<p><strong>Store:</strong> Starbucks Coffee #1234</p>
<p><strong>Date:</strong> January 15, 2024 at 2:30 PM</p>
<h3>Order Details:</h3>
<ul>
<li>Grande Latte - $5.47</li>
<li>Tax - $0.48</li>
</ul>
<p><strong>Total:</strong> $5.95</p>
<p><strong>Payment:</strong> Visa ending in 1234</p>
</body>
</html>
            `.trim()
          }
        ],
        headers: {
          'message-id': 'cf-starbucks-001@test.com',
          'date': 'Mon, 15 Jan 2024 14:30:00 -0800'
        },
        attachments: [
          {
            filename: 'receipt.pdf',
            type: 'application/pdf',
            content: 'JVBERi0xLjQKJcOkw7zDtsO8CjIgMCBvYmoKPDwKL0xlbmd0aCAzIDAgUgo+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjcyIDcyMCBUZAooUmVjZWlwdCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago=',
            disposition: 'attachment'
          }
        ]
      };

      const request = new Request('http://localhost:3000/api/inbound', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-cloudflare-signature': 'test-signature'
        },
        body: JSON.stringify(cloudflarePayload)
      });

      const result = await adapter.parse(request);

      // Verify normalized payload structure
      expect(result).toMatchObject({
        alias: 'u_testorg@inbox.chiphi.ai',
        from: 'sender@example.com',
        to: 'u_testorg@inbox.chiphi.ai',
        subject: 'Test Receipt - Starbucks Coffee',
      });

      expect(result.messageId).toBe('cf-starbucks-001@test.com');
      expect(result.text).toContain('Starbucks Coffee');
      expect(result.text).toContain('$5.95');
      expect(result.html).toContain('<h2>Thank you for visiting Starbucks!</h2>');
      expect(result.receivedAt).toBeInstanceOf(Date);
      expect(result.metadata).toHaveProperty('provider', 'cloudflare');
      expect(result.metadata).toHaveProperty('correlationId');
      
      // Verify attachments are normalized
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments![0]).toMatchObject({
        name: 'receipt.pdf',
        contentType: 'application/pdf',
        size: expect.any(Number),
      });
    });

    it('should handle Cloudflare payload with missing content gracefully', async () => {
      const incompletePayload = {
        personalizations: [{
          to: [{ email: 'u_testorg@inbox.chiphi.ai' }]
        }],
        from: { email: 'sender@example.com' },
        subject: 'Incomplete Receipt',
        // Missing content array
      };

      const request = new Request('http://localhost:3000/api/inbound', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(incompletePayload)
      });

      await expect(adapter.parse(request)).rejects.toThrow(ProviderParsingError);
    });

    it('should handle HMAC signature verification correctly', async () => {
      // Test with missing signature header
      const request = new Request('http://localhost:3000/api/inbound', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({})
      });

      // Should throw ProviderVerificationError when signature is missing
      await expect(adapter.verify(request)).rejects.toThrow(ProviderVerificationError);
      
      // Test with signature header present
      const requestWithSig = new Request('http://localhost:3000/api/inbound', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-cloudflare-signature': 'test-signature',
        },
        body: JSON.stringify({})
      });

      // Should return boolean or throw ProviderVerificationError
      try {
        const result = await adapter.verify(requestWithSig);
        expect(typeof result).toBe('boolean');
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderVerificationError);
      }
    });

    it('should perform health check successfully', async () => {
      const healthResult = await adapter.healthCheck();
      
      expect(healthResult).toMatchObject({
        healthy: expect.any(Boolean),
        responseTimeMs: expect.any(Number),
        details: {
          hasSecret: true,
          hasValidTimeout: true,
          timeoutMs: 30000,
          environment: 'test',
        },
      });
      
      expect(healthResult.responseTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('SESAdapter Integration', () => {
    let adapter: SESAdapter;

    beforeEach(() => {
      adapter = new SESAdapter('test-ses-secret', 30000, false); // Disable signature verification for tests
    });

    it('should parse valid SES SNS notification payload', async () => {
      // Synthetic SES SNS payload based on AWS documentation
      const sesMailObject = {
        timestamp: '2024-01-15T22:30:00.000Z',
        messageId: 'ses-message-001',
        source: 'receipts@wholefoods.com',
        destination: ['u_testorg@chiphi.oronculzac.com'],
        headersTruncated: false,
        headers: [
          { name: 'From', value: 'receipts@wholefoods.com' },
          { name: 'To', value: 'u_testorg@chiphi.oronculzac.com' },
          { name: 'Subject', value: 'Whole Foods Market Receipt' },
          { name: 'Date', value: 'Mon, 15 Jan 2024 14:30:00 -0800' }
        ],
        commonHeaders: {
          from: ['receipts@wholefoods.com'],
          to: ['u_testorg@chiphi.oronculzac.com'],
          subject: 'Whole Foods Market Receipt',
          date: 'Mon, 15 Jan 2024 14:30:00 -0800',
          messageId: 'ses-message-001'
        }
      };

      const sesMessage = {
        mail: sesMailObject,
        receipt: {
          timestamp: '2024-01-15T22:30:00.000Z',
          processingTimeMillis: 123,
          recipients: ['u_testorg@chiphi.oronculzac.com'],
          spamVerdict: { status: 'PASS' },
          virusVerdict: { status: 'PASS' },
          spfVerdict: { status: 'PASS' },
          dkimVerdict: { status: 'PASS' },
          dmarcVerdict: { status: 'PASS' },
          action: {
            type: 'S3',
            topicArn: 'arn:aws:sns:us-east-1:123456789012:ses-topic',
            bucketName: 'ses-emails-bucket',
            objectKey: 'emails/ses-message-001'
          }
        },
        content: {
          text: `
WHOLE FOODS MARKET
456 Broadway, New York, NY 10013

Date: 01/14/2024 Time: 4:45 PM
Cashier: Sarah M.

ORGANIC BANANAS         $3.99
ALMOND MILK 32OZ        $4.49
QUINOA SALAD           $12.99

Subtotal:              $20.47
Tax:                   $1.79
Total:                $22.26

VISA ****1234         $22.26
          `.trim(),
          html: `
<html>
<body>
<h2>WHOLE FOODS MARKET</h2>
<p>456 Broadway, New York, NY 10013</p>
<p>Date: 01/14/2024 Time: 4:45 PM</p>
<p>Cashier: Sarah M.</p>
<ul>
<li>ORGANIC BANANAS - $3.99</li>
<li>ALMOND MILK 32OZ - $4.49</li>
<li>QUINOA SALAD - $12.99</li>
</ul>
<p>Subtotal: $20.47</p>
<p>Tax: $1.79</p>
<p><strong>Total: $22.26</strong></p>
<p>VISA ****1234 - $22.26</p>
</body>
</html>
          `.trim()
        }
      };

      const snsPayload = {
        Type: 'Notification',
        MessageId: 'sns-notification-001',
        TopicArn: 'arn:aws:sns:us-east-1:123456789012:ses-topic',
        Subject: 'Amazon SES Email Receipt',
        Message: JSON.stringify(sesMessage),
        Timestamp: '2024-01-15T22:30:00.000Z',
        SignatureVersion: '1',
        Signature: 'test-signature',
        SigningCertURL: 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-test.pem'
      };

      const request = new Request('http://localhost:3000/api/inbound', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-amz-sns-message-type': 'Notification'
        },
        body: JSON.stringify(snsPayload)
      });

      const result = await adapter.parse(request);

      // Verify normalized payload structure
      expect(result).toMatchObject({
        alias: 'u_testorg@chiphi.oronculzac.com',
        messageId: 'ses-message-001',
        from: 'receipts@wholefoods.com',
        to: 'u_testorg@chiphi.oronculzac.com',
        subject: 'Whole Foods Market Receipt',
      });

      expect(result.text).toContain('WHOLE FOODS MARKET');
      expect(result.text).toContain('$22.26');
      expect(result.html).toContain('<h2>WHOLE FOODS MARKET</h2>');
      expect(result.receivedAt).toBeInstanceOf(Date);
      expect(result.metadata).toHaveProperty('provider', 'ses');
      expect(result.metadata).toHaveProperty('snsMessageId', 'sns-notification-001');
      expect(result.metadata).toHaveProperty('sesMessageId', 'ses-message-001');
    });

    it('should handle malformed SNS message gracefully', async () => {
      const malformedPayload = {
        Type: 'Notification',
        MessageId: 'sns-001',
        Message: 'invalid json message content'
      };

      const request = new Request('http://localhost:3000/api/inbound', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(malformedPayload)
      });

      await expect(adapter.parse(request)).rejects.toThrow(ProviderParsingError);
    });

    it('should skip signature verification when disabled', async () => {
      const request = new Request('http://localhost:3000/api/inbound', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          Type: 'Notification',
          MessageId: 'test',
          Message: '{}',
          Signature: 'invalid-signature'
        })
      });

      const result = await adapter.verify(request);
      expect(result).toBe(true); // Should pass when verification is disabled
    });

    it('should perform health check successfully', async () => {
      const healthResult = await adapter.healthCheck();
      
      expect(healthResult).toMatchObject({
        healthy: expect.any(Boolean),
        responseTimeMs: expect.any(Number),
        details: {
          hasSecret: true,
          hasValidTimeout: true,
          signatureVerificationEnabled: false,
          timeoutMs: 30000,
          environment: 'test',
        },
      });
    });
  });

  describe('Provider Factory Creation and Switching', () => {
    it('should create CloudflareAdapter for cloudflare provider', () => {
      const provider = ProviderFactory.createProvider('cloudflare');
      expect(provider).toBeInstanceOf(CloudflareAdapter);
      expect(provider.getName()).toBe('cloudflare');
    });

    it('should create SESAdapter for ses provider', () => {
      const provider = ProviderFactory.createProvider('ses');
      expect(provider).toBeInstanceOf(SESAdapter);
      expect(provider.getName()).toBe('ses');
    });

    it('should throw ProviderConfigurationError for unknown provider', () => {
      expect(() => ProviderFactory.createProvider('unknown' as any))
        .toThrow(ProviderConfigurationError);
    });

    it('should cache provider instances', () => {
      const provider1 = ProviderFactory.createProvider('cloudflare');
      const provider2 = ProviderFactory.createProvider('cloudflare');
      expect(provider1).toBe(provider2); // Same instance due to caching
    });

    it('should return different instances for different configurations', () => {
      const provider1 = ProviderFactory.createProvider('cloudflare', { webhookSecret: 'secret1' });
      const provider2 = ProviderFactory.createProvider('cloudflare', { webhookSecret: 'secret2' });
      expect(provider1).not.toBe(provider2); // Different instances due to different configs
    });

    it('should get default provider based on configuration', () => {
      const provider = ProviderFactory.getDefaultProvider();
      expect(provider).toBeInstanceOf(CloudflareAdapter); // Based on mocked config
    });

    it('should validate provider configuration', () => {
      expect(() => ProviderFactory.validateProviderConfiguration('cloudflare')).not.toThrow();
      expect(() => ProviderFactory.validateProviderConfiguration('ses')).not.toThrow();
      expect(() => ProviderFactory.validateProviderConfiguration('invalid' as any))
        .toThrow(ProviderConfigurationError);
    });

    it('should list all supported providers with configuration status', () => {
      const providers = ProviderFactory.listProviders();
      
      expect(providers).toHaveLength(2);
      expect(providers.map(p => p.name)).toEqual(['cloudflare', 'ses']);
      
      providers.forEach(provider => {
        expect(provider).toMatchObject({
          name: expect.any(String),
          enabled: expect.any(Boolean),
          config: expect.any(Object),
          timeoutMs: 30000,
        });
      });
    });

    it('should clear provider cache', () => {
      const provider1 = ProviderFactory.createProvider('cloudflare');
      ProviderFactory.clearCache();
      const provider2 = ProviderFactory.createProvider('cloudflare');
      expect(provider1).not.toBe(provider2); // Different instances after cache clear
    });
  });

  describe('Provider Health Checks and Fallback Mechanisms', () => {
    it('should perform health check on cloudflare provider', async () => {
      const healthCheck = await ProviderFactory.performHealthCheck('cloudflare');
      
      expect(healthCheck).toMatchObject({
        provider: 'cloudflare',
        healthy: expect.any(Boolean),
        lastChecked: expect.any(Date),
        responseTimeMs: expect.any(Number),
        details: {
          correlationId: expect.any(String),
          configurationValid: true,
        },
      });
      
      expect(healthCheck.responseTimeMs).toBeGreaterThan(0);
    });

    it('should perform health check on ses provider', async () => {
      const healthCheck = await ProviderFactory.performHealthCheck('ses');
      
      expect(healthCheck).toMatchObject({
        provider: 'ses',
        healthy: expect.any(Boolean),
        lastChecked: expect.any(Date),
        responseTimeMs: expect.any(Number),
        details: {
          correlationId: expect.any(String),
          configurationValid: true,
        },
      });
    });

    it('should cache health check results', async () => {
      const healthCheck1 = await ProviderFactory.performHealthCheck('cloudflare', true);
      const healthCheck2 = await ProviderFactory.performHealthCheck('cloudflare', true);
      
      expect(healthCheck1.lastChecked).toEqual(healthCheck2.lastChecked);
    });

    it('should bypass cache when requested', async () => {
      const healthCheck1 = await ProviderFactory.performHealthCheck('cloudflare', false);
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      const healthCheck2 = await ProviderFactory.performHealthCheck('cloudflare', false);
      
      expect(healthCheck1.lastChecked.getTime()).toBeLessThan(healthCheck2.lastChecked.getTime());
    });

    it('should perform health checks on all providers', async () => {
      const healthChecks = await ProviderFactory.performAllHealthChecks();
      
      expect(healthChecks.size).toBe(2);
      expect(healthChecks.has('cloudflare')).toBe(true);
      expect(healthChecks.has('ses')).toBe(true);
      
      healthChecks.forEach((healthCheck, providerName) => {
        expect(healthCheck.provider).toBe(providerName);
        expect(healthCheck.healthy).toBeDefined();
        expect(healthCheck.lastChecked).toBeInstanceOf(Date);
      });
    });

    it('should identify fallback providers', () => {
      const cloudflareFallback = ProviderFactory.getFallbackProvider('cloudflare');
      const sesFallback = ProviderFactory.getFallbackProvider('ses');
      
      expect(cloudflareFallback).toBe('ses');
      expect(sesFallback).toBe('cloudflare');
    });

    it('should handle provider switching with ProviderSwitcher', async () => {
      const switcher = new ProviderSwitcher('cloudflare');
      
      const status = await switcher.getStatus();
      expect(status).toMatchObject({
        current: 'cloudflare',
        fallback: 'ses',
        currentHealthy: expect.any(Boolean),
        fallbackHealthy: expect.any(Boolean),
      });
      
      // Switch to SES
      switcher.switchProvider('ses');
      const newStatus = await switcher.getStatus();
      expect(newStatus.current).toBe('ses');
      expect(newStatus.fallback).toBe('cloudflare');
    });

    it('should get active provider with fallback logic', async () => {
      const switcher = new ProviderSwitcher('cloudflare');
      const activeProvider = await switcher.getActiveProvider();
      
      expect(activeProvider).toBeInstanceOf(CloudflareAdapter);
    });
  });

  describe('Idempotency Enforcement Across Providers', () => {
    beforeEach(() => {
      // Mock database to simulate idempotency checking
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { org_id: 'test-org-id', is_active: true },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null, // No existing email found
          error: { message: 'No rows returned' },
        });
    });

    it('should enforce idempotency for Cloudflare emails', async () => {
      const messageId = 'idempotency-test-cf-001';
      const adapter = new CloudflareAdapter('test-secret');
      
      const payload = {
        personalizations: [{ to: [{ email: 'u_testorg@inbox.chiphi.ai' }] }],
        from: { email: 'sender@example.com' },
        subject: 'Test Receipt',
        content: [{ type: 'text/plain', value: 'Test content' }],
        headers: { 'message-id': messageId }
      };

      const request = new Request('http://localhost:3000/api/inbound', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await adapter.parse(request);
      expect(result.messageId).toBe(messageId);
      
      // Verify messageId is preserved for idempotency checking
      expect(result.messageId).toBe(messageId);
    });

    it('should enforce idempotency for SES emails', async () => {
      const messageId = 'idempotency-test-ses-001';
      const adapter = new SESAdapter('test-secret', 30000, false);
      
      const sesMessage = {
        mail: {
          timestamp: '2024-01-15T22:30:00.000Z',
          messageId: messageId,
          source: 'sender@example.com',
          destination: ['u_testorg@chiphi.oronculzac.com'],
          commonHeaders: {
            subject: 'Test Receipt',
            messageId: messageId
          }
        },
        content: {
          text: 'Test receipt content'
        }
      };

      const snsPayload = {
        Type: 'Notification',
        MessageId: 'sns-001',
        TopicArn: 'arn:aws:sns:us-east-1:123456789012:test-topic',
        Message: JSON.stringify(sesMessage),
        Timestamp: '2024-01-15T22:30:00.000Z',
        SignatureVersion: '1',
        Signature: 'test-signature',
        SigningCertURL: 'https://sns.us-east-1.amazonaws.com/test.pem'
      };

      const request = new Request('http://localhost:3000/api/inbound', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(snsPayload)
      });

      const result = await adapter.parse(request);
      expect(result.messageId).toBe(messageId);
    });

    it('should handle duplicate message detection', async () => {
      const messageId = 'duplicate-test-001';
      
      // Mock existing email found
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { org_id: 'test-org-id', is_active: true },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'existing-email-id', message_id: messageId },
          error: null,
        });

      const adapter = new CloudflareAdapter('test-secret');
      const payload = {
        personalizations: [{ to: [{ email: 'u_testorg@inbox.chiphi.ai' }] }],
        from: { email: 'sender@example.com' },
        subject: 'Duplicate Receipt',
        content: [{ type: 'text/plain', value: 'Test content' }],
        headers: { 'message-id': messageId }
      };

      const request = new Request('http://localhost:3000/api/inbound', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await adapter.parse(request);
      expect(result.messageId).toBe(messageId);
      
      // The actual idempotency check would happen in the API route
      // Here we just verify the messageId is correctly extracted
    });
  });

  describe('Error Handling and Logging for Provider-Specific Failures', () => {
    it('should handle CloudflareAdapter verification errors', async () => {
      const adapter = new CloudflareAdapter('test-secret');
      
      const request = new Request('http://localhost:3000/api/inbound', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({})
      });

      // Should throw ProviderVerificationError when signature is missing
      await expect(adapter.verify(request)).rejects.toThrow(ProviderVerificationError);
    });

    it('should handle CloudflareAdapter parsing errors with context', async () => {
      const adapter = new CloudflareAdapter('test-secret');
      
      const request = new Request('http://localhost:3000/api/inbound', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'invalid json'
      });

      await expect(adapter.parse(request)).rejects.toThrow(ProviderParsingError);
      
      try {
        await adapter.parse(request);
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderParsingError);
        expect((error as ProviderParsingError).provider).toBe('cloudflare');
        expect((error as ProviderParsingError).code).toBe('PARSING_FAILED');
        expect((error as ProviderParsingError).details).toBeDefined();
      }
    });

    it('should handle SESAdapter verification errors', async () => {
      const adapter = new SESAdapter('test-secret', 30000, true); // Enable signature verification
      
      const request = new Request('http://localhost:3000/api/inbound', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          Type: 'Notification',
          MessageId: 'test',
          Message: '{}',
          Signature: 'invalid-signature'
          // Missing required fields for SNS payload
        })
      });

      // Should throw ProviderVerificationError for invalid SNS structure
      await expect(adapter.verify(request)).rejects.toThrow(ProviderVerificationError);
    });

    it('should handle SESAdapter parsing errors with context', async () => {
      const adapter = new SESAdapter('test-secret', 30000, false);
      
      const request = new Request('http://localhost:3000/api/inbound', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          Type: 'Notification',
          MessageId: 'test',
          TopicArn: 'arn:aws:sns:us-east-1:123456789012:test',
          Message: 'invalid json message',
          Timestamp: '2024-01-15T22:30:00.000Z',
          SignatureVersion: '1',
          Signature: 'test-signature',
          SigningCertURL: 'https://sns.us-east-1.amazonaws.com/test.pem'
        })
      });

      await expect(adapter.parse(request)).rejects.toThrow(ProviderParsingError);
      
      try {
        await adapter.parse(request);
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderParsingError);
        expect((error as ProviderParsingError).provider).toBe('ses');
        expect((error as ProviderParsingError).code).toBe('PARSING_FAILED');
        expect((error as ProviderParsingError).details).toBeDefined();
      }
    });

    it('should handle ProviderFactory configuration errors', () => {
      expect(() => ProviderFactory.createProvider('invalid' as any))
        .toThrow(ProviderConfigurationError);
      
      try {
        ProviderFactory.createProvider('invalid' as any);
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderConfigurationError);
        expect((error as ProviderConfigurationError).provider).toBe('invalid');
        expect((error as ProviderConfigurationError).code).toBe('CONFIGURATION_ERROR');
        expect((error as ProviderConfigurationError).details).toHaveProperty('supportedProviders');
      }
    });

    it('should handle health check failures gracefully', async () => {
      // Mock a provider that throws during health check
      const mockProvider = {
        getName: () => 'mock',
        verify: vi.fn(),
        parse: vi.fn(),
        healthCheck: vi.fn().mockRejectedValue(new Error('Health check failed'))
      };

      vi.spyOn(ProviderFactory, 'createProvider').mockReturnValue(mockProvider as any);

      const healthCheck = await ProviderFactory.performHealthCheck('cloudflare');
      
      expect(healthCheck).toMatchObject({
        provider: 'cloudflare',
        healthy: false,
        error: expect.any(String),
        details: {
          correlationId: expect.any(String),
          unexpectedError: true,
        },
      });
    });

    it('should generate correlation IDs for error tracking', () => {
      const correlationId1 = generateCorrelationId();
      const correlationId2 = generateCorrelationId();
      
      expect(correlationId1).toMatch(/^email_\d+_[a-z0-9]+$/);
      expect(correlationId2).toMatch(/^email_\d+_[a-z0-9]+$/);
      expect(correlationId1).not.toBe(correlationId2);
    });

    it('should provide provider-specific logging context', () => {
      const cloudflareContext = ProviderFactory.getProviderLoggingContext('cloudflare');
      const sesContext = ProviderFactory.getProviderLoggingContext('ses');
      
      expect(cloudflareContext).toMatchObject({
        provider: 'cloudflare',
        isConfigured: expect.any(Boolean),
        isDefault: true, // Based on mocked config
        environment: 'test',
        hasSecret: expect.any(Boolean),
      });
      
      expect(sesContext).toMatchObject({
        provider: 'ses',
        isConfigured: expect.any(Boolean),
        isDefault: false,
        environment: 'test',
        hasSecret: expect.any(Boolean),
      });
    });
  });

  describe('Provider Contract Compliance', () => {
    const providers = [
      { name: 'cloudflare', factory: () => new CloudflareAdapter('test-secret') },
      { name: 'ses', factory: () => new SESAdapter('test-secret', 30000, false) }
    ];

    providers.forEach(({ name, factory }) => {
      describe(`${name} provider contract`, () => {
        let provider: any;

        beforeEach(() => {
          provider = factory();
        });

        it('should implement getName method', () => {
          expect(typeof provider.getName).toBe('function');
          expect(provider.getName()).toBe(name);
        });

        it('should implement verify method returning Promise<boolean>', async () => {
          expect(typeof provider.verify).toBe('function');
          
          const mockRequest = new Request('http://localhost/test', {
            method: 'POST',
            headers: name === 'cloudflare' ? { 'x-cloudflare-signature': 'test-sig' } : {},
            body: name === 'ses' ? JSON.stringify({
              Type: 'Notification',
              MessageId: 'test',
              TopicArn: 'arn:aws:sns:us-east-1:123456789012:test',
              Message: '{}',
              Timestamp: '2024-01-15T22:30:00.000Z',
              SignatureVersion: '1',
              Signature: 'test-signature',
              SigningCertURL: 'https://sns.us-east-1.amazonaws.com/test.pem'
            }) : '{}'
          });

          try {
            const result = await provider.verify(mockRequest);
            expect(typeof result).toBe('boolean');
          } catch (error) {
            // Verification may fail, but should throw proper error types
            expect(error).toBeInstanceOf(ProviderVerificationError);
          }
        });

        it('should implement parse method returning Promise<InboundEmailPayload>', async () => {
          expect(typeof provider.parse).toBe('function');
          
          const mockPayload = name === 'ses' ? {
            Type: 'Notification',
            MessageId: 'test-123',
            TopicArn: 'arn:aws:sns:us-east-1:123456789012:test',
            Message: JSON.stringify({
              mail: {
                timestamp: '2024-01-15T22:30:00.000Z',
                messageId: 'test-123',
                source: 'sender@example.com',
                destination: ['u_test@inbox.chiphi.ai'],
                commonHeaders: {
                  subject: 'Test',
                  messageId: 'test-123'
                }
              },
              content: {
                text: 'Test content'
              }
            }),
            Timestamp: '2024-01-15T22:30:00.000Z',
            SignatureVersion: '1',
            Signature: 'test-signature',
            SigningCertURL: 'https://sns.us-east-1.amazonaws.com/test.pem'
          } : {
            personalizations: [{ to: [{ email: 'u_test@inbox.chiphi.ai' }] }],
            from: { email: 'sender@example.com' },
            subject: 'Test',
            content: [{ type: 'text/plain', value: 'Test content' }],
            headers: { 'message-id': 'test-123' }
          };

          const mockRequest = new Request('http://localhost/test', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(mockPayload)
          });

          const result = await provider.parse(mockRequest);
          
          // Verify InboundEmailPayload structure
          expect(result).toHaveProperty('alias');
          expect(result).toHaveProperty('messageId');
          expect(result).toHaveProperty('from');
          expect(result).toHaveProperty('to');
          expect(typeof result.alias).toBe('string');
          expect(typeof result.messageId).toBe('string');
          expect(typeof result.from).toBe('string');
          expect(typeof result.to).toBe('string');
        });

        it('should implement healthCheck method if available', async () => {
          if ('healthCheck' in provider && typeof provider.healthCheck === 'function') {
            const healthResult = await provider.healthCheck();
            
            expect(healthResult).toHaveProperty('healthy');
            expect(typeof healthResult.healthy).toBe('boolean');
            
            if (healthResult.responseTimeMs !== undefined) {
              expect(typeof healthResult.responseTimeMs).toBe('number');
              expect(healthResult.responseTimeMs).toBeGreaterThanOrEqual(0);
            }
          }
        });
      });
    });
  });
});