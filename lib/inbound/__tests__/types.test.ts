import { describe, it, expect } from 'vitest';
import {
  InboundEmailPayloadSchema,
  ProviderConfigSchema,
  extractOrgSlugFromAlias,
  isValidAlias,
  normalizeEmailContent,
  generateCorrelationId,
  ProviderError,
  ProviderVerificationError,
  ProviderParsingError,
  ProviderConfigurationError,
} from '../types';

describe('InboundEmailPayload Schema', () => {
  it('should validate a complete email payload', () => {
    const payload = {
      alias: 'u_test-org@inbox.chiphi.ai',
      messageId: 'test-message-123',
      from: 'sender@example.com',
      to: 'u_test-org@inbox.chiphi.ai',
      subject: 'Test Email',
      text: 'Test email content',
      html: '<p>Test email content</p>',
      attachments: [
        {
          name: 'receipt.pdf',
          contentType: 'application/pdf',
          size: 1024,
        },
      ],
      receivedAt: new Date(),
    };

    const result = InboundEmailPayloadSchema.parse(payload);
    expect(result).toEqual(payload);
  });

  it('should require either text or html content', () => {
    const payload = {
      alias: 'u_test-org@inbox.chiphi.ai',
      messageId: 'test-message-123',
      from: 'sender@example.com',
      to: 'u_test-org@inbox.chiphi.ai',
    };

    expect(() => InboundEmailPayloadSchema.parse(payload)).toThrow();
  });

  it('should validate alias format', () => {
    const validPayload = {
      alias: 'u_test-org@inbox.chiphi.ai',
      messageId: 'test-message-123',
      from: 'sender@example.com',
      to: 'u_test-org@inbox.chiphi.ai',
      text: 'content',
    };

    expect(() => InboundEmailPayloadSchema.parse(validPayload)).not.toThrow();

    const invalidPayload = {
      ...validPayload,
      alias: 'invalid-alias@example.com',
    };

    expect(() => InboundEmailPayloadSchema.parse(invalidPayload)).toThrow();
  });
});

describe('ProviderConfig Schema', () => {
  it('should validate provider configuration', () => {
    const config = {
      name: 'cloudflare',
      enabled: true,
      config: {
        apiKey: 'test-key',
      },
      webhookSecret: 'test-secret',
      timeoutMs: 30000,
    };

    const result = ProviderConfigSchema.parse(config);
    expect(result).toEqual(config);
  });

  it('should require minimum timeout', () => {
    const config = {
      name: 'test',
      enabled: true,
      config: {},
      timeoutMs: 500, // Below minimum
    };

    expect(() => ProviderConfigSchema.parse(config)).toThrow();
  });
});

describe('Utility Functions', () => {
  describe('extractOrgSlugFromAlias', () => {
    it('should extract organization slug from valid alias', () => {
      const alias = 'u_test-org-123@inbox.chiphi.ai';
      const slug = extractOrgSlugFromAlias(alias);
      expect(slug).toBe('test-org-123');
    });

    it('should throw error for invalid alias', () => {
      const alias = 'invalid@example.com';
      expect(() => extractOrgSlugFromAlias(alias)).toThrow();
    });
  });

  describe('isValidAlias', () => {
    it('should validate correct alias format', () => {
      expect(isValidAlias('u_test@inbox.chiphi.ai')).toBe(true);
      expect(isValidAlias('u_test-org-123@inbox.chiphi.ai')).toBe(true);
      expect(isValidAlias('invalid@example.com')).toBe(false);
      expect(isValidAlias('u_test@wrong-domain.com')).toBe(false);
    });
  });

  describe('normalizeEmailContent', () => {
    it('should normalize email content', () => {
      const content = '  Multiple   spaces   and\n\nnewlines  ';
      const normalized = normalizeEmailContent(content);
      expect(normalized).toBe('Multiple spaces and newlines');
    });

    it('should handle empty content', () => {
      expect(normalizeEmailContent('')).toBe('');
      expect(normalizeEmailContent(null as any)).toBe('');
      expect(normalizeEmailContent(undefined as any)).toBe('');
    });
  });

  describe('generateCorrelationId', () => {
    it('should generate unique correlation IDs', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();
      
      expect(id1).toMatch(/^email_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^email_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });
});

describe('Error Classes', () => {
  describe('ProviderError', () => {
    it('should create provider error with details', () => {
      const error = new ProviderError(
        'Test error',
        'cloudflare',
        'TEST_ERROR',
        { key: 'value' }
      );

      expect(error.message).toBe('Test error');
      expect(error.provider).toBe('cloudflare');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual({ key: 'value' });
      expect(error.name).toBe('ProviderError');
    });
  });

  describe('ProviderVerificationError', () => {
    it('should create verification error', () => {
      const error = new ProviderVerificationError('ses', { reason: 'invalid signature' });

      expect(error.message).toBe('Provider verification failed');
      expect(error.provider).toBe('ses');
      expect(error.code).toBe('VERIFICATION_FAILED');
      expect(error.name).toBe('ProviderVerificationError');
    });
  });

  describe('ProviderParsingError', () => {
    it('should create parsing error', () => {
      const error = new ProviderParsingError('cloudflare', { field: 'messageId' });

      expect(error.message).toBe('Provider payload parsing failed');
      expect(error.provider).toBe('cloudflare');
      expect(error.code).toBe('PARSING_FAILED');
      expect(error.name).toBe('ProviderParsingError');
    });
  });

  describe('ProviderConfigurationError', () => {
    it('should create configuration error', () => {
      const error = new ProviderConfigurationError('registry', { missing: 'webhookSecret' });

      expect(error.message).toBe('Provider configuration invalid');
      expect(error.provider).toBe('registry');
      expect(error.code).toBe('CONFIGURATION_ERROR');
      expect(error.name).toBe('ProviderConfigurationError');
    });
  });
});