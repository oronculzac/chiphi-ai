'use client';

import { useState, useCallback } from 'react';
import { ExportOptions, ExportResult } from '@/lib/services/export';

interface UseExportReturn {
  exportTransactions: (options: ExportOptions) => Promise<ExportResult>;
  isExporting: boolean;
  error: string | null;
}

/**
 * Hook for handling transaction exports
 * Implements requirements 8.1, 8.2, 8.5
 */
export function useExport(): UseExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportTransactions = useCallback(async (options: ExportOptions): Promise<ExportResult> => {
    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Export failed');
      }

      return {
        success: result.success,
        data: result.data,
        filename: result.filename,
        error: result.error,
        retryable: result.retryable
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      setError(errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        retryable: true
      };
    } finally {
      setIsExporting(false);
    }
  }, []);

  return {
    exportTransactions,
    isExporting,
    error
  };
}