'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, DollarSign, Receipt, Target, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface DemoDashboardAnalyticsProps {
  orgId: string;
}

// Colors for the donut chart
const CHART_COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
  '#82CA9D', '#FFC658', '#FF7C7C', '#8DD1E1', '#D084D0'
];

// Mock data for demonstration
const mockAnalytics = {
  monthToDateTotal: 2847.32,
  categoryBreakdown: [
    { category: 'Groceries', amount: 856.45, count: 12, percentage: 30 },
    { category: 'Restaurants', amount: 642.18, count: 8, percentage: 23 },
    { category: 'Transportation', amount: 423.67, count: 6, percentage: 15 },
    { category: 'Entertainment', amount: 312.89, count: 4, percentage: 11 },
    { category: 'Shopping', amount: 298.45, count: 7, percentage: 10 },
    { category: 'Utilities', amount: 189.23, count: 3, percentage: 7 },
    { category: 'Healthcare', amount: 124.45, count: 2, percentage: 4 }
  ],
  spendingTrend: [
    { date: '2025-01-01', amount: 45.67 },
    { date: '2025-01-02', amount: 123.45 },
    { date: '2025-01-03', amount: 89.23 },
    { date: '2025-01-04', amount: 156.78 },
    { date: '2025-01-05', amount: 234.56 },
    { date: '2025-01-06', amount: 98.34 },
    { date: '2025-01-07', amount: 167.89 },
    { date: '2025-01-08', amount: 203.45 },
    { date: '2025-01-09', amount: 145.67 },
    { date: '2025-01-10', amount: 189.23 },
    { date: '2025-01-11', amount: 267.89 },
    { date: '2025-01-12', amount: 134.56 },
    { date: '2025-01-13', amount: 198.34 },
    { date: '2025-01-14', amount: 245.67 },
    { date: '2025-01-15', amount: 178.90 },
    { date: '2025-01-16', amount: 223.45 },
    { date: '2025-01-17', amount: 156.78 },
    { date: '2025-01-18', amount: 289.34 },
    { date: '2025-01-19', amount: 167.89 },
    { date: '2025-01-20', amount: 234.56 },
    { date: '2025-01-21', amount: 198.23 },
    { date: '2025-01-22', amount: 145.67 },
    { date: '2025-01-23', amount: 267.89 },
    { date: '2025-01-24', amount: 189.45 },
    { date: '2025-01-25', amount: 223.78 },
    { date: '2025-01-26', amount: 156.34 },
    { date: '2025-01-27', amount: 298.67 },
    { date: '2025-01-28', amount: 178.90 },
    { date: '2025-01-29', amount: 234.45 },
    { date: '2025-01-30', amount: 189.23 }
  ],
  recentTransactions: [
    { id: '1', merchant: 'Whole Foods', amount: 89.45, category: 'Groceries', confidence: 95 },
    { id: '2', merchant: 'Starbucks', amount: 12.50, category: 'Restaurants', confidence: 98 },
    { id: '3', merchant: 'Uber', amount: 23.75, category: 'Transportation', confidence: 92 },
    { id: '4', merchant: 'Amazon', amount: 156.78, category: 'Shopping', confidence: 88 },
    { id: '5', merchant: 'Netflix', amount: 15.99, category: 'Entertainment', confidence: 99 }
  ]
};

export function DemoDashboardAnalytics({ orgId }: DemoDashboardAnalyticsProps) {
  const [analytics, setAnalytics] = useState(mockAnalytics);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate small changes in data
      setAnalytics(prev => ({
        ...prev,
        monthToDateTotal: prev.monthToDateTotal + (Math.random() - 0.5) * 50,
        spendingTrend: prev.spendingTrend.map(point => ({
          ...point,
          amount: Math.max(0, point.amount + (Math.random() - 0.5) * 20)
        }))
      }));
      setLastUpdated(new Date());
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Simulate refresh
  const refreshAnalytics = () => {
    setLoading(true);
    setTimeout(() => {
      setAnalytics(prev => ({
        ...prev,
        monthToDateTotal: prev.monthToDateTotal + (Math.random() - 0.5) * 100
      }));
      setLastUpdated(new Date());
      setLoading(false);
    }, 1000);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Calculate trend direction
  const getTrendDirection = (trendData: typeof analytics.spendingTrend) => {
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
  const prepareDonutData = (categoryBreakdown: typeof analytics.categoryBreakdown) => {
    return categoryBreakdown.slice(0, 8).map((category, index) => ({
      name: category.category,
      value: category.amount,
      percentage: category.percentage,
      count: category.count,
      color: CHART_COLORS[index % CHART_COLORS.length]
    }));
  };

  // Prepare trend chart data
  const prepareTrendData = (spendingTrend: typeof analytics.spendingTrend) => {
    return spendingTrend.map(point => ({
      date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amount: point.amount,
      fullDate: point.date
    }));
  };

  if (loading && !analytics) {
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

  const trendDirection = getTrendDirection(analytics.spendingTrend);
  const donutData = prepareDonutData(analytics.categoryBreakdown);
  const trendData = prepareTrendData(analytics.spendingTrend);

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Real-time Analytics Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()} • Demo Mode
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshAnalytics}
          disabled={loading}
          className="flex items-center space-x-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Month to Date Total */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Month to Date</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics.monthToDateTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total spending this month
            </p>
          </CardContent>
        </Card>

        {/* Transaction Count */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.categoryBreakdown.reduce((sum, cat) => sum + cat.count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total transactions
            </p>
          </CardContent>
        </Card>

        {/* Top Category */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Category</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">30-Day Trend</CardTitle>
            {trendDirection === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
            {trendDirection === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
            {trendDirection === 'neutral' && <Minus className="h-4 w-4 text-muted-foreground" />}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
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
              <div className="grid grid-cols-2 gap-2 text-sm">
                {donutData.map((category, index) => (
                  <div key={category.name} className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="truncate">{category.name}</span>
                    <span className="text-muted-foreground ml-auto">
                      {category.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 30-Day Spending Trend */}
        <Card>
          <CardHeader>
            <CardTitle>30-Day Spending Trend</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>

      {/* Real-time Updates Indicator */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Real-time updates active • Updates every 30 seconds</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}