import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MerchantMapService } from '../merchant-map';
import { AIProcessingPipeline } from '../ai-processing-pipeline';
import { ReceiptData } from '@/lib/types';

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    }))
  }))
}));

// Mock AI services
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

describe('MerchantMap Integration', () => {
  let merchantMapService: MerchantMapService;
  let aiPipeline: AIProcessingPipeline;
  const mockOrgId = '123e4567-e89b-12d3-a456-426614174000';
  const mockUserId = '987fcdeb-51a2-43d1-b123-456789abcdef';

  beforeEach(() => {
    merchantMapService = new MerchantMapService();
    aiPipeline = new AIProcessingPipeline();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('AI Pipeline Integration', () => {
    it('should apply merchant mapping during AI processing', async () => {
      // Mock the AI services
      const { languageNormalizer } = await import('../ai-language-normalizer');
      const { dataExtractor } = await import('../ai-data-extractor');

      const mockTranslationResult = {
        translatedText: 'Receipt from Starbucks Coffee',
        originalText: 'Receipt from Starbucks Coffee',
        sourceLanguage: 'english',
        confidence: 95
      };

      const mockReceiptData: ReceiptData = {
        date: '2024-01-01',
        amount: 5.99,
        currency: 'USD',
        merchant: 'Starbucks',
        last4: null,
        category: 'Miscellaneous',
        subcategory: null,
        notes: null,
        confidence: 80,
        explanation: 'AI categorized as miscellaneous'
      };

      const mockMapping = {
        id: 'mapping-id',
        org_id: mockOrgId,
        merchant_name: 'starbucks',
        category: 'Food & Dining',
        subcategory: 'Coffee Shops',
        created_by: mockUserId,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      // Setup mocks
      vi.mocked(languageNormalizer.normalizeText).mockResolvedValue(mockTranslationResult);
      vi.mocked(dataExtractor.extractReceiptDataWithRetry).mockResolvedValue(mockReceiptData);

      // Mock the lookup to return a mapping
      const mockSupabase = (await import('@/lib/supabase/server')).createClient();
      vi.mocked(mockSupabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockMapping, error: null })
            })
          })
        })
      } as any);

      // Process receipt with organization ID
      const result = await aiPipeline.processReceiptText('Receipt from Starbucks Coffee', mockOrgId);

      // Verify that mapping was applied
      expect(result.receiptData.category).toBe('Food & Dining');
      expect(result.receiptData.subcategory).toBe('Coffee Shops');
      expect(result.receiptData.confidence).toBeGreaterThan(80); // Should increase confidence
      expect(result.receiptData.explanation).toContain('Applied learned categorization');
      expect(result.appliedMapping).toBe(true);
    });

    it('should not apply mapping when none exists', async () => {
      // Mock the AI services
      const { languageNormalizer } = await import('../ai-language-normalizer');
      const { dataExtractor } = await import('../ai-data-extractor');

      const mockTranslationResult = {
        translatedText: 'Receipt from Unknown Store',
        originalText: 'Receipt from Unknown Store',
        sourceLanguage: 'english',
        confidence: 95
      };

      const mockReceiptData: ReceiptData = {
        date: '2024-01-01',
        amount: 15.99,
        currency: 'USD',
        merchant: 'Unknown Store',
        last4: null,
        category: 'Miscellaneous',
        subcategory: null,
        notes: null,
        confidence: 75,
        explanation: 'AI categorized as miscellaneous'
      };

      // Setup mocks
      vi.mocked(languageNormalizer.normalizeText).mockResolvedValue(mockTranslationResult);
      vi.mocked(dataExtractor.extractReceiptDataWithRetry).mockResolvedValue(mockReceiptData);

      // Mock the lookup to return no mapping
      const mockSupabase = (await import('@/lib/supabase/server')).createClient();
      vi.mocked(mockSupabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
            })
          })
        })
      } as any);

      // Process receipt with organization ID
      const result = await aiPipeline.processReceiptText('Receipt from Unknown Store', mockOrgId);

      // Verify that original data is preserved
      expect(result.receiptData.category).toBe('Miscellaneous');
      expect(result.receiptData.subcategory).toBeNull();
      expect(result.receiptData.confidence).toBe(75);
      expect(result.appliedMapping).toBe(false);
    });

    it('should work without organization ID (no mapping applied)', async () => {
      // Mock the AI services
      const { languageNormalizer } = await import('../ai-language-normalizer');
      const { dataExtractor } = await import('../ai-data-extractor');

      const mockTranslationResult = {
        translatedText: 'Receipt from Test Store',
        originalText: 'Receipt from Test Store',
        sourceLanguage: 'english',
        confidence: 95
      };

      const mockReceiptData: ReceiptData = {
        date: '2024-01-01',
        amount: 25.99,
        currency: 'USD',
        merchant: 'Test Store',
        last4: null,
        category: 'Shopping',
        subcategory: null,
        notes: null,
        confidence: 85,
        explanation: 'AI categorized as shopping'
      };

      // Setup mocks
      vi.mocked(languageNormalizer.normalizeText).mockResolvedValue(mockTranslationResult);
      vi.mocked(dataExtractor.extractReceiptDataWithRetry).mockResolvedValue(mockReceiptData);

      // Process receipt without organization ID
      const result = await aiPipeline.processReceiptText('Receipt from Test Store');

      // Verify that original data is preserved and no mapping was attempted
      expect(result.receiptData).toEqual(mockReceiptData);
      expect(result.appliedMapping).toBe(false);
    });
  });

  describe('Learning System Workflow', () => {
    it('should demonstrate complete learning workflow', async () => {
      // Step 1: Create a mapping
      const mockMapping = {
        id: 'mapping-id',
        org_id: mockOrgId,
        merchant_name: 'target',
        category: 'Shopping',
        subcategory: 'Department Stores',
        created_by: mockUserId,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const mockSupabase = (await import('@/lib/supabase/server')).createClient();
      vi.mocked(mockSupabase.from).mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockMapping, error: null })
          })
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockMapping, error: null })
            })
          })
        })
      } as any);

      // Create the mapping
      const createdMapping = await merchantMapService.updateMapping(
        'Target Corporation',
        'Shopping',
        'Department Stores',
        mockOrgId,
        mockUserId
      );

      expect(createdMapping).toEqual(mockMapping);

      // Step 2: Apply the mapping to new receipt data
      const receiptData: ReceiptData = {
        date: '2024-01-02',
        amount: 45.99,
        currency: 'USD',
        merchant: 'Target Corp',
        last4: null,
        category: 'Miscellaneous',
        subcategory: null,
        notes: null,
        confidence: 70,
        explanation: 'AI categorized as miscellaneous'
      };

      const appliedData = await merchantMapService.applyMapping(receiptData, mockOrgId);

      // Verify the mapping was applied
      expect(appliedData.category).toBe('Shopping');
      expect(appliedData.subcategory).toBe('Department Stores');
      expect(appliedData.confidence).toBeGreaterThan(70);
      expect(appliedData.explanation).toContain('Applied learned categorization');
    });
  });
});