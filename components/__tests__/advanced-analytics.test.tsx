import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdvancedAnalyticsService } from '@/lib/services/advanced-analytics';
import { AdvancedAnalyticsDashboard } from '@/components/advanced-analytics-dashboard';

// Mock the hooks
vi.mock('@/hooks/use-advanced-analytics', () => ({
  useAdvancedAnalytics: () => ({
    loading: false,
    error: null,
    generateMonthlyReport: vi.fn(),
    generateYearlyReport: vi.fn(),
    analyzeSpendingTrend: vi.fn(),
    getBudgets: vi.fn(),
    comparePredefined: vi.fn()
  })
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false
}));

// Mock the card components
vi.mock('@/components/monthly-report-card', () => ({
  MonthlyReportCard: ({ onGenerateReport }: any) => (
    <div data-testid="monthly-report-card">
      <button onClick={() => onGenerateReport(1, 2024)}>Generate Monthly Report</button>
    </div>
  )
}));

vi.mock('@/components/yearly-report-card', () => ({
  YearlyReportCard: ({ onGenerateReport }: any) => (
    <div data-testid="yearly-report-card">
      <button onClick={() => onGenerateReport(2024)}>Generate Yearly Report</button>
    </div>
  )
}));

vi.mock('@/components/spending-trend-card', () => ({
  SpendingTrendCard: ({ onAnalyzeTrend }: any) => (
    <div data-testid="spending-trend-card">
      <button onClick={() => onAnalyzeTrend(30)}>Analyze Trend</button>
    </div>
  )
}));

vi.mock('@/components/budget-tracking-card', () => ({
  BudgetTrackingCard: ({ onGetBudgets }: any) => (
    <div data-testid="budget-tracking-card">
      <button onClick={() => onGetBudgets(true)}>Get Budgets</button>
    </div>
  )
}));

vi.mock('@/components/comparative-analysis-card', () => ({
  ComparativeAnalysisCard: ({ onCompare }: any) => (
    <div data-testid="comparative-analysis-card">
      <button onClick={() => onCompare('thisMonthVsLastMonth')}>Compare</button>
    </div>
  )
}));

describe('AdvancedAnalyticsService', () => {
  let service: AdvancedAnalyticsService;

  beforeEach(() => {
    service = new AdvancedAnalyticsService();
  });

  describe('generateMonthlyReport', () => {
    it('should generate a monthly report structure', async () => {
      // Mock Supabase client
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: '1',
              amount: 100,
              category: 'Groceries',
              merchant: 'Store A',
              date: '2024-01-15'
            },
            {
              id: '2',
              amount: 50,
              category: 'Gas',
              merchant: 'Gas Station',
              date: '2024-01-20'
            }
          ],
          error: null
        })
      };

      // Replace the supabase client
      (service as any).supabase = mockSupabase;

      const report = await service.generateMonthlyReport('org-1', 1, 2024);

      expect(report).toBeDefined();
      expect(report.month).toBe('January');
      expect(report.year).toBe(2024);
      expect(report.totalSpending).toBe(150);
      expect(report.transactionCount).toBe(2);
      expect(report.categoryBreakdown).toHaveLength(2);
      expect(report.topMerchants).toHaveLength(2);
    });
  });

  describe('analyzeSpendingTrend', () => {
    it('should analyze spending trends correctly', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({
          data: [
            { amount: 100, date: '2024-01-15' },
            { amount: 80, date: '2024-01-20' }
          ],
          error: null
        })
      };

      (service as any).supabase = mockSupabase;

      const analysis = await service.analyzeSpendingTrend('org-1', 30);

      expect(analysis).toBeDefined();
      expect(analysis.currentPeriod).toBeDefined();
      expect(analysis.previousPeriod).toBeDefined();
      expect(analysis.change).toBeDefined();
      expect(analysis.prediction).toBeDefined();
      expect(['increasing', 'decreasing', 'stable']).toContain(analysis.change.trend);
    });
  });

  describe('getBudgets', () => {
    it('should return budget information', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({
          data: [
            { category: 'Groceries', amount: 100 },
            { category: 'Gas', amount: 50 }
          ],
          error: null
        })
      };

      (service as any).supabase = mockSupabase;

      const budgets = await service.getBudgets('org-1');

      expect(budgets).toBeDefined();
      expect(Array.isArray(budgets)).toBe(true);
      expect(budgets.length).toBeGreaterThan(0);
      
      if (budgets.length > 0) {
        expect(budgets[0]).toHaveProperty('id');
        expect(budgets[0]).toHaveProperty('category');
        expect(budgets[0]).toHaveProperty('monthlyLimit');
        expect(budgets[0]).toHaveProperty('currentSpending');
        expect(budgets[0]).toHaveProperty('percentageUsed');
      }
    });
  });

  describe('compareTimePeriods', () => {
    it('should compare time periods correctly', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({
          data: [
            { amount: 100, category: 'Groceries', date: '2024-01-15' },
            { amount: 50, category: 'Gas', date: '2024-01-20' }
          ],
          error: null
        })
      };

      (service as any).supabase = mockSupabase;

      const currentStart = new Date('2024-01-01');
      const currentEnd = new Date('2024-01-31');
      const comparisonStart = new Date('2023-12-01');
      const comparisonEnd = new Date('2023-12-31');

      const comparison = await service.compareTimePeriods(
        'org-1',
        currentStart,
        currentEnd,
        comparisonStart,
        comparisonEnd
      );

      expect(comparison).toBeDefined();
      expect(comparison.currentPeriod).toBeDefined();
      expect(comparison.comparisonPeriod).toBeDefined();
      expect(comparison.changes).toBeDefined();
      expect(Array.isArray(comparison.insights)).toBe(true);
    });
  });
});

describe('AdvancedAnalyticsDashboard', () => {
  it('should render all tabs correctly', () => {
    render(<AdvancedAnalyticsDashboard orgId="test-org" />);

    expect(screen.getByText('Advanced Analytics')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Trends')).toBeInTheDocument();
    expect(screen.getByText('Budgets')).toBeInTheDocument();
    expect(screen.getByText('Compare')).toBeInTheDocument();
  });

  it('should switch between tabs', async () => {
    render(<AdvancedAnalyticsDashboard orgId="test-org" />);

    // Click on Trends tab
    fireEvent.click(screen.getByText('Trends'));
    await waitFor(() => {
      expect(screen.getByTestId('spending-trend-card')).toBeInTheDocument();
    });

    // Click on Budgets tab
    fireEvent.click(screen.getByText('Budgets'));
    await waitFor(() => {
      expect(screen.getByTestId('budget-tracking-card')).toBeInTheDocument();
    });

    // Click on Compare tab
    fireEvent.click(screen.getByText('Compare'));
    await waitFor(() => {
      expect(screen.getByTestId('comparative-analysis-card')).toBeInTheDocument();
    });
  });

  it('should render reports tab by default', () => {
    render(<AdvancedAnalyticsDashboard orgId="test-org" />);

    expect(screen.getByTestId('monthly-report-card')).toBeInTheDocument();
    expect(screen.getByTestId('yearly-report-card')).toBeInTheDocument();
  });
});