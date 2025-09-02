'use client';

import { useState, useCallback } from 'react';
import { 
  MonthlyReport, 
  YearlyReport, 
  SpendingTrendAnalysis, 
  Budget, 
  BudgetAlert, 
  ComparativeAnalysis 
} from '@/lib/services/advanced-analytics';

interface UseAdvancedAnalyticsOptions {
  orgId: string;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  note?: string;
}

export function useAdvancedAnalytics({ orgId }: UseAdvancedAnalyticsOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate monthly report
  const generateMonthlyReport = useCallback(async (
    month: number, 
    year: number, 
    includePDF: boolean = false
  ): Promise<MonthlyReport | null> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        type: 'monthly',
        month: month.toString(),
        year: year.toString(),
        includePDF: includePDF.toString()
      });

      const response = await fetch(`/api/analytics/reports?${params}`);
      const result: ApiResponse<MonthlyReport> = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to generate monthly report');
        return null;
      }

      return result.data || null;
    } catch (err) {
      console.error('Error generating monthly report:', err);
      setError('Failed to generate monthly report');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Generate yearly report
  const generateYearlyReport = useCallback(async (
    year: number, 
    includePDF: boolean = false
  ): Promise<YearlyReport | null> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        type: 'yearly',
        year: year.toString(),
        includePDF: includePDF.toString()
      });

      const response = await fetch(`/api/analytics/reports?${params}`);
      const result: ApiResponse<YearlyReport> = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to generate yearly report');
        return null;
      }

      return result.data || null;
    } catch (err) {
      console.error('Error generating yearly report:', err);
      setError('Failed to generate yearly report');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get available report periods
  const getAvailableReportPeriods = useCallback(async (): Promise<Array<{ month: number; year: number; label: string }> | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analytics/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'getAvailablePeriods' }),
      });

      const result: ApiResponse<Array<{ month: number; year: number; label: string }>> = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to get available periods');
        return null;
      }

      return result.data || null;
    } catch (err) {
      console.error('Error getting available periods:', err);
      setError('Failed to get available periods');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Analyze spending trend
  const analyzeSpendingTrend = useCallback(async (
    periodDays: number = 30
  ): Promise<SpendingTrendAnalysis | null> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        periodDays: periodDays.toString()
      });

      const response = await fetch(`/api/analytics/trends?${params}`);
      const result: ApiResponse<SpendingTrendAnalysis> = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to analyze spending trend');
        return null;
      }

      return result.data || null;
    } catch (err) {
      console.error('Error analyzing spending trend:', err);
      setError('Failed to analyze spending trend');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get budgets and alerts
  const getBudgets = useCallback(async (
    includeAlerts: boolean = true
  ): Promise<{ budgets: Budget[]; alerts?: BudgetAlert[] } | null> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        includeAlerts: includeAlerts.toString()
      });

      const response = await fetch(`/api/analytics/budgets?${params}`);
      const result: ApiResponse<{ budgets: Budget[]; alerts?: BudgetAlert[] }> = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to get budgets');
        return null;
      }

      return result.data || null;
    } catch (err) {
      console.error('Error getting budgets:', err);
      setError('Failed to get budgets');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create budget
  const createBudget = useCallback(async (
    category: string, 
    monthlyLimit: number
  ): Promise<Budget | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analytics/budgets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category, monthlyLimit }),
      });

      const result: ApiResponse<Budget> = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to create budget');
        return null;
      }

      return result.data || null;
    } catch (err) {
      console.error('Error creating budget:', err);
      setError('Failed to create budget');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Compare time periods
  const compareTimePeriods = useCallback(async (
    currentStart: Date,
    currentEnd: Date,
    comparisonStart: Date,
    comparisonEnd: Date
  ): Promise<ComparativeAnalysis | null> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        currentStart: currentStart.toISOString().split('T')[0],
        currentEnd: currentEnd.toISOString().split('T')[0],
        comparisonStart: comparisonStart.toISOString().split('T')[0],
        comparisonEnd: comparisonEnd.toISOString().split('T')[0]
      });

      const response = await fetch(`/api/analytics/compare?${params}`);
      const result: ApiResponse<ComparativeAnalysis> = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to compare time periods');
        return null;
      }

      return result.data || null;
    } catch (err) {
      console.error('Error comparing time periods:', err);
      setError('Failed to compare time periods');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Predefined comparisons
  const comparePredefined = useCallback(async (
    comparisonType: 'thisMonthVsLastMonth' | 'thisYearVsLastYear' | 'last30DaysVsPrevious30Days'
  ): Promise<ComparativeAnalysis | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analytics/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comparisonType }),
      });

      const result: ApiResponse<ComparativeAnalysis> = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to compare periods');
        return null;
      }

      return result.data || null;
    } catch (err) {
      console.error('Error comparing periods:', err);
      setError('Failed to compare periods');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    generateMonthlyReport,
    generateYearlyReport,
    getAvailableReportPeriods,
    analyzeSpendingTrend,
    getBudgets,
    createBudget,
    compareTimePeriods,
    comparePredefined
  };
}