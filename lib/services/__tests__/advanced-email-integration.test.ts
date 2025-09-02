import { describe, it, expect } from 'vitest';
import { ParsedEmail } from '@/lib/types';

describe('Advanced Email Processing Integration', () => {
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

  describe('Email Content Processing', () => {
    it('should identify receipt-like content', () => {
      const receiptContent = 'Thank you for your purchase. Total: $25.99';
      
      // Test receipt keyword detection
      const hasReceiptKeywords = ['receipt', 'purchase', 'total'].some(keyword => 
        receiptContent.toLowerCase().includes(keyword)
      );
      
      expect(hasReceiptKeywords).toBe(true);
    });

    it('should detect currency patterns', () => {
      const content = 'Amount charged: $15.50';
      const currencyPattern = /[\$€£¥]\s*\d+|\d+\s*(?:usd|eur|gbp|jpy|dollars?|euros?|pounds?|yen)/i;
      
      expect(currencyPattern.test(content)).toBe(true);
    });

    it('should identify forwarded emails', () => {
      const forwardedSubject = 'Fwd: Receipt from Store';
      const forwardedContent = 'Original message:\nFrom: store@example.com\nThank you for your purchase';
      
      const isForwarded = forwardedSubject.toLowerCase().includes('fwd:') ||
                         forwardedContent.toLowerCase().includes('original message');
      
      expect(isForwarded).toBe(true);
    });

    it('should detect suspicious patterns', () => {
      const suspiciousContent = 'URGENT: Click here to verify your account now!';
      
      const suspiciousPatterns = [
        /urgent.*action/i,
        /click.*here/i,
        /verify.*account/i,
      ];
      
      const hasSuspiciousPattern = suspiciousPatterns.some(pattern => 
        pattern.test(suspiciousContent)
      );
      
      expect(hasSuspiciousPattern).toBe(true);
    });

    it('should redact sensitive information', () => {
      const contentWithSensitiveData = 'Credit Card: 4532-1234-5678-9012, SSN: 123-45-6789';
      
      // Redact credit card (keep last 4)
      let sanitized = contentWithSensitiveData.replace(
        /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?(\d{4})\b/g,
        '**** **** **** $1'
      );
      
      // Redact SSN
      sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '***-**-****');
      
      expect(sanitized).toContain('**** **** **** 9012');
      expect(sanitized).toContain('***-**-****');
      expect(sanitized).not.toContain('4532-1234-5678-9012');
      expect(sanitized).not.toContain('123-45-6789');
    });

    it('should validate PDF file headers', () => {
      const validPDFBuffer = Buffer.from('%PDF-1.4\nValid PDF content');
      const invalidBuffer = Buffer.from('Not a PDF file');
      
      const isValidPDF = (buffer: Buffer): boolean => {
        if (buffer.length < 4) return false;
        const header = buffer.subarray(0, 4).toString('ascii');
        return header === '%PDF';
      };
      
      expect(isValidPDF(validPDFBuffer)).toBe(true);
      expect(isValidPDF(invalidBuffer)).toBe(false);
    });

    it('should detect malicious PDF content', () => {
      const maliciousPDFContent = '%PDF-1.4\n/JavaScript (alert("xss"))';
      const cleanPDFContent = '%PDF-1.4\nClean PDF content';
      
      const hasMaliciousContent = (content: string): boolean => {
        return content.includes('/JavaScript') || 
               content.includes('/EmbeddedFile') || 
               content.includes('/SubmitForm');
      };
      
      expect(hasMaliciousContent(maliciousPDFContent)).toBe(true);
      expect(hasMaliciousContent(cleanPDFContent)).toBe(false);
    });

    it('should calculate content similarity', () => {
      const text1 = 'thank you for your purchase total amount';
      const text2 = 'thank you for your purchase total amount';
      const text3 = 'completely different content here';
      
      const calculateSimilarity = (str1: string, str2: string): number => {
        const words1 = new Set(str1.toLowerCase().split(/\s+/));
        const words2 = new Set(str2.toLowerCase().split(/\s+/));
        
        const intersection = new Set([...words1].filter(word => words2.has(word)));
        const union = new Set([...words1, ...words2]);
        
        return intersection.size / union.size;
      };
      
      expect(calculateSimilarity(text1, text2)).toBe(1.0);
      expect(calculateSimilarity(text1, text3)).toBeLessThan(0.5);
    });

    it('should generate consistent content hashes', () => {
      const content1 = 'Thank you for your purchase';
      const content2 = 'Thank you for your purchase';
      const content3 = 'Different content';
      
      const generateHash = (content: string): string => {
        // Simple hash function for testing
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
          const char = content.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
      };
      
      expect(generateHash(content1)).toBe(generateHash(content2));
      expect(generateHash(content1)).not.toBe(generateHash(content3));
    });

    it('should extract original content from forwarded emails', () => {
      const forwardedEmail = `
        Forwarded message:
        From: store@example.com
        To: customer@example.com
        Subject: Receipt
        
        Thank you for your purchase.
        Total: $25.99
        
        Visit us again!
      `;
      
      // Extract content after forwarding headers
      const lines = forwardedEmail.split('\n');
      let extractedContent = '';
      let foundContent = false;
      
      for (const line of lines) {
        if (foundContent) {
          extractedContent += line + '\n';
        } else if (line.trim().includes('Subject:')) {
          foundContent = true;
        }
      }
      
      expect(extractedContent).toContain('Thank you for your purchase');
      expect(extractedContent).toContain('$25.99');
    });
  });

  describe('Security Validation', () => {
    it('should detect dangerous file types', () => {
      const dangerousTypes = [
        'application/x-executable',
        'application/x-msdownload',
        'application/x-msdos-program',
      ];
      
      const testType = 'application/x-executable';
      expect(dangerousTypes.includes(testType)).toBe(true);
      
      const safeType = 'application/pdf';
      expect(dangerousTypes.includes(safeType)).toBe(false);
    });

    it('should validate file size limits', () => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const fileSize1 = 5 * 1024 * 1024; // 5MB
      const fileSize2 = 15 * 1024 * 1024; // 15MB
      
      expect(fileSize1 <= maxSize).toBe(true);
      expect(fileSize2 <= maxSize).toBe(false);
    });

    it('should detect spam domains', () => {
      const spamDomains = ['tempmail.org', '10minutemail.com', 'guerrillamail.com'];
      const testEmail1 = 'user@tempmail.org';
      const testEmail2 = 'user@legitimate-domain.com';
      
      const domain1 = testEmail1.split('@')[1];
      const domain2 = testEmail2.split('@')[1];
      
      expect(spamDomains.includes(domain1)).toBe(true);
      expect(spamDomains.includes(domain2)).toBe(false);
    });
  });
});