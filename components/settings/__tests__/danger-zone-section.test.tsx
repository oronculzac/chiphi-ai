import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DangerZoneSection from '../danger-zone-section';
import { useToast } from '@/hooks/use-toast';

// Mock the hooks
vi.mock('@/hooks/use-toast');

// Mock the ConfirmationDialog component
vi.mock('../confirmation-dialog', () => ({
  ConfirmationDialog: ({ 
    open, 
    title, 
    onConfirm, 
    onCancel, 
    requiresTyping 
  }: any) => (
    open ? (
      <div data-testid="confirmation-dialog">
        <div>{title}</div>
        {requiresTyping && (
          <div data-testid="requires-typing">
            Type: {requiresTyping.expectedText}
          </div>
        )}
        <button onClick={onConfirm} data-testid="confirm-button">
          Confirm
        </button>
        <button onClick={onCancel} data-testid="cancel-button">
          Cancel
        </button>
      </div>
    ) : null
  ),
}));

// Mock fetch
global.fetch = vi.fn();

const mockToast = vi.fn();

describe('DangerZoneSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({ toast: mockToast });
    (global.fetch as any).mockClear();
  });

  it('should render danger zone section', () => {
    render(<DangerZoneSection organizationName="Test Org" />);
    
    expect(screen.getByText('Danger Zone')).toBeInTheDocument();
    expect(screen.getByText('Delete Account')).toBeInTheDocument();
    expect(screen.getByText('Delete Selected Data (0)')).toBeInTheDocument();
  });

  it('should enable data deletion button when options are selected', () => {
    render(<DangerZoneSection organizationName="Test Org" />);
    
    // Initially disabled
    expect(screen.getByText('Delete Selected Data (0)')).toBeDisabled();
    
    // Select a data type
    const transactionsCheckbox = screen.getByLabelText('Transactions & Receipts');
    fireEvent.click(transactionsCheckbox);
    
    // Should now be enabled and show count
    expect(screen.getByText('Delete Selected Data (1)')).toBeEnabled();
  });

  it('should show account deletion confirmation dialog', () => {
    render(<DangerZoneSection organizationName="Test Org" />);
    
    const deleteAccountButton = screen.getByText('Delete Account');
    fireEvent.click(deleteAccountButton);
    
    expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete Account')).toBeInTheDocument();
    expect(screen.getByTestId('requires-typing')).toBeInTheDocument();
    expect(screen.getByText('Type: Test Org')).toBeInTheDocument();
  });

  it('should show data deletion confirmation dialog', () => {
    render(<DangerZoneSection organizationName="Test Org" />);
    
    // Select a data type first
    const transactionsCheckbox = screen.getByLabelText('Transactions & Receipts');
    fireEvent.click(transactionsCheckbox);
    
    // Click delete button
    const deleteDataButton = screen.getByText('Delete Selected Data (1)');
    fireEvent.click(deleteDataButton);
    
    expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete Selected Data')).toBeInTheDocument();
  });

  it('should handle successful account deletion', async () => {
    // Mock successful API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, deletedCount: 100 }),
    });

    // Mock window.location.href
    const mockLocation = { href: '' };
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
    });

    render(<DangerZoneSection organizationName="Test Org" />);
    
    // Open dialog and confirm
    const deleteAccountButton = screen.getByText('Delete Account');
    fireEvent.click(deleteAccountButton);
    
    const confirmButton = screen.getByTestId('confirm-button');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/settings/account/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    // Should redirect to goodbye page
    expect(mockLocation.href).toBe('/goodbye');
  });

  it('should handle successful data deletion', async () => {
    // Mock successful API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, deletedCount: 50 }),
    });

    render(<DangerZoneSection organizationName="Test Org" />);
    
    // Select data types
    const transactionsCheckbox = screen.getByLabelText('Transactions & Receipts');
    fireEvent.click(transactionsCheckbox);
    
    // Open dialog and confirm
    const deleteDataButton = screen.getByText('Delete Selected Data (1)');
    fireEvent.click(deleteDataButton);
    
    const confirmButton = screen.getByTestId('confirm-button');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/settings/data/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dataTypes: ['transactions'] }),
      });
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Data Deleted Successfully',
        description: 'Deleted 50 records across 1 data types.',
      });
    });
  });

  it('should handle API errors', async () => {
    // Mock API error response
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Insufficient permissions' }),
    });

    render(<DangerZoneSection organizationName="Test Org" />);
    
    // Try to delete account
    const deleteAccountButton = screen.getByText('Delete Account');
    fireEvent.click(deleteAccountButton);
    
    const confirmButton = screen.getByTestId('confirm-button');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Account Deletion Failed',
        description: 'Insufficient permissions',
        variant: 'destructive',
      });
    });
  });

  it('should prevent data deletion when no options selected', () => {
    render(<DangerZoneSection organizationName="Test Org" />);
    
    const deleteDataButton = screen.getByText('Delete Selected Data (0)');
    fireEvent.click(deleteDataButton);
    
    expect(mockToast).toHaveBeenCalledWith({
      title: 'No Data Selected',
      description: 'Please select at least one data type to delete.',
      variant: 'destructive',
    });
  });
});