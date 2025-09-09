'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ReportFilters } from './reports-filters';

interface ReportsExportDialogProps {
  filters: ReportFilters;
  children?: React.ReactNode;
  format?: 'csv' | 'ynab'; // Format is determined by which button was clicked
}

interface ExportResult {
  success: boolean;
  data?: string;
  filename?: string;
  error?: string;
  retryable?: boolean;
  correlationId?: string;
  transactionCount?: number;
}

/**
 * Reports Export Dialog Component
 * 
 * Simplified export dialog that shows format information based on which button was clicked
 * Implements requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
export function ReportsExportDialog({ 
  filters,
  children,
  format = 'csv'
}: ReportsExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  /**
   * Handle export request (requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6)
   */
  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      // Prepare export request with report filters
      const exportRequest = {
        format: format,
        timeRange: filters.timeRange,
        startDate: filters.startDate,
        endDate: filters.endDate,
        categories: filters.categories.length > 0 ? filters.categories : undefined,
        search: filters.search || undefined,
      };

      // Call reports export API endpoint
      const response = await fetch('/api/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportRequest),
      });

      const result: ExportResult = await response.json();

      if (result.success && result.data && result.filename) {
        // Create and trigger download (requirement 6.2)
        const blob = new Blob([result.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        // Show success message with transaction count
        const countMessage = result.transactionCount 
          ? ` (${result.transactionCount} transactions)`
          : '';
        toast.success(`Export completed successfully${countMessage}`);
        setOpen(false);
      } else {
        // Handle export errors (requirement 6.6)
        const errorMessage = result.error || 'Export failed';
        
        if (response.status === 400) {
          toast.error(errorMessage);
        } else if (response.status === 429) {
          toast.error('Rate limit exceeded. Please try again later.');
        } else {
          toast.error(errorMessage);
          
          // Show retry option for retryable errors
          if (result.retryable) {
            toast.error('Export failed. Please try again.', {
              action: {
                label: 'Retry',
                onClick: () => handleExport()
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed. Please check your connection and try again.');
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Get filter summary for display
   */
  const getFilterSummary = () => {
    const parts: string[] = [];
    
    // Time range
    const timeRangeLabels = {
      last7: 'Last 7 days',
      last30: 'Last 30 days', 
      last90: 'Last 90 days',
      mtd: 'Month-to-date',
      custom: 'Custom range'
    };
    parts.push(`Time: ${timeRangeLabels[filters.timeRange]}`);
    
    // Custom date range
    if (filters.timeRange === 'custom' && filters.startDate && filters.endDate) {
      parts.push(`${filters.startDate} to ${filters.endDate}`);
    }
    
    // Categories
    if (filters.categories.length > 0) {
      if (filters.categories.length === 1) {
        parts.push(`Category: ${filters.categories[0]}`);
      } else {
        parts.push(`Categories: ${filters.categories.length} selected`);
      }
    }
    
    // Search
    if (filters.search) {
      parts.push(`Search: "${filters.search}"`);
    }
    
    return parts.join(' • ');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Report Data</DialogTitle>
          <DialogDescription>
            Export your filtered report data in {format.toUpperCase()} format. The export will include all transactions matching your current filters.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Current Filters Summary */}
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <Label className="text-sm font-medium text-white">Current Filters</Label>
            <p className="text-sm text-white mt-1 break-words">
              {getFilterSummary()}
            </p>
          </div>

          {/* Format Information */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Format</Label>
            
            {format === 'csv' && (
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-white">
                  <strong className="font-semibold">CSV Format:</strong> Includes headers: Date, Amount, Currency, Merchant, Category, Subcategory, Notes
                </p>
              </div>
            )}

            {format === 'ynab' && (
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-white">
                  <strong className="font-semibold">YNAB Format:</strong> Compatible with You Need A Budget import. Includes payee, category, and memo fields.
                </p>
              </div>
            )}

            {/* Note about empty results */}
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-white">
                <strong className="font-semibold">Note:</strong> If no transactions match your filters, a file with headers only will be generated.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export {format.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}