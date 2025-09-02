import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MerchantMapService } from '../merchant-map';
import { ReceiptData } from '@/lib/types';

// Mock the Supabase client creation first
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn()
}));

// Import the mocked createClient
import { createClient } from '@/lib/supabase/server';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        })),
        order: vi.fn(() => ({
          single: vi.fn()
        })),
        gte: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      single: vi.fn(),
      order: vi.fn()
    })),
    upsert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn()
      }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn()
      }))
    }))
  }))
};

describe('MerchantMapService', () => {
  let merchantMapService: MerchantMapService;
  const mockOrgId = '123e4567-e89b-12d3-a456-426614174000';
  const mockUserId = '987fcdeb-51a2-43d1-b123-456789abcdef';

  beforeEach(() => {
    // Setup the mock before creating the service
    vi.mocked(createClient).mockReturnValue(mockSupabase as any);
    merchantMapService = new MerchantMapService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('lookupMapping', () => {
    it('should return mapping when found', async () => {
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

      const mockChain = {
        single: vi.fn().mockResolvedValue({ data: mockMapping, error: null })
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(mockChain)
          })
        })
      });

      const result = await merchantMapService.lookupMapping('Starbucks Coffee', mockOrgId);

      expect(result).toEqual(mockMapping);
      expect(mockSupabase.from).toHaveBeenCalledWith('merchant_map');
    });

    it('should return null when no mapping found', async () => {
      const mockChain = {
        single: vi.fn().mockResolvedValue({ 
          data: null, 
          error: { code: 'PGRST116' } // No rows returned
        })
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(mockChain)
          })
        })
      });

      const result = await merchantMapService.lookupMapping('Unknown Merchant', mockOrgId);

      expect(result).toBeNull();
    });

    it('should normalize merchant names for consistent lookup', async () => {
      const mockChain = {
        single: vi.fn().mockResolvedValue({ 
          data: null, 
          error: { code: 'PGRST116' }
        })
      };

      const mockEqChain = {
        eq: vi.fn().mockReturnValue(mockChain)
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue(mockEqChain)
        })
      });

      await merchantMapService.lookupMapping('STARBUCKS CORPORATION INC.', mockOrgId);

      // Should normalize to 'starbucks'
      expect(mockEqChain.eq).toHaveBeenCalledWith('merchant_name', 'starbucks');
    });
  });

  describe('updateMapping', () => {
    it('should create or update mapping successfully', async () => {
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

      const mockChain = {
        single: vi.fn().mockResolvedValue({ data: mockMapping, error: null })
      };

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(mockChain)
        })
      });

      const result = await merchantMapService.updateMapping(
        'Starbucks',
        'Food & Dining',
        'Coffee Shops',
        mockOrgId,
        mockUserId
      );

      expect(result).toEqual(mockMapping);
      expect(mockSupabase.from).toHaveBeenCalledWith('merchant_map');
    });

    it('should handle upsert with normalized merchant name', async () => {
      const mockChain = {
        single: vi.fn().mockResolvedValue({ 
          data: {}, 
          error: null 
        })
      };

      const mockSelectChain = {
        select: vi.fn().mockReturnValue(mockChain)
      };

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue(mockSelectChain)
      });

      await merchantMapService.updateMapping(
        'STARBUCKS CORP.',
        'Food & Dining',
        null,
        mockOrgId,
        mockUserId
      );

      expect(mockSelectChain.select).toHaveBeenCalled();
    });
  });

  describe('applyMapping', () => {
    it('should apply mapping when found', async () => {
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

      const mockChain = {
        single: vi.fn().mockResolvedValue({ data: mockMapping, error: null })
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(mockChain)
          })
        })
      });

      const receiptData: ReceiptData = {
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

      const result = await merchantMapService.applyMapping(receiptData, mockOrgId);

      expect(result.category).toBe('Food & Dining');
      expect(result.subcategory).toBe('Coffee Shops');
      expect(result.confidence).toBe(95); // Should increase confidence
      expect(result.explanation).toContain('Applied learned categorization');
    });

    it('should return original data when no mapping found', async () => {
      const mockChain = {
        single: vi.fn().mockResolvedValue({ 
          data: null, 
          error: { code: 'PGRST116' }
        })
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(mockChain)
          })
        })
      });

      const receiptData: ReceiptData = {
        date: '2024-01-01',
        amount: 5.99,
        currency: 'USD',
        merchant: 'Unknown Merchant',
        last4: null,
        category: 'Miscellaneous',
        subcategory: null,
        notes: null,
        confidence: 80,
        explanation: 'AI categorized as miscellaneous'
      };

      const result = await merchantMapService.applyMapping(receiptData, mockOrgId);

      expect(result).toEqual(receiptData);
    });

    it('should handle errors gracefully and return original data', async () => {
      const mockChain = {
        single: vi.fn().mockRejectedValue(new Error('Database error'))
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(mockChain)
          })
        })
      });

      const receiptData: ReceiptData = {
        date: '2024-01-01',
        amount: 5.99,
        currency: 'USD',
        merchant: 'Test Merchant',
        last4: null,
        category: 'Miscellaneous',
        subcategory: null,
        notes: null,
        confidence: 80,
        explanation: 'AI categorized as miscellaneous'
      };

      const result = await merchantMapService.applyMapping(receiptData, mockOrgId);

      expect(result).toEqual(receiptData);
    });
  });

  describe('getMappingsForOrg', () => {
    it('should return all mappings for organization', async () => {
      const mockMappings = [
        {
          id: 'mapping-1',
          org_id: mockOrgId,
          merchant_name: 'starbucks',
          category: 'Food & Dining',
          subcategory: 'Coffee Shops',
          created_by: mockUserId,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      const mockChain = {
        order: vi.fn().mockResolvedValue({ data: mockMappings, error: null })
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue(mockChain)
        })
      });

      const result = await merchantMapService.getMappingsForOrg(mockOrgId);

      expect(result).toEqual(mockMappings);
      expect(mockChain.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    });
  });

  describe('merchant name normalization', () => {
    it('should normalize merchant names consistently', () => {
      const service = new MerchantMapService();
      
      // Access private method through type assertion for testing
      const normalize = (service as any).normalizeMerchantName.bind(service);

      expect(normalize('STARBUCKS CORPORATION')).toBe('starbucks');
      expect(normalize('McDonald\'s Inc.')).toBe('mcdonald\'s');
      expect(normalize('  Target Corp  ')).toBe('target');
      expect(normalize('Amazon.com LLC')).toBe('amazon.com');
      expect(normalize('Walmart Company')).toBe('walmart');
    });
  });
});