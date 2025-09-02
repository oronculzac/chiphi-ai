import { describe, it, expect, beforeEach } from 'vitest';
import {
  createProcessingContext,
  normalizeAttachments,
  extractEmailContent,
  validateMessageId,
  extractEmailAddresses,
  calculateProcessingMetrics,
  validateAndParseAlias,
  sanitizeEmailContent,
} from '../utils';
import { InboundEmailPayload, EmailProcessingContext } from '../types';

describe('Utility Functions', () => {
  describe('createProcessingContext', () => {
    it('should create processing context from email payload', () => {
      const payload: InboundEmailPayload = {
        alias: 'u_test-org@inbox.chiphi.ai',
        messageId: 'test-123',
        from: 'sender@example.com',
        to: 'u_test-org@inbox.chiphi.ai',
        text: 'test content',
        receivedAt: new Date('2024-01-01T10:00:00Z'),
        metadata: { source: 'test' },
      };

      const context = createProcessingContext(payload, 'cloudflare');

      expect(context.provider).toBe('cloudflare');
      expect(context.orgSlug).toBe('test-org');
      expect(context.messageId).toBe('test-123');
      expect(context.receivedAt).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(context.correlationId).toMatch(/^email_\d+_[a-z0-9]+$/);
      expect(context.metadata).toEqual({ source: 'test' });
    });

    it('should use current time if receivedAt not provided', () => {
      const payload: InboundEmailPayload = {
        alias: 'u_test@inbox.chiphi.ai',
        messageId: 'test-123',
        from: 'sender@example.com',
        to: 'u_test@inbox.chiphi.ai',
        text: 'test content',
      };

      const context = createProcessingContext(payload, 'ses');
      expect(context.receivedAt).toBeInstanceOf(Date);
    });
  });

  describe('normalizeAttachments', () => {
    it('should normalize Cloudflare attachments', () => {
      const cloudflareAttachments = [
        {
          filename: 'receipt.pdf',
          type: 'application/pdf',
          content: 'base64content',
        },
      ];

      const normalized = normalizeAttachments(cloudflareAttachments, 'cloudflare');

      expect(normalized).toHaveLength(1);
      expect(normalized![0]).toEqual({
        name: 'receipt.pdf',
        contentType: 'application/pdf',
        size: expect.any(Number),
        key: undefined,
      });
    });

    it('should normalize SES attachments', () => {
      const sesAttachments = [
        {
          name: 'invoice.jpg',
          contentType: 'image/jpeg',
          size: 2048,
        },
      ];

      const normalized = normalizeAttachments(sesAttachments, 'ses');

      expect(normalized).toHaveLength(1);
      expect(normalized![0]).toEqual({
        name: 'invoice.jpg',
        contentType: 'image/jpeg',
        size: 2048,
        key: undefined,
      });
    });

    it('should handle empty attachments', () => {
      expect(normalizeAttachments([], 'cloudflare')).toEqual([]);
      expect(normalizeAttachments(null as any, 'cloudflare')).toBeUndefined();
      expect(normalizeAttachments(undefined as any, 'cloudflare')).toBeUndefined();
    });

    it('should throw error for invalid attachments', () => {
      const invalidAttachments = [{ invalid: 'data' }];
      
      expect(() => normalizeAttachments(invalidAttachments, 'cloudflare')).toThrow();
    });
  });

  describe('extractEmailContent', () => {
    it('should extract Cloudflare content', () => {
      const cloudflarePayload = {
        content: [
          { type: 'text/plain', value: 'Plain text content' },
          { type: 'text/html', value: '<p>HTML content</p>' },
        ],
      };

      const content = extractEmailContent(cloudflarePayload, 'cloudflare');

      expect(content.text).toBe('Plain text content');
      expect(content.html).toBe('<p>HTML content</p>');
    });

    it('should extract SES content', () => {
      const sesPayload = {
        Message: JSON.stringify({
          content: {
            text: 'SES text content',
            html: '<p>SES HTML content</p>',
          },
        }),
      };

      const content = extractEmailContent(sesPayload, 'ses');

      expect(content.text).toBe('SES text content');
      expect(content.html).toBe('<p>SES HTML content</p>');
    });

    it('should handle generic content extraction', () => {
      const genericPayload = {
        text: 'Generic text',
        html: '<p>Generic HTML</p>',
      };

      const content = extractEmailContent(genericPayload, 'generic');

      expect(content.text).toBe('Generic text');
      expect(content.html).toBe('<p>Generic HTML</p>');
    });
  });

  describe('validateMessageId', () => {
    it('should validate correct message IDs', () => {
      expect(() => validateMessageId('valid-message-123', 'test')).not.toThrow();
      expect(() => validateMessageId('msg_123@example.com', 'test')).not.toThrow();
    });

    it('should reject invalid message IDs', () => {
      expect(() => validateMessageId('', 'test')).toThrow();
      expect(() => validateMessageId('a'.repeat(256), 'test')).toThrow();
      expect(() => validateMessageId('invalid spaces', 'test')).toThrow();
      expect(() => validateMessageId('invalid!chars', 'test')).toThrow();
    });
  });

  describe('extractEmailAddresses', () => {
    it('should extract Cloudflare addresses', () => {
      const cloudflarePayload = {
        from: { email: 'sender@example.com' },
        personalizations: [
          {
            to: [{ email: 'u_test@inbox.chiphi.ai' }],
          },
        ],
      };

      const addresses = extractEmailAddresses(cloudflarePayload, 'cloudflare');

      expect(addresses.from).toBe('sender@example.com');
      expect(addresses.to).toBe('u_test@inbox.chiphi.ai');
    });

    it('should extract SES addresses', () => {
      const sesPayload = {
        Message: JSON.stringify({
          mail: {
            source: 'sender@example.com',
            destination: ['u_test@inbox.chiphi.ai'],
          },
        }),
      };

      const addresses = extractEmailAddresses(sesPayload, 'ses');

      expect(addresses.from).toBe('sender@example.com');
      expect(addresses.to).toBe('u_test@inbox.chiphi.ai');
    });

    it('should throw error for missing addresses', () => {
      const invalidPayload = {};
      
      expect(() => extractEmailAddresses(invalidPayload, 'cloudflare')).toThrow();
    });
  });

  describe('calculateProcessingMetrics', () => {
    it('should calculate processing metrics', () => {
      const context: EmailProcessingContext = {
        correlationId: 'test-123',
        provider: 'test',
        orgSlug: 'test-org',
        messageId: 'msg-123',
        receivedAt: new Date(Date.now() - 5000), // 5 seconds ago
        processingStartedAt: new Date(Date.now() - 1000), // 1 second ago
      };

      const metrics = calculateProcessingMetrics(context);

      expect(metrics.processingTimeMs).toBeGreaterThan(0);
      expect(metrics.queueTimeMs).toBeGreaterThan(0);
    });
  });

  describe('validateAndParseAlias', () => {
    it('should validate and parse correct alias', () => {
      const result = validateAndParseAlias('u_test-org-123@inbox.chiphi.ai');

      expect(result.isValid).toBe(true);
      expect(result.orgSlug).toBe('test-org-123');
      expect(result.domain).toBe('inbox.chiphi.ai');
    });

    it('should handle invalid alias', () => {
      const result = validateAndParseAlias('invalid@example.com');

      expect(result.isValid).toBe(false);
      expect(result.orgSlug).toBe('');
      expect(result.domain).toBe('');
    });
  });

  describe('sanitizeEmailContent', () => {
    it('should remove script tags', () => {
      const content = 'Safe content <script>alert("xss")</script> more content';
      const sanitized = sanitizeEmailContent(content);

      expect(sanitized).toBe('Safe content more content');
      expect(sanitized).not.toContain('<script>');
    });

    it('should remove style tags', () => {
      const content = 'Content <style>body { color: red; }</style> more';
      const sanitized = sanitizeEmailContent(content);

      expect(sanitized).not.toContain('<style>');
    });

    it('should remove javascript URLs', () => {
      const content = 'Click <a href="javascript:alert()">here</a>';
      const sanitized = sanitizeEmailContent(content);

      expect(sanitized).not.toContain('javascript:');
    });

    it('should preserve image data URLs', () => {
      const content = 'Image: <img src="data:image/png;base64,abc123">';
      const sanitized = sanitizeEmailContent(content);

      expect(sanitized).toContain('data:image/png');
    });

    it('should remove non-image data URLs', () => {
      const content = 'Link: <a href="data:text/html,<script>alert()</script>">click</a>';
      const sanitized = sanitizeEmailContent(content);

      expect(sanitized).toContain('data-removed:text/html');
    });

    it('should handle empty content', () => {
      expect(sanitizeEmailContent('')).toBe('');
      expect(sanitizeEmailContent(null as any)).toBe('');
      expect(sanitizeEmailContent(undefined as any)).toBe('');
    });
  });
});