'use client';

import { useState, useEffect, useRef } from 'react';
import { Transaction, DashboardStats } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TransactionList } from './transaction-list';
import { DashboardAnalytics } from './dashboard-analytics';
import { DemoDashboardAnalytics } from './demo-dashboard-analytics';
import { InsightsPanel } from './insights-panel';
import { ExportDialog } from './export-dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, TrendingUp, DollarSign, Receipt, Target } from 'lucide-react';
import { useExport } from '@/hooks/use-export';
import { useIsMobile } from '@/hooks/use-mobile';

interface TransactionDashboardProps {
  orgId: string;
}

export function TransactionDashboard({ orgId }: TransactionDashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('analytics');
  const [activeTransactionTab, setActiveTransactionTab] = useState('all');
  const { exportTransactions } = useExport();
  const isMobile = useIsMobile();
  const skipLinkRef = useRef<HTMLAnchorElement>(null);

  // Fetch dashboard statistics
  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/transactions/stats');
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch statistics');
      }

      setStats(result.data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, []);

  // Handle category update from transaction list
  const handleCategoryUpdate = (transactionId: string, category: string, subcategory?: string) => {
    // Refresh stats after category update
    fetchStats();
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
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

        {/* Transaction List Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[150px]" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-4 w-[100px]" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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

  return (
    <div className="space-y-6">
      {/* Skip to main content link for screen readers */}
      <a
        ref={skipLinkRef}
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary text-primary-foreground px-4 py-2 rounded-md z-50"
        onFocus={() => skipLinkRef.current?.scrollIntoView()}
      >
        Skip to main content
      </a>

      {/* Main Dashboard Tabs */}
      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab} 
        className="w-full"
        aria-label="Dashboard navigation"
      >
        <TabsList className={`grid w-full ${isMobile ? 'grid-cols-1 h-auto' : 'grid-cols-3'}`}>
          <TabsTrigger 
            value="analytics"
            className={isMobile ? 'justify-start' : ''}
            aria-describedby="analytics-desc"
          >
            Analytics
          </TabsTrigger>
          <TabsTrigger 
            value="insights"
            className={isMobile ? 'justify-start' : ''}
            aria-describedby="insights-desc"
          >
            AI Insights
          </TabsTrigger>
          <TabsTrigger 
            value="transactions"
            className={isMobile ? 'justify-start' : ''}
            aria-describedby="transactions-desc"
          >
            Transactions
          </TabsTrigger>
        </TabsList>

        {/* Hidden descriptions for screen readers */}
        <div className="sr-only">
          <div id="analytics-desc">View spending analytics and charts</div>
          <div id="insights-desc">Ask AI questions about your spending</div>
          <div id="transactions-desc">View and manage your transactions</div>
        </div>
        
        <TabsContent value="analytics" className="space-y-6" id="main-content">
          <div role="region" aria-labelledby="analytics-heading">
            <h2 id="analytics-heading" className="sr-only">Analytics Dashboard</h2>
            <DemoDashboardAnalytics orgId={orgId} />
          </div>
        </TabsContent>
        
        <TabsContent value="insights" className="space-y-6" id="main-content">
          <div role="region" aria-labelledby="insights-heading">
            <h2 id="insights-heading" className="sr-only">AI Insights Panel</h2>
            <InsightsPanel orgId={orgId} />
          </div>
        </TabsContent>
        
        <TabsContent value="transactions" className="space-y-6" id="main-content">
          <div role="region" aria-labelledby="transactions-heading">
            <h2 id="transactions-heading" className="sr-only">Transaction Management</h2>
            {/* Transaction List with Sub-tabs */}
            <Tabs 
              value={activeTransactionTab} 
              onValueChange={setActiveTransactionTab} 
              className="w-full"
              aria-label="Transaction filters"
            >
              <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'items-center justify-between'}`}>
                <TabsList className={isMobile ? 'grid grid-cols-2 w-full' : ''}>
                  <TabsTrigger value="all" aria-describedby="all-desc">
                    {isMobile ? 'All' : 'All Transactions'}
                  </TabsTrigger>
                  <TabsTrigger value="recent" aria-describedby="recent-desc">
                    Recent
                  </TabsTrigger>
                  <TabsTrigger value="high-confidence" aria-describedby="high-conf-desc">
                    {isMobile ? 'High Conf.' : 'High Confidence'}
                  </TabsTrigger>
                  <TabsTrigger value="needs-review" aria-describedby="review-desc">
                    {isMobile ? 'Review' : 'Needs Review'}
                  </TabsTrigger>
                </TabsList>
                
                {/* Hidden descriptions for screen readers */}
                <div className="sr-only">
                  <div id="all-desc">Show all transactions</div>
                  <div id="recent-desc">Show recent transactions</div>
                  <div id="high-conf-desc">Show high confidence transactions</div>
                  <div id="review-desc">Show transactions needing review</div>
                </div>
                
                {/* Export Button */}
                <ExportDialog 
                  onExport={exportTransactions}
                  availableCategories={stats?.categories || []}
                />
              </div>
            
              <TabsContent value="all" className="space-y-4">
                <TransactionList 
                  orgId={orgId} 
                  onCategoryUpdate={handleCategoryUpdate}
                  filter="all"
                />
              </TabsContent>
              
              <TabsContent value="recent" className="space-y-4">
                <TransactionList 
                  orgId={orgId} 
                  onCategoryUpdate={handleCategoryUpdate}
                  filter="recent"
                />
              </TabsContent>
              
              <TabsContent value="high-confidence" className="space-y-4">
                <TransactionList 
                  orgId={orgId} 
                  onCategoryUpdate={handleCategoryUpdate}
                  filter="high-confidence"
                />
              </TabsContent>
              
              <TabsContent value="needs-review" className="space-y-4">
                <TransactionList 
                  orgId={orgId} 
                  onCategoryUpdate={handleCategoryUpdate}
                  filter="needs-review"
                />
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}