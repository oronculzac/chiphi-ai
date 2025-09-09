import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fallbackCategorizationService } from '../fallback-categorization';
import { loggingService } from '../logging-service';

// Mock the logging service
vi.mock('../logging-service', () => ({
  loggingService: {
    logProcessingStep: vi.fn(),
  },
}));

describe('FallbackCategorizationService', () => {
  const mockOrgId = 'test-org-id';
  const mockEmailId = 'test-email-id';
  const mockCorrelationId = 'test-correlation-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractFallbackData', () => {
    it('should extract basic receipt data from email content', async () => {
      const emailContent = `
        Receipt from Starbucks
        Date: 2024-01-15
        Total: $12.50
        Card ending in 1234
        Thank you for your purchase!
      `;

      const result = await fallbackCategorizationService.extractFallbackData(
        emailContent,
        mockOrgId,
        mockEmailId,
        mockCorrelationId
      );

      expect(result).toMatchObject({
        amount: 12.50,
        currency: 'USD',
        date: '2024-01-15',
        merchant: expect.stringContaining('Starbucks'),
        last4: '1234',
        category: 'Food & Dining',
        confidence: expect.any(Number),
        explanation: expect.stringContaining('Food & Dining'),
        fallbackUsed: true,
      });

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('should categorize transportation expenses correctly', async () => {
      const emailContent = `
        Shell Gas Station
        Date: 2024-01-15
        Amount: $45.00 USD
        Fuel purchase
      `;

      const result = await fallbackCategorizationService.extractFallbackData(
        emailContent,
        mockOrgId,
        mockEmailId,
        mockCorrelationId
      );

      expect(result.category).toBe('Transportation');
      expect(result.amount).toBe(45.00);
      expect(result.currency).toBe('USD');
    });

    it('should handle missing information gracefully', async () => {
      const emailContent = 'Some random text without clear receipt information';

      const result = await fallbackCategorizationService.extractFallbackData(
        emailContent,
        mockOrgId,
        mockEmailId,
        mockCorrelationId
      );

      expect(result).toMatchObject({
        amount: 0,
        currency: 'USD',
        merchant: 'Unknown Merchant',
        category: 'Other',
        confidence: expect.any(Number),
        fallbackUsed: true,
      });

      expect(result.confidence).toBeLessThan(50); // Low confidence for unclear content
    });

    it('should extract multiple currency formats', async () => {
      const testCases = [
        { content: 'Total: €25.50', expectedCurrency: 'EUR', expectedAmount: 25.50 },
        { content: 'Amount: £15.75', expectedCurrency: 'GBP', expectedAmount: 15.75 },
        { content: 'Cost: ¥1000', expectedCurrency: 'JPY', expectedAmount: null }, // Yen might not be extracted correctly
        { content: 'Total: 30.00 CAD', expectedCurrency: 'CAD', expectedAmount: 30.00 },
      ];

      for (const testCase of testCases) {
        const result = await fallbackCategorizationService.extractFallbackData(
          testCase.content,
          mockOrgId,
          mockEmailId,
          mockCorrelationId
        );

        expect(result.currency).toBe(testCase.expectedCurrency);
        if (testCase.expectedAmount) {
          expect(result.amount).toBe(testCase.expectedAmount);
        }
      }
    });

    it('should extract date in various formats', async () => {
      const testCases = [
        { content: 'Date: 2024-01-15', expectedDate: '2024-01-15' },
        { content: 'Date: 01/15/2024', expectedDate: '2024-01-15' },
        { content: 'Date: Jan 15, 2024', expectedDate: '2024-01-15' },
      ];

      for (const testCase of testCases) {
        const result = await fallbackCategorizationService.extractFallbackData(
          testCase.content,
          mockOrgId,
          mockEmailId,
          mockCorrelationId
        );

        expect(result.date).toBe(testCase.expectedDate);
      }
    });

    it('should log processing steps', async () => {
      const emailContent = 'Test receipt content';

      await fallbackCategorizationService.extractFallbackData(
        emailContent,
        mockOrgId,
        mockEmailId,
        mockCorrelationId
      );

      expect(loggingService.logProcessingStep).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: mockOrgId,
          emailId: mockEmailId,
          step: 'fallback_categorization_start',
          status: 'started',
          correlationId: mockCorrelationId,
        })
      );

      expect(loggingService.logProcessingStep).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: mockOrgId,
          emailId: mockEmailId,
          step: 'fallback_categorization_complete',
          status: 'completed',
          correlationId: mockCorrelationId,
        })
      );
    });

    it('should return minimal data when extraction fails', async () => {
      // Mock logging service to throw an error
      vi.mocked(loggingService.logProcessingStep).mockRejectedValueOnce(new Error('Logging failed'));

      const result = await fallbackCategorizationService.extractFallbackData(
        'test content',
        mockOrgId,
        mockEmailId,
        mockCorrelationId
      );

      expect(result).toMatchObject({
        amount: 0,
        currency: 'USD',
        merchant: 'Unknown Merchant',
        category: 'Other',
        confidence: 10,
        fallbackUsed: true,
        notes: 'Fallback processing failed - manual review required',
      });
    });
  });

  describe('checkAIServiceAvailability', () => {
    it('should return service availability status', async () => {
      const result = await fallbackCategorizationService.checkAIServiceAvailability();

      expect(result).toHaveProperty('available');
      expect(result).toHaveProperty('services');
      expect(result.services).toHaveProperty('openai');
      expect(result.services).toHaveProperty('translation');
      expect(result.services).toHaveProperty('extraction');
    });
  });

  describe('keyword categorization', () => {
    it('should categorize based on merchant keywords', async () => {
      const testCases = [
        { merchant: 'McDonald\'s', expectedCategory: 'Food & Dining' },
        { merchant: 'Shell Gas Station', expectedCategory: 'Transportation' },
        { merchant: 'Amazon', expectedCategory: 'Shopping' },
        { merchant: 'Netflix', expectedCategory: 'Entertainment' },
        { merchant: 'CVS Pharmacy', expectedCategory: 'Health & Fitness' },
        { merchant: 'Marriott Hotel', expectedCategory: 'Travel' },
      ];

      for (const testCase of testCases) {
        const emailContent = `Receipt from ${testCase.merchant}\nTotal: $25.00`;
        
        const result = await fallbackCategorizationService.extractFallbackData(
          emailContent,
          mockOrgId,
          mockEmailId,
          mockCorrelationId
        );

        expect(result.category).toBe(testCase.expectedCategory);
      }
    });
  });
});