'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

import { useToast } from '@/hooks/use-toast';
import { useExport } from '@/hooks/use-export';
import { Download, Calendar, FileText, Database } from 'lucide-react';
import { format } from 'date-fns';
import DangerZoneSection from './danger-zone-section';

interface DateRange {
  start: string;
  end: string;
}

interface DataTabProps {
  organizationName?: string;
}

export default function DataTab({ organizationName = 'Your Organization' }: DataTabProps) {
  const { toast } = useToast();
  const { exportTransactions, isExporting, error } = useExport();
  
  const [dateRange, setDateRange] = useState<DateRange>({
    start: '',
    end: ''
  });
  


  // Handle date range changes
  const handleDateRangeChange = (field: keyof DateRange, value: string) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Validate date range
  const isDateRangeValid = () => {
    if (!dateRange.start || !dateRange.end) return true; // Optional range
    return new Date(dateRange.start) <= new Date(dateRange.end);
  };

  // Handle export
  const handleExport = async (format: 'csv' | 'ynab') => {
    try {
      // Validate date range if provided
      if (dateRange.start && dateRange.end && !isDateRangeValid()) {
        toast({
          title: 'Invalid Date Range',
          description: 'End date must be after start date.',
          variant: 'destructive',
        });
        return;
      }

      // Prepare export options
      const options = {
        format,
        ...(dateRange.start && dateRange.end && {
          dateRange: {
            start: dateRange.start,
            end: dateRange.end
          }
        })
      };

      // Execute export
      const result = await exportTransactions(options);

      if (result.success && result.data && result.filename) {
        // Create and trigger download
        const blob = new Blob([result.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast({
          title: 'Export Successful',
          description: `Your ${format.toUpperCase()} file has been downloaded.`,
        });
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      toast({
        title: 'Export Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  // Clear date range
  const clearDateRange = () => {
    setDateRange({ start: '', end: '' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Data Management</h2>
        <p className="text-muted-foreground">
          Export your financial data and manage your account settings.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Export Data Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Data
            </CardTitle>
            <CardDescription>
              Download your transaction data in CSV or YNAB-compatible formats.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date Range Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <Label className="text-sm font-medium">Date Range (Optional)</Label>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date" className="text-sm">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => handleDateRangeChange('start', e.target.value)}
                    max={dateRange.end || format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="end-date" className="text-sm">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => handleDateRangeChange('end', e.target.value)}
                    min={dateRange.start}
                    max={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
              </div>
              
              {(dateRange.start || dateRange.end) && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {dateRange.start && dateRange.end
                      ? `Exporting data from ${format(new Date(dateRange.start), 'MMM dd, yyyy')} to ${format(new Date(dateRange.end), 'MMM dd, yyyy')}`
                      : 'Please select both start and end dates'
                    }
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearDateRange}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </Button>
                </div>
              )}
              
              {!isDateRangeValid() && (
                <p className="text-sm text-destructive">
                  End date must be after start date.
                </p>
              )}
            </div>



            {/* Export Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => handleExport('csv')}
                disabled={isExporting || !isDateRangeValid()}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Export CSV'}
              </Button>
              
              <Button
                onClick={() => handleExport('ynab')}
                disabled={isExporting || !isDateRangeValid()}
                className="flex items-center gap-2"
                variant="outline"
              >
                <Database className="h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Export YNAB'}
              </Button>
            </div>

            {/* Export Info */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-medium">Export Information</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• CSV format includes all transaction fields and metadata</li>
                <li>• YNAB format is optimized for You Need A Budget import</li>
                <li>• Exports are filtered by your organization's data only</li>
                <li>• Large exports may take a few moments to generate</li>
              </ul>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-destructive font-medium">Export Error</p>
                <p className="text-sm text-destructive/80 mt-1">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Danger Zone Section */}
        <DangerZoneSection organizationName={organizationName} />
      </div>
    </div>
  );
}