'use client';

import React, { useMemo, memo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { TrendingUp, AlertCircle, RefreshCw, Calendar } from 'lucide-react';
import { TrendEmptyState } from '@/components/reports/empty-states';
import { WidgetErrorBoundary, determineEmptyStateVariant } from '@/components/reports/widget-error-boundary';
import { usePerformanceMonitor } from '@/hooks/use-performance-monitor';
import {
  DynamicLineChart,
  DynamicLine,
  DynamicAreaChart,
  DynamicArea,
  DynamicXAxis,
  DynamicYAxis,
  DynamicCartesianGrid,
  DynamicTooltip,
  DynamicResponsiveContainer,
  ChartSkeleton
} from '@/components/reports/charts/dynamic-charts';

// Define SpendingTrendPoint interface if not available from lib/types
interface SpendingTrendPoint {
  date: string;
  amount: number;
  transactionCount: number;
}

interface SpendingTrendWidgetProps {
  data: SpendingTrendPoint[];
  timeRange: string;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  hasAnyTransactions?: boolean;
  hasActiveFilters?: boolean;
  onWidenRange?: (range: 'last90' | 'last180' | 'all') => void;
  onClearFilters?: () => void;
  currentRange?: string;
}

// Transform function for chart data optimization
function transformDataForChart(
  data: SpendingTrendPoint[], 
  timeRange: string
) {
  if (!data || data.length === 0) return [];

  // Sort data by date
  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Determine date range based on timeRange parameter
  const endDate = new Date();
  let startDate = new Date();
  
  switch (timeRange) {
    case 'last7':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case 'last30':
      startDate.setDate(endDate.getDate() - 30);
      break;
    case 'last90':
      startDate.setDate(endDate.getDate() - 90);
      break;
    case 'mtd':
      startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      break;
    default:
      // For custom ranges, use the data range
      if (sortedData.length > 0) {
        startDate = new Date(sortedData[0].date);
      }
  }

  // Create a map of existing data points
  const dataMap = new Map(sortedData.map(point => [point.date, point.amount]));
  
  // Fill in missing dates with zero amounts
  const filledData: Array<{ date: string; amount: number; formattedDate: string }> = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const amount = dataMap.get(dateStr) || 0;
    
    filledData.push({
      date: dateStr,
      amount,
      formattedDate: formatDateForDisplay(currentDate)
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return filledData;
}

// Format date for display in tooltip and axis
function formatDateForDisplay(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(date);
}

// Format currency helper
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// Custom tooltip component
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const data = payload[0];
    const date = new Date(label);
    const formattedDate = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
    
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-sm">{formattedDate}</p>
        <p className="text-lg font-semibold text-primary">
          {formatCurrency(data.value)}
        </p>
        {data.value === 0 && (
          <p className="text-xs text-muted-foreground">No spending</p>
        )}
      </div>
    );
  }
  return null;
}

// Custom X-axis tick formatter
function formatXAxisTick(tickItem: string, index: number, ticks?: string[]) {
  if (!tickItem || !ticks) return '';
  
  const date = new Date(tickItem);
  
  // Show fewer ticks on smaller screens or longer time ranges
  const totalTicks = ticks.length;
  let skipInterval = 1;
  
  if (totalTicks > 30) {
    skipInterval = Math.ceil(totalTicks / 10); // Show ~10 ticks max
  } else if (totalTicks > 14) {
    skipInterval = Math.ceil(totalTicks / 7); // Show ~7 ticks max
  }
  
  if (index % skipInterval === 0) {
    return formatDateForDisplay(date);
  }
  return '';
}

// Get time range display name
function getTimeRangeDisplayName(timeRange: string): string {
  switch (timeRange) {
    case 'last7':
      return 'Last 7 Days';
    case 'last30':
      return 'Last 30 Days';
    case 'last90':
      return 'Last 90 Days';
    case 'mtd':
      return 'Month to Date';
    case 'custom':
      return 'Custom Range';
    default:
      return 'Spending Trend';
  }
}

