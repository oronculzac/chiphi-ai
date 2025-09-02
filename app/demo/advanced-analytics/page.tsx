import { AdvancedAnalyticsDashboard } from '@/components/advanced-analytics-dashboard';

export default function AdvancedAnalyticsDemo() {
  // Demo org ID - in real app this would come from auth
  const demoOrgId = 'demo-org-123';

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Advanced Analytics Demo</h1>
        <p className="text-muted-foreground">
          Comprehensive reporting, trend analysis, budget tracking, and comparative analytics for financial data.
        </p>
      </div>
      
      <AdvancedAnalyticsDashboard orgId={demoOrgId} />
    </div>
  );
}