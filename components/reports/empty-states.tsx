'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Calendar, 
  Filter, 
  Receipt, 
  TrendingUp, 
  PieChart,
  DollarSign,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

/**
 * Empty state components for reports widgets
 * 
 * Requirements covered:
 * - 7.1: Create empty state components for "No data found" scenarios
 * - 7.2: Add quick action buttons to widen date range when no data exists
 * - 7.3: Implement different messaging for organizations with no transactions
 */

interface EmptyStateProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  variant?: 'no-data' | 'no-transactions' | 'filtered-out';
}

function EmptyStateBase({ title, description, icon: Icon, actions, variant = 'no-data' }: EmptyStateProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'no-transactions':
        return {
          iconColor: 'text-blue-500',
          bgColor: 'bg-blue-50 dark:bg-blue-950/20',
          borderColor: 'border-blue-200 dark:border-blue-800'
        };
      case 'filtered-out':
        return {
          iconColor: 'text-amber-500',
          bgColor: 'bg-amber-50 dark:bg-amber-950/20',
          borderColor: 'border-amber-200 dark:border-amber-800'
        };
      default:
        return {
          iconColor: 'text-muted-foreground',
          bgColor: 'bg-muted/20',
          borderColor: 'border-muted'
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className="flex flex-col items-center justify-center h-64 text-center p-6">
      <div className={`rounded-full p-4 mb-4 ${styles.bgColor} ${styles.borderColor} border`}>
        <Icon className={`h-8 w-8 ${styles.iconColor}`} aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md">{description}</p>
      {actions && (
        <div className="flex flex-col sm:flex-row gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

interface QuickActionButtonsProps {
  onWidenRange: (range: 'last90' | 'last180' | 'all') => void;
  currentRange?: string;
}

function QuickActionButtons({ onWidenRange, currentRange }: QuickActionButtonsProps) {
  const suggestions = [
    { range: 'last90' as const, label: 'Last 90 Days', disabled: currentRange === 'last90' },
    { range: 'last180' as const, label: 'Last 6 Months', disabled: currentRange === 'last180' },
    { range: 'all' as const, label: 'All Time', disabled: currentRange === 'all' }
  ];

  return (
    <>
      {suggestions.map(({ range, label, disabled }) => (
        <Button
          key={range}
          variant="outline"
          size="sm"
          onClick={() => onWidenRange(range)}
          disabled={disabled}
          className="gap-2"
        >
          <Calendar className="h-4 w-4" />
          {label}
        </Button>
      ))}
    </>
  );
}

// MTD Widget Empty States
interface MTDEmptyStateProps {
  variant: 'no-data' | 'no-transactions' | 'filtered-out';
  onWidenRange?: (range: 'last90' | 'last180' | 'all') => void;
  onClearFilters?: () => void;
  currentRange?: string;
}

export function MTDEmptyState({ variant, onWidenRange, onClearFilters, currentRange }: MTDEmptyStateProps) {
  if (variant === 'no-transactions') {
    return (
      <EmptyStateBase
        title="No Transactions Yet"
        description="Start by forwarding your first receipt email to begin tracking your expenses."
        icon={Receipt}
        variant="no-transactions"
        actions={
          <Button variant="default" className="gap-2">
            <Receipt className="h-4 w-4" />
            Learn How to Add Receipts
          </Button>
        }
      />
    );
  }

  if (variant === 'filtered-out') {
    return (
      <EmptyStateBase
        title="No Data for Current Filters"
        description="Try widening your date range or clearing filters to see more data."
        icon={Filter}
        variant="filtered-out"
        actions={
          <>
            {onClearFilters && (
              <Button variant="outline" size="sm" onClick={onClearFilters} className="gap-2">
                <Filter className="h-4 w-4" />
                Clear Filters
              </Button>
            )}
            {onWidenRange && (
              <QuickActionButtons onWidenRange={onWidenRange} currentRange={currentRange} />
            )}
          </>
        }
      />
    );
  }

  return (
    <EmptyStateBase
      title="No Spending Data"
      description="No spending data available for the selected period."
      icon={DollarSign}
      actions={
        onWidenRange && (
          <QuickActionButtons onWidenRange={onWidenRange} currentRange={currentRange} />
        )
      }
    />
  );
}

// Category Widget Empty States
interface CategoryEmptyStateProps {
  variant: 'no-data' | 'no-transactions' | 'filtered-out';
  onWidenRange?: (range: 'last90' | 'last180' | 'all') => void;
  onClearFilters?: () => void;
  currentRange?: string;
}

export function CategoryEmptyState({ variant, onWidenRange, onClearFilters, currentRange }: CategoryEmptyStateProps) {
  if (variant === 'no-transactions') {
    return (
      <EmptyStateBase
        title="No Categories to Show"
        description="Once you start processing receipts, you'll see a breakdown of spending by category here."
        icon={Receipt}
        variant="no-transactions"
        actions={
          <Button variant="default" className="gap-2">
            <Receipt className="h-4 w-4" />
            Process Your First Receipt
          </Button>
        }
      />
    );
  }

  if (variant === 'filtered-out') {
    return (
      <EmptyStateBase
        title="No Categories Match Filters"
        description="Your current filters don't match any transactions. Try adjusting your search criteria."
        icon={Filter}
        variant="filtered-out"
        actions={
          <>
            {onClearFilters && (
              <Button variant="outline" size="sm" onClick={onClearFilters} className="gap-2">
                <Filter className="h-4 w-4" />
                Clear All Filters
              </Button>
            )}
            {onWidenRange && (
              <QuickActionButtons onWidenRange={onWidenRange} currentRange={currentRange} />
            )}
          </>
        }
      />
    );
  }

  return (
    <EmptyStateBase
      title="No Category Data"
      description="No category breakdown available for the selected period."
      icon={PieChart}
      actions={
        onWidenRange && (
          <QuickActionButtons onWidenRange={onWidenRange} currentRange={currentRange} />
        )
      }
    />
  );
}

// Trend Widget Empty States
interface TrendEmptyStateProps {
  variant: 'no-data' | 'no-transactions' | 'filtered-out';
  onWidenRange?: (range: 'last90' | 'last180' | 'all') => void;
  onClearFilters?: () => void;
  currentRange?: string;
}

export function TrendEmptyState({ variant, onWidenRange, onClearFilters, currentRange }: TrendEmptyStateProps) {
  if (variant === 'no-transactions') {
    return (
      <EmptyStateBase
        title="No Trends to Display"
        description="Start tracking expenses to see spending trends and patterns over time."
        icon={Receipt}
        variant="no-transactions"
        actions={
          <Button variant="default" className="gap-2">
            <Receipt className="h-4 w-4" />
            Start Tracking Expenses
          </Button>
        }
      />
    );
  }

  if (variant === 'filtered-out') {
    return (
      <EmptyStateBase
        title="No Trend Data Available"
        description="Your filters don't match any transactions. Try expanding your search criteria."
        icon={Filter}
        variant="filtered-out"
        actions={
          <>
            {onClearFilters && (
              <Button variant="outline" size="sm" onClick={onClearFilters} className="gap-2">
                <Filter className="h-4 w-4" />
                Clear Filters
              </Button>
            )}
            {onWidenRange && (
              <QuickActionButtons onWidenRange={onWidenRange} currentRange={currentRange} />
            )}
          </>
        }
      />
    );
  }

  return (
    <EmptyStateBase
      title="No Trend Data"
      description="No spending trend data available for the selected period."
      icon={TrendingUp}
      actions={
        onWidenRange && (
          <QuickActionButtons onWidenRange={onWidenRange} currentRange={currentRange} />
        )
      }
    />
  );
}

// Generic Reports Page Empty State
interface ReportsEmptyStateProps {
  hasAnyTransactions: boolean;
  onGetStarted?: () => void;
  onWidenRange?: (range: 'last90' | 'last180' | 'all') => void;
  onClearFilters?: () => void;
}

export function ReportsEmptyState({ 
  hasAnyTransactions, 
  onGetStarted, 
  onWidenRange, 
  onClearFilters 
}: ReportsEmptyStateProps) {
  if (!hasAnyTransactions) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8">
          <EmptyStateBase
            title="Welcome to Reports"
            description="Start by processing your first receipt to see detailed financial analytics and insights here."
            icon={FileText}
            variant="no-transactions"
            actions={
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="default" onClick={onGetStarted} className="gap-2">
                  <Receipt className="h-4 w-4" />
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Learn More
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent className="p-8">
        <EmptyStateBase
          title="No Data for Current Selection"
          description="Try adjusting your filters or expanding your date range to see more data."
          icon={Filter}
          variant="filtered-out"
          actions={
            <div className="flex flex-col sm:flex-row gap-2">
              {onClearFilters && (
                <Button variant="outline" size="sm" onClick={onClearFilters} className="gap-2">
                  <Filter className="h-4 w-4" />
                  Clear All Filters
                </Button>
              )}
              {onWidenRange && (
                <QuickActionButtons onWidenRange={onWidenRange} />
              )}
            </div>
          }
        />
      </CardContent>
    </Card>
  );
}