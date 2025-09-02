import { describe, it, expect, vi, beforeEach } from 'vitest';
import { advancedEmailProcessor } from '../advanced-email-processor';
import { duplicateDetector } from '../duplicate-detector';
import { emailSanitizer } from '../email-sanitizer';
import { pdfProcessor } from '../pdf-processor';
import { forwardedEmailDetector } from '../forwarded-email-detector';
import { ParsedEmail } from '@/lib/types';

// Mock dependencies
vi.mock('../duplicate-detector', () => ({
  duplicateDetector: {
    isDuplicate: vi.fn(),
  },
}));
vi.mock('../email-sanitizer', () => ({
  emailSanitizer: {
    sanitizeEmail: vi.fn(),
  },
}));
vi.mock('../pdf-processor', () => ({
  pdfProcessor: {
    processPDFAttachments: vi.fn(),
  },
}));
vi.mock('../forwarded-email-detector', () => ({
  forwardedEmailDetector: {
    detectForwardedChain: vi.fn(),
    extractFromForwardedChain: vi.fn(),
  },
}));
vi.mock('../logging-service', () => ({
  loggingService: {
    logProcessingStep: vi.fn(),
  },
}));

describe('AdvancedEmailProcessor', () => {
  const mockOrgId = 'test-org-id';
  const mockCorrelationId = 'test-correlation-id';
  
  const mockParsedEmail: ParsedEmail = {
    messageId: 'test-message-id',
    from: 'sender@example.com',
    to: 'recipient@example.com',
    subject: 'Test Receipt',
    text: 'Thank you for your purchase. Total: $25.99',
    html: '<p>Thank you for your purchase. Total: $25.99</p>',
    attachments: [],
    headers: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processAdvancedEmail', () => {
    it('should return early if email is duplicate', async () => {
      // Mock duplicate detection
      vi.mocked(duplicateDetector.isDuplicate).mockResolvedValue({
        isDuplicate: true,
        reason: 'Message ID already exists',
        existingEmailId: 'existing-id',
        confidence: 100,
      });

      const result = await advancedEmailProcessor.processAdvancedEmail(
        mockParsedEmail,
        mockOrgId,
        mockCorrelationId
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.attachmentTexts).toEqual([]);
      expect(result.securityFlags).toEqual([]);
      expect(result.sanitizationActions).toEqual([]);
      
      // Should not call other services if duplicate
      expect(emailSanitizer.sanitizeEmail).not.toHaveBeenCalled();
    });

    it('should process non-duplicate email with all features', async () => {
      // Mock duplicate detection - not duplicate
      vi.mocked(duplicateDetector.isDuplicate).mockResolvedValue({
        isDuplicate: false,
        confidence: 0,
      });

      // Mock email sanitization
      const mockSanitizationResult = {
        sanitizedEmail: { ...mockParsedEmail, text: 'Sanitized content' },
        securityFlags: [
          {
            type: 'phishing_attempt' as const,
            severity: 'medium' as const,
            description: 'Suspicious pattern detected',
            location: 'text_content' as const,
          },
        ],
        sanitizationActions: [
          {
            type: 'redaction' as const,
            description: 'Credit card number redacted',
            location: 'text_content' as const,
          },
        ],
      };
      vi.mocked(emailSanitizer.sanitizeEmail).mockResolvedValue(mockSanitizationResult);

      // Mock PDF processing
      vi.mocked(pdfProcessor.processPDFAttachments).mockResolvedValue(['PDF content']);

      // Mock forwarded email detection
      const mockForwardedChain = {
        originalSender: 'original@example.com',
        forwardedBy: ['forwarder@example.com'],
        chainDepth: 1,
        extractedContent: 'Original receipt content',
      };
      vi.mocked(forwardedEmailDetector.detectForwardedChain).mockResolvedValue(mockForwardedChain);
      vi.mocked(forwardedEmailDetector.extractFromForwardedChain).mockResolvedValue({
        text: 'Enhanced text content',
        html: 'Enhanced HTML content',
      });

      const result = await advancedEmailProcessor.processAdvancedEmail(
        mockParsedEmail,
        mockOrgId,
        mockCorrelationId
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.processedEmail.text).toBe('Enhanced text content');
      expect(result.attachmentTexts).toEqual(['PDF content']);
      expect(result.securityFlags).toHaveLength(1);
      expect(result.sanitizationActions).toHaveLength(1);
      expect(result.forwardedChain).toEqual(mockForwardedChain);

      // Verify all services were called
      expect(duplicateDetector.isDuplicate).toHaveBeenCalledWith(
        mockParsedEmail,
        mockOrgId,
        mockCorrelationId
      );
      expect(emailSanitizer.sanitizeEmail).toHaveBeenCalledWith(
        mockParsedEmail,
        mockOrgId,
        mockCorrelationId
      );
      expect(pdfProcessor.processPDFAttachments).toHaveBeenCalled();
      expect(forwardedEmailDetector.detectForwardedChain).toHaveBeenCalled();
    });

    it('should handle PDF attachments correctly', async () => {
      const emailWithPDF: ParsedEmail = {
        ...mockParsedEmail,
        attachments: [
          {
            filename: 'receipt.pdf',
            contentType: 'application/pdf',
            size: 1024,
            content: Buffer.from('PDF content'),
          },
        ],
      };

      // Mock dependencies
      vi.mocked(duplicateDetector.isDuplicate).mockResolvedValue({
        isDuplicate: false,
        confidence: 0,
      });
      vi.mocked(emailSanitizer.sanitizeEmail).mockResolvedValue({
        sanitizedEmail: emailWithPDF,
        securityFlags: [],
        sanitizationActions: [],
      });
      vi.mocked(pdfProcessor.processPDFAttachments).mockResolvedValue(['Extracted PDF text']);
      vi.mocked(forwardedEmailDetector.detectForwardedChain).mockResolvedValue(null);

      const result = await advancedEmailProcessor.processAdvancedEmail(
        emailWithPDF,
        mockOrgId,
        mockCorrelationId
      );

      expect(result.attachmentTexts).toEqual(['Extracted PDF text']);
      expect(pdfProcessor.processPDFAttachments).toHaveBeenCalledWith(
        emailWithPDF.attachments,
        mockOrgId,
        mockCorrelationId
      );
    });

    it('should handle forwarded email chains', async () => {
      const forwardedEmail: ParsedEmail = {
        ...mockParsedEmail,
        subject: 'Fwd: Receipt from Store',
        text: 'Original message:\nFrom: store@example.com\nThank you for your purchase',
      };

      const mockForwardedChain = {
        originalSender: 'store@example.com',
        forwardedBy: ['user@example.com'],
        chainDepth: 1,
        extractedContent: 'Thank you for your purchase',
      };

      // Mock dependencies
      vi.mocked(duplicateDetector.isDuplicate).mockResolvedValue({
        isDuplicate: false,
        confidence: 0,
      });
      vi.mocked(emailSanitizer.sanitizeEmail).mockResolvedValue({
        sanitizedEmail: forwardedEmail,
        securityFlags: [],
        sanitizationActions: [],
      });
      vi.mocked(pdfProcessor.processPDFAttachments).mockResolvedValue([]);
      vi.mocked(forwardedEmailDetector.detectForwardedChain).mockResolvedValue(mockForwardedChain);
      vi.mocked(forwardedEmailDetector.extractFromForwardedChain).mockResolvedValue({
        text: 'Enhanced forwarded content',
        html: '<p>Enhanced forwarded content</p>',
      });

      const result = await advancedEmailProcessor.processAdvancedEmail(
        forwardedEmail,
        mockOrgId,
        mockCorrelationId
      );

      expect(result.forwardedChain).toEqual(mockForwardedChain);
      expect(result.processedEmail.text).toBe('Enhanced forwarded content');
      expect(result.processedEmail.html).toBe('<p>Enhanced forwarded content</p>');
    });

    it('should perform quality checks on processed content', async () => {
      const lowQualityEmail: ParsedEmail = {
        ...mockParsedEmail,
        subject: 'Hi',
        text: 'Short message',
      };

      // Mock dependencies
      vi.mocked(duplicateDetector.isDuplicate).mockResolvedValue({
        isDuplicate: false,
        confidence: 0,
      });
      vi.mocked(emailSanitizer.sanitizeEmail).mockResolvedValue({
        sanitizedEmail: lowQualityEmail,
        securityFlags: [],
        sanitizationActions: [],
      });
      vi.mocked(pdfProcessor.processPDFAttachments).mockResolvedValue([]);
      vi.mocked(forwardedEmailDetector.detectForwardedChain).mockResolvedValue(null);

      const result = await advancedEmailProcessor.processAdvancedEmail(
        lowQualityEmail,
        mockOrgId,
        mockCorrelationId
      );

      // Should have quality flags for non-receipt content and short content
      expect(result.securityFlags.length).toBeGreaterThan(0);
      expect(result.securityFlags.some(flag => 
        flag.description.includes('does not appear to be a receipt')
      )).toBe(true);
      expect(result.securityFlags.some(flag => 
        flag.description.includes('unusually short')
      )).toBe(true);
    });

    it('should handle excessive forwarding', async () => {
      const excessivelyForwardedEmail: ParsedEmail = {
        ...mockParsedEmail,
        subject: 'Fwd: Fwd: Fwd: Fwd: Receipt',
      };

      // Mock dependencies
      vi.mocked(duplicateDetector.isDuplicate).mockResolvedValue({
        isDuplicate: false,
        confidence: 0,
      });
      vi.mocked(emailSanitizer.sanitizeEmail).mockResolvedValue({
        sanitizedEmail: excessivelyForwardedEmail,
        securityFlags: [],
        sanitizationActions: [],
      });
      vi.mocked(pdfProcessor.processPDFAttachments).mockResolvedValue([]);
      vi.mocked(forwardedEmailDetector.detectForwardedChain).mockResolvedValue(null);

      const result = await advancedEmailProcessor.processAdvancedEmail(
        excessivelyForwardedEmail,
        mockOrgId,
        mockCorrelationId
      );

      // Should flag excessive forwarding
      expect(result.securityFlags.some(flag => 
        flag.description.includes('forwarded multiple times')
      )).toBe(true);
    });

    it('should handle processing errors gracefully', async () => {
      // Mock duplicate detection to throw error
      vi.mocked(duplicateDetector.isDuplicate).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        advancedEmailProcessor.processAdvancedEmail(
          mockParsedEmail,
          mockOrgId,
          mockCorrelationId
        )
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('isLikelyReceiptContent', () => {
    it('should identify receipt content by keywords', () => {
      const receiptEmail: ParsedEmail = {
        ...mockParsedEmail,
        text: 'Thank you for your purchase. Total: $25.99',
      };

      // Access private method through any cast for testing
      const isReceipt = (advancedEmailProcessor as any).isLikelyReceiptContent(receiptEmail);
      expect(isReceipt).toBe(true);
    });

    it('should identify receipt content by currency patterns', () => {
      const receiptEmail: ParsedEmail = {
        ...mockParsedEmail,
        text: 'Amount charged: $15.50',
      };

      const isReceipt = (advancedEmailProcessor as any).isLikelyReceiptContent(receiptEmail);
      expect(isReceipt).toBe(true);
    });

    it('should not identify non-receipt content', () => {
      const nonReceiptEmail: ParsedEmail = {
        ...mockParsedEmail,
        subject: 'Meeting reminder',
        text: 'Don\'t forget about our meeting tomorrow',
      };

      const isReceipt = (advancedEmailProcessor as any).isLikelyReceiptContent(nonReceiptEmail);
      expect(isReceipt).toBe(false);
    });
  });
});