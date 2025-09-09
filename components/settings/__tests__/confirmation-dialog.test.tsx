import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmationDialog } from '../confirmation-dialog';

describe('ConfirmationDialog', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render dialog when open', () => {
    render(
      <ConfirmationDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        title="Test Dialog"
        description="Test description"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Test Dialog')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should not render dialog when closed', () => {
    render(
      <ConfirmationDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        title="Test Dialog"
        description="Test description"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.queryByText('Test Dialog')).not.toBeInTheDocument();
  });

  it('should handle confirm action', () => {
    render(
      <ConfirmationDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        title="Test Dialog"
        description="Test description"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('should handle cancel action', () => {
    render(
      <ConfirmationDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        title="Test Dialog"
        description="Test description"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('should require typing confirmation when specified', () => {
    render(
      <ConfirmationDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        title="Test Dialog"
        description="Test description"
        requiresTyping={{
          expectedText: 'DELETE',
          placeholder: 'Type DELETE to confirm',
        }}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByPlaceholderText('Type DELETE to confirm')).toBeInTheDocument();
    expect(screen.getByText('DELETE')).toBeInTheDocument();

    // Confirm button should be disabled initially
    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toBeDisabled();
  });

  it('should enable confirm button when correct text is typed', () => {
    render(
      <ConfirmationDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        title="Test Dialog"
        description="Test description"
        requiresTyping={{
          expectedText: 'DELETE',
          placeholder: 'Type DELETE to confirm',
        }}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByPlaceholderText('Type DELETE to confirm');
    const confirmButton = screen.getByText('Confirm');

    // Initially disabled
    expect(confirmButton).toBeDisabled();

    // Type incorrect text
    fireEvent.change(input, { target: { value: 'WRONG' } });
    expect(confirmButton).toBeDisabled();

    // Type correct text
    fireEvent.change(input, { target: { value: 'DELETE' } });
    expect(confirmButton).toBeEnabled();
  });

  it('should show destructive variant styling', () => {
    render(
      <ConfirmationDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        title="Delete Account"
        description="This will delete everything"
        variant="destructive"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    // Should show warning icon for destructive variant
    expect(screen.getByText('Delete Account')).toBeInTheDocument();
  });

  it('should handle loading state', () => {
    render(
      <ConfirmationDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        title="Test Dialog"
        description="Test description"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isLoading={true}
      />
    );

    const confirmButton = screen.getByText('Confirm');
    const cancelButton = screen.getByText('Cancel');

    expect(confirmButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });

  it('should handle keyboard navigation', () => {
    render(
      <ConfirmationDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        title="Test Dialog"
        description="Test description"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const dialog = screen.getByRole('dialog');

    // Test Enter key
    fireEvent.keyDown(dialog, { key: 'Enter' });
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);

    // Reset mock
    mockOnConfirm.mockClear();

    // Test Escape key
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});