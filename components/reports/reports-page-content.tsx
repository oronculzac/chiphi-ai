'use client';

import React, { memo, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Database, PieChart as PieChartIcon, BarChart3, TrendingUp, Calendar, Bell } from 'lucide-react';
import ReportsFilters from '@/components/reports/reports-filters';
import { MTDTotalWidget, CategoryBreakdownWidget, SpendingTrendWidget } from '@/components/reports/widgets';
import { ReportsExportDialog } from '@/components/reports/reports-export-dialog';
import { ReportsEmptyState } from '@/components/reports/empty-states';
import { useReportsData } from '@/hooks/use-reports-data';
import { useReportsFilters } from '@/hooks/use-reports-filters';
import { useAuth } from '@/components/auth/auth-provider';

// Coming Soon Feature Component
function ComingSoonFeature() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center py-12">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <BarChart3 className="w-12 h-12 text-primary" />
        </div>
        
        <h2 className="text-3xl font-bold mb-4">Advanced Reports Coming Soon</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          We&apos;re building powerful analytics and reporting features to help you gain deeper insights into your spending patterns.
        </p>
        
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
          <Calendar className="w-4 h-4" />
          Expected Launch: Q4 2025
        </div>
      </div>

      {/* Feature Preview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold mb-2">Spending Trends</h3>
            <p className="text-sm text-muted-foreground">
              Visualize your spending patterns over time with interactive charts and trend analysis.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <PieChartIcon className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold mb-2">Category Breakdown</h3>
            <p className="text-sm text-muted-foreground">
              See detailed breakdowns of your expenses by category with smart categorization.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold mb-2">Export & Integration</h3>
            <p className="text-sm text-muted-foreground">
              Export your data to CSV, Excel, or integrate directly with YNAB and other tools.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Notification Signup */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-8 text-center">
          <Bell className="w-8 h-8 text-primary mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Get Notified When Reports Launch</h3>
          <p className="text-muted-foreground mb-6">
            Be the first to know when our advanced reporting features are ready.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
            <Button>
              Notify Me
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            We'll only email you about reports feature updates. No spam, ever.
          </p>
        </CardContent>
      </Card>

      {/* Current Features */}
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-4">In the meantime, explore what&apos;s available now:</h3>
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
            View Dashboard
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/receipts'}>
            Manage Receipts
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/settings'}>
            Account Settings
          </Button>
        </div>
      </div>
    </div>
  );
}

// Organization Setup Card Component
function OrganizationSetupCard() {
  const [orgName, setOrgName] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);
  const [error, setError] = React.useState('');
  const { refreshProfile } = useAuth();

  const handleCreateOrganization = async () => {
    if (!orgName.trim()) {
      setError('Organization name is required');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const response = await fetch('/api/auth/organization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: orgName.trim() }),
      });

      const result = await response.json();

      if (result.success) {
        // Refresh the auth profile to get the new organization
        await refreshProfile();
        // The page will automatically re-render with the new organization
      } else {
        setError(result.error || 'Failed to create organization');
      }
    } catch (error) {
      console.error('Error creating organization:', error);
      setError('Failed to create organization. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-12">
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
              <PieChartIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-2">Set Up Your Organization</h3>
              <p className="text-muted-foreground">
                Create your organization to start tracking expenses and viewing reports.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="org-name" className="text-sm font-medium text-left block">
                  Organization Name
                </label>
                <input
                  id="org-name"
                  type="text"
                  value={orgName}
                  onChange={(e) => {
                    setOrgName(e.target.value);
                    setError('');
                  }}
                  placeholder=&quot;Enter your organization name&quot;
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  disabled={isCreating}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button 
                onClick={handleCreateOrganization}
                disabled={isCreating || !orgName.trim()}
                className="w-full"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Creating Organization...
                  </>
                ) : (
                  'Create Organization'
                )}
              </Button>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                You can also set up your organization from the{' '}
                <button 
                  onClick={() => window.location.href = '/dashboard'}
                  className=&quot;text-primary hover:underline&quot;
                >
                  dashboard
                </button>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Main content component for the reports page
 * Handles URL parameter state management and renders report widgets
 * 
 * Requirements covered:
 * - 4.6: Set up URL parameter handling for filter state persistence
 * - 8.1: Implement basic page layout using Page + Section components
 */

