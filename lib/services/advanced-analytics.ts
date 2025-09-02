import { createClient } from '@/lib/supabase/client';
import { Transaction } from '@/lib/types';

// Advanced analytics types
export interface MonthlyReport {
  month: string;
  year: number;
  totalSpending: number;
  transactionCount: number;
  categoryBreakdown: CategorySpending[];
  topMerchants: MerchantSpending[];
  averageTransactionAmount: number;
  spendingDays: number;
}

export interface YearlyReport {
  year: number;
  totalSpending: number;
  transactionCount: number;
  monthlyBreakdown: MonthlySpending[];
  categoryBreakdown: CategorySpending[];
  topMerchants: MerchantSpending[];
  averageMonthlySpending: number;
  peakSpendingMonth: string;
}

export interface CategorySpending {
  category: string;
  amount: number;
  percentage: number;
  count: number;
  averageAmount: number;
}

export interface MerchantSpending {
  merchant: string;
  amount: number;
  count: number;
  averageAmount: number;
  category: string;
}

export interface MonthlySpending {
  month: string;
  amount: number;
  transactionCount: number;
}

export interface SpendingTrendAnalysis {
  currentPeriod: {
    amount: number;
    transactionCount: number;
    averageDaily: number;
  };
  previousPeriod: {
    amount: number;
    transactionCount: number;
    averageDaily: number;
  };
  change: {
    amount: number;
    percentage: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  prediction: {
    nextMonthEstimate: number;
    confidence: number;
    factors: string[];
  };
}

export interface Budget {
  id: string;
  orgId: string;
  category: string;
  monthlyLimit: number;
  currentSpending: number;
  remainingBudget: number;
  percentageUsed: number;
  isOverBudget: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetAlert {
  budgetId: string;
  category: string;
  alertType: 'warning' | 'exceeded' | 'approaching';
  currentSpending: number;
  budgetLimit: number;
  percentageUsed: number;
  message: string;
  createdAt: Date;
}

export interface ComparativeAnalysis {
  currentPeriod: {
    start: Date;
    end: Date;
    totalSpending: number;
    transactionCount: number;
    categoryBreakdown: CategorySpending[];
  };
  comparisonPeriod: {
    start: Date;
    end: Date;
    totalSpending: number;
    transactionCount: number;
    categoryBreakdown: CategorySpending[];
  };
  changes: {
    totalSpendingChange: number;
    totalSpendingPercentage: number;
    transactionCountChange: number;
    categoryChanges: Array<{
      category: string;
      change: number;
      percentage: number;
      trend: 'up' | 'down' | 'stable';
    }>;
  };
  insights: string[];
}

export interface PDFReportOptions {
  includeCharts: boolean;
  includeCategoryBreakdown: boolean;
  includeMerchantAnalysis: boolean;
  includeTrendAnalysis: boolean;
  logoUrl?: string;
  organizationName?: string;
}

export class AdvancedAnalyticsService {
  private supabase = createClient();

  // Monthly spending reports with PDF export
  async generateMonthlyReport(
    orgId: string, 
    month: number, 
    year: number,
    options?: PDFReportOptions
  ): Promise<MonthlyReport> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Get transactions for the month
    const { data: transactions, error } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('org_id', orgId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) throw error;

    const monthlyTransactions = transactions || [];
    const totalSpending = monthlyTransactions.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    // Calculate category breakdown
    const categoryMap = new Map<string, { amount: number; count: number }>();
    monthlyTransactions.forEach(t => {
      const existing = categoryMap.get(t.category) || { amount: 0, count: 0 };
      categoryMap.set(t.category, {
        amount: existing.amount + parseFloat(t.amount.toString()),
        count: existing.count + 1
      });
    });

