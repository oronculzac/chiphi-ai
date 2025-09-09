'use client';

import React, { useMemo, memo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PieChart as PieChartIcon, AlertCircle, RefreshCw, Filter } from 'lucide-react';
import { CategoryEmptyState } from '@/components/reports/empty-states';
import { WidgetErrorBoundary, determineEmptyStateVariant } from '@/components/reports/widget-error-boundary';
import { usePerformanceMonitor } from '@/hooks/use-performance-monitor';
import {
  DynamicPieChart,
  DynamicPie,
  DynamicCell,
  DynamicResponsiveContainer,
  DynamicTooltip,
  DonutChartSkeleton
} from '@/components/reports/charts/dynamic-charts';

interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  count: number;
}

interface CategoryBreakdownWidgetProps {
  data: CategoryBreakdown[];
  onCategoryClick: (category: string) => void;
  selectedCategories: string[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  hasAnyTransactions?: boolean;
  hasActiveFilters?: boolean;
  onWidenRange?: (range: 'last90' | 'last180' | 'all') => void;
  onClearFilters?: () => void;
  currentRange?: string;
}

// Color palette for categories (colorblind-friendly)
const CATEGORY_COLORS = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#ca8a04', // yellow
  '#9333ea', // purple
  '#c2410c', // orange
  '#0891b2', // cyan
  '#be123c', // rose
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#06b6d4', // sky
  '#10b981', // emerald
];

// Transform function for chart data optimization
function transformDataForChart(
  data: CategoryBreakdown[], 
  selectedCategories: string[]
) {
  if (!data || data.length === 0) return [];

  // Sort by amount descending
  const sortedData = [...data].sort((a, b) => b.amount - a.amount);
  
  // If more than 8 categories, group smaller ones into "Other"
  let chartData: Array<CategoryBreakdown & { color: string; isOther?: boolean }>;
  
  if (sortedData.length > 8) {
    const topCategories = sortedData.slice(0, 7);
    const otherCategories = sortedData.slice(7);
    
    const otherTotal = otherCategories.reduce((sum, cat) => sum + cat.amount, 0);
    const otherCount = otherCategories.reduce((sum, cat) => sum + cat.count, 0);
    const otherPercentage = otherCategories.reduce((sum, cat) => sum + cat.percentage, 0);
    
    chartData = [
      ...topCategories.map((cat, index) => ({
        ...cat,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length]
      })),
      {
        category: 'Other',
        amount: otherTotal,
        percentage: otherPercentage,
        count: otherCount,
        color: CATEGORY_COLORS[7],
        isOther: true
      }
    ];
  } else {
    chartData = sortedData.map((cat, index) => ({
      ...cat,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length]
    }));
  }

  // Add selection state to each item and ensure colors are properly set
  const result = chartData.map((item, index) => {
    const finalColor = item.color || CATEGORY_COLORS[index % CATEGORY_COLORS.length];
    return {
      ...item,
      // Ensure color is always set, fallback to a default color if needed
      color: finalColor,
      fill: finalColor, // Add explicit fill property for Recharts
      isSelected: selectedCategories.includes(item.category),
      opacity: selectedCategories.length === 0 || selectedCategories.includes(item.category) ? 1 : 0.3
    };
  });

  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Chart data with colors:', result.map(item => ({ 
      category: item.category, 
      color: item.color,
      fill: item.fill,
      amount: item.amount 
    })));
  }

  return result;
}

// Custom tooltip component
function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg">
        <p className="font-medium">{data.category}</p>
        <p className="text-sm text-muted-foreground">
          Amount: {formatCurrency(data.amount)}
        </p>
        <p className="text-sm text-muted-foreground">
          {data.percentage.toFixed(1)}% of total
        </p>
        <p className="text-sm text-muted-foreground">
          {data.count} transaction{data.count !== 1 ? 's' : ''}
        </p>
      </div>
    );
  }
  return null;
}

