'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Target, 
  Plus, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { Budget, BudgetAlert } from '@/lib/services/advanced-analytics';
import { useAdvancedAnalytics } from '@/hooks/use-advanced-analytics';

interface BudgetTrackingCardProps {
  orgId: string;
  onGetBudgets: (includeAlerts?: boolean) => Promise<{ budgets: Budget[]; alerts?: BudgetAlert[] } | null>;
  loading: boolean;
}

export function BudgetTrackingCard({ orgId, onGetBudgets, loading }: BudgetTrackingCardProps) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [loadingBudgets, setLoadingBudgets] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newBudgetCategory, setNewBudgetCategory] = useState('');
  const [newBudgetLimit, setNewBudgetLimit] = useState('');
  
  const { createBudget } = useAdvancedAnalytics({ orgId });

  const loadBudgets = async () => {
    setLoadingBudgets(true);
    const result = await onGetBudgets(true);
    if (result) {
      setBudgets(result.budgets);
      setAlerts(result.alerts || []);
    }
    setLoadingBudgets(false);
  };

  useEffect(() => {
    loadBudgets();
  }, []);

  const handleCreateBudget = async () => {
    if (!newBudgetCategory.trim() || !newBudgetLimit.trim()) return;
    
    const limit = parseFloat(newBudgetLimit);
    if (isNaN(limit) || limit <= 0) return;

    const result = await createBudget(newBudgetCategory.trim(), limit);
    if (result) {
      setBudgets(prev => [...prev, result]);
      setNewBudgetCategory('');
      setNewBudgetLimit('');
      setShowCreateDialog(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getAlertIcon = (alertType: 'warning' | 'exceeded' | 'approaching') => {
    switch (alertType) {
      case 'exceeded':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'approaching':
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Budget Tracking</span>
          </CardTitle>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Budget
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Budget</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <Input
                    placeholder="e.g., Groceries, Entertainment"
                    value={newBudgetCategory}
                    onChange={(e) => setNewBudgetCategory(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Monthly Limit</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newBudgetLimit}
                    onChange={(e) => setNewBudgetLimit(e.target.value)}
                  />
                </div>
                <div className="flex space-x-2">
                  <Button onClick={handleCreateBudget} className="flex-1">
                    Create Budget
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Refresh Button */}
        <Button 
          variant="outline" 
          onClick={loadBudgets}
          disabled={loadingBudgets || loading}
          className="w-full"
        >
          {loadingBudgets ? 'Loading...' : 'Refresh Budgets'}
        </Button>

        {/* Budget Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Budget Alerts</h4>
            {alerts.map((alert, index) => (
              <Alert key={index} className={
                alert.alertType === 'exceeded' ? 'border-red-200 bg-red-50 dark:bg-red-950/20' :
                alert.alertType === 'warning' ? 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20' :
                'border-blue-200 bg-blue-50 dark:bg-blue-950/20'
              }>
                <div className="flex items-start space-x-2">
                  {getAlertIcon(alert.alertType)}
                  <AlertDescription className="text-sm">
                    {alert.message}
                  </AlertDescription>
                </div>
              </Alert>
            ))}
          </div>
        )}

        {/* Budget List */}
        {loadingBudgets && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        )}

        {!loadingBudgets && budgets.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No budgets set up yet</p>
            <p className="text-sm">Create your first budget to start tracking spending</p>
          </div>
        )}

        {!loadingBudgets && budgets.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Current Budgets</h4>
            <div className="space-y-4">
              {budgets.map((budget) => (
                <div key={budget.id} className="border rounded-lg p-4 space-y-3">
                  {/* Budget Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <h5 className="font-medium">{budget.category}</h5>
                      {budget.isOverBudget && (
                        <Badge variant="destructive" className="text-xs">
                          Over Budget
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {formatCurrency(budget.currentSpending)} / {formatCurrency(budget.monthlyLimit)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {budget.percentageUsed.toFixed(1)}% used
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <Progress 
                      value={Math.min(budget.percentageUsed, 100)} 
                      className="h-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Budget Details */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-3 w-3 text-green-500" />
                      <div>
                        <p className="text-muted-foreground">Remaining</p>
                        <p className={`font-medium ${budget.remainingBudget < 0 ? 'text-red-500' : 'text-green-500'}`}>
                          {formatCurrency(budget.remainingBudget)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-3 w-3 text-blue-500" />
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <p className={`font-medium ${
                          budget.isOverBudget ? 'text-red-500' : 
                          budget.percentageUsed > 80 ? 'text-yellow-500' : 
                          'text-green-500'
                        }`}>
                          {budget.isOverBudget ? 'Over Budget' : 
                           budget.percentageUsed > 80 ? 'Near Limit' : 
                           'On Track'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Budget Summary */}
        {budgets.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-3">
            <h4 className="font-medium text-sm mb-2">Budget Summary</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <p className="text-muted-foreground">Total Budgets</p>
                <p className="font-semibold">{budgets.length}</p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground">Over Budget</p>
                <p className="font-semibold text-red-500">
                  {budgets.filter(b => b.isOverBudget).length}
                </p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground">On Track</p>
                <p className="font-semibold text-green-500">
                  {budgets.filter(b => !b.isOverBudget && b.percentageUsed < 80).length}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}