    const categoryBreakdown: CategorySpending[] = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      amount: data.amount,
      percentage: totalSpending > 0 ? (data.amount / totalSpending) * 100 : 0,
      count: data.count,
      averageAmount: data.amount / data.count
    })).sort((a, b) => b.amount - a.amount);

    // Calculate merchant breakdown
    const merchantMap = new Map<string, { amount: number; count: number; category: string }>();
    monthlyTransactions.forEach(t => {
      const existing = merchantMap.get(t.merchant) || { amount: 0, count: 0, category: t.category };
      merchantMap.set(t.merchant, {
        amount: existing.amount + parseFloat(t.amount.toString()),
        count: existing.count + 1,
        category: t.category
      });
    });

    const topMerchants: MerchantSpending[] = Array.from(merchantMap.entries()).map(([merchant, data]) => ({
      merchant,
      amount: data.amount,
      count: data.count,
      averageAmount: data.amount / data.count,
      category: data.category
    })).sort((a, b) => b.amount - a.amount).slice(0, 10);

    // Calculate spending days
    const uniqueDates = new Set(monthlyTransactions.map(t => t.date));
    const spendingDays = uniqueDates.size;

    const report: MonthlyReport = {
      month: startDate.toLocaleString('default', { month: 'long' }),
      year,
      totalSpending,
      transactionCount: monthlyTransactions.length,
      categoryBreakdown,
      topMerchants,
      averageTransactionAmount: monthlyTransactions.length > 0 ? totalSpending / monthlyTransactions.length : 0,
      spendingDays
    };

    return report;
  }

  // Yearly spending reports with PDF export
  async generateYearlyReport(
    orgId: string, 
    year: number,
    options?: PDFReportOptions
  ): Promise<YearlyReport> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    // Get transactions for the year
    const { data: transactions, error } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('org_id', orgId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) throw error;

    const yearlyTransactions = transactions || [];
    const totalSpending = yearlyTransactions.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    // Calculate monthly breakdown
    const monthlyMap = new Map<string, { amount: number; count: number }>();
    yearlyTransactions.forEach(t => {
      const monthKey = new Date(t.date).toLocaleString('default', { month: 'long' });
      const existing = monthlyMap.get(monthKey) || { amount: 0, count: 0 };
      monthlyMap.set(monthKey, {
        amount: existing.amount + parseFloat(t.amount.toString()),
        count: existing.count + 1
      });
    });

    const monthlyBreakdown: MonthlySpending[] = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      amount: data.amount,
      transactionCount: data.count
    }));

    // Find peak spending month
    const peakMonth = monthlyBreakdown.reduce((max, current) => 
      current.amount > max.amount ? current : max, 
      monthlyBreakdown[0] || { month: 'None', amount: 0, transactionCount: 0 }
    );

    // Calculate category breakdown (reuse logic from monthly)
    const categoryMap = new Map<string, { amount: number; count: number }>();
    yearlyTransactions.forEach(t => {
      const existing = categoryMap.get(t.category) || { amount: 0, count: 0 };
      categoryMap.set(t.category, {
        amount: existing.amount + parseFloat(t.amount.toString()),
        count: existing.count + 1
      });
    });

    const categoryBreakdown: CategorySpending[] = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      amount: data.amount,
      percentage: totalSpending > 0 ? (data.amount / totalSpending) * 100 : 0,
      count: data.count,
      averageAmount: data.amount / data.count
    })).sort((a, b) => b.amount - a.amount);

    // Calculate merchant breakdown
    const merchantMap = new Map<string, { amount: number; count: number; category: string }>();
    yearlyTransactions.forEach(t => {
      const existing = merchantMap.get(t.merchant) || { amount: 0, count: 0, category: t.category };
      merchantMap.set(t.merchant, {
        amount: existing.amount + parseFloat(t.amount.toString()),
        count: existing.count + 1,
        category: t.category
      });
    });

    const topMerchants: MerchantSpending[] = Array.from(merchantMap.entries()).map(([merchant, data]) => ({
      merchant,
      amount: data.amount,
      count: data.count,
      averageAmount: data.amount / data.count,
      category: data.category
    })).sort((a, b) => b.amount - a.amount).slice(0, 15);

    const report: YearlyReport = {
      year,
      totalSpending,
      transactionCount: yearlyTransactions.length,
      monthlyBreakdown,
      categoryBreakdown,
      topMerchants,
      averageMonthlySpending: totalSpending / 12,
      peakSpendingMonth: peakMonth.month
    };

    return report;
  }

  // Spending trend analysis with predictive insights
  async analyzeSpendingTrend(
    orgId: string,
    periodDays: number = 30
  ): Promise<SpendingTrendAnalysis> {
    const currentEndDate = new Date();
    const currentStartDate = new Date(currentEndDate.getTime() - (periodDays * 24 * 60 * 60 * 1000));
    const previousStartDate = new Date(currentStartDate.getTime() - (periodDays * 24 * 60 * 60 * 1000));

    // Get current period transactions
    const { data: currentTransactions, error: currentError } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('org_id', orgId)
      .gte('date', currentStartDate.toISOString().split('T')[0])
      .lte('date', currentEndDate.toISOString().split('T')[0]);

    if (currentError) throw currentError;

    // Get previous period transactions
    const { data: previousTransactions, error: previousError } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('org_id', orgId)
      .gte('date', previousStartDate.toISOString().split('T')[0])
      .lt('date', currentStartDate.toISOString().split('T')[0]);

    if (previousError) throw previousError;

    const currentAmount = (currentTransactions || []).reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
    const previousAmount = (previousTransactions || []).reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    const currentCount = (currentTransactions || []).length;
    const previousCount = (previousTransactions || []).length;

    const currentDaily = currentAmount / periodDays;
    const previousDaily = previousAmount / periodDays;

    const amountChange = currentAmount - previousAmount;
    const percentageChange = previousAmount > 0 ? (amountChange / previousAmount) * 100 : 0;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (percentageChange > 10) trend = 'increasing';
    else if (percentageChange < -10) trend = 'decreasing';

    // Simple prediction based on trend
    const trendMultiplier = trend === 'increasing' ? 1.1 : trend === 'decreasing' ? 0.9 : 1.0;
    const nextMonthEstimate = currentDaily * 30 * trendMultiplier;
    
    // Confidence based on data consistency
    const confidence = Math.min(95, Math.max(60, 100 - Math.abs(percentageChange)));

    // Generate prediction factors
    const factors: string[] = [];
    if (trend === 'increasing') {
      factors.push('Recent spending increase detected');
      if (currentCount > previousCount) factors.push('More frequent transactions');
    } else if (trend === 'decreasing') {
      factors.push('Recent spending decrease detected');
      if (currentCount < previousCount) factors.push('Fewer transactions');
    } else {
      factors.push('Stable spending pattern');
    }

    return {
      currentPeriod: {
        amount: currentAmount,
        transactionCount: currentCount,
        averageDaily: currentDaily
      },
      previousPeriod: {
        amount: previousAmount,
        transactionCount: previousCount,
        averageDaily: previousDaily
      },
      change: {
        amount: amountChange,
        percentage: percentageChange,
        trend
      },
      prediction: {
        nextMonthEstimate,
        confidence,
        factors
      }
    };
  }  
