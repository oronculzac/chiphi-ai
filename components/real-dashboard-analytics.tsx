'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, Receipt, Target, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { DashboardStats } from '@/lib/types';

interface RealDashboardAnalyticsProps {
  stats: DashboardStats;
  loading: boolean;
  onRefresh: () => void;
}

// Colors for the donut chart
const CHART_COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
  '#82CA9D', '#FFC658', '#FF7C7C', '#8DD1E1', '#D084D0'
];

export function RealDashboardAnalytics({ stats, loading, onRefresh }: RealDashboardAnalyticsProps) {
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Calculate trend direction
  const getTrendDirection = (trendData: typeof stats.spendingTrend) => {
    if (trendData.length < 2) return 'neutral';
    
    const recent = trendData.slice(-7); // Last 7 days
    if (recent.length < 2) return 'neutral';
    
    const firstHalf = recent.slice(0, Math.ceil(recent.length / 2));
    const secondHalf = recent.slice(Math.ceil(recent.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, point) => sum + point.amount, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, point) => sum + point.amount, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg * 1.1) return 'up';
    if (secondAvg < firstAvg * 0.9) return 'down';
    return 'neutral';
  };

  // Prepare donut chart data
  const prepareDonutData = (categoryBreakdown: typeof stats.categoryBreakdown) => {
    return categoryBreakdown.slice(0, 8).map((category, index) => ({
      name: category.category,
      value: category.amount,
      percentage: category.percentage,
      count: category.count,
      color: CHART_COLORS[index % CHART_COLORS.length]
    }));
  };

  // Prepare trend chart data
  const prepareTrendData = (spendingTrend: typeof stats.spendingTrend) => {
    return spendingTrend.map(point => ({
      date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amount: point.amount,
      fullDate: point.date
    }));
  };

  const trendDirection = getTrendDirection(stats.spendingTrend);
  const donutData = prepareDonutData(stats.categoryBreakdown);
  const trendData = prepareTrendData(stats.spendingTrend);
  const totalTransactions = stats.categoryBreakdown.reduce((sum, cat) => sum + cat.count, 0);
  const topCategory = stats.categoryBreakdown[0];

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Real-time Analytics Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleTimeString()} • Live Data
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
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
              {formatCurrency(stats.monthToDateTotal)}
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
              {totalTransactions}
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
              {topCategory?.category || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {topCategory ? 
                `${formatCurrency(topCategory.amount)} (${topCategory.percentage}%)` :
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
              {donutData.length > 0 ? (
                <>
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
                </>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No category data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Spending Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Spending Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
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
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Real-time Updates Indicator */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Live data from database • {stats.recentTransactions.length} recent transactions</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}