const SpendingTrendWidgetContent = memo(function SpendingTrendWidgetContent({
  data,
  timeRange,
  loading,
  error,
  onRetry,
  hasAnyTransactions = true,
  hasActiveFilters = false,
  onWidenRange,
  onClearFilters,
  currentRange
}: SpendingTrendWidgetProps) {
  // Performance monitoring
  const { startMeasurement, endMeasurement } = usePerformanceMonitor({
    componentName: 'SpendingTrendWidget',
    threshold: 200 // 200ms threshold for trend chart rendering
  });

  // Transform data for chart with memoization and performance tracking
  const chartData = useMemo(() => {
    startMeasurement();
    const result = transformDataForChart(data, timeRange);
    endMeasurement();
    return result;
  }, [data, timeRange, startMeasurement, endMeasurement]);

  // Calculate summary statistics with memoization
  const summaryStats = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { total: 0, average: 0, peak: 0, daysWithSpending: 0 };
    }

    const total = chartData.reduce((sum, point) => sum + point.amount, 0);
    const daysWithSpending = chartData.filter(point => point.amount > 0).length;
    const average = daysWithSpending > 0 ? total / daysWithSpending : 0;
    const peak = Math.max(...chartData.map(point => point.amount));

    return { total, average, peak, daysWithSpending };
  }, [chartData]);

  // Memoized chart type determination
  const useAreaChart = useMemo(() => 
    timeRange === 'last90' || timeRange === 'custom', 
    [timeRange]
  );

  // Memoized X-axis tick formatter
  const xAxisTickFormatter = useCallback((tickItem: string, index: number, ticks?: string[]) => {
    return formatXAxisTick(tickItem, index, ticks);
  }, []);

  // Memoized Y-axis tick formatter
  const yAxisTickFormatter = useCallback((value: number) => {
    return formatCurrency(value);
  }, []);

  // Loading state
  if (loading) {
    return (
      <Card data-testid="trend-widget">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {getTimeRangeDisplayName(timeRange)} Trend
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="h-64 mb-4">
            <ChartSkeleton />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card data-testid="trend-widget">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {getTimeRangeDisplayName(timeRange)} Trend
          </CardTitle>
          <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" aria-hidden="true" />
            <p className="text-sm text-destructive mb-4">{error}</p>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="flex items-center space-x-2"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Retry</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state - use enhanced empty states
  if (!data || data.length === 0 || summaryStats.total === 0) {
    const variant = determineEmptyStateVariant(data, hasAnyTransactions, hasActiveFilters);
    
    return (
      <Card data-testid="trend-widget">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {getTimeRangeDisplayName(timeRange)} Trend
          </CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <TrendEmptyState
            variant={variant}
            onWidenRange={onWidenRange}
            onClearFilters={onClearFilters}
            currentRange={currentRange}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="trend-widget" role="article" aria-labelledby="trend-title">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle id="trend-title" className="text-sm font-medium">
          {getTimeRangeDisplayName(timeRange)} Trend
        </CardTitle>
        <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        {/* Chart */}
        <div className="h-64 mb-4">
          <DynamicResponsiveContainer width="100%" height="100%">
            {useAreaChart ? (
              <DynamicAreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <DynamicCartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <DynamicXAxis 
                  dataKey="date"
                  tickFormatter={xAxisTickFormatter}
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <DynamicYAxis 
                  tickFormatter={yAxisTickFormatter}
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <DynamicTooltip content={<CustomTooltip />} />
                <DynamicArea
                  type="monotone"
                  dataKey="amount"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#spendingGradient)"
                  connectNulls={false}
                />
              </DynamicAreaChart>
            ) : (
              <DynamicLineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <DynamicCartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <DynamicXAxis 
                  dataKey="date"
                  tickFormatter={xAxisTickFormatter}
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <DynamicYAxis 
                  tickFormatter={yAxisTickFormatter}
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <DynamicTooltip content={<CustomTooltip />} />
                <DynamicLine
                  type="monotone"
                  dataKey="amount"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                  connectNulls={false}
                />
              </DynamicLineChart>
            )}
          </DynamicResponsiveContainer>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-semibold" aria-label={`Total spending: ${formatCurrency(summaryStats.total)}`}>
              {formatCurrency(summaryStats.total)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Daily Avg</p>
            <p className="text-lg font-semibold" aria-label={`Daily average: ${formatCurrency(summaryStats.average)}`}>
              {formatCurrency(summaryStats.average)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Peak Day</p>
            <p className="text-lg font-semibold" aria-label={`Peak day spending: ${formatCurrency(summaryStats.peak)}`}>
              {formatCurrency(summaryStats.peak)}
            </p>
          </div>
        </div>

        {/* Additional info */}
        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground">
            {summaryStats.daysWithSpending} of {chartData.length} days with spending activity
          </p>
        </div>
      </CardContent>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo optimization
  return (
    JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data) &&
    prevProps.timeRange === nextProps.timeRange &&
    prevProps.loading === nextProps.loading &&
    prevProps.error === nextProps.error &&
    prevProps.hasAnyTransactions === nextProps.hasAnyTransactions &&
    prevProps.hasActiveFilters === nextProps.hasActiveFilters &&
    prevProps.currentRange === nextProps.currentRange
  );
});

// Export the widget wrapped with error boundary
export function SpendingTrendWidget(props: SpendingTrendWidgetProps) {
  return (
    <WidgetErrorBoundary
      widgetName="Spending Trend Widget"
      fallbackTitle="Spending Trend"
      onRetry={props.onRetry}
    >
      <SpendingTrendWidgetContent {...props} />
    </WidgetErrorBoundary>
  );
}