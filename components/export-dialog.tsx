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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ExportOptions, ExportResult } from '@/lib/services/export';
import { toast } from 'sonner';

interface ExportDialogProps {
  onExport: (options: ExportOptions) => Promise<ExportResult>;
  availableCategories?: string[];
  children?: React.ReactNode;
}

/**
 * Export Dialog Component
 * Implements requirement 8.1, 8.2: Format selection UI
 * Implements requirement 8.5: Clear error messaging
 */
export function ExportDialog({ 
  onExport, 
  availableCategories = [],
  children 
}: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'ynab'>('csv');
  const [dateRange, setDateRange] = useState<{
    start: Date | undefined;
    end: Date | undefined;
  }>({
    start: undefined,
    end: undefined,
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const exportFormats = [
    {
      value: 'csv' as const,
      label: 'CSV',
      description: 'Standard CSV format with all transaction fields'
    },
    {
      value: 'ynab' as const,
      label: 'YNAB',
      description: 'You Need A Budget compatible format'
    }
  ];

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const options: ExportOptions = {
        format: exportFormat,
        ...(dateRange.start && dateRange.end && {
          dateRange: {
            start: dateRange.start,
            end: dateRange.end
          }
        }),
        ...(selectedCategories.length > 0 && {
          categories: selectedCategories
        })
      };

      const result = await onExport(options);

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

        toast.success('Export completed successfully');
        setOpen(false);
      } else {
        // Handle export errors (requirement 8.5)
        const errorMessage = result.error || 'Export failed';
        toast.error(errorMessage);
        
        // Show retry option for retryable errors (requirement 8.5)
        if (result.retryable) {
          toast.error('Export failed. Please try again.', {
            action: {
              label: 'Retry',
              onClick: () => handleExport()
            }
          });
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const resetForm = () => {
    setExportFormat('csv');
    setDateRange({ start: undefined, end: undefined });
    setSelectedCategories([]);
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) {
        resetForm();
      }
    }}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export Transactions</DialogTitle>
          <DialogDescription>
            Choose your export format and optional filters to download your transaction data.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* Format Selection */}
          <div className="grid gap-2">
            <Label htmlFor="format">Export Format</Label>
            <Select
              value={exportFormat}
              onValueChange={(value: 'csv' | 'ynab') => setExportFormat(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                {exportFormats.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{format.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {format.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Selection */}
          <div className="grid gap-2">
            <Label>Date Range (Optional)</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !dateRange.start && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.start ? (
                      format(dateRange.start, "PPP")
                    ) : (
                      <span>Start date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.start}
                    onSelect={(date) => setDateRange(prev => ({ ...prev, start: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !dateRange.end && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.end ? (
                      format(dateRange.end, "PPP")
                    ) : (
                      <span>End date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.end}
                    onSelect={(date) => setDateRange(prev => ({ ...prev, end: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Category Filter */}
          {availableCategories.length > 0 && (
            <div className="grid gap-2">
              <Label>Categories (Optional)</Label>
              <Select
                value={selectedCategories.join(',')}
                onValueChange={(value) => {
                  setSelectedCategories(value ? value.split(',') : []);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  {availableCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}