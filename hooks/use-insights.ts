'use client';

import { useState, useCallback } from 'react';
import { InsightQuery, InsightResult } from '@/lib/types';

interface UseInsightsOptions {
  orgId: string;
}

interface InsightResponse {
  success: boolean;
  data?: InsightResult & { availableInsights?: InsightQuery[] };
  error?: string;
  suggestions?: string[];
}

export function useInsights({ orgId }: UseInsightsOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableInsights, setAvailableInsights] = useState<InsightQuery[]>([]);

  // Load available insights
  const loadAvailableInsights = useCallback(async () => {
    try {
      const response = await fetch('/api/insights');
      const data: InsightResponse = await response.json();
      
      if (data.success && data.data?.availableInsights) {
        setAvailableInsights(data.data.availableInsights);
      }
    } catch (error) {
      console.error('Error loading available insights:', error);
    }
  }, []);

  // Execute natural language query
  const askQuestion = useCallback(async (query: string): Promise<InsightResult | null> => {
    if (!query.trim()) return null;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      const data: InsightResponse = await response.json();

      if (data.success && data.data) {
        return data.data as InsightResult;
      } else {
        setError(data.error || 'Failed to process insight');
        return null;
      }
    } catch (error) {
      console.error('Error submitting insight query:', error);
      setError('Failed to process your question. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Execute predefined insight
  const executeInsight = useCallback(async (insightId: string): Promise<InsightResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/insights?insightId=${insightId}`);
      const data: InsightResponse = await response.json();

      if (data.success && data.data) {
        return data.data as InsightResult;
      } else {
        setError(data.error || 'Failed to process insight');
        return null;
      }
    } catch (error) {
      console.error('Error executing predefined insight:', error);
      setError('Failed to process insight. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get insights by category
  const getInsightsByCategory = useCallback((category: string) => {
    return availableInsights.filter(insight => insight.category === category);
  }, [availableInsights]);

  // Search insights by keyword
  const searchInsights = useCallback((keyword: string) => {
    const searchTerm = keyword.toLowerCase();
    return availableInsights.filter(insight => 
      insight.question.toLowerCase().includes(searchTerm) ||
      insight.description.toLowerCase().includes(searchTerm)
    );
  }, [availableInsights]);

  return {
    loading,
    error,
    availableInsights,
    loadAvailableInsights,
    askQuestion,
    executeInsight,
    getInsightsByCategory,
    searchInsights
  };
}