'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Download, DollarSign, Receipt, TrendingUp, Star } from 'lucide-react';
import { YearlyReport } from '@/lib/services/advanced-analytics';

interface YearlyReportCardProps {
  orgId: string;
  onGenerateReport: (year: number, includePDF?: boolean) => Promise<YearlyReport | null>;
  loading: boolean;
}

export function YearlyReportCard({ orgId, onGenerateReport, loading }: YearlyReportCardProps) {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [report, setReport] = useState<YearlyReport | null>(null);
  const [generating, setGenerating] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const handleGenerateReport = async (includePDF: boolean = false) => {
    setGenerating(true);
    const result = await onGenerateReport(selectedYear, includePDF);
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
          <Calendar className="h-5 w-5" />
          <span>Yearly Reports</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Year Selection */}
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
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {report && !generating && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{report.year} Annual Report</h3>
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
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Average</p>
                  <p className="font-semibold">{formatCurrency(report.averageMonthlySpending)}</p>
                </div>
              </div>
            </div>

            {/* Peak Spending Month */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Peak Spending Month</p>
                  <p className="font-semibold">{report.peakSpendingMonth}</p>
                </div>
              </div>
            </div>

            {/* Monthly Breakdown */}
            <div>
              <h4 className="font-medium mb-2">Monthly Breakdown</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {report.monthlyBreakdown.map((month) => (
                  <div key={month.month} className="flex items-center justify-between">
                    <span className="text-sm">{month.month}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">{formatCurrency(month.amount)}</span>
                      <Badge variant="outline" className="text-xs">
                        {month.transactionCount} txns
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Categories */}
            <div>
              <h4 className="font-medium mb-2">Top Categories</h4>
              <div className="space-y-2">
                {report.categoryBreakdown.slice(0, 4).map((category) => (
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
                {report.topMerchants.slice(0, 4).map((merchant) => (
                  <div key={merchant.merchant} className="flex items-center justify-between">
                    <span className="text-sm truncate">{merchant.merchant}</span>
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}