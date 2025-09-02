import { createClient } from '@/lib/supabase/server';
import { Transaction } from '@/lib/types';

export interface ExportOptions {
  format: 'csv' | 'ynab';
  dateRange?: {
    start: Date;
    end: Date;
  };
  categories?: string[];
}

export interface ExportResult {
  success: boolean;
  data?: string;
  filename?: string;
  error?: string;
  retryable?: boolean;
}

/**
 * YNAB Export Service for transaction data
 * Implements requirement 8.2: Generate YNAB-compatible format
 */
export class YNABExportService {
  private supabase = createClient();

  /**
   * Export transactions to YNAB-compatible CSV format
   * Implements requirements 8.2, 8.3, 8.4
   */
  async exportTransactions(
    orgId: string,
    options: ExportOptions = { format: 'ynab' }
  ): Promise<ExportResult> {
    try {
      // Fetch transactions with tenant-scoped access (requirement 8.4)
      const transactions = await this.fetchTransactions(orgId, options);
      
      if (!transactions || transactions.length === 0) {
        return {
          success: false,
          error: 'No transactions found for the specified criteria',
          retryable: false
        };
      }

      // Generate YNAB CSV content (requirement 8.2)
      const ynabContent = this.generateYNABCSV(transactions);
      const filename = this.generateFilename('csv', options);

      return {
        success: true,
        data: ynabContent,
        filename
      };
    } catch (error) {
      console.error('YNAB export failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed',
        retryable: true // Most errors are retryable (requirement 8.5)
      };
    }
  }

  /**
   * Fetch transactions with proper tenant isolation
   * Implements requirement 8.4: Only include data accessible to requesting user
   */
  private async fetchTransactions(
    orgId: string,
    options: ExportOptions
  ): Promise<Transaction[]> {
    let query = this.supabase
      .from('transactions')
      .select(`
        id,
        date,
        amount,
        currency,
        merchant,
        last4,
        category,
        subcategory,
        notes,
        confidence,
        explanation,
        original_text,
        translated_text,
        source_language,
        created_at,
        updated_at
      `)
      .eq('org_id', orgId)
      .order('date', { ascending: false });

    // Apply date range filter if specified
    if (options.dateRange) {
      query = query
        .gte('date', options.dateRange.start.toISOString().split('T')[0])
        .lte('date', options.dateRange.end.toISOString().split('T')[0]);
    }

    // Apply category filter if specified
    if (options.categories && options.categories.length > 0) {
      query = query.in('category', options.categories);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Generate YNAB-compatible CSV content from transactions
   * YNAB format: Date,Payee,Category,Memo,Outflow,Inflow
   * Implements requirement 8.2: Generate YNAB-compatible format
   */
  private generateYNABCSV(transactions: Transaction[]): string {
    // YNAB CSV headers (requirement 8.2)
    const headers = ['Date', 'Payee', 'Category', 'Memo', 'Outflow', 'Inflow'];

    // Convert transactions to YNAB CSV rows
    const rows = transactions.map(transaction => {
      // YNAB uses positive amounts for inflows, negative for outflows
      const isOutflow = transaction.amount > 0;
      const outflow = isOutflow ? Math.abs(transaction.amount).toFixed(2) : '';
      const inflow = !isOutflow ? Math.abs(transaction.amount).toFixed(2) : '';
      
      // Create memo with confidence and explanation info
      const memo = this.createYNABMemo(transaction);
      
      return [
        transaction.date,
        this.escapeCsvField(transaction.merchant),
        this.escapeCsvField(this.formatYNABCategory(transaction)),
        this.escapeCsvField(memo),
        outflow,
        inflow
      ];
    });

    // Combine headers and rows
    const csvLines = [headers, ...rows];
    return csvLines.map(row => row.join(',')).join('\n');
  }

  /**
   * Format category for YNAB (includes subcategory if available)
   */
  private formatYNABCategory(transaction: Transaction): string {
    if (transaction.subcategory) {
      return `${transaction.category}: ${transaction.subcategory}`;
    }
    return transaction.category;
  }

  /**
   * Create memo field for YNAB with relevant transaction info
   */
  private createYNABMemo(transaction: Transaction): string {
    const parts: string[] = [];
    
    if (transaction.notes) {
      parts.push(transaction.notes);
    }
    
    if (transaction.last4) {
      parts.push(`Card: ****${transaction.last4}`);
    }
    
    if (transaction.confidence < 90) {
      parts.push(`Confidence: ${transaction.confidence}%`);
    }
    
    return parts.join(' | ');
  }

  /**
   * Escape CSV field to handle commas, quotes, and newlines
   */
  private escapeCsvField(field: string): string {
    if (!field) return '';
    
    // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    
    return field;
  }

  /**
   * Generate filename for export
   */
  private generateFilename(format: string, options: ExportOptions): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const dateRange = options.dateRange 
      ? `_${options.dateRange.start.toISOString().split('T')[0]}_to_${options.dateRange.end.toISOString().split('T')[0]}`
      : '';
    
    return `ynab_transactions_${timestamp}${dateRange}.${format}`;
  }
}

/**
 * CSV Export Service for transaction data
 * Implements requirement 8.1: Generate CSV format files
 */
export class CSVExportService {
  private supabase = createClient();

