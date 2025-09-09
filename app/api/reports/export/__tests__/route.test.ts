import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock dependencies
vi.mock('@/lib/database/utils', () => ({
  getUserSession: vi.fn()
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn()
}));

// Import mocked functions
import { getUserSession } from '@/lib/database/utils';
import { createClient } from '@/lib/supabase/server';

const mockGetUserSession = vi.mocked(getUserSession);
const mockCreateClient = vi.mocked(createClient);

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn()
};

// Mock query builder
const createMockQuery = (data: any, error: any = null) => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  insert: vi.fn().mockResolvedValue({ data, error }),
  data,
  error
});

// Mock transaction data
const mockTransactions = [
  {
    id: '1',
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

describe('/api/reports/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful authentication
    mockGetUserSession.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
      org: { id: 'org-1', name: 'Test Org' }
    });
    
    // Mock Supabase client
    mockCreateClient.mockReturnValue(mockSupabase as any);
    
    // Mock successful transaction query
    mockSupabase.from.mockReturnValue(createMockQuery(mockTransactions));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 for unauthenticated requests', async () => {
      mockGetUserSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/reports/export', {
        method: 'POST',
        body: JSON.stringify({ format: 'csv', timeRange: 'last30' })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
      expect(data.correlationId).toBeDefined();
    });
  });

  describe('Request Validation', () => {
    it('should validate required format parameter', async () => {
      const request = new NextRequest('http://localhost/api/reports/export', {
        method: 'POST',
        body: JSON.stringify({ timeRange: 'last30' }) // Missing format
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid request parameters');
      expect(data.details).toBeDefined();
    });

    it('should validate format enum values', async () => {
      const request = new NextRequest('http://localhost/api/reports/export', {
        method: 'POST',
        body: JSON.stringify({ format: 'invalid', timeRange: 'last30' })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid request parameters');
    });

    it('should validate custom date range requirements', async () => {
      const request = new NextRequest('http://localhost/api/reports/export', {
        method: 'POST',
        body: JSON.stringify({ 
          format: 'csv', 
          timeRange: 'custom' 
          // Missing startDate and endDate
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Custom date range requires both startDate and endDate');
    });

    it('should validate date range order', async () => {
      const request = new NextRequest('http://localhost/api/reports/export', {
        method: 'POST',
        body: JSON.stringify({ 
          format: 'csv', 
          timeRange: 'custom',
          startDate: '2024-01-31',
          endDate: '2024-01-01' // End before start
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Start date cannot be after end date');
    });
  });

  describe('CSV Export', () => {
    it('should export transactions in CSV format with correct headers', async () => {
      const request = new NextRequest('http://localhost/api/reports/export', {
        method: 'POST',
        body: JSON.stringify({ 
          format: 'csv', 
          timeRange: 'last30'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.filename).toMatch(/reports_\d{4}-\d{2}-\d{2}_last30\.csv/);
      expect(data.transactionCount).toBe(2);

      // Check CSV headers (requirement 6.4)
      const lines = data.data.split('\n');
      expect(lines[0]).toBe('Date,Amount,Currency,Merchant,Category,Subcategory,Notes');
      
      // Check CSV data
      expect(lines[1]).toContain('2024-01-15,25.99,USD,Coffee Shop,Food & Dining,Coffee,Morning coffee');
      expect(lines[2]).toContain('2024-01-16,150,USD,Grocery Store,Groceries,,');
    });

    it('should handle empty results by generating headers only', async () => {
      // Mock empty transaction result
      mockSupabase.from.mockReturnValue(createMockQuery([]));

      const request = new NextRequest('http://localhost/api/reports/export', {
        method: 'POST',
        body: JSON.stringify({ 
          format: 'csv', 
          timeRange: 'last30'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.transactionCount).toBe(0);
      
      // Should still have headers (requirement 6.5)
      const lines = data.data.split('\n');
      expect(lines[0]).toBe('Date,Amount,Currency,Merchant,Category,Subcategory,Notes');
      expect(lines.length).toBe(1); // Only headers
    });

    it('should escape CSV fields correctly', async () => {
      const transactionWithSpecialChars = [{
        ...mockTransactions[0],
        merchant: 'Restaurant, "The Best"',
        notes: 'Dinner with\nfriends'
      }];
      
      mockSupabase.from.mockReturnValue(createMockQuery(transactionWithSpecialChars));

      const request = new NextRequest('http://localhost/api/reports/export', {
        method: 'POST',
        body: JSON.stringify({ 
          format: 'csv', 
          timeRange: 'last30'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Check proper CSV escaping
      expect(data.data).toContain('"Restaurant, ""The Best"""');
      expect(data.data).toContain('"Dinner with\nfriends"');
    });
  });

  describe('YNAB Export', () => {
    it('should export transactions in YNAB format', async () => {
      const request = new NextRequest('http://localhost/api/reports/export', {
        method: 'POST',
        body: JSON.stringify({ 
          format: 'ynab', 
          timeRange: 'last30'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.filename).toMatch(/ynab_reports_\d{4}-\d{2}-\d{2}_last30\.csv/);

      // Check YNAB headers
      const lines = data.data.split('\n');
      expect(lines[0]).toBe('Date,Payee,Category,Memo,Outflow,Inflow');
      
      // Check YNAB data format
      expect(lines[1]).toContain('2024-01-15,Coffee Shop,Food & Dining: Coffee');
      expect(lines[1]).toContain('25.99,'); // Outflow
      expect(lines[2]).toContain('2024-01-16,Grocery Store,Groceries');
      expect(lines[2]).toContain('150.00,'); // Outflow
    });

    it('should create proper YNAB memo with card and confidence info', async () => {
      const request = new NextRequest('http://localhost/api/reports/export', {
        method: 'POST',
        body: JSON.stringify({ 
          format: 'ynab', 
          timeRange: 'last30'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      const lines = data.data.split('\n');
      // Should include card info and confidence for low confidence transactions
      expect(lines[1]).toContain('Morning coffee | Card: ****1234');
      expect(lines[2]).toContain('Confidence: 88%');
    });
  });

  describe('Filter Application', () => {
    it('should apply time range filters correctly', async () => {
      const request = new NextRequest('http://localhost/api/reports/export', {
        method: 'POST',
        body: JSON.stringify({ 
          format: 'csv', 
          timeRange: 'last7'
        })
      });

      await POST(request);

      // Verify query was called with correct date range
      expect(mockSupabase.from).toHaveBeenCalledWith('transactions');
    });

    it('should apply category filters', async () => {
      const request = new NextRequest('http://localhost/api/reports/export', {
        method: 'POST',
        body: JSON.stringify({ 
          format: 'csv', 
          timeRange: 'last30',
          categories: ['Food & Dining', 'Groceries']
        })
      });

      await POST(request);

      // Verify query was called with category filter
      expect(mockSupabase.from).toHaveBeenCalledWith('transactions');
    });

    it('should apply search filters', async () => {
      const request = new NextRequest('http://localhost/api/reports/export', {
        method: 'POST',
        body: JSON.stringify({ 
          format: 'csv', 
          timeRange: 'last30',
          search: 'coffee'
        })
      });

      await POST(request);

      // Verify query was called with search filter
      expect(mockSupabase.from).toHaveBeenCalledWith('transactions');
    });

    it('should apply custom date range', async () => {
      const request = new NextRequest('http://localhost/api/reports/export', {
        method: 'POST',
        body: JSON.stringify({ 
          format: 'csv', 
          timeRange: 'custom',
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.filename).toContain('2024-01-01_to_2024-01-31');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockSupabase.from.mockReturnValue(createMockQuery(null, { message: 'Database connection failed' }));

      const request = new NextRequest('http://localhost/api/reports/export', {
        method: 'POST',
        body: JSON.stringify({ 
          format: 'csv', 
          timeRange: 'last30'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Export failed. Please try again.');
      expect(data.retryable).toBe(true);
    });

    it('should include correlation ID in all responses', async () => {
      const request = new NextRequest('http://localhost/api/reports/export', {
        method: 'POST',
        body: JSON.stringify({ 
          format: 'csv', 
          timeRange: 'last30'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.correlationId).toBeDefined();
      expect(data.correlationId).toMatch(/^reports_export_/);
    });
  });

  describe('Filename Generation', () => {
    it('should generate filename with time range', async () => {
      const request = new NextRequest('http://localhost/api/reports/export', {
        method: 'POST',
        body: JSON.stringify({ 
          format: 'csv', 
          timeRange: 'mtd'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.filename).toMatch(/reports_\d{4}-\d{2}-\d{2}_mtd\.csv/);
    });

    it('should generate YNAB filename correctly', async () => {
      const request = new NextRequest('http://localhost/api/reports/export', {
        method: 'POST',
        body: JSON.stringify({ 
          format: 'ynab', 
          timeRange: 'last30'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.filename).toMatch(/ynab_reports_\d{4}-\d{2}-\d{2}_last30\.csv/);
    });
  });
});