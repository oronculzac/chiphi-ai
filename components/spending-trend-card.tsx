'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, Target, Brain } from 'lucide-react';
import { SpendingTrendAnalysis } from '@/lib/services/advanced-analytics';

interface SpendingTrendCardProps {
  orgId: string;
  onAnalyzeTrend: (periodDays: number) => Promise<SpendingTrendAnalysis | null>;
  loading: boolean;
}

export function SpendingTrendCard({ orgId, onAnalyzeTrend, loading }: SpendingTrendCardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<number>(30);
  const [analysis, setAnalysis] = useState<SpendingTrendAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const periods = [
    { value: 7, label: '7 days' },
    { value: 14, label: '14 days' },
    { value: 30, label: '30 days' },
    { value: 60, label: '60 days' },
    { value: 90, label: '90 days' }
  ];

  const handleAnalyzeTrend = async () => {
    setAnalyzing(true);
    const result = await onAnalyzeTrend(selectedPeriod);
    if (result) {
      setAnalysis(result);
    }
    setAnalyzing(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getTrendIcon = (trend: 'increasing' | 'decreasing' | 'stable') => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTrendColor = (trend: 'increasing' | 'decreasing' | 'stable') => {
    switch (trend) {
      case 'increasing':
        return 'text-red-500';
      case 'decreasing':
        return 'text-green-500';
      default:
        return 'text-blue-500';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5" />
          <span>Spending Trend Analysis</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Period Selection */}
        <div>
          <label className="text-sm font-medium mb-2 block">Analysis Period</label>
          <Select value={selectedPeriod.toString()} onValueChange={(value) => setSelectedPeriod(parseInt(value))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periods.map((period) => (
                <SelectItem key={period.value} value={period.value.toString()}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Analyze Button */}
        <Button 
          onClick={handleAnalyzeTrend}
          disabled={analyzing || loading}
          className="w-full"
        >
          {analyzing ? 'Analyzing...' : 'Analyze Spending Trend'}
        </Button>

        {/* Analysis Display */}
        {analyzing && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {analysis && !analyzing && (
          <div className="space-y-4 border-t pt-4">
            {/* Trend Overview */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getTrendIcon(analysis.change.trend)}
                <span className={`font-semibold ${getTrendColor(analysis.change.trend)}`}>
                  {analysis.change.trend.charAt(0).toUpperCase() + analysis.change.trend.slice(1)} Trend
                </span>
              </div>
              <Badge variant={analysis.change.trend === 'increasing' ? 'destructive' : analysis.change.trend === 'decreasing' ? 'default' : 'secondary'}>
                {analysis.change.percentage > 0 ? '+' : ''}{analysis.change.percentage.toFixed(1)}%
              </Badge>
            </div>

            {/* Period Comparison */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Current Period</h4>
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Total</span>
                    <span className="text-sm font-medium">{formatCurrency(analysis.currentPeriod.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Transactions</span>
                    <span className="text-sm font-medium">{analysis.currentPeriod.transactionCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Daily Avg</span>
                    <span className="text-sm font-medium">{formatCurrency(analysis.currentPeriod.averageDaily)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm">Previous Period</h4>
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Total</span>
                    <span className="text-sm font-medium">{formatCurrency(analysis.previousPeriod.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Transactions</span>
                    <span className="text-sm font-medium">{analysis.previousPeriod.transactionCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Daily Avg</span>
                    <span className="text-sm font-medium">{formatCurrency(analysis.previousPeriod.averageDaily)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Change Summary */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Change</span>
                <span className={`text-sm font-semibold ${getTrendColor(analysis.change.trend)}`}>
                  {analysis.change.amount > 0 ? '+' : ''}{formatCurrency(analysis.change.amount)}
                </span>
              </div>
              <Progress 
                value={Math.min(Math.abs(analysis.change.percentage), 100)} 
                className="h-2"
              />
            </div>

            {/* Prediction */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Brain className="h-4 w-4 text-purple-500" />
                <h4 className="font-medium text-sm">AI Prediction</h4>
                <Badge variant="outline" className="text-xs">
                  {analysis.prediction.confidence}% confidence
                </Badge>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Next Month Estimate</span>
                  <span className="font-semibold">{formatCurrency(analysis.prediction.nextMonthEstimate)}</span>
                </div>
                <div className="space-y-1">
                  {analysis.prediction.factors.map((factor, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Target className="h-3 w-3 text-purple-500" />
                      <span className="text-xs text-muted-foreground">{factor}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}