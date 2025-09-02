'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MessageSquare, 
  Send, 
  Lightbulb, 
  TrendingUp, 
  DollarSign, 
  BarChart3,
  Store,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { InsightQuery, InsightResult } from '@/lib/types';

interface InsightsPanelProps {
  orgId: string;
}

interface InsightResponse {
  success: boolean;
  data?: InsightResult;
  error?: string;
  availableInsights?: InsightQuery[];
  suggestions?: string[];
}

export function InsightsPanel({ orgId }: InsightsPanelProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InsightResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableInsights, setAvailableInsights] = useState<InsightQuery[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Load available insights on mount
  useEffect(() => {
    loadAvailableInsights();
  }, []);

  const loadAvailableInsights = async () => {
    try {
      const response = await fetch('/api/insights');
      const data: InsightResponse = await response.json();
      
      if (data.success && data.data?.availableInsights) {
        setAvailableInsights(data.data.availableInsights);
      }
    } catch (error) {
      console.error('Error loading available insights:', error);
    }
  };

  const handleSubmitQuery = async (queryText?: string) => {
    const searchQuery = queryText || query;
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setSuggestions([]);

    try {
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery }),
      });

      const data: InsightResponse = await response.json();

      if (data.success && data.data) {
        setResult(data.data);
        setQuery(''); // Clear input on success
      } else {
        setError(data.error || 'Failed to process insight');
        if (data.suggestions) {
          setSuggestions(data.suggestions);
        }
      }
    } catch (error) {
      console.error('Error submitting insight query:', error);
      setError('Failed to process your question. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePredefinedQuery = async (insightId: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSuggestions([]);

    try {
      const response = await fetch(`/api/insights?insightId=${insightId}`);
      const data: InsightResponse = await response.json();

      if (data.success && data.data) {
        setResult(data.data);
      } else {
        setError(data.error || 'Failed to process insight');
      }
    } catch (error) {
      console.error('Error executing predefined insight:', error);
      setError('Failed to process insight. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'spending':
        return <DollarSign className="w-4 h-4" />;
      case 'trends':
        return <TrendingUp className="w-4 h-4" />;
      case 'categories':
        return <BarChart3 className="w-4 h-4" />;
      case 'merchants':
        return <Store className="w-4 h-4" />;
      default:
        return <Lightbulb className="w-4 h-4" />;
    }
  };

  const renderVisualization = (result: InsightResult) => {
    if (!result.data || !result.visualization) return null;

    switch (result.visualization) {
      case 'metric':
        return (
          <div className="text-center p-6 bg-muted/50 rounded-lg">
            <div className="text-3xl font-bold text-primary">
              {typeof result.data.amount !== 'undefined' 
                ? `$${result.data.amount.toFixed(2)}`
                : typeof result.data.weeklyAverage !== 'undefined'
                ? `$${result.data.weeklyAverage.toFixed(2)}`
                : typeof result.data.percentage !== 'undefined'
                ? `${result.data.percentage.toFixed(1)}%`
                : 'N/A'
              }
            </div>
          </div>
        );

      case 'table':
        if (Array.isArray(result.data)) {
          return (
            <div className="space-y-2">
              {result.data.slice(0, 5).map((item: any, index: number) => (
                <div key={index} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                  <span className="font-medium">
                    {item.merchant || item.category || `Item ${index + 1}`}
                  </span>
                  <span className="text-muted-foreground">
                    {typeof item.amount === 'number' 
                      ? `$${item.amount.toFixed(2)}`
                      : typeof item.change === 'number'
                      ? `${item.change > 0 ? '+' : ''}${item.change.toFixed(1)}%`
                      : item.value || 'N/A'
                    }
                  </span>
                </div>
              ))}
            </div>
          );
        }
        break;

      case 'chart':
        return (
          <div className="text-center p-4 bg-muted/50 rounded-lg text-muted-foreground">
            <BarChart3 className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">Chart visualization would appear here</p>
            <p className="text-xs">Data points: {Array.isArray(result.data) ? result.data.length : 'N/A'}</p>
          </div>
        );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">AI Insights</h3>
      </div>

      {/* Query Input */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex space-x-2">
            <Input
              placeholder="Ask about your spending patterns..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSubmitQuery()}
              disabled={loading}
            />
            <Button 
              onClick={() => handleSubmitQuery()}
              disabled={loading || !query.trim()}
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Quick Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availableInsights.slice(0, 6).map((insight) => (
              <Button
                key={insight.id}
                variant="outline"
                size="sm"
                className="justify-start h-auto p-3 text-left"
                onClick={() => handlePredefinedQuery(insight.id)}
                disabled={loading}
              >
                <div className="flex items-start space-x-2">
                  {getCategoryIcon(insight.category)}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">
                      {insight.question}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {insight.description}
                    </div>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 mb-4">
              <MessageSquare className="w-4 h-4 animate-pulse" />
              <span className="text-sm text-muted-foreground">Analyzing your data...</span>
            </div>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-destructive mb-2">{error}</p>
                {suggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Try asking:</p>
                    <div className="flex flex-wrap gap-1">
                      {suggestions.slice(0, 3).map((suggestion, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          className="text-xs h-6"
                          onClick={() => handleSubmitQuery(suggestion)}
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center space-x-2">
                <MessageSquare className="w-4 h-4" />
                <span>Insight Result</span>
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {result.confidence}% confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Question */}
              <div className="text-sm text-muted-foreground">
                <strong>Q:</strong> {result.query}
              </div>
              
              {/* Answer */}
              <div className="text-sm">
                <strong>A:</strong> {result.answer}
              </div>

              {/* Visualization */}
              {renderVisualization(result)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help Text */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Ask about:</strong> Monthly spending, top categories, spending trends, favorite merchants</p>
            <p><strong>Security:</strong> All queries use predefined analytics functions - no custom SQL allowed</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}