// Custom legend component with click functionality
function CustomLegend({ payload, onCategoryClick, selectedCategories }: any) {
  if (!payload || !Array.isArray(payload)) {
    return null;
  }
  
  // Filter out invalid entries before mapping
  const validPayload = payload.filter((item: any) => 
    item && item.category && item.amount !== undefined
  );
  
  if (validPayload.length === 0) {
    return null;
  }
  
  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {validPayload.map((item: any, index: number) => {
        const isSelected = selectedCategories.includes(item.category);
        const hasSelection = selectedCategories.length > 0;
        
        return (
          <button
            key={`legend-${index}`}
            onClick={() => onCategoryClick(item.category)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all hover:bg-accent ${
              hasSelection && !isSelected ? 'opacity-50' : ''
            } ${isSelected ? 'bg-accent ring-1 ring-ring' : ''}`}
            aria-label={`${isSelected ? 'Remove filter for' : 'Filter by'} ${item.category}`}
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span className="font-medium">{item.category}</span>
            <span className="text-muted-foreground">
              {formatCurrency(item.amount)}
            </span>
            {isSelected && (
              <Filter className="w-3 h-3 text-primary" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// Format currency helper
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

const CategoryBreakdownWidgetContent = memo(function CategoryBreakdownWidgetContent({
  data,
  onCategoryClick,
  selectedCategories,
  loading,
  error,
  onRetry,
  hasAnyTransactions = true,
  hasActiveFilters = false,
  onWidenRange,
  onClearFilters,
  currentRange
}: CategoryBreakdownWidgetProps) {
  // Performance monitoring - MUST be called before any conditional returns
  const { startMeasurement, endMeasurement } = usePerformanceMonitor({
    componentName: 'CategoryBreakdownWidget',
    threshold: 150 // 150ms threshold for chart rendering
  });

  // Validate data structure - do this in useMemo to avoid violating hooks rules
  const validData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return [];
    }
    
    return data.filter(item => 
      item && 
      typeof item === 'object' && 
      typeof item.category === 'string' && 
      typeof item.amount === 'number' && 
      !isNaN(item.amount) &&
      item.amount > 0
    );
  }, [data]);

  // Transform data for chart with memoization and performance tracking
  const chartData = useMemo(() => {
    let dataToUse = validData;
    
    // Use sample data in development if no real data is available and not in error state
    if (process.env.NODE_ENV === 'development' && validData.length === 0 && !error) {
      dataToUse = [
        { category: 'Shopping', amount: 604.54, percentage: 35.2, count: 12 },
        { category: 'Food & Dining', amount: 156.89, percentage: 9.1, count: 8 },
        { category: 'Transportation', amount: 78.90, percentage: 4.6, count: 3 },
        { category: 'Utilities', amount: 198.76, percentage: 11.6, count: 2 },
        { category: 'Healthcare', amount: 45.67, percentage: 2.7, count: 1 },
        { category: 'Business', amount: 29.99, percentage: 1.7, count: 1 },
      ];
    }
    
    if (dataToUse.length === 0) return [];
    
    startMeasurement();
    const result = transformDataForChart(dataToUse, selectedCategories);
    endMeasurement();
    return result;
  }, [validData, selectedCategories, startMeasurement, endMeasurement]);

  // Memoized chart click handler
  const handleChartClick = useCallback((data: any) => {
    if (data && data.category) {
      onCategoryClick(data.category);
    }
  }, [onCategoryClick]);

  // Memoized clear filters handler
  const handleClearFilters = useCallback(() => {
    selectedCategories.forEach(cat => onCategoryClick(cat));
  }, [selectedCategories, onCategoryClick]);

  // Now handle conditional returns after all hooks are called
  
  // Early return for invalid data
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <Card data-testid="category-widget">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Category Breakdown</CardTitle>
          <PieChartIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <PieChartIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No category data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Return for no valid data after filtering
  if (validData.length === 0) {
    return (
      <Card data-testid="category-widget">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Category Breakdown</CardTitle>
          <PieChartIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <PieChartIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No valid category data found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Card data-testid="category-widget">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Category Breakdown</CardTitle>
          <PieChartIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <DonutChartSkeleton />
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-8 w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card data-testid="category-widget">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Category Breakdown</CardTitle>
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
  if (!data || data.length === 0) {
    const variant = determineEmptyStateVariant(data, hasAnyTransactions, hasActiveFilters);
    
    return (
      <Card data-testid="category-widget">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Category Breakdown</CardTitle>
          <PieChartIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <CategoryEmptyState
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
    <Card data-testid="category-widget" role="article" aria-labelledby="category-title">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle id="category-title" className="text-sm font-medium">
          Category Breakdown
          {selectedCategories.length > 0 && (
            <span className="ml-2 text-xs text-primary">
              ({selectedCategories.length} filter{selectedCategories.length !== 1 ? 's' : ''} active)
            </span>
          )}
        </CardTitle>
        <PieChartIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="h-64 mb-4 w-full">
          <DynamicResponsiveContainer width="100%" height="100%">
            <DynamicPieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <DynamicPie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={1}
                dataKey="amount"
                onClick={handleChartClick}
                className="cursor-pointer focus:outline-none"
              >
                {chartData.map((entry, index) => {
                  const cellColor = entry.color || CATEGORY_COLORS[index % CATEGORY_COLORS.length];
                  return (
                    <DynamicCell 
                      key={`cell-${entry.category}-${index}`} 
                      fill={cellColor}
                      fillOpacity={entry.opacity || 1}
                      stroke={entry.isSelected ? '#000' : '#fff'}
                      strokeWidth={entry.isSelected ? 2 : 1}
                    />
                  );
                })}
              </DynamicPie>
              <DynamicTooltip content={<CustomTooltip />} />
            </DynamicPieChart>
          </DynamicResponsiveContainer>
        </div>
        
        {/* Legend moved outside the chart container for better layout */}
        <CustomLegend 
          payload={chartData}
          onCategoryClick={onCategoryClick}
          selectedCategories={selectedCategories}
        />
        
        {/* Clear filters button */}
        {selectedCategories.length > 0 && (
          <div className="flex justify-center mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="flex items-center space-x-2"
            >
              <Filter className="h-3 w-3" />
              <span>Clear Category Filters</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo optimization
  return (
    JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data) &&
    JSON.stringify(prevProps.selectedCategories) === JSON.stringify(nextProps.selectedCategories) &&
    prevProps.loading === nextProps.loading &&
    prevProps.error === nextProps.error &&
    prevProps.hasAnyTransactions === nextProps.hasAnyTransactions &&
    prevProps.hasActiveFilters === nextProps.hasActiveFilters &&
    prevProps.currentRange === nextProps.currentRange
  );
});

// Export the widget wrapped with error boundary
export function CategoryBreakdownWidget(props: CategoryBreakdownWidgetProps) {
  return (
    <WidgetErrorBoundary
      widgetName="Category Breakdown Widget"
      fallbackTitle="Category Breakdown"
      onRetry={props.onRetry}
    >
      <CategoryBreakdownWidgetContent {...props} />
    </WidgetErrorBoundary>
  );
}