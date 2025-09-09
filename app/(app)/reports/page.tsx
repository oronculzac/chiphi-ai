import { Suspense } from 'react';
import { Metadata } from 'next';
import dynamic from 'next/dynamic';
import ReportsPageLoading from '@/components/reports/reports-page-loading';
import ReportsPageError from '@/components/reports/reports-page-error';

// Dynamic import for reports content to implement lazy loading (requirement 8.5)
const ReportsPageContent = dynamic(
  () => import('@/components/reports/reports-page-content'),
  {
    loading: () => <ReportsPageLoading />,
  }
);

export const metadata: Metadata = {
  title: 'Reports - AI Receipts Dashboard',
  description: 'Comprehensive financial analytics and reporting with interactive charts, spending trends, and export capabilities.',
  keywords: ['reports', 'analytics', 'financial', 'spending', 'charts', 'export'],
  openGraph: {
    title: 'Reports - AI Receipts Dashboard',
    description: 'View detailed financial reports and analytics for your expenses',
    type: 'website',
  },
};

interface ReportsPageProps {
  searchParams: Promise<{
    timeRange?: string;
    startDate?: string;
    endDate?: string;
    categories?: string;
    search?: string;
  }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const resolvedSearchParams = await searchParams;
  
  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <div className="container mx-auto py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Financial Reports</h1>
            <p className="text-muted-foreground">
              Analyze your spending patterns with interactive charts and detailed insights.
            </p>
          </div>
          
          {/* Reports Content with Error Boundary */}
          <Suspense fallback={<ReportsPageLoading />}>
            <ReportsPageError>
              <ReportsPageContent searchParams={resolvedSearchParams} />
            </ReportsPageError>
          </Suspense>
        </div>
      </div>
    </div>
  );
}