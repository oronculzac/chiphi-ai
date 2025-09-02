'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, 
  TrendingUp, 
  Target, 
  BarChart3, 
  Download, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  DollarSign
} from 'lucide-react';
import { useAdvancedAnalytics } from '@/hooks/use-advanced-analytics';
import { useIsMobile } from '@/hooks/use-mobile';
import { MonthlyReportCard } from './monthly-report-card';
import { YearlyReportCard } from './yearly-report-card';
import { SpendingTrendCard } from './spending-trend-card';
import { BudgetTrackingCard } from './budget-tracking-card';
import { ComparativeAnalysisCard } from './comparative-analysis-card';

interface AdvancedAnalyticsDashboardProps {
  orgId: string;
}

export function AdvancedAnalyticsDashboard({ orgId }: AdvancedAnalyticsDashboardProps) {
  const { 
    loading, 
    error, 
    generateMonthlyReport,
    generateYearlyReport,
    analyzeSpendingTrend,
    getBudgets,
    comparePredefined
  } = useAdvancedAnalytics({ orgId });
  
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('reports');

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (error) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'items-center justify-between'}`}>
        <div>
          <h2 className="text-2xl font-bold">Advanced Analytics</h2>
          <p className="text-muted-foreground">
            Comprehensive reporting, trend analysis, and budget tracking
          </p>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className={`grid w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-4'}`}>
          <TabsTrigger value="reports" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Reports</span>
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4" />
            <span>Trends</span>
          </TabsTrigger>
          <TabsTrigger value="budgets" className="flex items-center space-x-2">
            <Target className="h-4 w-4" />
            <span>Budgets</span>
          </TabsTrigger>
          <TabsTrigger value="compare" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Compare</span>
          </TabsTrigger>
        </TabsList>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'} gap-6`}>
            <MonthlyReportCard 
              orgId={orgId}
              onGenerateReport={generateMonthlyReport}
              loading={loading}
            />
            <YearlyReportCard 
              orgId={orgId}
              onGenerateReport={generateYearlyReport}
              loading={loading}
            />
          </div>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6">
          <SpendingTrendCard 
            orgId={orgId}
            onAnalyzeTrend={analyzeSpendingTrend}
            loading={loading}
          />
        </TabsContent>

        {/* Budgets Tab */}
        <TabsContent value="budgets" className="space-y-6">
          <BudgetTrackingCard 
            orgId={orgId}
            onGetBudgets={getBudgets}
            loading={loading}
          />
        </TabsContent>

        {/* Compare Tab */}
        <TabsContent value="compare" className="space-y-6">
          <ComparativeAnalysisCard 
            orgId={orgId}
            onCompare={comparePredefined}
            loading={loading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}