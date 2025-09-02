'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { BarChart3, TrendingUp, TrendingDown, Minus, Calendar, Lightbulb } from 'lucide-react';
import { ComparativeAnalysis } from '@/lib/services/advanced-analytics';

interface ComparativeAnalysisCardProps {
  orgId: string;
  onCompare: (comparisonType: 'thisMonthVsLastMonth' | 'thisYearVsLastYear' | 'last30DaysVsPrevious30Days') => Promise<ComparativeAnalysis | null>;
  loading: boolean;
}

export function ComparativeAnalysisCard({ orgId, onCompare, loading }: ComparativeAnalysisCardProps) {
  const [selectedComparison, setSelectedComparison] = useState<'thisMonthVsLastMonth' | 'thisYearVsLastYear' | 'last30DaysVsPrevious30Days'>('thisMonthVsLastMonth');
  const [analysis, setAnalysis] = useState<ComparativeAnalysis | null>(null);
  const [comparing, setComparing] = useState(false);

  const comparisons = [
    { value: 'thisMonthVsLastMonth', label: 'This Month vs Last Month' },
    { value: 'thisYearVsLastYear', label: 'This Year vs Last Year' },
    { value: 'last30DaysVsPrevious30Days', label: 'Last 30 Days vs Previous 30 Days' }
  ];

  const handleCompare = async () => {
    setComparing(true);
    const result = await onCompare(selectedComparison);
    if (result) {
      setAnalysis(result);
    }
    setComparing(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDateRange = (start: Date, end: Date) => {
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-red-500" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-green-500" />;
      default:
        return <Minus className="h-3 w-3 text-blue-500" />;
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return 'text-red-500';
      case 'down':
        return 'text-green-500';
      default:
        return 'text-blue-500';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5" />
          <span>Comparative Analysis</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comparison Selection */}
        <div>
          <label className="text-sm font-medium mb-2 block">Comparison Type</label>
          <Select value={selectedComparison} onValueChange={(value: any) => setSelectedComparison(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {comparisons.map((comparison) => (
                <SelectItem key={comparison.value} value={comparison.value}>
                  {comparison.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Compare Button */}
        <Button 
          onClick={handleCompare}
          disabled={comparing || loading}
          className="w-full"
        >
          {comparing ? 'Comparing...' : 'Compare Periods'}
        </Button>

        {/* Analysis Display */}
        {comparing && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {analysis && !comparing && (
          <div className="space-y-4 border-t pt-4">
            {/* Period Headers */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <h4 className="font-medium text-sm mb-1">Current Period</h4>
                <p className="text-xs text-muted-foreground">
                  {formatDateRange(analysis.currentPeriod.start, analysis.currentPeriod.end)}
                </p>
              </div>
              <div className="text-center">
                <h4 className="font-medium text-sm mb-1">Comparison Period</h4>
                <p className="text-xs text-muted-foreground">
                  {formatDateRange(analysis.comparisonPeriod.start, analysis.comparisonPeriod.end)}
                </p>
              </div>
            </div>

            {/* Total Spending Comparison */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Total Spending</span>
                <div className="flex items-center space-x-2">
                  {analysis.changes.totalSpendingPercentage > 0 ? (
                    <TrendingUp className="h-4 w-4 text-red-500" />
                  ) : analysis.changes.totalSpendingPercentage < 0 ? (
                    <TrendingDown className="h-4 w-4 text-green-500" />
                  ) : (
                    <Minus className="h-4 w-4 text-blue-500" />
                  )}
                  <Badge variant={
                    analysis.changes.totalSpendingPercentage > 0 ? 'destructive' : 
                    analysis.changes.totalSpendingPercentage < 0 ? 'default' : 'secondary'
                  }>
                    {analysis.changes.totalSpendingPercentage > 0 ? '+' : ''}
                    {analysis.changes.totalSpendingPercentage.toFixed(1)}%
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Current</p>
                  <p className="font-semibold">{formatCurrency(analysis.currentPeriod.totalSpending)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Previous</p>
                  <p className="font-semibold">{formatCurrency(analysis.comparisonPeriod.totalSpending)}</p>
                </div>
              </div>
              
              <div className="mt-2">
                <p className="text-sm text-muted-foreground">Change</p>
                <p className={`font-semibold ${
                  analysis.changes.totalSpendingChange > 0 ? 'text-red-500' : 
                  analysis.changes.totalSpendingChange < 0 ? 'text-green-500' : 'text-blue-500'
                }`}>
                  {analysis.changes.totalSpendingChange > 0 ? '+' : ''}
                  {formatCurrency(analysis.changes.totalSpendingChange)}
                </p>
              </div>
            </div>

            {/* Transaction Count Comparison */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground mb-1">Current Transactions</p>
                <p className="font-semibold">{analysis.currentPeriod.transactionCount}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground mb-1">Previous Transactions</p>
                <p className="font-semibold">{analysis.comparisonPeriod.transactionCount}</p>
              </div>
            </div>

            {/* Category Changes */}
            <div>
              <h4 className="font-medium text-sm mb-2">Category Changes</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {analysis.changes.categoryChanges
                  .filter(change => Math.abs(change.percentage) > 5) // Only show significant changes
                  .slice(0, 6)
                  .map((change, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getTrendIcon(change.trend)}
                      <span className="text-sm">{change.category}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-medium ${getTrendColor(change.trend)}`}>
                        {change.change > 0 ? '+' : ''}{formatCurrency(change.change)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {change.percentage > 0 ? '+' : ''}{change.percentage.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Insights */}
            {analysis.insights.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  <h4 className="font-medium text-sm">Key Insights</h4>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-3">
                  <ul className="space-y-1">
                    {analysis.insights.map((insight, index) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
                        <span className="text-yellow-500 mt-1">•</span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-3">
              <h4 className="font-medium text-sm mb-2">Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Spending Trend:</span>
                  <span className={`ml-2 font-medium ${
                    analysis.changes.totalSpendingPercentage > 10 ? 'text-red-500' : 
                    analysis.changes.totalSpendingPercentage < -10 ? 'text-green-500' : 'text-blue-500'
                  }`}>
                    {analysis.changes.totalSpendingPercentage > 10 ? 'Increasing' : 
                     analysis.changes.totalSpendingPercentage < -10 ? 'Decreasing' : 'Stable'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Activity:</span>
                  <span className={`ml-2 font-medium ${
                    analysis.changes.transactionCountChange > 0 ? 'text-blue-500' : 
                    analysis.changes.transactionCountChange < 0 ? 'text-orange-500' : 'text-gray-500'
                  }`}>
                    {analysis.changes.transactionCountChange > 0 ? 'More Active' : 
                     analysis.changes.transactionCountChange < 0 ? 'Less Active' : 'Same Level'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}