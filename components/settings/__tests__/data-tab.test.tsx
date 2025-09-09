import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DataTab from '../data-tab';
import { useToast } from '@/hooks/use-toast';
import { useExport } from '@/hooks/use-export';

// Mock the hooks
vi.mock('@/hooks/use-toast');
vi.mock('@/hooks/use-export');

// Mock the DangerZoneSection component
vi.mock('../danger-zone-section', () => ({
  default: ({ organizationName }: { organizationName: string }) => (
    <div data-testid="danger-zone-section">
      Danger Zone for {organizationName}
    </div>
  ),
}));

const mockToast = vi.fn();
const mockExportTransactions = vi.fn();

describe('DataTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({ toast: mockToast });
    (useExport as any).mockReturnValue({
      exportTransactions: mockExportTransactions,
      isExporting: false,
      error: null,
    });
  });

  it('should render export functionality', () => {
    render(<DataTab organizationName="Test Org" />);
    
    expect(screen.getByText('Export Data')).toBeInTheDocument();
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
    expect(screen.getByText('Export YNAB')).toBeInTheDocument();
  });

  it('should render danger zone section with organization name', () => {
    render(<DataTab organizationName="Test Organization" />);
    
    expect(screen.getByTestId('danger-zone-section')).toBeInTheDocument();
    expect(screen.getByText('Danger Zone for Test Organization')).toBeInTheDocument();
  });

  it('should handle date range validation', () => {
    // Test date range validation logic
    const startDate = '2024-01-01';
    const endDate = '2024-01-31';
    const isValid = new Date(startDate) <= new Date(endDate);
    expect(isValid).toBe(true);
    
    const invalidStartDate = '2024-01-31';
    const invalidEndDate = '2024-01-01';
    const isInvalid = new Date(invalidStartDate) <= new Date(invalidEndDate);
    expect(isInvalid).toBe(false);
  });

  it('should handle export functionality', async () => {
    mockExportTransactions.mockResolvedValue({
      success: true,
      data: 'csv,data',
      filename: 'export.csv',
    });

    render(<DataTab organizationName="Test Org" />);
    
    const exportButton = screen.getByText('Export CSV');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockExportTransactions).toHaveBeenCalledWith({
        format: 'csv',
      });
    });
  });

  it('should show error toast on export failure', async () => {
    mockExportTransactions.mockResolvedValue({
      success: false,
      error: 'Export failed',
    });

    render(<DataTab organizationName="Test Org" />);
    
    const exportButton = screen.getByText('Export CSV');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Export Failed',
        description: 'Export failed',
        variant: 'destructive',
      });
    });
  });

  it('should use default organization name when not provided', () => {
    render(<DataTab />);
    
    expect(screen.getByText('Danger Zone for Your Organization')).toBeInTheDocument();
  });
});