// Budget tracking and alert system
  async createBudget(
    orgId: string,
    category: string,
    monthlyLimit: number
  ): Promise<Budget> {
    const budgetId = crypto.randomUUID();
    const now = new Date();

    // Get current month spending for this category
    const currentSpending = await this.getCurrentCategorySpending(orgId, category);

    const budget: Budget = {
      id: budgetId,
      orgId,
      category,
      monthlyLimit,
      currentSpending,
      remainingBudget: monthlyLimit - currentSpending,
      percentageUsed: monthlyLimit > 0 ? (currentSpending / monthlyLimit) * 100 : 0,
      isOverBudget: currentSpending > monthlyLimit,
      createdAt: now,
      updatedAt: now
    };

    // Store budget in database (would need budget table)
    // For now, we'll return the calculated budget
    return budget;
  }

  async updateBudget(
    budgetId: string,
    updates: Partial<Pick<Budget, 'monthlyLimit' | 'category'>>
  ): Promise<Budget> {
    // This would update the budget in the database
    // For now, we'll throw an error to indicate it needs implementation
    throw new Error('Budget updates require database table implementation');
  }

  async getBudgets(orgId: string): Promise<Budget[]> {
    // Get all categories that have transactions
    const { data: categories, error } = await this.supabase
      .from('transactions')
      .select('category')
      .eq('org_id', orgId)
      .gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);

    if (error) throw error;

    const uniqueCategories = [...new Set((categories || []).map(c => c.category))];

    // For demo purposes, create sample budgets
    const budgets: Budget[] = await Promise.all(
      uniqueCategories.map(async (category) => {
        const currentSpending = await this.getCurrentCategorySpending(orgId, category);
        const sampleLimit = Math.max(currentSpending * 1.2, 100); // 20% above current or $100 minimum

        return {
          id: crypto.randomUUID(),
          orgId,
          category,
          monthlyLimit: sampleLimit,
          currentSpending,
          remainingBudget: sampleLimit - currentSpending,
          percentageUsed: sampleLimit > 0 ? (currentSpending / sampleLimit) * 100 : 0,
          isOverBudget: currentSpending > sampleLimit,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      })
    );

    return budgets;
  }

  async getBudgetAlerts(orgId: string): Promise<BudgetAlert[]> {
    const budgets = await this.getBudgets(orgId);
    const alerts: BudgetAlert[] = [];

    budgets.forEach(budget => {
      let alertType: 'warning' | 'exceeded' | 'approaching' | null = null;
      let message = '';

      if (budget.isOverBudget) {
        alertType = 'exceeded';
        message = `Budget exceeded for ${budget.category}. You've spent $${budget.currentSpending.toFixed(2)} of your $${budget.monthlyLimit.toFixed(2)} budget.`;
      } else if (budget.percentageUsed >= 80) {
        alertType = 'warning';
        message = `Approaching budget limit for ${budget.category}. You've used ${budget.percentageUsed.toFixed(1)}% of your budget.`;
      } else if (budget.percentageUsed >= 60) {
        alertType = 'approaching';
        message = `${budget.category} spending is at ${budget.percentageUsed.toFixed(1)}% of budget.`;
      }

      if (alertType) {
        alerts.push({
          budgetId: budget.id,
          category: budget.category,
          alertType,
          currentSpending: budget.currentSpending,
          budgetLimit: budget.monthlyLimit,
          percentageUsed: budget.percentageUsed,
          message,
          createdAt: new Date()
        });
      }
    });

    return alerts;
  }

  private async getCurrentCategorySpending(orgId: string, category: string): Promise<number> {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    
    const { data, error } = await this.supabase
      .from('transactions')
      .select('amount')
      .eq('org_id', orgId)
      .eq('category', category)
      .gte('date', startOfMonth.toISOString().split('T')[0]);

    if (error) throw error;

    return (data || []).reduce((sum, t) => sum + parseFloat((t.amount || 0).toString()), 0);
  }

  // Comparative analytics across time periods
  async compareTimePeriods(
    orgId: string,
    currentStart: Date,
    currentEnd: Date,
    comparisonStart: Date,
    comparisonEnd: Date
  ): Promise<ComparativeAnalysis> {
    // Get current period transactions
    const { data: currentTransactions, error: currentError } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('org_id', orgId)
      .gte('date', currentStart.toISOString().split('T')[0])
      .lte('date', currentEnd.toISOString().split('T')[0]);

    if (currentError) throw currentError;

    // Get comparison period transactions
    const { data: comparisonTransactions, error: comparisonError } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('org_id', orgId)
      .gte('date', comparisonStart.toISOString().split('T')[0])
      .lte('date', comparisonEnd.toISOString().split('T')[0]);

    if (comparisonError) throw comparisonError;

    // Calculate current period stats
    const currentTotal = (currentTransactions || []).reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
    const currentCount = (currentTransactions || []).length;
    const currentCategories = this.calculateCategoryBreakdown(currentTransactions || [], currentTotal);

    // Calculate comparison period stats
    const comparisonTotal = (comparisonTransactions || []).reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
    const comparisonCount = (comparisonTransactions || []).length;
    const comparisonCategories = this.calculateCategoryBreakdown(comparisonTransactions || [], comparisonTotal);

    // Calculate changes
    const totalSpendingChange = currentTotal - comparisonTotal;
    const totalSpendingPercentage = comparisonTotal > 0 ? (totalSpendingChange / comparisonTotal) * 100 : 0;
    const transactionCountChange = currentCount - comparisonCount;

    // Calculate category changes
    const categoryChanges = currentCategories.map(currentCat => {
      const comparisonCat = comparisonCategories.find(c => c.category === currentCat.category);
      const comparisonAmount = comparisonCat?.amount || 0;
      const change = currentCat.amount - comparisonAmount;
      const percentage = comparisonAmount > 0 ? (change / comparisonAmount) * 100 : 0;
      
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (percentage > 10) trend = 'up';
      else if (percentage < -10) trend = 'down';

      return {
        category: currentCat.category,
        change,
        percentage,
        trend
      };
    });

    // Generate insights
    const insights: string[] = [];
    if (totalSpendingPercentage > 20) {
      insights.push(`Total spending increased significantly by ${totalSpendingPercentage.toFixed(1)}%`);
    } else if (totalSpendingPercentage < -20) {
      insights.push(`Total spending decreased significantly by ${Math.abs(totalSpendingPercentage).toFixed(1)}%`);
    }

    const biggestIncrease = categoryChanges.reduce((max, cat) => 
      cat.percentage > max.percentage ? cat : max, 
      categoryChanges[0] || { category: '', percentage: 0 }
    );

    if (biggestIncrease.percentage > 50) {
      insights.push(`${biggestIncrease.category} spending increased dramatically by ${biggestIncrease.percentage.toFixed(1)}%`);
    }

    const biggestDecrease = categoryChanges.reduce((min, cat) => 
      cat.percentage < min.percentage ? cat : min, 
      categoryChanges[0] || { category: '', percentage: 0 }
    );

    if (biggestDecrease.percentage < -50) {
      insights.push(`${biggestDecrease.category} spending decreased significantly by ${Math.abs(biggestDecrease.percentage).toFixed(1)}%`);
    }

    return {
      currentPeriod: {
        start: currentStart,
        end: currentEnd,
        totalSpending: currentTotal,
        transactionCount: currentCount,
        categoryBreakdown: currentCategories
      },
      comparisonPeriod: {
        start: comparisonStart,
        end: comparisonEnd,
        totalSpending: comparisonTotal,
        transactionCount: comparisonCount,
        categoryBreakdown: comparisonCategories
      },
      changes: {
        totalSpendingChange,
        totalSpendingPercentage,
        transactionCountChange,
        categoryChanges
      },
      insights
    };
  }

  private calculateCategoryBreakdown(transactions: Transaction[], totalSpending: number): CategorySpending[] {
    const categoryMap = new Map<string, { amount: number; count: number }>();
    
    transactions.forEach(t => {
      const existing = categoryMap.get(t.category) || { amount: 0, count: 0 };
      categoryMap.set(t.category, {
        amount: existing.amount + parseFloat(t.amount.toString()),
        count: existing.count + 1
      });
    });

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      amount: data.amount,
      percentage: totalSpending > 0 ? (data.amount / totalSpending) * 100 : 0,
      count: data.count,
      averageAmount: data.amount / data.count
    })).sort((a, b) => b.amount - a.amount);
  }

  // PDF export functionality (placeholder - would need PDF library)
  async exportReportToPDF(
    report: MonthlyReport | YearlyReport,
    options: PDFReportOptions = {
      includeCharts: true,
      includeCategoryBreakdown: true,
      includeMerchantAnalysis: true,
      includeTrendAnalysis: true
    }
  ): Promise<Buffer> {
    // This would use a PDF library like jsPDF or Puppeteer
    // For now, we'll throw an error to indicate it needs implementation
    throw new Error('PDF export requires PDF library implementation (jsPDF, Puppeteer, etc.)');
  }

  // Helper method to get month/year options for reports
  getAvailableReportPeriods(orgId: string): Promise<Array<{ month: number; year: number; label: string }>> {
    // This would query the database to find the earliest transaction date
    // and generate available periods from then to now
    const periods: Array<{ month: number; year: number; label: string }> = [];
    const now = new Date();
    
    // Generate last 12 months as example
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      periods.push({
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        label: date.toLocaleString('default', { month: 'long', year: 'numeric' })
      });
    }
    
    return Promise.resolve(periods);
  }
}