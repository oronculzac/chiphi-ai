import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import NotificationsTab from '@/components/settings/notifications-tab';

// Mock the toast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('NotificationsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const mockPreferences = {
    receiptProcessed: true,
    dailySummary: false,
    weeklySummary: false,
    summaryEmails: ['test@example.com'],
  };

  it('renders loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<NotificationsTab />);
    
    expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
    expect(screen.getByText('Configure how and when you receive notifications about receipt processing and system activity.')).toBeInTheDocument();
    
    // Should show loading skeleton
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('loads and displays notification preferences', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPreferences,
    });

    render(<NotificationsTab />);

    await waitFor(() => {
      expect(screen.getByText('Notification Types')).toBeInTheDocument();
    });

    // Check that toggles are rendered with correct states
    const receiptToggle = screen.getByRole('switch', { name: /new receipt processed/i });
    const dailyToggle = screen.getByRole('switch', { name: /daily summary/i });
    const weeklyToggle = screen.getByRole('switch', { name: /weekly summary/i });

    expect(receiptToggle).toBeChecked();
    expect(dailyToggle).not.toBeChecked();
    expect(weeklyToggle).not.toBeChecked();

    // Check that email is displayed
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('handles API error when loading preferences', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(<NotificationsTab />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to load notification preferences. Please try again.',
        variant: 'destructive',
      });
    });
  });

  it('toggles notification preferences', async () => {
    // Initial load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPreferences,
    });

    // Update request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockPreferences, dailySummary: true }),
    });

    render(<NotificationsTab />);

    await waitFor(() => {
      expect(screen.getByText('Notification Types')).toBeInTheDocument();
    });

    const dailyToggle = screen.getByRole('switch', { name: /daily summary/i });
    fireEvent.click(dailyToggle);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/settings/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...mockPreferences,
          dailySummary: true,
        }),
      });
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Success',
      description: 'Notification preferences updated successfully.',
    });
  });

  it('handles toggle update error', async () => {
    // Initial load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPreferences,
    });

    // Update request fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(<NotificationsTab />);

    await waitFor(() => {
      expect(screen.getByText('Notification Types')).toBeInTheDocument();
    });

    const dailyToggle = screen.getByRole('switch', { name: /daily summary/i });
    fireEvent.click(dailyToggle);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to update notification preferences. Please try again.',
        variant: 'destructive',
      });
    });
  });

  it('adds new email address', async () => {
    // Initial load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPreferences,
    });

    // Update request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockPreferences,
        summaryEmails: [...mockPreferences.summaryEmails, 'new@example.com'],
      }),
    });

    render(<NotificationsTab />);

    await waitFor(() => {
      expect(screen.getByText('Additional Email Recipients')).toBeInTheDocument();
    });

    // Click add email button
    const addButton = screen.getByRole('button', { name: /add email address/i });
    fireEvent.click(addButton);

    // Enter email address
    const emailInput = screen.getByPlaceholderText('Enter email address');
    fireEvent.change(emailInput, { target: { value: 'new@example.com' } });

    // Click add button
    const confirmAddButton = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(confirmAddButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/settings/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...mockPreferences,
          summaryEmails: [...mockPreferences.summaryEmails, 'new@example.com'],
        }),
      });
    });
  });

  it('validates email format when adding', async () => {
    // Initial load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPreferences,
    });

    render(<NotificationsTab />);

    await waitFor(() => {
      expect(screen.getByText('Additional Email Recipients')).toBeInTheDocument();
    });

    // Click add email button
    const addButton = screen.getByRole('button', { name: /add email address/i });
    fireEvent.click(addButton);

    // Enter invalid email
    const emailInput = screen.getByPlaceholderText('Enter email address');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

    // Click add button
    const confirmAddButton = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(confirmAddButton);

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Invalid Email',
      description: 'Please enter a valid email address.',
      variant: 'destructive',
    });

    // Should not make API call
    expect(mockFetch).toHaveBeenCalledTimes(1); // Only the initial load
  });

  it('prevents adding duplicate email addresses', async () => {
    // Initial load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPreferences,
    });

    render(<NotificationsTab />);

    await waitFor(() => {
      expect(screen.getByText('Additional Email Recipients')).toBeInTheDocument();
    });

    // Click add email button
    const addButton = screen.getByRole('button', { name: /add email address/i });
    fireEvent.click(addButton);

    // Enter existing email
    const emailInput = screen.getByPlaceholderText('Enter email address');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    // Click add button
    const confirmAddButton = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(confirmAddButton);

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Email Already Added',
      description: 'This email address is already in your notification list.',
      variant: 'destructive',
    });

    // Should not make API call
    expect(mockFetch).toHaveBeenCalledTimes(1); // Only the initial load
  });

  it('removes email address', async () => {
    // Initial load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPreferences,
    });

    // Update request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockPreferences,
        summaryEmails: [],
      }),
    });

    render(<NotificationsTab />);

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    // Click remove button (trash icon)
    const removeButton = screen.getByRole('button', { name: '' }); // Trash icon button
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/settings/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...mockPreferences,
          summaryEmails: [],
        }),
      });
    });
  });

  it('handles keyboard navigation for email input', async () => {
    // Initial load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPreferences,
    });

    // Update request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockPreferences,
        summaryEmails: [...mockPreferences.summaryEmails, 'keyboard@example.com'],
      }),
    });

    render(<NotificationsTab />);

    await waitFor(() => {
      expect(screen.getByText('Additional Email Recipients')).toBeInTheDocument();
    });

    // Click add email button
    const addButton = screen.getByRole('button', { name: /add email address/i });
    fireEvent.click(addButton);

    // Enter email and press Enter
    const emailInput = screen.getByPlaceholderText('Enter email address');
    fireEvent.change(emailInput, { target: { value: 'keyboard@example.com' } });
    fireEvent.keyDown(emailInput, { key: 'Enter' });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/settings/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...mockPreferences,
          summaryEmails: [...mockPreferences.summaryEmails, 'keyboard@example.com'],
        }),
      });
    });
  });

  it('cancels email input with Escape key', async () => {
    // Initial load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPreferences,
    });

    render(<NotificationsTab />);

    await waitFor(() => {
      expect(screen.getByText('Additional Email Recipients')).toBeInTheDocument();
    });

    // Click add email button
    const addButton = screen.getByRole('button', { name: /add email address/i });
    fireEvent.click(addButton);

    // Enter email and press Escape
    const emailInput = screen.getByPlaceholderText('Enter email address');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.keyDown(emailInput, { key: 'Escape' });

    // Should hide input and show add button again
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Enter email address')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add email address/i })).toBeInTheDocument();
    });
  });

  it('shows empty state message when no additional emails', async () => {
    const preferencesWithoutEmails = {
      ...mockPreferences,
      summaryEmails: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => preferencesWithoutEmails,
    });

    render(<NotificationsTab />);

    await waitFor(() => {
      expect(screen.getByText('No additional email recipients configured. Summary notifications will only be sent to your account email.')).toBeInTheDocument();
    });
  });
});