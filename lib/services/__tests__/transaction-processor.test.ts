import './setup'; // Import test setup first
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransactionProcessor } from '../transaction-processor';
import { aiProcessingPipeline } from '../ai-processing-pipeline';
import { transactionDb } from '@/lib/database/transaction-operations';
import { logProcessingStep } from '@/lib/database/utils';
import { ProcessingErrorType } from '@/lib/types';

// Mock dependencies
vi.mock('../ai-processing-pipeline');
vi.mock('@/lib/database/transaction-operations');
vi.mock('@/lib/database/utils');

describe('TransactionProcessor', () => {
  let processor: TransactionProcessor;
  
  const mockOrgId = 'org-123';
  const mockEmailId = 'email-456';
  const mockUserId = 'user-789';
  const mockTransactionId = 'txn-abc';

  const mockProcessingResult = {
    receiptData: {
      date: '2024-01-15',
      amount: 25.99,
      currency: 'USD',
      merchant: 'Test Merchant',
      last4: '1234',
      category: 'Food & Dining',
      subcategory: 'Restaurants',
      notes: 'Lunch meeting',
      confidence: 85,
      explanation: 'High confidence categorization based on merchant name'
    },
    translationResult: {
      translatedText: 'Receipt for lunch',
      originalText: 'Receipt for lunch',
      sourceLanguage: 'English',
      confidence: 100
    },
    processingTimeMs: 1500,
    appliedMapping: false
  };

  const mockTransaction = {
    id: mockTransactionId,
    org_id: mockOrgId,
    email_id: mockEmailId,
    date: '2024-01-15',
    amount: 25.99,
    currency: 'USD',
    merchant: 'Test Merchant',
    last4: '1234',
    category: 'Food & Dining',
    subcategory: 'Restaurants',
    notes: 'Lunch meeting',
    confidence: 85,
    explanation: 'High confidence categorization based on merchant name',
    original_text: 'Receipt for lunch',
    translated_text: null,
    source_language: null,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z'
  };

  beforeEach(() => {
    processor = new TransactionProcessor();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('processEmailToTransaction', () => {
    it('should successfully process email content to transaction', async () => {
      // Mock AI processing pipeline
      vi.mocked(aiProcessingPipeline.processReceiptText).mockResolvedValue(mockProcessingResult);
      
      // Mock database operations
      vi.mocked(transactionDb.createTransaction).mockResolvedValue(mockTransactionId);
      vi.mocked(transactionDb.getTransaction).mockResolvedValue(mockTransaction);
      
      // Mock logging
      vi.mocked(logProcessingStep).mockResolvedValue();

      const emailContent = 'Receipt from Test Merchant for $25.99';
      
      const result = await processor.processEmailToTransaction(
        mockEmailId,
        mockOrgId,
        emailContent,
        mockUserId
      );

      expect(result).toEqual(mockTransaction);
      expect(aiProcessingPipeline.processReceiptText).toHaveBeenCalledWith(
        emailContent, // PII should be redacted but this is simple text
        mockOrgId
      );
      expect(transactionDb.createTransaction).toHaveBeenCalledWith(
        mockOrgId,
        mockEmailId,
        expect.objectContaining({
          date: '2024-01-15',
          amount: 25.99,
          currency: 'USD',
          merchant: 'Test Merchant',
          category: 'Food & Dining',
          confidence: 85
        })
      );
      expect(logProcessingStep).toHaveBeenCalledWith(
        mockOrgId,
        mockEmailId,
        'transaction_processing',
        'started',
        expect.any(Object)
      );
      expect(logProcessingStep).toHaveBeenCalledWith(
        mockOrgId,
        mockEmailId,
        'transaction_processing',
        'completed',
        expect.objectContaining({
          transactionId: mockTransactionId,
          confidence: 85
        }),
        undefined,
        expect.any(Number)
      );
    });

    it('should redact PII from email content before processing', async () => {
      vi.mocked(aiProcessingPipeline.processReceiptText).mockResolvedValue(mockProcessingResult);
      vi.mocked(transactionDb.createTransaction).mockResolvedValue(mockTransactionId);
      vi.mocked(transactionDb.getTransaction).mockResolvedValue(mockTransaction);
      vi.mocked(logProcessingStep).mockResolvedValue();

      const emailContentWithPII = `
        Receipt from Test Merchant
        Card ending in 4532-1234-5678-9012
        CVV: 123
        Phone: 555-123-4567
        SSN: 123-45-6789
        Amount: $25.99
      `;

      await processor.processEmailToTransaction(
        mockEmailId,
        mockOrgId,
        emailContentWithPII,
        mockUserId
      );

      // Verify AI processing was called with redacted content
      const calledContent = vi.mocked(aiProcessingPipeline.processReceiptText).mock.calls[0][0];
      expect(calledContent).not.toContain('4532-1234-5678-9012');
      expect(calledContent).not.toContain('CVV: 123');
      expect(calledContent).not.toContain('555-123-4567');
      expect(calledContent).not.toContain('123-45-6789');
      expect(calledContent).toContain('****-****-****-9012');
    });

    it('should handle AI processing failures', async () => {
      vi.mocked(aiProcessingPipeline.processReceiptText).mockRejectedValue(
        new Error('AI processing failed')
      );
      vi.mocked(logProcessingStep).mockResolvedValue();

      const emailContent = 'Invalid receipt content';

      await expect(
        processor.processEmailToTransaction(mockEmailId, mockOrgId, emailContent)
      ).rejects.toThrow('Transaction processing failed: AI processing failed');

      expect(logProcessingStep).toHaveBeenCalledWith(
        mockOrgId,
        mockEmailId,
        'transaction_processing',
        'failed',
        expect.objectContaining({ error: 'AI processing failed' }),
        'AI processing failed',
        expect.any(Number)
      );
    });

    it('should validate processing results', async () => {
      const invalidResult = {
        ...mockProcessingResult,
        receiptData: {
          ...mockProcessingResult.receiptData,
          amount: -10, // Invalid negative amount
          confidence: 150 // Invalid confidence > 100
        }
      };

      vi.mocked(aiProcessingPipeline.processReceiptText).mockResolvedValue(invalidResult);
      vi.mocked(logProcessingStep).mockResolvedValue();

      await expect(
        processor.processEmailToTransaction(mockEmailId, mockOrgId, 'test content')
      ).rejects.toThrow('Invalid or missing amount');
    });
  });

  describe('updateTransaction', () => {
    it('should successfully update transaction with PII redaction', async () => {
      const updates = {
        notes: 'Updated notes with card 4532-1234-5678-9012',
        category: 'Updated Category',
        last4: '9876'
      };

      vi.mocked(transactionDb.updateTransaction).mockResolvedValue(true);
      vi.mocked(transactionDb.getTransaction).mockResolvedValue({
        ...mockTransaction,
        ...updates,
        notes: 'Updated notes with card ****-****-****-9012',
        last4: '9876'
      });

      const result = await processor.updateTransaction(
        mockTransactionId,
        updates,
        mockOrgId,
        mockUserId
      );

      expect(transactionDb.updateTransaction).toHaveBeenCalledWith(
        mockTransactionId,
        mockOrgId,
        mockUserId,
        expect.objectContaining({
          category: 'Updated Category',
          last4: '9876'
        })
      );
      expect(result.notes).not.toContain('4532-1234-5678-9012');
    });

    it('should handle update failures', async () => {
      vi.mocked(transactionDb.updateTransaction).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        processor.updateTransaction(mockTransactionId, {}, mockOrgId, mockUserId)
      ).rejects.toThrow('Transaction update failed: Database error');
    });
  });

  describe('getTransaction', () => {
    it('should retrieve transaction by ID', async () => {
      vi.mocked(transactionDb.getTransaction).mockResolvedValue(mockTransaction);

      const result = await processor.getTransaction(mockTransactionId, mockOrgId);

      expect(result).toEqual(mockTransaction);
      expect(transactionDb.getTransaction).toHaveBeenCalledWith(mockTransactionId);
    });

    it('should return null for non-existent transaction', async () => {
      vi.mocked(transactionDb.getTransaction).mockResolvedValue(null);

      const result = await processor.getTransaction('non-existent', mockOrgId);

      expect(result).toBeNull();
    });
  });

  describe('getTransactions', () => {
    it('should retrieve transactions with filtering options', async () => {
      const mockTransactions = [mockTransaction];
      vi.mocked(transactionDb.getTransactions).mockResolvedValue({
        transactions: mockTransactions,
        total: 1
      });

      const options = {
        limit: 10,
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        category: 'Food & Dining',
        minConfidence: 80
      };

      const result = await processor.getTransactions(mockOrgId, options);

      expect(result).toEqual({
        transactions: mockTransactions,
        total: 1
      });
      expect(transactionDb.getTransactions).toHaveBeenCalledWith(mockOrgId, options);
    });
  });

  describe('deleteTransaction', () => {
    it('should successfully delete transaction', async () => {
      vi.mocked(transactionDb.deleteTransaction).mockResolvedValue(true);

      await processor.deleteTransaction(mockTransactionId, mockOrgId);

      expect(transactionDb.deleteTransaction).toHaveBeenCalledWith(
        mockTransactionId,
        mockOrgId,
        undefined
      );
    });
  });

  describe('PII redaction', () => {
    it('should redact credit card numbers', () => {
      const processor = new TransactionProcessor();
      const textWithPAN = 'Card number: 4532-1234-5678-9012';
      
      // Access private method for testing
      const redacted = (processor as any).redactPII(textWithPAN);
      
      expect(redacted).not.toContain('4532-1234-5678-9012');
      expect(redacted).toContain('****-****-****-9012');
    });

    it('should redact CVV codes', () => {
      const processor = new TransactionProcessor();
      const textWithCVV = 'CVV: 123 and CVC: 4567';
      
      const redacted = (processor as any).redactPII(textWithCVV);
      
      expect(redacted).not.toContain('CVV: 123');
      expect(redacted).not.toContain('CVC: 4567');
      expect(redacted).toContain('CVV: ***');
      expect(redacted).toContain('CVC: ***');
    });

    it('should redact SSN', () => {
      const processor = new TransactionProcessor();
      const textWithSSN = 'SSN: 123-45-6789';
      
      const redacted = (processor as any).redactPII(textWithSSN);
      
      expect(redacted).not.toContain('123-45-6789');
      expect(redacted).toContain('***-**-****');
    });

    it('should redact phone numbers in context', () => {
      const processor = new TransactionProcessor();
      const textWithPhone = 'Phone: 555-123-4567';
      
      const redacted = (processor as any).redactPII(textWithPhone);
      
      expect(redacted).not.toContain('555-123-4567');
      expect(redacted).toContain('***-***-****');
    });

    it('should redact 2FA codes', () => {
      const processor = new TransactionProcessor();
      const textWith2FA = 'Your code is 123456';
      
      const redacted = (processor as any).redactPII(textWith2FA);
      
      expect(redacted).not.toContain('123456');
      expect(redacted).toContain('******');
    });
  });

  describe('last4 extraction', () => {
    it('should extract last 4 digits from card number', () => {
      const processor = new TransactionProcessor();
      
      expect((processor as any).extractLast4('4532-1234-5678-9012')).toBe('9012');
      expect((processor as any).extractLast4('4532123456789012')).toBe('9012');
      expect((processor as any).extractLast4('****-****-****-9012')).toBe('9012');
    });

    it('should return null for invalid card info', () => {
      const processor = new TransactionProcessor();
      
      expect((processor as any).extractLast4('123')).toBeNull();
      expect((processor as any).extractLast4('')).toBeNull();
      expect((processor as any).extractLast4(null)).toBeNull();
    });
  });

  describe('validation', () => {
    it('should validate processing results', () => {
      const processor = new TransactionProcessor();
      
      // Valid result should not throw
      expect(() => {
        (processor as any).validateProcessingResult(mockProcessingResult);
      }).not.toThrow();
    });

    it('should reject invalid processing results', () => {
      const processor = new TransactionProcessor();
      
      const invalidResults = [
        {
          ...mockProcessingResult,
          receiptData: { ...mockProcessingResult.receiptData, date: '' }
        },
        {
          ...mockProcessingResult,
          receiptData: { ...mockProcessingResult.receiptData, amount: -10 }
        },
        {
          ...mockProcessingResult,
          receiptData: { ...mockProcessingResult.receiptData, confidence: 150 }
        },
        {
          ...mockProcessingResult,
          receiptData: { ...mockProcessingResult.receiptData, currency: 'INVALID' }
        }
      ];

      invalidResults.forEach(result => {
        expect(() => {
          (processor as any).validateProcessingResult(result);
        }).toThrow();
      });
    });
  });

  describe('getTransactionStats', () => {
    it('should retrieve transaction statistics', async () => {
      const mockStats = {
        totalTransactions: 10,
        totalAmount: 259.90,
        averageConfidence: 85.5,
        lowConfidenceCount: 2,
        categoryBreakdown: [
          { category: 'Food & Dining', count: 5, amount: 125.50 },
          { category: 'Shopping', count: 3, amount: 89.40 },
          { category: 'Transportation', count: 2, amount: 45.00 }
        ]
      };

      vi.mocked(transactionDb.getTransactionStats).mockResolvedValue(mockStats);

      const result = await processor.getTransactionStats(mockOrgId);

      expect(result).toEqual(mockStats);
      expect(transactionDb.getTransactionStats).toHaveBeenCalledWith(mockOrgId, undefined);
    });

    it('should handle date range filtering', async () => {
      const dateRange = { start: '2024-01-01', end: '2024-01-31' };
      vi.mocked(transactionDb.getTransactionStats).mockResolvedValue({
        totalTransactions: 5,
        totalAmount: 125.50,
        averageConfidence: 88.0,
        lowConfidenceCount: 1,
        categoryBreakdown: []
      });

      await processor.getTransactionStats(mockOrgId, dateRange);

      expect(transactionDb.getTransactionStats).toHaveBeenCalledWith(mockOrgId, dateRange);
    });
  });
});