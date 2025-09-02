'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, DollarSign, Receipt, Target, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { DashboardStats, CategoryBreakdown, SpendingTrendPoint } from '@/lib/types';
import { useRealTimeAnalytics } from '@/hooks/use-real-time-analytics';
import { useIsMobile } from '@/hooks/use-mobile';

interface DashboardAnalyticsProps {
  orgId: string;
}

interface AnalyticsData extends DashboardStats {
  monthToDateTotal: number;
  categoryBreakdown: CategoryBreakdown[];
  spendingTrend: SpendingTrendPoint[];
  recentTransactions: any[];
}

// Colors for the donut chart
const CHART_COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
  '#82CA9D', '#FFC658', '#FF7C7C', '#8DD1E1', '#D084D0'
];

export function DashboardAnalytics({ orgId }: DashboardAnalyticsProps) {
  const { analytics, loading, error, lastUpdated, refreshAnalytics } = useRealTimeAnalytics({ 
    orgId,
    refreshInterval: 30000 // 30 seconds
  });
  const isMobile = useIsMobile();

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Calculate trend direction
  const getTrendDirection = (trendData: SpendingTrendPoint[]) => {
    if (trendData.length < 2) return 'neutral';
    
    const recent = trendData.slice(-7); // Last 7 days
    const firstWeek = recent.slice(0, Math.ceil(recent.length / 2));
    const secondWeek = recent.slice(Math.ceil(recent.length / 2));
    
    const firstAvg = firstWeek.reduce((sum, point) => sum + point.amount, 0) / firstWeek.length;
    const secondAvg = secondWeek.reduce((sum, point) => sum + point.amount, 0) / secondWeek.length;
    
    if (secondAvg > firstAvg * 1.1) return 'up';
    if (secondAvg < firstAvg * 0.9) return 'down';
    return 'neutral';
  };

  // Prepare donut chart data
  const prepareDonutData = (categoryBreakdown: CategoryBreakdown[]) => {
    return categoryBreakdown.slice(0, 8).map((category, index) => ({
      name: category.category,
      value: category.amount,
      percentage: category.percentage,
      count: category.count,
      color: CHART_COLORS[index % CHART_COLORS.length]
    }));
  };

  // Prepare trend chart data
  const prepareTrendData = (spendingTrend: SpendingTrendPoint[]) => {
    return spendingTrend.map(point => ({
      date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amount: point.amount,
      fullDate: point.date
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[120px]" />
                <Skeleton className="h-3 w-[80px] mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-[150px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-[150px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return null;
  }

  const trendDirection = getTrendDirection(analytics.spendingTrend);
  const donutData = prepareDonutData(analytics.categoryBreakdown);
  const trendData = prepareTrendData(analytics.spendingTrend);

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'items-center justify-between'}`}>
        <div>
          <h2 id="analytics-dashboard-title" className="text-2xl font-bold">Analytics Dashboard</h2>
          {lastUpdated && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshAnalytics}
          disabled={loading}
          className={`flex items-center space-x-2 ${isMobile ? 'w-full' : ''}`}
          aria-label={`Refresh analytics data${loading ? ' (refreshing)' : ''}`}
          aria-describedby="refresh-desc"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
        </Button>
        <div id="refresh-desc" className="sr-only">
          Refresh the analytics dashboard with the latest data
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div 
        className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-4'} gap-4`}
        role="region"
        aria-labelledby="key-metrics-heading"
      >
        <h3 id="key-metrics-heading" className="sr-only">Key Metrics</h3>
        
        {/* Month to Date Total */}
        <Card role="article" aria-labelledby="mtd-title">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle id="mtd-title" className="text-sm font-medium">Month to Date</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div 
              className="text-2xl font-bold"
              aria-label={`Month to date total: ${formatCurrency(analytics.monthToDateTotal)}`}
            >
              {formatCurrency(analytics.monthToDateTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total spending this month
            </p>
          </CardContent>
        </Card>

        {/* Transaction Count */}
        <Card role="article" aria-labelledby="transactions-title">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle id="transactions-title" className="text-sm font-medium">Transactions</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div 
              className="text-2xl font-bold"
              aria-label={`Transaction count: ${analytics.recentTransactions.length} recent transactions`}
            >
              {analytics.recentTransactions.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Recent transactions
            </p>
          </CardContent>
        </Card>

        {/* Top Category */}
        <Card role="article" aria-labelledby="top-category-title">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle id="top-category-title" className="text-sm font-medium">Top Category</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div 
              className="text-2xl font-bold"
              aria-label={`Top spending category: ${analytics.categoryBreakdown[0]?.category || 'No data available'}`}
            >
              {analytics.categoryBreakdown[0]?.category || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.categoryBreakdown[0] ? 
                `${formatCurrency(analytics.categoryBreakdown[0].amount)} (${analytics.categoryBreakdown[0].percentage}%)` :
                'No transactions yet'
              }
            </p>
          </CardContent>
        </Card>

        {/* Spending Trend */}
        <Card role="article" aria-labelledby="trend-title">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle id="trend-title" className="text-sm font-medium">30-Day Trend</CardTitle>
            {trendDirection === 'up' && <TrendingUp className="h-4 w-4 text-green-500" aria-label="Trending up" />}
            {trendDirection === 'down' && <TrendingDown className="h-4 w-4 text-red-500" aria-label="Trending down" />}
            {trendDirection === 'neutral' && <Minus className="h-4 w-4 text-muted-foreground" aria-label="Stable trend" />}
          </CardHeader>
          <CardContent>
            <div 
              className="text-2xl font-bold"
              aria-label={`Spending trend: ${
                trendDirection === 'up' ? 'increasing' : 
                trendDirection === 'down' ? 'decreasing' : 'stable'
              }`}
            >
              {trendDirection === 'up' && '↗'}
              {trendDirection === 'down' && '↘'}
              {trendDirection === 'neutral' && '→'}
            </div>
            <p className="text-xs text-muted-foreground">
              {trendDirection === 'up' && 'Spending increasing'}
              {trendDirection === 'down' && 'Spending decreasing'}
              {trendDirection === 'neutral' && 'Spending stable'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'} gap-6`}>
        {/* Category Breakdown Donut Chart */}
        <Card role="img" aria-labelledby="category-chart-title" aria-describedby="category-chart-desc">
          <CardHeader>
            <CardTitle id="category-chart-title">Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {donutData.length > 0 ? (
              <div className="space-y-4">
                <div id="category-chart-desc" className="sr-only">
                  Donut chart showing spending breakdown by category. {donutData.length} categories displayed.
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Amount']}
                      labelFormatter={(label) => `Category: ${label}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
                
                {/* Legend */}
                <div 
                  className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-2 text-sm`}
                  role="list"
                  aria-label="Category breakdown legend"
                >
                  {donutData.map((category, index) => (
                    <div 
                      key={category.name} 
                      className="flex items-center space-x-2"
                      role="listitem"
                    >
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: category.color }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{category.name}</span>
                      <span className="text-muted-foreground ml-auto">
                        {category.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div 
                className="flex items-center justify-center h-[300px] text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                No category data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* 30-Day Spending Trend */}
        <Card role="img" aria-labelledby="trend-chart-title" aria-describedby="trend-chart-desc">
          <CardHeader>
            <CardTitle id="trend-chart-title">30-Day Spending Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <>
                <div id="trend-chart-desc" className="sr-only">
                  Line chart showing spending trend over the last 30 days. {trendData.length} data points displayed.
                </div>
                <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Amount']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#0088FE" 
                    strokeWidth={2}
                    dot={{ fill: '#0088FE', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              </>
            ) : (
              <div 
                className="flex items-center justify-center h-[300px] text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}