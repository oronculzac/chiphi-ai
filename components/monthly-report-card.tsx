'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Download, Calendar, DollarSign, Receipt, Store } from 'lucide-react';
import { MonthlyReport } from '@/lib/services/advanced-analytics';

interface MonthlyReportCardProps {
  orgId: string;
  onGenerateReport: (month: number, year: number, includePDF?: boolean) => Promise<MonthlyReport | null>;
  loading: boolean;
}

export function MonthlyReportCard({ orgId, onGenerateReport, loading }: MonthlyReportCardProps) {
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [generating, setGenerating] = useState(false);

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const handleGenerateReport = async (includePDF: boolean = false) => {
    setGenerating(true);
    const result = await onGenerateReport(selectedMonth, selectedYear, includePDF);
    if (result) {
      setReport(result);
    }
    setGenerating(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5" />
          <span>Monthly Reports</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Report Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Month</label>
            <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Year</label>
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Generate Buttons */}
        <div className="flex space-x-2">
          <Button 
            onClick={() => handleGenerateReport(false)}
            disabled={generating || loading}
            className="flex-1"
          >
            {generating ? 'Generating...' : 'Generate Report'}
          </Button>
          <Button 
            variant="outline"
            onClick={() => handleGenerateReport(true)}
            disabled={generating || loading}
          >
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>

        {/* Report Display */}
        {generating && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {report && !generating && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{report.month} {report.year}</h3>
              <Badge variant="secondary">
                {report.transactionCount} transactions
              </Badge>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Spending</p>
                  <p className="font-semibold">{formatCurrency(report.totalSpending)}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Receipt className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Avg Transaction</p>
                  <p className="font-semibold">{formatCurrency(report.averageTransactionAmount)}</p>
                </div>
              </div>
            </div>

            {/* Top Categories */}
            <div>
              <h4 className="font-medium mb-2">Top Categories</h4>
              <div className="space-y-2">
                {report.categoryBreakdown.slice(0, 3).map((category, index) => (
                  <div key={category.category} className="flex items-center justify-between">
                    <span className="text-sm">{category.category}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">{formatCurrency(category.amount)}</span>
                      <Badge variant="outline" className="text-xs">
                        {category.percentage.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Merchants */}
            <div>
              <h4 className="font-medium mb-2">Top Merchants</h4>
              <div className="space-y-2">
                {report.topMerchants.slice(0, 3).map((merchant, index) => (
                  <div key={merchant.merchant} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Store className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{merchant.merchant}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">{formatCurrency(merchant.amount)}</span>
                      <Badge variant="outline" className="text-xs">
                        {merchant.count} txns
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Spending Days:</span>
                  <span className="ml-2 font-medium">{report.spendingDays}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Categories:</span>
                  <span className="ml-2 font-medium">{report.categoryBreakdown.length}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}