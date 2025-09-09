import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enhancedEmailProcessor } from '../enhanced-email-processor';
import { aiProcessingPipeline } from '../ai-processing-pipeline';
import { transactionProcessor } from '../transaction-processor';

// Mock dependencies
vi.mock('../ai-processing-pipeline');
vi.mock('../transaction-processor');
vi.mock('../logging-service', () => ({
  loggingService: {
    logProcessingStep: vi.fn(),
    generateCorrelationId: vi.fn(() => 'test-correlation-id'),
    recordPerformanceMetric: vi.fn(),
    logAIUsage: vi.fn(),
  },
}));

describe('EnhancedEmailProcessor - SES Integration', () => {
  const mockOrgId = 'test-org-id';
  const mockEmailId = 'test-email-id';
  const mockUserId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processEmailToTransaction with SES support', () => {
    it('should process SES email with AI pipeline integration', async () => {
      // Mock AI processing pipeline result
      const mockProcessingResult = {
        receiptData: {
          date: '2024-01-15',
          amount: 25.50,
          currency: 'USD',
          merchant: 'Test Merchant',
          last4: '1234',
          category: 'Food & Dining',
          subcategory: null,
          notes: null,
          confidence: 85,
          explanation: 'Categorized as Food & Dining based on merchant name',
        },
        translationResult: {
          originalText: 'Original receipt text',
          translatedText: 'Original receipt text',
          sourceLanguage: 'English',
          confidence: 1.0,
        },
        processingTimeMs: 1500,
        appliedMapping: false,
        fallbackUsed: false,
      };

      vi.mocked(aiProcessingPipeline.processReceiptText).mockResolvedValue(mockProcessingResult);

      // Mock transaction creation
      const mockTransaction = {
        id: 'test-transaction-id',
        org_id: mockOrgId,
        email_id: mockEmailId,
        date: '2024-01-15',
        amount: 25.50,
        currency: 'USD',
        merchant: 'Test Merchant',
        category: 'Food & Dining',
        confidence: 85,
        explanation: 'Categorized as Food & Dining based on merchant name',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.mocked(transactionProcessor.createTransactionFromSESResult).mockResolvedValue(mockTransaction as any);

      const emailContent = 'Test receipt content from SES';
      const metadata = {
        provider: 'ses',
        rawRef: 's3://bucket/key',
        correlationId: 'test-correlation-id',
      };

      const result = await enhancedEmailProcessor.processEmailToTransaction(
        mockEmailId,
        mockOrgId,
        emailContent,
        mockUserId,
        metadata
      );

      expect(result.success).toBe(true);
      expect(result.transaction).toEqual(mockTransaction);
      expect(result.processingTimeMs).toBeGreaterThan(0);

      // Verify AI processing was called with correct parameters
      expect(aiProcessingPipeline.processReceiptText).toHaveBeenCalledWith(
        emailContent,
        mockOrgId,
        mockEmailId
      );

      // Verify transaction creation was called with SES-specific method
      expect(transactionProcessor.createTransactionFromSESResult).toHaveBeenCalledWith(
        mockEmailId,
        mockOrgId,
        expect.objectContaining({
          ...mockProcessingResult,
          provider: 'ses',
          rawRef: 's3://bucket/key',
          correlationId: 'test-correlation-id',
        }),
        mockUserId
      );
    });

    it('should handle fallback processing when AI services fail', async () => {
      // Mock AI processing pipeline to use fallback
      const mockFallbackResult = {
        receiptData: {
          date: '2024-01-15',
          amount: 0,
          currency: 'USD',
          merchant: 'Unknown Merchant',
          last4: null,
          category: 'Other',
          subcategory: null,
          notes: 'Processed using fallback categorization due to AI service unavailability',
          confidence: 30,
          explanation: 'Categorized as "Other" using keyword matching. AI services were unavailable.',
          fallbackUsed: true,
        },
        translationResult: {
          originalText: 'Test content',
          translatedText: 'Test content',
          sourceLanguage: 'English',
          confidence: 0.5,
        },
        processingTimeMs: 500,
        appliedMapping: false,
        fallbackUsed: true,
      };

      vi.mocked(aiProcessingPipeline.processReceiptText).mockResolvedValue(mockFallbackResult);

      // Mock transaction creation
      const mockTransaction = {
        id: 'test-transaction-id',
        org_id: mockOrgId,
        email_id: mockEmailId,
        date: '2024-01-15',
        amount: 0,
        currency: 'USD',
        merchant: 'Unknown Merchant',
        category: 'Other',
        confidence: 30,
        notes: 'Processed using fallback categorization due to AI service unavailability',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.mocked(transactionProcessor.createTransactionFromSESResult).mockResolvedValue(mockTransaction as any);

      const emailContent = 'Test receipt content';
      const metadata = {
        provider: 'ses',
        rawRef: 's3://bucket/key',
      };

      const result = await enhancedEmailProcessor.processEmailToTransaction(
        mockEmailId,
        mockOrgId,
        emailContent,
        mockUserId,
        metadata
      );

      expect(result.success).toBe(true);
      expect(result.transaction).toEqual(mockTransaction);

      // Verify fallback was used
      expect(transactionProcessor.createTransactionFromSESResult).toHaveBeenCalledWith(
        mockEmailId,
        mockOrgId,
        expect.objectContaining({
          fallbackUsed: true,
        }),
        mockUserId
      );
    });

    it('should include SES-specific metadata in processing result', async () => {
      const mockProcessingResult = {
        receiptData: {
          date: '2024-01-15',
          amount: 25.50,
          currency: 'USD',
          merchant: 'Test Merchant',
          category: 'Food & Dining',
          confidence: 85,
          explanation: 'Test explanation',
        },
        translationResult: {
          originalText: 'Original text',
          translatedText: 'Translated text',
          sourceLanguage: 'Spanish',
          confidence: 0.9,
        },
        processingTimeMs: 1500,
        appliedMapping: true,
        fallbackUsed: false,
      };

      vi.mocked(aiProcessingPipeline.processReceiptText).mockResolvedValue(mockProcessingResult);
      vi.mocked(transactionProcessor.createTransactionFromSESResult).mockResolvedValue({
        id: 'test-transaction-id',
      } as any);

      const emailContent = 'Test content';
      const metadata = {
        provider: 'ses',
        rawRef: 's3://bucket/key',
        correlationId: 'test-correlation-id',
      };

      await enhancedEmailProcessor.processEmailToTransaction(
        mockEmailId,
        mockOrgId,
        emailContent,
        mockUserId,
        metadata
      );

      // Verify SES-specific metadata was passed to transaction creation
      expect(transactionProcessor.createTransactionFromSESResult).toHaveBeenCalledWith(
        mockEmailId,
        mockOrgId,
        expect.objectContaining({
          provider: 'ses',
          rawRef: 's3://bucket/key',
          correlationId: 'test-correlation-id',
          fallbackUsed: false,
          processingMetadata: expect.objectContaining({
            hasOriginalText: true,
            hasTranslatedText: true,
            sourceLanguage: 'Spanish',
            wasTranslated: true,
            confidenceScore: 85,
            appliedMapping: true,
            fallbackUsed: false,
          }),
        }),
        mockUserId
      );
    });
  });
});