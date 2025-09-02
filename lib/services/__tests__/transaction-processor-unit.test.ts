import './setup'; // Import test setup first
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionProcessor } from '../transaction-processor';

/**
 * Unit tests for TransactionProcessor core functionality
 * 
 * These tests focus on the business logic without database dependencies:
 * - PII redaction
 * - Data validation
 * - Last4 extraction
 * - Error handling
 * 
 * Requirements tested:
 * - 3.3: PII redaction and last4 handling
 * - 7.4: Secure data handling
 */
describe('TransactionProcessor Core Functionality', () => {
  let processor: TransactionProcessor;

  beforeEach(() => {
    processor = new TransactionProcessor();
  });

  describe('PII Redaction', () => {
    it('should redact full credit card numbers', () => {
      const testCases = [
        {
          input: 'Card number: 4532-1234-5678-9012',
          expected: 'Card number: ****-****-****-9012'
        },
        {
          input: 'Payment with 4532123456789012',
          expected: 'Payment with ****-****-****-9012'
        },
        {
          input: 'Multiple cards: 4532-1234-5678-9012 and 5555-4444-3333-2222',
          expected: 'Multiple cards: ****-****-****-9012 and ****-****-****-2222'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = (processor as any).redactPII(input);
        expect(result).toBe(expected);
      });
    });

    it('should redact CVV codes', () => {
      const testCases = [
        {
          input: 'CVV: 123',
          expected: 'CVV: ***'
        },
        {
          input: 'CVC: 4567',
          expected: 'CVC: ***'
        },
        {
          input: 'Security code CVV:123 for verification',
          expected: 'Security code CVV: *** for verification'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = (processor as any).redactPII(input);
        expect(result).toBe(expected);
      });
    });

    it('should redact SSN numbers', () => {
      const testCases = [
        {
          input: 'SSN: 123-45-6789',
          expected: 'SSN: ***-**-****'
        },
        {
          input: 'Social Security Number 123456789',
          expected: 'Social Security Number ***-**-****'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = (processor as any).redactPII(input);
        expect(result).toBe(expected);
      });
    });

    it('should redact phone numbers in context', () => {
      const testCases = [
        {
          input: 'Phone: 555-123-4567',
          expected: 'Phone: ***-***-****'
        },
        {
          input: 'Contact tel: 555.123.4567',
          expected: 'Contact Phone: ***-***-****'
        },
        {
          input: 'Mobile: 5551234567',
          expected: 'Phone: ***-***-****'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = (processor as any).redactPII(input);
        expect(result).toBe(expected);
      });
    });

    it('should redact 2FA codes', () => {
      const testCases = [
        {
          input: 'Your verification code is 123456',
          expected: 'Your verification code is ******'
        },
        {
          input: 'Code: 987654 expires in 5 minutes',
          expected: 'Code: ****** expires in 5 minutes'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = (processor as any).redactPII(input);
        expect(result).toBe(expected);
      });
    });

    it('should redact email addresses', () => {
      const testCases = [
        {
          input: 'Contact us at support@example.com',
          expected: 'Contact us at ***@***.***'
        },
        {
          input: 'Email: user.name+tag@domain.co.uk',
          expected: 'Email: ***@***.***'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = (processor as any).redactPII(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle empty or null input', () => {
      expect((processor as any).redactPII('')).toBe('');
      expect((processor as any).redactPII(null)).toBe(null);
      expect((processor as any).redactPII(undefined)).toBe(undefined);
    });

    it('should preserve non-PII content', () => {
      const input = 'Receipt from McDonald\'s for $12.99 on 2024-01-15';
      const result = (processor as any).redactPII(input);
      expect(result).toBe(input); // Should be unchanged
    });
  });

  describe('Last4 Extraction', () => {
    it('should extract last 4 digits from various card formats', () => {
      const testCases = [
        {
          input: '4532-1234-5678-9012',
          expected: '9012'
        },
        {
          input: '4532123456789012',
          expected: '9012'
        },
        {
          input: '****-****-****-9012',
          expected: '9012'
        },
        {
          input: '4532 1234 5678 9012',
          expected: '9012'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = (processor as any).extractLast4(input);
        expect(result).toBe(expected);
      });
    });

    it('should return null for invalid input', () => {
      const testCases = [
        null,
        '',
        '123', // Too short
        'abc', // No digits
        '****-****-****-****' // No actual digits
      ];

      testCases.forEach(input => {
        const result = (processor as any).extractLast4(input);
        expect(result).toBeNull();
      });
    });

    it('should handle edge cases', () => {
      // Exactly 4 digits
      expect((processor as any).extractLast4('1234')).toBe('1234');
      
      // More than 16 digits (invalid card but should still extract last 4)
      expect((processor as any).extractLast4('12345678901234567890')).toBe('7890');
    });
  });

  describe('Processing Result Validation', () => {
    const validProcessingResult = {
      receiptData: {
        date: '2024-01-15',
        amount: 25.99,
        currency: 'USD',
        merchant: 'Test Merchant',
        last4: '1234',
        category: 'Food & Dining',
        subcategory: 'Restaurants',
        notes: 'Test transaction',
        confidence: 85,
        explanation: 'High confidence categorization'
      },
      translationResult: {
        translatedText: 'Receipt text',
        originalText: 'Receipt text',
        sourceLanguage: 'English',
        confidence: 100
      },
      processingTimeMs: 1500,
      appliedMapping: false
    };

    it('should validate correct processing results', () => {
      expect(() => {
        (processor as any).validateProcessingResult(validProcessingResult);
      }).not.toThrow();
    });

    it('should reject missing required fields', () => {
      const testCases = [
        {
          ...validProcessingResult,
          receiptData: { ...validProcessingResult.receiptData, date: '' }
        },
        {
          ...validProcessingResult,
          receiptData: { ...validProcessingResult.receiptData, merchant: '' }
        },
        {
          ...validProcessingResult,
          receiptData: { ...validProcessingResult.receiptData, category: '' }
        },
        {
          ...validProcessingResult,
          receiptData: { ...validProcessingResult.receiptData, explanation: '' }
        }
      ];

      testCases.forEach(result => {
        expect(() => {
          (processor as any).validateProcessingResult(result);
        }).toThrow();
      });
    });

    it('should reject invalid amounts', () => {
      const testCases = [
        {
          ...validProcessingResult,
          receiptData: { ...validProcessingResult.receiptData, amount: 0 }
        },
        {
          ...validProcessingResult,
          receiptData: { ...validProcessingResult.receiptData, amount: -10 }
        },
        {
          ...validProcessingResult,
          receiptData: { ...validProcessingResult.receiptData, amount: null }
        }
      ];

      testCases.forEach(result => {
        expect(() => {
          (processor as any).validateProcessingResult(result);
        }).toThrow('Invalid or missing amount');
      });
    });

    it('should reject invalid confidence scores', () => {
      const testCases = [
        {
          ...validProcessingResult,
          receiptData: { ...validProcessingResult.receiptData, confidence: -1 }
        },
        {
          ...validProcessingResult,
          receiptData: { ...validProcessingResult.receiptData, confidence: 101 }
        },
        {
          ...validProcessingResult,
          receiptData: { ...validProcessingResult.receiptData, confidence: 150 }
        }
      ];

      testCases.forEach(result => {
        expect(() => {
          (processor as any).validateProcessingResult(result);
        }).toThrow('Invalid confidence score');
      });
    });

    it('should reject confidence below minimum threshold', () => {
      const result = {
        ...validProcessingResult,
        receiptData: { ...validProcessingResult.receiptData, confidence: 25 }
      };

      expect(() => {
        (processor as any).validateProcessingResult(result);
      }).toThrow('below minimum threshold');
    });

    it('should reject invalid date formats', () => {
      const testCases = [
        {
          ...validProcessingResult,
          receiptData: { ...validProcessingResult.receiptData, date: '2024/01/15' }
        },
        {
          ...validProcessingResult,
          receiptData: { ...validProcessingResult.receiptData, date: '15-01-2024' }
        },
        {
          ...validProcessingResult,
          receiptData: { ...validProcessingResult.receiptData, date: 'January 15, 2024' }
        }
      ];

      testCases.forEach(result => {
        expect(() => {
          (processor as any).validateProcessingResult(result);
        }).toThrow('Invalid date format');
      });
    });

    it('should reject invalid currency codes', () => {
      const testCases = [
        {
          ...validProcessingResult,
          receiptData: { ...validProcessingResult.receiptData, currency: 'US' }
        },
        {
          ...validProcessingResult,
          receiptData: { ...validProcessingResult.receiptData, currency: 'DOLLAR' }
        },
        {
          ...validProcessingResult,
          receiptData: { ...validProcessingResult.receiptData, currency: 'usd' }
        }
      ];

      testCases.forEach(result => {
        expect(() => {
          (processor as any).validateProcessingResult(result);
        }).toThrow('Invalid currency format');
      });
    });
  });

  describe('Error Classification', () => {
    it('should identify retryable errors', () => {
      const retryableErrors = [
        new Error('Connection timeout'),
        new Error('Network error occurred'),
        new Error('Rate limit exceeded'),
        new Error('Service unavailable'),
        new Error('Internal server error')
      ];

      retryableErrors.forEach(error => {
        const isRetryable = (processor as any).isRetryableError(error);
        expect(isRetryable).toBe(true);
      });
    });

    it('should identify non-retryable errors', () => {
      const nonRetryableErrors = [
        new Error('Invalid input data'),
        new Error('Authentication failed'),
        new Error('Permission denied'),
        new Error('Resource not found')
      ];

      nonRetryableErrors.forEach(error => {
        const isRetryable = (processor as any).isRetryableError(error);
        expect(isRetryable).toBe(false);
      });
    });

    it('should handle non-Error objects', () => {
      const nonErrors = [
        'string error',
        { message: 'object error' },
        null,
        undefined
      ];

      nonErrors.forEach(error => {
        const isRetryable = (processor as any).isRetryableError(error);
        expect(isRetryable).toBe(false);
      });
    });
  });

  describe('Complex PII Scenarios', () => {
    it('should handle receipt with multiple PII types', () => {
      const receiptWithPII = `
        RECEIPT - McDonald's
        Date: 2024-01-15 12:30 PM
        
        Card: **** **** **** 9012
        CVV: 123
        Auth Code: 456789
        
        Customer Phone: 555-123-4567
        Email: customer@email.com
        
        Total: $12.99
        
        For support, call 1-800-MCDONALDS
        or email support@mcdonalds.com
      `;

      const redacted = (processor as any).redactPII(receiptWithPII);

      // Should not contain original PII
      expect(redacted).not.toContain('CVV: 123');
      expect(redacted).not.toContain('555-123-4567');
      expect(redacted).not.toContain('customer@email.com');
      expect(redacted).not.toContain('456789'); // 2FA code

      // Should contain redacted versions
      expect(redacted).toContain('CVV: ***');
      expect(redacted).toContain('Phone: ***-***-****');
      expect(redacted).toContain('***@***.***');
      expect(redacted).toContain('******'); // Auth code

      // Should preserve business information
      expect(redacted).toContain('McDonald\'s');
      expect(redacted).toContain('2024-01-15');
      expect(redacted).toContain('$12.99');
      expect(redacted).toContain('**** **** **** 9012'); // Partial PAN should remain
    });

    it('should preserve legitimate numbers that are not PII', () => {
      const receiptText = `
        Order #12345
        Table 8
        Items: 2
        Subtotal: $10.99
        Tax: $1.00
        Total: $11.99
        Store #1001
        Transaction ID: TXN789123
      `;

      const redacted = (processor as any).redactPII(receiptText);

      // Should preserve all legitimate numbers
      expect(redacted).toContain('Order #12345');
      expect(redacted).toContain('Table 8');
      expect(redacted).toContain('Items: 2');
      expect(redacted).toContain('$10.99');
      expect(redacted).toContain('$1.00');
      expect(redacted).toContain('$11.99');
      expect(redacted).toContain('Store #1001');
      expect(redacted).toContain('TXN789123');
    });
  });
});