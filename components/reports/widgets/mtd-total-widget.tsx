'use client';

import React, { memo, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MTDEmptyState } from '@/components/reports/empty-states';
import { WidgetErrorBoundary, determineEmptyStateVariant } from '@/components/reports/widget-error-boundary';

interface MTDData {
  current: number;
  previous: number;
  change: number;
  changePercentage: number;
}

interface MTDTotalWidgetProps {
  data: MTDData | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  hasAnyTransactions?: boolean;
  hasActiveFilters?: boolean;
  onWidenRange?: (range: 'last90' | 'last180' | 'all') => void;
  onClearFilters?: () => void;
  currentRange?: string;
}

// Memoized currency formatter
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

// Memoized percentage formatter
const formatPercentage = (percentage: number) => {
  return `${Math.abs(percentage).toFixed(1)}%`;
};

// Memoized trend info calculator
const getTrendInfo = (changePercentage: number) => {
  if (changePercentage > 0) {
    return {
      direction: 'up' as const,
      color: 'text-red-500',
      bgColor: 'bg-red-50',
      icon: TrendingUp,
      label: 'increase'
    };
  } else if (changePercentage < 0) {
    return {
      direction: 'down' as const,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      icon: TrendingDown,
      label: 'decrease'
    };
  } else {
    return {
      direction: 'neutral' as const,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/50',
      icon: null,
      label: 'no change'
    };
  }
};

const MTDTotalWidgetContent = memo(function MTDTotalWidgetContent({ 
  data, 
  loading, 
  error, 
  onRetry,
  hasAnyTransactions = true,
  hasActiveFilters = false,
  onWidenRange,
  onClearFilters,
  currentRange
}: MTDTotalWidgetProps) {
  // Memoized trend info calculation
  const trendInfo = useMemo(() => 
    data ? getTrendInfo(data.changePercentage) : null, 
    [data?.changePercentage]
  );

  // Memoized previous data check
  const hasPreviousData = useMemo(() => 
    data ? data.previous > 0 : false, 
    [data?.previous]
  );

  // Memoized formatted values
  const formattedValues = useMemo(() => {
    if (!data) return null;
    return {
      current: formatCurrency(data.current),
      percentage: formatPercentage(data.changePercentage),
      change: formatCurrency(Math.abs(data.change))
    };
  }, [data]);

  // Loading state
  if (loading) {
    return (
      <Card data-testid="mtd-widget">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Month to Date</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-24 mb-1" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card data-testid="mtd-widget">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Month to Date</CardTitle>
          <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 text-destructive mb-2">
            <span className="text-sm">{error}</span>
          </div>
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
        </CardContent>
      </Card>
    );
  }

  // No data state - use enhanced empty states
  if (!data || data.current === 0) {
    const variant = determineEmptyStateVariant(
      data ? [data] : null, 
      hasAnyTransactions, 
      hasActiveFilters
    );
    
    return (
      <Card data-testid="mtd-widget">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Month to Date</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <MTDEmptyState
            variant={variant}
            onWidenRange={onWidenRange}
            onClearFilters={onClearFilters}
            currentRange={currentRange}
          />
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = trendInfo?.icon;

  return (
    <Card data-testid="mtd-widget" role="article" aria-labelledby="mtd-title">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle id="mtd-title" className="text-sm font-medium">
          Month to Date
        </CardTitle>
        <DollarSign className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div 
          className="text-2xl font-bold"
          data-testid="mtd-total"
          aria-label={`Month to date total: ${formattedValues?.current}`}
        >
          {formattedValues?.current}
        </div>
        
        {/* Comparison with previous period */}
        {hasPreviousData ? (
          <div className="flex items-center space-x-2 mt-2">
            {TrendIcon && trendInfo && (
              <div className={`flex items-center space-x-1 ${trendInfo.color}`}>
                <TrendIcon className="h-3 w-3" aria-hidden="true" />
                <span className="text-sm font-medium">
                  {formattedValues?.percentage}
                </span>
              </div>
            )}
            {!TrendIcon && data.changePercentage === 0 && trendInfo && (
              <div className={`flex items-center space-x-1 ${trendInfo.color}`}>
                <span className="text-sm font-medium">No change</span>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">
              No comparison data available
            </span>
          </div>
        )}
        
        <p className="text-xs text-muted-foreground mt-1">
          {hasPreviousData && trendInfo ? (
            <>
              {formattedValues?.change} {trendInfo.label} from previous period
            </>
          ) : (
            'Total spending this month'
          )}
        </p>
      </CardContent>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo optimization
  return (
    JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data) &&
    prevProps.loading === nextProps.loading &&
    prevProps.error === nextProps.error &&
    prevProps.hasAnyTransactions === nextProps.hasAnyTransactions &&
    prevProps.hasActiveFilters === nextProps.hasActiveFilters &&
    prevProps.currentRange === nextProps.currentRange
  );
});

// Export the widget wrapped with error boundary
export function MTDTotalWidget(props: MTDTotalWidgetProps) {
  return (
    <WidgetErrorBoundary
      widgetName="MTD Total Widget"
      fallbackTitle="Month to Date"
      onRetry={props.onRetry}
    >
      <MTDTotalWidgetContent {...props} />
    </WidgetErrorBoundary>
  );
}