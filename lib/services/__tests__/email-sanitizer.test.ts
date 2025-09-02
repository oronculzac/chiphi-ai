import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emailSanitizer } from '../email-sanitizer';
import { ParsedEmail, EmailAttachment } from '@/lib/types';

// Mock logging service
vi.mock('../logging-service');

describe('EmailSanitizer', () => {
  const mockOrgId = 'test-org-id';
  const mockCorrelationId = 'test-correlation-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sanitizeEmail', () => {
    it('should sanitize text content and detect security issues', async () => {
      const maliciousEmail: ParsedEmail = {
        messageId: 'test-message-id',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'URGENT: Verify your account now!',
        text: 'Click here to verify your account: javascript:alert("xss") Credit card: 1234-5678-9012-3456',
        html: '<script>alert("xss")</script><p>Click here</p>',
        attachments: [],
        headers: {},
      };

      const result = await emailSanitizer.sanitizeEmail(
        maliciousEmail,
        mockOrgId,
        mockCorrelationId
      );

      // Should detect security flags
      expect(result.securityFlags.length).toBeGreaterThan(0);
      expect(result.securityFlags.some(flag => flag.type === 'phishing_attempt')).toBe(true);
      expect(result.securityFlags.some(flag => flag.type === 'malicious_code')).toBe(true);

      // Should sanitize content
      expect(result.sanitizedEmail.text).toContain('**** **** **** 3456'); // Credit card redacted
      expect(result.sanitizedEmail.text).toContain('javascript:void(0)'); // JavaScript neutralized
      expect(result.sanitizedEmail.html).not.toContain('<script>'); // Script tags removed

      // Should record sanitization actions
      expect(result.sanitizationActions.length).toBeGreaterThan(0);
      expect(result.sanitizationActions.some(action => action.type === 'redaction')).toBe(true);
      expect(result.sanitizationActions.some(action => action.type === 'removal')).toBe(true);
    });

    it('should redact sensitive information', async () => {
      const emailWithSensitiveData: ParsedEmail = {
        messageId: 'test-message-id',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Receipt',
        text: `
          Credit Card: 4532-1234-5678-9012
          SSN: 123-45-6789
          Phone: 555-123-4567
          Email: user@example.com
        `,
        html: '',
        attachments: [],
        headers: {},
      };

      const result = await emailSanitizer.sanitizeEmail(
        emailWithSensitiveData,
        mockOrgId,
        mockCorrelationId
      );

      const sanitizedText = result.sanitizedEmail.text;
      
      // Credit card should be redacted (keep last 4)
      expect(sanitizedText).toContain('**** **** **** 9012');
      expect(sanitizedText).not.toContain('4532-1234-5678-9012');

      // SSN should be redacted
      expect(sanitizedText).toContain('***-**-****');
      expect(sanitizedText).not.toContain('123-45-6789');

      // Phone should be redacted (keep last 4)
      expect(sanitizedText).toContain('***-***-4567');
      expect(sanitizedText).not.toContain('555-123-4567');

      // Email should be redacted (keep domain)
      expect(sanitizedText).toContain('***@example.com');
      expect(sanitizedText).not.toContain('user@example.com');
    });

    it('should sanitize HTML content', async () => {
      const emailWithMaliciousHTML: ParsedEmail = {
        messageId: 'test-message-id',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Receipt',
        text: '',
        html: `
          <script>alert('xss')</script>
          <style>body { background: expression(alert('css-xss')); }</style>
          <a href="javascript:alert('link-xss')">Click here</a>
          <div onclick="alert('event')">Click me</div>
          <form action="javascript:submit()">Submit</form>
        `,
        attachments: [],
        headers: {},
      };

      const result = await emailSanitizer.sanitizeEmail(
        emailWithMaliciousHTML,
        mockOrgId,
        mockCorrelationId
      );

      const sanitizedHTML = result.sanitizedEmail.html;

      // Script tags should be removed
      expect(sanitizedHTML).not.toContain('<script>');
      expect(sanitizedHTML).not.toContain('alert(\'xss\')');

      // Dangerous CSS should be removed
      expect(sanitizedHTML).not.toContain('expression(');

      // JavaScript URLs should be neutralized
      expect(sanitizedHTML).toContain('javascript:void(0)');
      expect(sanitizedHTML).not.toContain('javascript:alert');

      // Event handlers should be neutralized
      expect(sanitizedHTML).toContain('data-removed-onclick');
      expect(sanitizedHTML).not.toContain('onclick="alert');

      // Should have security flags
      expect(result.securityFlags.some(flag => flag.type === 'malicious_code')).toBe(true);
    });

    it('should validate and filter dangerous attachments', async () => {
      const dangerousAttachment: EmailAttachment = {
        filename: 'malware.exe',
        contentType: 'application/x-executable',
        size: 1024,
        content: Buffer.from('fake executable'),
      };

      const safeAttachment: EmailAttachment = {
        filename: 'receipt.pdf',
        contentType: 'application/pdf',
        size: 1024,
        content: Buffer.from('%PDF-1.4 safe pdf content'),
      };

      const emailWithAttachments: ParsedEmail = {
        messageId: 'test-message-id',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Receipt',
        text: 'Please see attached receipt',
        html: '',
        attachments: [dangerousAttachment, safeAttachment],
        headers: {},
      };

      const result = await emailSanitizer.sanitizeEmail(
        emailWithAttachments,
        mockOrgId,
        mockCorrelationId
      );

      // Dangerous attachment should be removed
      expect(result.sanitizedEmail.attachments).toHaveLength(1);
      expect(result.sanitizedEmail.attachments[0].filename).toBe('receipt.pdf');

      // Should have security flags for dangerous attachment
      expect(result.securityFlags.some(flag => flag.type === 'dangerous_file_type')).toBe(true);

      // Should have sanitization action for removal
      expect(result.sanitizationActions.some(action => 
        action.type === 'removal' && action.description.includes('malware.exe')
      )).toBe(true);
    });

    it('should detect oversized attachments', async () => {
      const oversizedAttachment: EmailAttachment = {
        filename: 'large-file.pdf',
        contentType: 'application/pdf',
        size: 15 * 1024 * 1024, // 15MB (over 10MB limit)
        content: Buffer.alloc(15 * 1024 * 1024),
      };

      const emailWithOversizedAttachment: ParsedEmail = {
        messageId: 'test-message-id',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Receipt',
        text: 'Large attachment',
        html: '',
        attachments: [oversizedAttachment],
        headers: {},
      };

      const result = await emailSanitizer.sanitizeEmail(
        emailWithOversizedAttachment,
        mockOrgId,
        mockCorrelationId
      );

      // Oversized attachment should be removed
      expect(result.sanitizedEmail.attachments).toHaveLength(0);

      // Should have security flag for oversized attachment
      expect(result.securityFlags.some(flag => flag.type === 'oversized_attachment')).toBe(true);
    });

    it('should detect suspicious senders', async () => {
      const emailFromSpamDomain: ParsedEmail = {
        messageId: 'test-message-id',
        from: 'sender@tempmail.org',
        to: 'recipient@example.com',
        subject: 'Receipt',
        text: 'Thank you for your purchase',
        html: '',
        attachments: [],
        headers: {},
      };

      const result = await emailSanitizer.sanitizeEmail(
        emailFromSpamDomain,
        mockOrgId,
        mockCorrelationId
      );

      // Should flag suspicious sender
      expect(result.securityFlags.some(flag => 
        flag.type === 'suspicious_sender' && 
        flag.description.includes('temporary/disposable email domain')
      )).toBe(true);
    });

    it('should validate PDF content for security', async () => {
      const maliciousPDFAttachment: EmailAttachment = {
        filename: 'receipt.pdf',
        contentType: 'application/pdf',
        size: 1024,
        content: Buffer.from('%PDF-1.4\n/JavaScript (alert("xss"))'),
      };

      const emailWithMaliciousPDF: ParsedEmail = {
        messageId: 'test-message-id',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Receipt',
        text: 'PDF receipt attached',
        html: '',
        attachments: [maliciousPDFAttachment],
        headers: {},
      };

      const result = await emailSanitizer.sanitizeEmail(
        emailWithMaliciousPDF,
        mockOrgId,
        mockCorrelationId
      );

      // Malicious PDF should be removed
      expect(result.sanitizedEmail.attachments).toHaveLength(0);

      // Should have security flag for malicious PDF
      expect(result.securityFlags.some(flag => 
        flag.type === 'malicious_code' && 
        flag.description.includes('PDF contains potentially malicious content')
      )).toBe(true);
    });

    it('should handle clean emails without issues', async () => {
      const cleanEmail: ParsedEmail = {
        messageId: 'test-message-id',
        from: 'store@legitimate-store.com',
        to: 'recipient@example.com',
        subject: 'Your Receipt',
        text: 'Thank you for your purchase. Total: $25.99',
        html: '<p>Thank you for your purchase. Total: $25.99</p>',
        attachments: [],
        headers: {},
      };

      const result = await emailSanitizer.sanitizeEmail(
        cleanEmail,
        mockOrgId,
        mockCorrelationId
      );

      // Should have no security flags
      expect(result.securityFlags).toHaveLength(0);

      // Should have no sanitization actions
      expect(result.sanitizationActions).toHaveLength(0);

      // Content should remain unchanged
      expect(result.sanitizedEmail.text).toBe(cleanEmail.text);
      expect(result.sanitizedEmail.html).toBe(cleanEmail.html);
    });
  });

  describe('validatePDFContent', () => {
    it('should reject PDFs with JavaScript', () => {
      const maliciousPDF = Buffer.from('%PDF-1.4\n/JavaScript (alert("xss"))');
      const isValid = (emailSanitizer as any).validatePDFContent(maliciousPDF);
      expect(isValid).toBe(false);
    });

    it('should reject PDFs with embedded files', () => {
      const maliciousPDF = Buffer.from('%PDF-1.4\n/EmbeddedFile');
      const isValid = (emailSanitizer as any).validatePDFContent(maliciousPDF);
      expect(isValid).toBe(false);
    });

    it('should reject PDFs with form submissions', () => {
      const maliciousPDF = Buffer.from('%PDF-1.4\n/SubmitForm');
      const isValid = (emailSanitizer as any).validatePDFContent(maliciousPDF);
      expect(isValid).toBe(false);
    });

    it('should accept clean PDFs', () => {
      const cleanPDF = Buffer.from('%PDF-1.4\nClean PDF content without dangerous features');
      const isValid = (emailSanitizer as any).validatePDFContent(cleanPDF);
      expect(isValid).toBe(true);
    });
  });
});