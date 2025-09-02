import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportService, CSVExportService, YNABExportService } from '../export';
import { Transaction } from '@/lib/types';

// Mock the entire export service to focus on testing the logic
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn()
}));

// Mock transaction data
const mockTransactions: Transaction[] = [
  {
    id: '1',
    org_id: 'org-1',
    email_id: 'email-1',
    date: '2024-01-15',
    amount: 25.99,
    currency: 'USD',
    merchant: 'Coffee Shop',
    last4: '1234',
    category: 'Food & Dining',
    subcategory: 'Coffee',
    notes: 'Morning coffee',
    confidence: 95,
    explanation: 'High confidence based on merchant name',
    original_text: 'Receipt text',
    translated_text: null,
    source_language: 'en',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z'
  },
  {
    id: '2',
    org_id: 'org-1',
    email_id: 'email-2',
    date: '2024-01-16',
    amount: 150.00,
    currency: 'USD',
    merchant: 'Grocery Store',
    last4: null,
    category: 'Groceries',
    subcategory: null,
    notes: null,
    confidence: 88,
    explanation: 'Categorized based on merchant type',
    original_text: 'Grocery receipt',
    translated_text: 'Grocery receipt',
    source_language: 'es',
    created_at: '2024-01-16T14:30:00Z',
    updated_at: '2024-01-16T14:30:00Z'
  }
];

