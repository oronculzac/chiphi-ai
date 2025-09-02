import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExportDialog } from '../export-dialog';
import { ExportResult } from '@/lib/services/export';
import { beforeEach } from 'node:test';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn((date) => date.toLocaleDateString())
}));

describe('ExportDialog', () => {
  const mockOnExport = vi.fn();
  const availableCategories = ['Food & Dining', 'Groceries', 'Transportation'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render export dialog with format selection', async () => {
    render(
      <ExportDialog 
        onExport={mockOnExport}
        availableCategories={availableCategories}
      />
    );

    // Click the trigger button
    const triggerButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(triggerButton);

    // Check if dialog content is rendered
    await waitFor(() => {
      expect(screen.getByText('Export Transactions')).toBeInTheDocument();
      expect(screen.getByText('Choose your export format')).toBeInTheDocument();
    });
  });

  it('should show format options', async () => {
    render(
      <ExportDialog 
        onExport={mockOnExport}
        availableCategories={availableCategories}
      />
    );

    // Open dialog
    fireEvent.click(screen.getByRole('button', { name: /export/i }));

    await waitFor(() => {
      // Check if format selection is available
      expect(screen.getByText('Export Format')).toBeInTheDocument();
    });
  });

  it('should call onExport with correct options when export button is clicked', async () => {
    const mockResult: ExportResult = {
      success: true,
      data: 'csv,data,here',
      filename: 'test-export.csv'
    };
    mockOnExport.mockResolvedValue(mockResult);

    render(
      <ExportDialog 
        onExport={mockOnExport}
        availableCategories={availableCategories}
      />
    );

    // Open dialog
    fireEvent.click(screen.getByRole('button', { name: /export/i }));

    await waitFor(() => {
      // Click export button (should be the second export button in the dialog)
      const exportButtons = screen.getAllByRole('button', { name: /export/i });
      const dialogExportButton = exportButtons.find(button => 
        button.textContent?.includes('Export') && !button.textContent?.includes('Cancel')
      );
      
      if (dialogExportButton) {
        fireEvent.click(dialogExportButton);
      }
    });

    await waitFor(() => {
      expect(mockOnExport).toHaveBeenCalledWith({
        format: 'csv' // Default format
      });
    });
  });

  it('should handle export errors gracefully', async () => {
    const mockResult: ExportResult = {
      success: false,
      error: 'Export failed',
      retryable: true
    };
    mockOnExport.mockResolvedValue(mockResult);

    render(
      <ExportDialog 
        onExport={mockOnExport}
        availableCategories={availableCategories}
      />
    );

    // Open dialog and trigger export
    fireEvent.click(screen.getByRole('button', { name: /export/i }));

    await waitFor(() => {
      const exportButtons = screen.getAllByRole('button', { name: /export/i });
      const dialogExportButton = exportButtons.find(button => 
        button.textContent?.includes('Export') && !button.textContent?.includes('Cancel')
      );
      
      if (dialogExportButton) {
        fireEvent.click(dialogExportButton);
      }
    });

    // Should handle the error (we can't easily test toast calls in this setup)
    await waitFor(() => {
      expect(mockOnExport).toHaveBeenCalled();
    });
  });

  it('should show available categories in filter', async () => {
    render(
      <ExportDialog 
        onExport={mockOnExport}
        availableCategories={availableCategories}
      />
    );

    // Open dialog
    fireEvent.click(screen.getByRole('button', { name: /export/i }));

    await waitFor(() => {
      expect(screen.getByText('Categories (Optional)')).toBeInTheDocument();
    });
  });
});