  /**
   * Export transactions to CSV format
   * Implements requirements 8.1, 8.3, 8.4
   */
  async exportTransactions(
    orgId: string,
    options: ExportOptions = { format: 'csv' }
  ): Promise<ExportResult> {
    try {
      // Fetch transactions with tenant-scoped access (requirement 8.4)
      const transactions = await this.fetchTransactions(orgId, options);
      
      if (!transactions || transactions.length === 0) {
        return {
          success: false,
          error: 'No transactions found for the specified criteria',
          retryable: false
        };
      }

      // Generate CSV content (requirement 8.1, 8.3)
      const csvContent = this.generateCSV(transactions);
      const filename = this.generateFilename('csv', options);

      return {
        success: true,
        data: csvContent,
        filename
      };
    } catch (error) {
      console.error('CSV export failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed',
        retryable: true // Most errors are retryable (requirement 8.5)
      };
    }
  }

  /**
   * Fetch transactions with proper tenant isolation
   * Implements requirement 8.4: Only include data accessible to requesting user
   */
  private async fetchTransactions(
    orgId: string,
    options: ExportOptions
  ): Promise<Transaction[]> {
    let query = this.supabase
      .from('transactions')
      .select(`
        id,
        date,
        amount,
        currency,
        merchant,
        last4,
        category,
        subcategory,
        notes,
        confidence,
        explanation,
        original_text,
        translated_text,
        source_language,
        created_at,
        updated_at
      `)
      .eq('org_id', orgId)
      .order('date', { ascending: false });

    // Apply date range filter if specified
    if (options.dateRange) {
      query = query
        .gte('date', options.dateRange.start.toISOString().split('T')[0])
        .lte('date', options.dateRange.end.toISOString().split('T')[0]);
    }

    // Apply category filter if specified
    if (options.categories && options.categories.length > 0) {
      query = query.in('category', options.categories);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Generate CSV content from transactions
   * Implements requirement 8.3: Include all transaction fields
   */
  private generateCSV(transactions: Transaction[]): string {
    // CSV headers - includes all transaction fields (requirement 8.3)
    const headers = [
      'ID',
      'Date',
      'Amount',
      'Currency',
      'Merchant',
      'Last4',
      'Category',
      'Subcategory',
      'Notes',
      'Confidence',
      'Explanation',
      'Original Text',
      'Translated Text',
      'Source Language',
      'Created At',
      'Updated At'
    ];

    // Convert transactions to CSV rows
    const rows = transactions.map(transaction => [
      transaction.id,
      transaction.date,
      transaction.amount.toString(),
      transaction.currency,
      this.escapeCsvField(transaction.merchant),
      transaction.last4 || '',
      this.escapeCsvField(transaction.category),
      this.escapeCsvField(transaction.subcategory || ''),
      this.escapeCsvField(transaction.notes || ''),
      transaction.confidence.toString(),
      this.escapeCsvField(transaction.explanation),
      this.escapeCsvField(transaction.original_text || ''),
      this.escapeCsvField(transaction.translated_text || ''),
      transaction.source_language || '',
      transaction.created_at,
      transaction.updated_at
    ]);

    // Combine headers and rows
    const csvLines = [headers, ...rows];
    return csvLines.map(row => row.join(',')).join('\n');
  }

  /**
   * Escape CSV field to handle commas, quotes, and newlines
   */
  private escapeCsvField(field: string): string {
    if (!field) return '';
    
    // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    
    return field;
  }

  /**
   * Generate filename for export
   */
  private generateFilename(format: string, options: ExportOptions): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const dateRange = options.dateRange 
      ? `_${options.dateRange.start.toISOString().split('T')[0]}_to_${options.dateRange.end.toISOString().split('T')[0]}`
      : '';
    
    return `transactions_${timestamp}${dateRange}.${format}`;
  }
}

/**
 * Unified Export Service
 * Handles both CSV and YNAB export formats
 * Implements requirements 8.1, 8.2, 8.3, 8.4, 8.5
 */
export class ExportService {
  private csvService = new CSVExportService();
  private ynabService = new YNABExportService();

  /**
   * Export transactions in the specified format
   * Implements all export requirements 8.1-8.5
   */
  async exportTransactions(
    orgId: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      // Validate input
      if (!orgId) {
        return {
          success: false,
          error: 'Organization ID is required',
          retryable: false
        };
      }

      // Route to appropriate service based on format
      switch (options.format) {
        case 'csv':
          return await this.csvService.exportTransactions(orgId, options);
        case 'ynab':
          return await this.ynabService.exportTransactions(orgId, options);
        default:
          return {
            success: false,
            error: `Unsupported export format: ${options.format}`,
            retryable: false
          };
      }
    } catch (error) {
      console.error('Export service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed',
        retryable: true
      };
    }
  }

  /**
   * Get available export formats
   */
  getAvailableFormats(): Array<{ value: string; label: string; description: string }> {
    return [
      {
        value: 'csv',
        label: 'CSV',
        description: 'Standard CSV format with all transaction fields'
      },
      {
        value: 'ynab',
        label: 'YNAB',
        description: 'You Need A Budget compatible format'
      }
    ];
  }
}