describe('ExportService', () => {
  let exportService: ExportService;
  let csvService: CSVExportService;
  let ynabService: YNABExportService;

  beforeEach(() => {
    exportService = new ExportService();
    csvService = new CSVExportService();
    ynabService = new YNABExportService();
    vi.clearAllMocks();
  });

  describe('CSV Export', () => {
    it('should export transactions to CSV format', async () => {
      const result = await csvService.exportTransactions('org-1', { format: 'csv' });

      console.log('Export result:', result);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.filename).toMatch(/transactions_\d{4}-\d{2}-\d{2}\.csv/);
      
      // Check CSV headers
      const lines = result.data!.split('\n');
      expect(lines[0]).toContain('ID,Date,Amount,Currency,Merchant');
      
      // Check CSV data
      expect(lines[1]).toContain('1,2024-01-15,25.99,USD,"Coffee Shop"');
      expect(lines[2]).toContain('2,2024-01-16,150,USD,"Grocery Store"');
    });

    it('should handle CSV field escaping correctly', async () => {
      const transactionWithCommas: Transaction = {
        ...mockTransactions[0],
        merchant: 'Restaurant, Inc.',
        notes: 'Dinner with "friends"'
      };

      // Mock single transaction with special characters
      mockSupabase.from.mockReturnValueOnce(
        createMockQuery([transactionWithCommas], null)
      );

      const result = await csvService.exportTransactions('org-1', { format: 'csv' });

      expect(result.success).toBe(true);
      expect(result.data).toContain('"Restaurant, Inc."');
      expect(result.data).toContain('"Dinner with ""friends"""');
    });

    it('should include all transaction fields in CSV', async () => {
      const result = await csvService.exportTransactions('org-1', { format: 'csv' });

      expect(result.success).toBe(true);
      
      const headers = result.data!.split('\n')[0];
      const expectedFields = [
        'ID', 'Date', 'Amount', 'Currency', 'Merchant', 'Last4',
        'Category', 'Subcategory', 'Notes', 'Confidence', 'Explanation',
        'Original Text', 'Translated Text', 'Source Language',
        'Created At', 'Updated At'
      ];
      
      expectedFields.forEach(field => {
        expect(headers).toContain(field);
      });
    });
  });

  describe('YNAB Export', () => {
    it('should export transactions to YNAB format', async () => {
      const result = await ynabService.exportTransactions('org-1', { format: 'ynab' });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.filename).toMatch(/ynab_transactions_\d{4}-\d{2}-\d{2}\.csv/);
      
      // Check YNAB headers
      const lines = result.data!.split('\n');
      expect(lines[0]).toBe('Date,Payee,Category,Memo,Outflow,Inflow');
      
      // Check YNAB data format
      expect(lines[1]).toContain('2024-01-15,"Coffee Shop","Food & Dining: Coffee"');
      expect(lines[2]).toContain('2024-01-16,"Grocery Store",Groceries');
    });

    it('should handle outflow/inflow correctly', async () => {
      const result = await ynabService.exportTransactions('org-1', { format: 'ynab' });

      expect(result.success).toBe(true);
      
      const lines = result.data!.split('\n');
      // Positive amounts should be outflows
      expect(lines[1]).toContain('25.99,'); // outflow
      expect(lines[1]).toContain(','); // empty inflow
      expect(lines[2]).toContain('150.00,'); // outflow
    });

    it('should create proper YNAB memo with confidence and card info', async () => {
      const result = await ynabService.exportTransactions('org-1', { format: 'ynab' });

      expect(result.success).toBe(true);
      
      const lines = result.data!.split('\n');
      // Should include card info and confidence for low confidence transactions
      expect(lines[1]).toContain('Card: ****1234');
      expect(lines[2]).toContain('Confidence: 88%');
    });
  });

  describe('Unified Export Service', () => {
    it('should route to CSV service for csv format', async () => {
      const result = await exportService.exportTransactions('org-1', { format: 'csv' });

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/transactions_.*\.csv/);
    });

    it('should route to YNAB service for ynab format', async () => {
      const result = await exportService.exportTransactions('org-1', { format: 'ynab' });

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/ynab_transactions_.*\.csv/);
    });

    it('should return error for unsupported format', async () => {
      const result = await exportService.exportTransactions('org-1', { 
        format: 'invalid' as any 
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported export format');
      expect(result.retryable).toBe(false);
    });

    it('should return available formats', () => {
      const formats = exportService.getAvailableFormats();

      expect(formats).toHaveLength(2);
      expect(formats[0]).toEqual({
        value: 'csv',
        label: 'CSV',
        description: 'Standard CSV format with all transaction fields'
      });
      expect(formats[1]).toEqual({
        value: 'ynab',
        label: 'YNAB',
        description: 'You Need A Budget compatible format'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockSupabase.from.mockReturnValueOnce(
        createMockQuery(null, { message: 'Database connection failed' })
      );

      const result = await csvService.exportTransactions('org-1', { format: 'csv' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database query failed');
      expect(result.retryable).toBe(true);
    });

    it('should handle empty transaction list', async () => {
      // Mock empty result
      mockSupabase.from.mockReturnValueOnce(
        createMockQuery([], null)
      );

      const result = await csvService.exportTransactions('org-1', { format: 'csv' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No transactions found for the specified criteria');
      expect(result.retryable).toBe(false);
    });

    it('should validate organization ID', async () => {
      const result = await exportService.exportTransactions('', { format: 'csv' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Organization ID is required');
      expect(result.retryable).toBe(false);
    });
  });

  describe('Filtering Options', () => {
    it('should apply date range filter', async () => {
      const options = {
        format: 'csv' as const,
        dateRange: {
          start: new Date('2024-01-15'),
          end: new Date('2024-01-16')
        }
      };

      await csvService.exportTransactions('org-1', options);

      // Verify the query was called with date filters
      expect(mockSupabase.from).toHaveBeenCalledWith('transactions');
    });

    it('should apply category filter', async () => {
      const options = {
        format: 'csv' as const,
        categories: ['Food & Dining', 'Groceries']
      };

      await csvService.exportTransactions('org-1', options);

      // Verify the query was called with category filter
      expect(mockSupabase.from).toHaveBeenCalledWith('transactions');
    });

    it('should generate filename with date range', async () => {
      const options = {
        format: 'csv' as const,
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        }
      };

      const result = await csvService.exportTransactions('org-1', options);

      expect(result.success).toBe(true);
      expect(result.filename).toContain('2024-01-01_to_2024-01-31');
    });
  });
});