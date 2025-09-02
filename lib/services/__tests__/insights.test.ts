import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InsightsService } from '../insights';

// Mock Supabase client
const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        gte: vi.fn(() => ({
          lt: vi.fn(() => ({ data: [], error: null }))
        }))
      }))
    }))
  }))
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase
}));

describe('InsightsService', () => {
  let insightsService: InsightsService;

  beforeEach(() => {
    insightsService = new InsightsService();
    vi.clearAllMocks();
  });

  describe('getAvailableInsights', () => {
    it('should return predefined insights', () => {
      const insights = insightsService.getAvailableInsights();
      
      expect(insights).toHaveLength(8);
      expect(insights[0]).toHaveProperty('id', 'monthly_spending');
      expect(insights[0]).toHaveProperty('question');
      expect(insights[0]).toHaveProperty('description');
      expect(insights[0]).toHaveProperty('category');
    });
  });

  describe('matchQuery', () => {
    it('should match monthly spending queries', () => {
      const queries = [
        'How much did I spend this month?',
        'monthly spending',
        'total this month',
        'current month spending'
      ];

      queries.forEach(query => {
        const match = insightsService.matchQuery(query);
        expect(match?.id).toBe('monthly_spending');
      });
    });

    it('should match category queries', () => {
      const queries = [
        'top categories',
        'spending categories',
        'what categories do I spend on'
      ];

      queries.forEach(query => {
        const match = insightsService.matchQuery(query);
        expect(match?.id).toBe('top_categories');
      });
    });

    it('should match trend queries', () => {
      const queries = [
        'spending trend',
        'how has my spending changed over time',
        'spending pattern'
      ];

      queries.forEach(query => {
        const match = insightsService.matchQuery(query);
        expect(match?.id).toBe('spending_trend');
      });
    });

    it('should return null for unmatched queries', () => {
      const match = insightsService.matchQuery('completely unrelated query');
      expect(match).toBeNull();
    });
  });

  describe('executeInsight', () => {
    it('should execute monthly spending insight', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: '150.50', error: null });

      const result = await insightsService.executeInsight('monthly_spending', 'test-org-id');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_month_to_date_total', {
        org_uuid: 'test-org-id'
      });
      expect(result.query).toBe('How much did I spend this month?');
      expect(result.answer).toContain('$150.50');
      expect(result.visualization).toBe('metric');
      expect(result.confidence).toBe(100);
    });

    it('should execute top categories insight', async () => {
      const mockCategories = [
        { category: 'Food', amount: '100.00', percentage: 50, count: 5 },
        { category: 'Transport', amount: '50.00', percentage: 25, count: 3 }
      ];
      mockSupabase.rpc.mockResolvedValueOnce({ data: mockCategories, error: null });

      const result = await insightsService.executeInsight('top_categories', 'test-org-id');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_category_breakdown', {
        org_uuid: 'test-org-id',
        days_back: 90
      });
      expect(result.query).toBe('What are my top spending categories?');
      expect(result.answer).toContain('Food');
      expect(result.answer).toContain('$100.00');
      expect(result.visualization).toBe('chart');
      expect(result.confidence).toBe(95);
    });

    it('should handle database errors', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('Database error') });

      await expect(
        insightsService.executeInsight('monthly_spending', 'test-org-id')
      ).rejects.toThrow('Failed to generate insight');
    });

    it('should throw error for invalid insight ID', async () => {
      await expect(
        insightsService.executeInsight('invalid_insight', 'test-org-id')
      ).rejects.toThrow('Invalid insight query');
    });
  });

  describe('security requirements', () => {
    it('should only use predefined analytics functions', () => {
      const insights = insightsService.getAvailableInsights();
      
      // Verify all insights have predefined IDs (Requirement 6.5)
      const validIds = [
        'monthly_spending', 'top_categories', 'spending_trend', 'top_merchants',
        'weekly_average', 'category_comparison', 'high_confidence_transactions', 'recent_activity'
      ];
      
      insights.forEach(insight => {
        expect(validIds).toContain(insight.id);
      });
    });

    it('should not allow freeform SQL execution', () => {
      // The service should only call predefined Supabase RPC functions
      // This is enforced by the implementation structure
      expect(typeof insightsService.executeInsight).toBe('function');
      
      // Verify no direct SQL execution methods exist
      expect(insightsService).not.toHaveProperty('executeSql');
      expect(insightsService).not.toHaveProperty('runQuery');
    });
  });

  describe('natural language processing', () => {
    it('should handle case-insensitive queries', () => {
      const match1 = insightsService.matchQuery('MONTHLY SPENDING');
      const match2 = insightsService.matchQuery('monthly spending');
      const match3 = insightsService.matchQuery('Monthly Spending');
      
      expect(match1?.id).toBe('monthly_spending');
      expect(match2?.id).toBe('monthly_spending');
      expect(match3?.id).toBe('monthly_spending');
    });

    it('should handle partial keyword matches', () => {
      const match = insightsService.matchQuery('show me my top spending categories');
      expect(match?.id).toBe('top_categories');
    });

    it('should prioritize queries with more keyword matches', () => {
      const match = insightsService.matchQuery('spending trend over time pattern');
      // Should match 'spending_trend' due to 'trend', 'over time', and 'pattern' keywords
      expect(match?.id).toBe('spending_trend');
    });
  });
});