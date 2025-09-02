import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIProcessingPipeline } from '../ai-processing-pipeline';

// Mock the services
vi.mock('../ai-language-normalizer', () => ({
  languageNormalizer: {
    normalizeText: vi.fn()
  }
}));

vi.mock('../ai-data-extractor', () => ({
  dataExtractor: {
    extractReceiptDataWithRetry: vi.fn()
  }
}));

describe('AIProcessingPipeline', () => {
  let pipeline: AIProcessingPipeline;
  let mockLanguageNormalizer: any;
  let mockDataExtractor: any;

  beforeEach(() => {
    pipeline = new AIProcessingPipeline();
    mockLanguageNormalizer = vi.mocked(require('../ai-language-normalizer').languageNormalizer);
    mockDataExtractor = vi.mocked(require('../ai-data-extractor').dataExtractor);
    vi.clearAllMocks();
  });

  describe('processReceiptText', () => {
    it('should process receipt text successfully', async () => {
      const originalText = 'Gracias por su compra en Starbucks';
      
      const mockTranslationResult = {
        translatedText: 'Thank you for your purchase at Starbucks',
        originalText: originalText,
        sourceLanguage: 'Spanish',
        confidence: 0.95
      };

      const mockReceiptData = {
        date: '2024-01-15',
        amount: 25.99,
        currency: 'USD',
        merchant: 'Starbucks',
        last4: '1234',
        category: 'Food & Dining',
        subcategory: 'Coffee',
        notes: null,
        confidence: 95,
        explanation: 'Coffee shop purchase categorized as Food & Dining'
      };

      mockLanguageNormalizer.normalizeText.mockResolvedValue(mockTranslationResult);
      mockDataExtractor.extractReceiptDataWithRetry.mockResolvedValue(mockReceiptData);

      const result = await pipeline.processReceiptText(originalText);

      expect(result).toEqual({
        receiptData: mockReceiptData,
        translationResult: mockTranslationResult,
        processingTimeMs: expect.any(Number)
      });

      expect(mockLanguageNormalizer.normalizeText).toHaveBeenCalledWith(originalText);
      expect(mockDataExtractor.extractReceiptDataWithRetry).toHaveBeenCalledWith(mockTranslationResult.translatedText);
    });

    it('should throw error for empty text', async () => {
      await expect(pipeline.processReceiptText('')).rejects.toThrow('Receipt text cannot be empty');
      await expect(pipeline.processReceiptText('   ')).rejects.toThrow('Receipt text cannot be empty');
    });

    it('should handle language normalization failure', async () => {
      const originalText = 'Some receipt text';
      mockLanguageNormalizer.normalizeText.mockRejectedValue(new Error('Language detection failed'));

      await expect(pipeline.processReceiptText(originalText)).rejects.toMatchObject({
        stage: 'language_detection',
        error: 'Language detection failed',
        originalText: originalText
      });
    });

    it('should handle data extraction failure', async () => {
      const originalText = 'Some receipt text';
      const mockTranslationResult = {
        translatedText: 'Some receipt text',
        originalText: originalText,
        sourceLanguage: 'English',
        confidence: 1.0
      };

      mockLanguageNormalizer.normalizeText.mockResolvedValue(mockTranslationResult);
      mockDataExtractor.extractReceiptDataWithRetry.mockRejectedValue(new Error('Data extraction failed'));

      await expect(pipeline.processReceiptText(originalText)).rejects.toMatchObject({
        stage: 'data_extraction',
        error: 'Data extraction failed',
        originalText: originalText
      });
    });
  });

  describe('processReceiptTextRobust', () => {
    it('should return successful result when all stages work', async () => {
      const originalText = 'Receipt text';
      
      const mockTranslationResult = {
        translatedText: 'Receipt text',
        originalText: originalText,
        sourceLanguage: 'English',
        confidence: 1.0
      };

      const mockReceiptData = {
        date: '2024-01-15',
        amount: 25.99,
        currency: 'USD',
        merchant: 'Store',
        last4: null,
        category: 'Shopping',
        subcategory: null,
        notes: null,
        confidence: 85,
        explanation: 'General shopping transaction'
      };

      mockLanguageNormalizer.normalizeText.mockResolvedValue(mockTranslationResult);
      mockDataExtractor.extractReceiptDataWithRetry.mockResolvedValue(mockReceiptData);

      const result = await pipeline.processReceiptTextRobust(originalText);

      expect(result).toEqual({
        receiptData: mockReceiptData,
        translationResult: mockTranslationResult,
        processingTimeMs: expect.any(Number)
      });
    });

    it('should return partial result when data extraction fails', async () => {
      const originalText = 'Receipt text';
      
      const mockTranslationResult = {
        translatedText: 'Receipt text',
        originalText: originalText,
        sourceLanguage: 'English',
        confidence: 1.0
      };

      mockLanguageNormalizer.normalizeText.mockResolvedValue(mockTranslationResult);
      mockDataExtractor.extractReceiptDataWithRetry.mockRejectedValue(new Error('Extraction failed'));

      const result = await pipeline.processReceiptTextRobust(originalText);

      expect(result).toMatchObject({
        stage: 'data_extraction',
        error: 'Extraction failed',
        originalText: originalText,
        partialResult: {
          translationResult: mockTranslationResult,
          processingTimeMs: expect.any(Number)
        }
      });
    });

    it('should return error when language normalization fails', async () => {
      const originalText = 'Receipt text';
      mockLanguageNormalizer.normalizeText.mockRejectedValue(new Error('Language failed'));

      const result = await pipeline.processReceiptTextRobust(originalText);

      expect(result).toMatchObject({
        stage: 'language_detection',
        error: 'Language failed',
        originalText: originalText,
        partialResult: {
          processingTimeMs: expect.any(Number)
        }
      });
    });
  });

  describe('validateProcessingResult', () => {
    it('should validate complete and valid result', () => {
      const validResult = {
        receiptData: {
          date: '2024-01-15',
          amount: 25.99,
          currency: 'USD',
          merchant: 'Starbucks',
          last4: '1234',
          category: 'Food & Dining',
          subcategory: 'Coffee',
          notes: null,
          confidence: 95,
          explanation: 'Valid explanation'
        },
        translationResult: {
          translatedText: 'Thank you',
          originalText: 'Gracias',
          sourceLanguage: 'Spanish',
          confidence: 0.95
        },
        processingTimeMs: 1500
      };

      expect(pipeline.validateProcessingResult(validResult)).toBe(true);
    });

    it('should reject result with missing required fields', () => {
      const invalidResult = {
        receiptData: {
          date: '2024-01-15',
          amount: 25.99,
          currency: 'USD',
          merchant: '', // Empty merchant
          last4: null,
          category: 'Food & Dining',
          subcategory: null,
          notes: null,
          confidence: 95,
          explanation: 'Valid explanation'
        },
        translationResult: {
          translatedText: 'Thank you',
          originalText: 'Gracias',
          sourceLanguage: 'Spanish',
          confidence: 0.95
        },
        processingTimeMs: 1500
      };

      expect(pipeline.validateProcessingResult(invalidResult)).toBe(false);
    });

    it('should reject result with invalid confidence score', () => {
      const invalidResult = {
        receiptData: {
          date: '2024-01-15',
          amount: 25.99,
          currency: 'USD',
          merchant: 'Starbucks',
          last4: null,
          category: 'Food & Dining',
          subcategory: null,
          notes: null,
          confidence: 150, // Invalid confidence > 100
          explanation: 'Valid explanation'
        },
        translationResult: {
          translatedText: 'Thank you',
          originalText: 'Gracias',
          sourceLanguage: 'Spanish',
          confidence: 0.95
        },
        processingTimeMs: 1500
      };

      expect(pipeline.validateProcessingResult(invalidResult)).toBe(false);
    });

    it('should reject result with negative amount', () => {
      const invalidResult = {
        receiptData: {
          date: '2024-01-15',
          amount: -25.99, // Negative amount
          currency: 'USD',
          merchant: 'Starbucks',
          last4: null,
          category: 'Food & Dining',
          subcategory: null,
          notes: null,
          confidence: 95,
          explanation: 'Valid explanation'
        },
        translationResult: {
          translatedText: 'Thank you',
          originalText: 'Gracias',
          sourceLanguage: 'Spanish',
          confidence: 0.95
        },
        processingTimeMs: 1500
      };

      expect(pipeline.validateProcessingResult(invalidResult)).toBe(false);
    });
  });

  describe('getProcessingStats', () => {
    it('should return correct stats for translated receipt', () => {
      const result = {
        receiptData: {
          date: '2024-01-15',
          amount: 25.99,
          currency: 'USD',
          merchant: 'Starbucks',
          last4: null,
          category: 'Food & Dining',
          subcategory: null,
          notes: null,
          confidence: 95,
          explanation: 'Valid explanation'
        },
        translationResult: {
          translatedText: 'Thank you for your purchase',
          originalText: 'Gracias por su compra',
          sourceLanguage: 'Spanish',
          confidence: 0.95
        },
        processingTimeMs: 1500
      };

      const stats = pipeline.getProcessingStats(result);

      expect(stats).toEqual({
        translationConfidence: 0.95,
        extractionConfidence: 95,
        processingTimeMs: 1500,
        wasTranslated: true,
        sourceLanguage: 'Spanish'
      });
    });

    it('should return correct stats for English receipt', () => {
      const result = {
        receiptData: {
          date: '2024-01-15',
          amount: 25.99,
          currency: 'USD',
          merchant: 'Starbucks',
          last4: null,
          category: 'Food & Dining',
          subcategory: null,
          notes: null,
          confidence: 95,
          explanation: 'Valid explanation'
        },
        translationResult: {
          translatedText: 'Thank you for your purchase',
          originalText: 'Thank you for your purchase',
          sourceLanguage: 'English',
          confidence: 1.0
        },
        processingTimeMs: 800
      };

      const stats = pipeline.getProcessingStats(result);

      expect(stats).toEqual({
        translationConfidence: 1.0,
        extractionConfidence: 95,
        processingTimeMs: 800,
        wasTranslated: false,
        sourceLanguage: 'English'
      });
    });
  });
});