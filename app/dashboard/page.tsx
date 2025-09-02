import { TransactionDashboard } from '@/components/transaction-dashboard';
import AuthGuard from '@/components/auth/auth-guard';

export default function DashboardPage() {
  return (
    <AuthGuard>
      <div className="container mx-auto py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Transaction Dashboard</h1>
            <p className="text-muted-foreground">
              View and manage your receipt transactions with AI-powered categorization.
            </p>
          </div>
          
          <TransactionDashboard orgId="demo-org-id" />
        </div>
      </div>
    </AuthGuard>
  );
}