import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OrganizationTab from '@/components/settings/organization-tab';

// Mock the toast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockOrganization = {
  id: 'org-123',
  name: 'Test Organization',
  logo_url: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('OrganizationTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should render loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<OrganizationTab />);
    
    expect(screen.getByText('Organization Settings')).toBeInTheDocument();
    expect(screen.getByText('Manage your organization information, logo, and team members.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
  });

  it('should fetch and display organization data on mount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockOrganization,
      }),
    });

    render(<OrganizationTab />);

    await waitFor(() => {
      expect(screen.getByText('Test Organization')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/settings/organization');
    expect(screen.getByText('Last updated: 1/1/2024')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('should handle fetch error gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: 'Failed to fetch organization',
      }),
    });

    render(<OrganizationTab />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to load organization information',
        variant: 'destructive',
      });
    });
  });

  it('should enter edit mode when Edit button is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockOrganization,
      }),
    });

    render(<OrganizationTab />);

    await waitFor(() => {
      expect(screen.getByText('Test Organization')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: 'Edit' });
    fireEvent.click(editButton);

    expect(screen.getByDisplayValue('Test Organization')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument();
  });

  it('should validate organization name input', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockOrganization,
      }),
    });

    render(<OrganizationTab />);

    await waitFor(() => {
      expect(screen.getByText('Test Organization')).toBeInTheDocument();
    });

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: 'Edit' });
    fireEvent.click(editButton);

    const input = screen.getByDisplayValue('Test Organization');
    
    // Test empty name
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByText('Organization name is required')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save/ })).toBeDisabled();

    // Test name too long
    const longName = 'a'.repeat(101);
    fireEvent.change(input, { target: { value: longName } });
    expect(screen.getByText('Organization name must be less than 100 characters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save/ })).toBeDisabled();

    // Test valid name
    fireEvent.change(input, { target: { value: 'Valid Organization Name' } });
    await waitFor(() => {
      expect(screen.queryByText('Organization name is required')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Save/ })).not.toBeDisabled();
    });
  });

  it('should save organization name successfully', async () => {
    // Mock initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockOrganization,
      }),
    });

    // Mock update request
    const updatedOrg = { ...mockOrganization, name: 'Updated Organization' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: updatedOrg,
      }),
    });

    render(<OrganizationTab />);

    await waitFor(() => {
      expect(screen.getByText('Test Organization')).toBeInTheDocument();
    });

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: 'Edit' });
    fireEvent.click(editButton);

    // Change name
    const input = screen.getByDisplayValue('Test Organization');
    fireEvent.change(input, { target: { value: 'Updated Organization' } });

    // Save
    const saveButton = screen.getByRole('button', { name: /Save/ });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/settings/organization', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Updated Organization' }),
      });
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Organization name updated successfully',
      });
    });

    expect(screen.getByText('Updated Organization')).toBeInTheDocument();
  });

  it('should handle save error gracefully', async () => {
    // Mock initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockOrganization,
      }),
    });

    // Mock failed update request
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: 'Insufficient permissions',
      }),
    });

    render(<OrganizationTab />);

    await waitFor(() => {
      expect(screen.getByText('Test Organization')).toBeInTheDocument();
    });

    // Enter edit mode and try to save
    const editButton = screen.getByRole('button', { name: 'Edit' });
    fireEvent.click(editButton);

    const saveButton = screen.getByRole('button', { name: /Save/ });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Insufficient permissions',
        variant: 'destructive',
      });
    });
  });

  it('should cancel edit mode when Cancel button is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockOrganization,
      }),
    });

    render(<OrganizationTab />);

    await waitFor(() => {
      expect(screen.getByText('Test Organization')).toBeInTheDocument();
    });

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: 'Edit' });
    fireEvent.click(editButton);

    // Change name
    const input = screen.getByDisplayValue('Test Organization');
    fireEvent.change(input, { target: { value: 'Changed Name' } });

    // Cancel
    const cancelButton = screen.getByRole('button', { name: /Cancel/ });
    fireEvent.click(cancelButton);

    // Should exit edit mode and revert changes
    expect(screen.getByText('Test Organization')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Changed Name')).not.toBeInTheDocument();
  });

  it('should show loading state during save operation', async () => {
    // Mock initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockOrganization,
      }),
    });

    // Mock slow update request
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<OrganizationTab />);

    await waitFor(() => {
      expect(screen.getByText('Test Organization')).toBeInTheDocument();
    });

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: 'Edit' });
    fireEvent.click(editButton);

    // Try to save
    const saveButton = screen.getByRole('button', { name: /Save/ });
    fireEvent.click(saveButton);

    // Should show loading state
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/ })).toBeDisabled();
  });

  it('should display placeholder text for upcoming features', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockOrganization,
      }),
    });

    render(<OrganizationTab />);

    await waitFor(() => {
      expect(screen.getByText('Test Organization')).toBeInTheDocument();
    });

    expect(screen.getByText('Logo upload functionality will be implemented in upcoming tasks.')).toBeInTheDocument();
    expect(screen.getByText('Member management functionality will be implemented in upcoming tasks.')).toBeInTheDocument();
  });
});