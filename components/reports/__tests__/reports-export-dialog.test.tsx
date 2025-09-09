import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportsExportDialog } from '../reports-export-dialog';
import { ReportFilters } from '../reports-filters';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

// Mock URL.createObjectURL and related APIs
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// Mock document.createElement and related DOM APIs
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();

Object.defineProperty(document, 'createElement', {
  value: vi.fn(() => ({
    href: '',
    download: '',
    click: mockClick
  }))
});

Object.defineProperty(document.body, 'appendChild', {
  value: mockAppendChild
});

Object.defineProperty(document.body, 'removeChild', {
  value: mockRemoveChild
});

describe('ReportsExportDialog', () => {
  const mockFilters: ReportFilters = {
    timeRange: 'last30',
    startDate: undefined,
    endDate: undefined,
    categories: ['Food & Dining'],
    search: 'coffee'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateObjectURL.mockReturnValue('blob:mock-url');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render export dialog with trigger button', () => {
    render(<ReportsExportDialog filters={mockFilters} />);
    
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });

  it('should render custom trigger when provided', () => {
    render(
      <ReportsExportDialog filters={mockFilters}>
        <button>Custom Export Button</button>
      </ReportsExportDialog>
    );
    
    expect(screen.getByRole('button', { name: /custom export button/i })).toBeInTheDocument();
  });

  it('should open dialog when trigger is clicked', async () => {
    render(<ReportsExportDialog filters={mockFilters} />);
    
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    
    await waitFor(() => {
      expect(screen.getByText('Export Report Data')).toBeInTheDocument();
    });
  });

  it('should display current filters summary', async () => {
    render(<ReportsExportDialog filters={mockFilters} />);
    
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/current filters/i)).toBeInTheDocument();
      expect(screen.getByText(/time: last 30 days/i)).toBeInTheDocument();
      expect(screen.getByText(/categories: 1 selected/i)).toBeInTheDocument();
      expect(screen.getByText(/search: "coffee"/i)).toBeInTheDocument();
    });
  });

  it('should display custom date range in filter summary', async () => {
    const customFilters: ReportFilters = {
      timeRange: 'custom',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      categories: [],
      search: ''
    };

    render(<ReportsExportDialog filters={customFilters} />);
    
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/2024-01-01 to 2024-01-31/i)).toBeInTheDocument();
    });
  });

  it('should show format selection options', async () => {
    render(<ReportsExportDialog filters={mockFilters} />);
    
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    
    await waitFor(() => {
      expect(screen.getByText('Export Format')).toBeInTheDocument();
    });
    
    // Open format selector
    fireEvent.click(screen.getByRole('combobox'));
    
    await waitFor(() => {
      expect(screen.getByText('CSV')).toBeInTheDocument();
      expect(screen.getByText('YNAB')).toBeInTheDocument();
      expect(screen.getByText(/standard csv format with headers/i)).toBeInTheDocument();
      expect(screen.getByText(/you need a budget compatible/i)).toBeInTheDocument();
    });
  });

  it('should show format-specific information for CSV', async () => {
    render(<ReportsExportDialog filters={mockFilters} />);
    
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    
    await waitFor(() => {
      // CSV should be selected by default
      expect(screen.getByText(/csv format.*date, amount, currency, merchant, category, subcategory, notes/i)).toBeInTheDocument();
    });
  });

  it('should show format-specific information for YNAB', async () => {
    render(<ReportsExportDialog filters={mockFilters} />);
    
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    
    await waitFor(() => {
      // Change to YNAB format
      fireEvent.click(screen.getByRole('combobox'));
    });
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('YNAB'));
    });
    
    await waitFor(() => {
      expect(screen.getByText(/ynab format.*compatible with you need a budget/i)).toBeInTheDocument();
    });
  });

  it('should handle successful CSV export', async () => {
    const mockResponse = {
      success: true,
      data: 'Date,Amount,Currency,Merchant,Category,Subcategory,Notes\n2024-01-15,25.99,USD,Coffee Shop,Food & Dining,Coffee,Morning coffee',
      filename: 'reports_2024-01-15_last30.csv',
      transactionCount: 1
    };

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse)
    });

    render(<ReportsExportDialog filters={mockFilters} />);
    
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /export csv/i }));
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format: 'csv',
          timeRange: 'last30',
          categories: ['Food & Dining'],
          search: 'coffee'
        })
      });
    });

    // Verify download was triggered
    expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(mockClick).toHaveBeenCalled();
    expect(mockAppendChild).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('should handle successful YNAB export', async () => {
    const mockResponse = {
      success: true,
      data: 'Date,Payee,Category,Memo,Outflow,Inflow\n2024-01-15,Coffee Shop,Food & Dining: Coffee,Morning coffee | Card: ****1234,25.99,',
      filename: 'ynab_reports_2024-01-15_last30.csv',
      transactionCount: 1
    };

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse)
    });

    render(<ReportsExportDialog filters={mockFilters} />);
    
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    
    await waitFor(() => {
      // Change to YNAB format
      fireEvent.click(screen.getByRole('combobox'));
    });
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('YNAB'));
    });
    
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /export ynab/i }));
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format: 'ynab',
          timeRange: 'last30',
          categories: ['Food & Dining'],
          search: 'coffee'
        })
      });
    });
  });

  it('should handle export errors gracefully', async () => {
    const mockResponse = {
      success: false,
      error: 'Export failed due to server error',
      retryable: true
    };

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse)
    });

    render(<ReportsExportDialog filters={mockFilters} />);
    
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /export csv/i }));
    });

    // Should not trigger download for failed export
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
    expect(mockClick).not.toHaveBeenCalled();
  });

  it('should handle rate limit errors', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 429,
      json: () => Promise.resolve({
        success: false,
        error: 'Rate limit exceeded'
      })
    });

    render(<ReportsExportDialog filters={mockFilters} />);
    
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /export csv/i }));
    });

    // Should not trigger download for rate limited request
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<ReportsExportDialog filters={mockFilters} />);
    
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /export csv/i }));
    });

    // Should not trigger download for network error
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
  });

  it('should show loading state during export', async () => {
    // Mock a delayed response
    mockFetch.mockImplementationOnce(() => 
      new Promise(resolve => setTimeout(() => resolve({
        json: () => Promise.resolve({ success: true, data: 'csv data', filename: 'test.csv' })
      }), 100))
    );

    render(<ReportsExportDialog filters={mockFilters} />);
    
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /export csv/i }));
    });

    // Should show loading state
    expect(screen.getByText(/exporting.../i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exporting.../i })).toBeDisabled();
  });

  it('should disable buttons during export', async () => {
    // Mock a delayed response
    mockFetch.mockImplementationOnce(() => 
      new Promise(resolve => setTimeout(() => resolve({
        json: () => Promise.resolve({ success: true, data: 'csv data', filename: 'test.csv' })
      }), 100))
    );

    render(<ReportsExportDialog filters={mockFilters} />);
    
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /export csv/i }));
    });

    // Both buttons should be disabled during export
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /exporting.../i })).toBeDisabled();
  });

  it('should close dialog after successful export', async () => {
    const mockResponse = {
      success: true,
      data: 'csv data',
      filename: 'test.csv',
      transactionCount: 1
    };

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse)
    });

    render(<ReportsExportDialog filters={mockFilters} />);
    
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    
    await waitFor(() => {
      expect(screen.getByText('Export Report Data')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));

    await waitFor(() => {
      expect(screen.queryByText('Export Report Data')).not.toBeInTheDocument();
    });
  });

  it('should reset form when dialog is closed', async () => {
    render(<ReportsExportDialog filters={mockFilters} />);
    
    // Open dialog
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    
    await waitFor(() => {
      // Change format to YNAB
      fireEvent.click(screen.getByRole('combobox'));
    });
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('YNAB'));
    });
    
    // Close dialog
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    
    // Reopen dialog
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    
    await waitFor(() => {
      // Format should be reset to CSV
      expect(screen.getByText(/csv format/i)).toBeInTheDocument();
    });
  });

  it('should show empty results note', async () => {
    render(<ReportsExportDialog filters={mockFilters} />);
    
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/if no transactions match your filters, a file with headers only will be generated/i)).toBeInTheDocument();
    });
  });
});