interface ReportsPageContentProps {
  searchParams: {
    timeRange?: string;
    startDate?: string;
    endDate?: string;
    categories?: string;
    search?: string;
  };
}

const ReportsPageContent = memo(function ReportsPageContent({ searchParams }: ReportsPageContentProps) {
  const { currentOrganization, isLoading: authLoading } = useAuth();
  const renderCountRef = React.useRef(0);
  const circuitBreakerRef = React.useRef(false);
  
  // For now, always show Coming Soon page to avoid infinite loop issues
  // TODO: Re-enable reports functionality once the root cause is fixed
  circuitBreakerRef.current = true;
  
  // ALWAYS call all hooks to avoid &quot;Rendered fewer hooks than expected&quot; error
  // Use the new reports filters hook for state management and URL synchronization
  const {
    filters,
    updateFilters,
    updateFiltersDebounced,
    clearFilters,
    availableCategories,
  } = useReportsFilters({
    debounceDelay: 300, // 300ms debounce for search input
  });

  // Fetch reports data using the enhanced custom hook
  const { 
    mtdData, 
    categoryData, 
    trendData,
    loading: reportsLoading, 
    error: reportsError, 
    refetch,
    correlationId,
    retryCount,
    lastUpdated
  } = useReportsData({
    orgId: currentOrganization?.id || '',
    filters,
    refreshInterval: 30000, // 30 seconds
    enabled: !!currentOrganization?.id && !circuitBreakerRef.current, // Disable data fetching if circuit breaker is active
  });

  // Memoized category click handler
  const handleCategoryClick = useCallback((category: string) => {
    const currentCategories = filters.categories || [];
    const newCategories = currentCategories.includes(category)
      ? currentCategories.filter(c => c !== category)
      : [...currentCategories, category];
    
    updateFilters({ categories: newCategories });
  }, [filters.categories, updateFilters]);

  // Memoized widen range handler
  const handleWidenRange = useCallback((range: 'last90' | 'last180' | 'all') => {
    const rangeMap = {
      'last90': 'last90' as const,
      'last180': 'last90' as const, // Map to available option
      'all': 'last90' as const // Map to available option for now
    };
    
    updateFilters({ 
      timeRange: rangeMap[range],
      startDate: undefined,
      endDate: undefined
    });
  }, [updateFilters]);

  // Memoized computed values for performance
  const computedValues = useMemo(() => {
    // Determine if organization has any transactions
    const hasAnyTransactions = !reportsLoading && (
      (mtdData && mtdData.current > 0) ||
      (categoryData && categoryData.length > 0) ||
      (trendData && trendData.length > 0)
    );

    // Determine if there are active filters
    const hasActiveFilters = !!(
      filters.categories?.length ||
      filters.search ||
      filters.timeRange !== 'last30' ||
      filters.startDate ||
      filters.endDate
    );

    // Check if all widgets are empty (no data scenario)
    const allWidgetsEmpty = !reportsLoading && !reportsError && (
      (!mtdData || mtdData.current === 0) &&
      (!categoryData || categoryData.length === 0) &&
      (!trendData || trendData.length === 0)
    );

    return { hasAnyTransactions, hasActiveFilters, allWidgetsEmpty };
  }, [reportsLoading, reportsError, mtdData, categoryData, trendData, filters]);

  // Circuit breaker check AFTER all hooks are called - show Coming Soon instead of error
  if (circuitBreakerRef.current) {
    return <ComingSoonFeature />;
  }

  // Show loading state while auth is loading
  if (authLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-muted rounded mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-64 bg-muted rounded"></div>
            <div className="h-64 bg-muted rounded"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show organization setup message if no organization exists
  if (!currentOrganization) {
    return <OrganizationSetupCard />;
  }

  // Show page-level empty state if no transactions exist
  if (computedValues.allWidgetsEmpty && !computedValues.hasAnyTransactions) {
    return (
      <div className="space-y-6">
        {/* Filters Section - still show for consistency */}
        <ReportsFilters
          filters={{...filters, categories: filters.categories || []}}
          onFiltersChange={updateFilters}
          onFiltersChangeDebounced={updateFiltersDebounced}
          onClearFilters={clearFilters}
          availableCategories={availableCategories}
          loading={reportsLoading}
        />

        {/* Page-level empty state */}
        <ReportsEmptyState
          hasAnyTransactions={computedValues.hasAnyTransactions}
          onGetStarted={() => window.location.href = '/dashboard'}
          onWidenRange={handleWidenRange}
          onClearFilters={clearFilters}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <ReportsFilters
        filters={{...filters, categories: filters.categories || []}}
        onFiltersChange={updateFilters}
        onFiltersChangeDebounced={updateFiltersDebounced}
        onClearFilters={clearFilters}
        availableCategories={availableCategories}
        loading={reportsLoading}
      />

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MTD Total Widget */}
        <MTDTotalWidget
          data={mtdData}
          loading={reportsLoading}
          error={reportsError}
          onRetry={refetch}
          hasAnyTransactions={computedValues.hasAnyTransactions}
          hasActiveFilters={computedValues.hasActiveFilters}
          onWidenRange={handleWidenRange}
          onClearFilters={clearFilters}
          currentRange={filters.timeRange}
        />

        {/* Category Breakdown Widget */}
        <CategoryBreakdownWidget
          data={categoryData}
          onCategoryClick={handleCategoryClick}
          selectedCategories={filters.categories || []}
          loading={reportsLoading}
          error={reportsError}
          onRetry={refetch}
          hasAnyTransactions={computedValues.hasAnyTransactions}
          hasActiveFilters={computedValues.hasActiveFilters}
          onWidenRange={handleWidenRange}
          onClearFilters={clearFilters}
          currentRange={filters.timeRange}
        />

        {/* Spending Trend Widget */}
        <SpendingTrendWidget
          data={trendData}
          timeRange={filters.timeRange}
          loading={reportsLoading}
          error={reportsError}
          onRetry={refetch}
          hasAnyTransactions={computedValues.hasAnyTransactions}
          hasActiveFilters={computedValues.hasActiveFilters}
          onWidenRange={handleWidenRange}
          onClearFilters={clearFilters}
          currentRange={filters.timeRange}
        />
      </div>

      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export your filtered report data in CSV or YNAB-compatible formats.
            </p>
            <div className="flex gap-4">
              <ReportsExportDialog filters={filters} format="csv">
                <Button variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </ReportsExportDialog>
              <ReportsExportDialog filters={filters} format="ynab">
                <Button variant="outline">
                  <Database className="h-4 w-4 mr-2" />
                  Export YNAB
                </Button>
              </ReportsExportDialog>
            </div>
            <p className="text-xs text-muted-foreground">
              Export includes all transactions matching your current filters with proper headers.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Debug Info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm">Debug Info</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-2 rounded overflow-auto whitespace-pre-wrap break-words text-foreground">
              {JSON.stringify({ 
                filters, 
                correlationId,
                retryCount,
                lastUpdated: lastUpdated?.toISOString(),
                searchParams 
              }, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo optimization
  // Since searchParams is now resolved, we can safely compare
  const prevKeys = Object.keys(prevProps.searchParams || {}).sort();
  const nextKeys = Object.keys(nextProps.searchParams || {}).sort();
  
  // Check if keys are different
  if (prevKeys.length !== nextKeys.length || !prevKeys.every((key, i) => key === nextKeys[i])) {
    return false;
  }
  
  // Check if values are different
  for (const key of prevKeys) {
    const prevValue = prevProps.searchParams[key as keyof typeof prevProps.searchParams];
    const nextValue = nextProps.searchParams[key as keyof typeof nextProps.searchParams];
    if (prevValue !== nextValue) {
      return false;
    }
  }
  
  return true;
});

export default ReportsPageContent;