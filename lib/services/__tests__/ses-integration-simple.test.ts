import { describe, it, expect } from 'vitest';
import { aiProcessingPipeline } from '../ai-processing-pipeline';
import { fallbackCategorizationService } from '../fallback-categorization';

describe('SES Integration - Core Functionality', () => {
  describe('AI Processing Pipeline with Fallback', () => {
    it('should have fallback processing capability', async () => {
      // Test that the fallback service exists and has the required methods
      expect(fallbackCategorizationService).toBeDefined();
      expect(typeof fallbackCategorizationService.extractFallbackData).toBe('function');
      expect(typeof fallbackCategorizationService.checkAIServiceAvailability).toBe('function');
    });

    it('should have enhanced AI processing pipeline', async () => {
      // Test that the AI processing pipeline exists and has the required methods
      expect(aiProcessingPipeline).toBeDefined();
      expect(typeof aiProcessingPipeline.processReceiptText).toBe('function');
      expect(typeof aiProcessingPipeline.processReceiptTextRobust).toBe('function');
    });

    it('should check AI service availability', async () => {
      const availability = await fallbackCategorizationService.checkAIServiceAvailability();
      
      expect(availability).toHaveProperty('available');
      expect(availability).toHaveProperty('services');
      expect(availability.services).toHaveProperty('openai');
      expect(availability.services).toHaveProperty('translation');
      expect(availability.services).toHaveProperty('extraction');
    });

    it('should extract fallback data when provided with content', async () => {
      const testContent = `
        Receipt from Test Store
        Date: 2024-01-15
        Total: $25.00
        Thank you for your purchase!
      `;

      const result = await fallbackCategorizationService.extractFallbackData(
        testContent,
        'test-org',
        'test-email',
        'test-correlation'
      );

      expect(result).toHaveProperty('date');
      expect(result).toHaveProperty('amount');
      expect(result).toHaveProperty('currency');
      expect(result).toHaveProperty('merchant');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('explanation');
      expect(result).toHaveProperty('fallbackUsed');
      expect(result.fallbackUsed).toBe(true);
    });
  });

  describe('Processing Result Structure', () => {
    it('should support fallback processing results', async () => {
      const testContent = 'Simple receipt content';
      
      const result = await fallbackCategorizationService.extractFallbackData(
        testContent,
        'test-org',
        'test-email',
        'test-correlation'
      );

      // Verify the result has all required fields for transaction creation
      expect(result.date).toBeDefined();
      expect(result.amount).toBeDefined();
      expect(result.currency).toBeDefined();
      expect(result.merchant).toBeDefined();
      expect(result.category).toBeDefined();
      expect(result.confidence).toBeDefined();
      expect(result.explanation).toBeDefined();
      expect(result.fallbackUsed).toBe(true);

      // Verify confidence is within expected range for fallback
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });
  });
});