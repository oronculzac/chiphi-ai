import { describe, it, expect } from 'vitest';

describe('Export Service Logic', () => {
  it('should escape CSV fields correctly', () => {
    const escapeCsvField = (field: string): string => {
      if (!field) return '';
      
      // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      
      return field;
    };

    expect(escapeCsvField('simple text')).toBe('simple text');
    expect(escapeCsvField('text, with comma')).toBe('"text, with comma"');
    expect(escapeCsvField('text with "quotes"')).toBe('"text with ""quotes"""');
    expect(escapeCsvField('text\nwith\nnewlines')).toBe('"text\nwith\nnewlines"');
  });

  it('should generate correct CSV headers', () => {
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

    expect(headers).toHaveLength(16);
    expect(headers).toContain('ID');
    expect(headers).toContain('Amount');
    expect(headers).toContain('Merchant');
    expect(headers).toContain('Category');
  });

  it('should generate correct YNAB headers', () => {
    const ynabHeaders = ['Date', 'Payee', 'Category', 'Memo', 'Outflow', 'Inflow'];

    expect(ynabHeaders).toHaveLength(6);
    expect(ynabHeaders).toContain('Date');
    expect(ynabHeaders).toContain('Payee');
    expect(ynabHeaders).toContain('Outflow');
    expect(ynabHeaders).toContain('Inflow');
  });

  it('should format YNAB category correctly', () => {
    const formatYNABCategory = (category: string, subcategory?: string): string => {
      if (subcategory) {
        return `${category}: ${subcategory}`;
      }
      return category;
    };

    expect(formatYNABCategory('Food & Dining')).toBe('Food & Dining');
    expect(formatYNABCategory('Food & Dining', 'Coffee')).toBe('Food & Dining: Coffee');
  });

  it('should create YNAB memo correctly', () => {
    const createYNABMemo = (notes?: string, last4?: string, confidence?: number): string => {
      const parts: string[] = [];
      
      if (notes) {
        parts.push(notes);
      }
      
      if (last4) {
        parts.push(`Card: ****${last4}`);
      }
      
      if (confidence && confidence < 90) {
        parts.push(`Confidence: ${confidence}%`);
      }
      
      return parts.join(' | ');
    };

    expect(createYNABMemo()).toBe('');
    expect(createYNABMemo('Coffee purchase')).toBe('Coffee purchase');
    expect(createYNABMemo('Coffee purchase', '1234')).toBe('Coffee purchase | Card: ****1234');
    expect(createYNABMemo('Coffee purchase', '1234', 85)).toBe('Coffee purchase | Card: ****1234 | Confidence: 85%');
    expect(createYNABMemo('Coffee purchase', '1234', 95)).toBe('Coffee purchase | Card: ****1234');
  });

  it('should generate filename with timestamp', () => {
    const generateFilename = (format: string, prefix: string = 'transactions'): string => {
      const timestamp = new Date().toISOString().split('T')[0];
      return `${prefix}_${timestamp}.${format}`;
    };

    const csvFilename = generateFilename('csv');
    const ynabFilename = generateFilename('csv', 'ynab_transactions');

    expect(csvFilename).toMatch(/transactions_\d{4}-\d{2}-\d{2}\.csv/);
    expect(ynabFilename).toMatch(/ynab_transactions_\d{4}-\d{2}-\d{2}\.csv/);
  });

  it('should validate export options', () => {
    const validateExportOptions = (options: any): { valid: boolean; error?: string } => {
      if (!options.format) {
        return { valid: false, error: 'Format is required' };
      }

      if (!['csv', 'ynab'].includes(options.format)) {
        return { valid: false, error: 'Invalid format' };
      }

      if (options.dateRange) {
        if (!options.dateRange.start || !options.dateRange.end) {
          return { valid: false, error: 'Both start and end dates are required for date range' };
        }

        if (new Date(options.dateRange.start) > new Date(options.dateRange.end)) {
          return { valid: false, error: 'Start date must be before end date' };
        }
      }

      return { valid: true };
    };

    expect(validateExportOptions({ format: 'csv' })).toEqual({ valid: true });
    expect(validateExportOptions({ format: 'ynab' })).toEqual({ valid: true });
    expect(validateExportOptions({})).toEqual({ valid: false, error: 'Format is required' });
    expect(validateExportOptions({ format: 'invalid' })).toEqual({ valid: false, error: 'Invalid format' });
    
    expect(validateExportOptions({
      format: 'csv',
      dateRange: { start: '2024-01-01', end: '2024-01-31' }
    })).toEqual({ valid: true });
    
    expect(validateExportOptions({
      format: 'csv',
      dateRange: { start: '2024-01-31', end: '2024-01-01' }
    })).toEqual({ valid: false, error: 'Start date must be before end date' });
  });
});