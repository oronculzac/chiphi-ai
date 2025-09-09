import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MembersManagementSection from '@/components/settings/members-management-section';
import { useToast } from '@/hooks/use-toast';

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockToast = vi.fn();

describe('MembersManagementSection - Core Functionality', () => {
  beforeEach(() => {
    vi.mocked(useToast).mockReturnValue({ toast: mockToast });
    mockFetch.mockReset();
    mockToast.mockReset();
  });

  const mockMembersData = {
    success: true,
    data: {
      members: [
        {
          id: 'user-1',
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'admin',
          joined_at: '2024-01-01T00:00:00Z',
        },
      ],
      invitations: [],
    },
  };

  it('renders loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<MembersManagementSection />);
    
    expect(screen.getByRole('status', { name: /loading members/i })).toBeInTheDocument();
  });

  it('renders members after loading', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMembersData,
    });

    render(<MembersManagementSection />);

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });

    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('shows invite form when invite button is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMembersData,
    });

    render(<MembersManagementSection />);

    await waitFor(() => {
      expect(screen.getByText('Invite Member')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Invite Member'));

    expect(screen.getByText('Invite New Member')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Role')).toBeInTheDocument();
  });

  it('validates email input in invite form', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMembersData,
    });

    render(<MembersManagementSection />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Invite Member'));
    });

    const emailInput = screen.getByLabelText('Email Address');
    const sendButton = screen.getByText('Send Invitation');

    // Try to send with invalid email
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });

    // Verify API was not called for invitation (only initial fetch)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('sends invitation when form is valid', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockMembersData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { invitationId: 'invite-123' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockMembersData,
      });

    render(<MembersManagementSection />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Invite Member'));
    });

    const emailInput = screen.getByLabelText('Email Address');
    const sendButton = screen.getByText('Send Invitation');

    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/settings/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'newuser@example.com',
          role: 'member',
        }),
      });
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Success',
      description: 'Invitation sent to newuser@example.com',
    });
  });

  it('handles API errors when sending invitation', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockMembersData,
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: 'User is already a member' }),
      });

    render(<MembersManagementSection />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Invite Member'));
    });

    const emailInput = screen.getByLabelText('Email Address');
    const sendButton = screen.getByText('Send Invitation');

    fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'User is already a member',
        variant: 'destructive',
      });
    });
  });

  it('handles empty members list', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          members: [],
          invitations: [],
        },
      }),
    });

    render(<MembersManagementSection />);

    await waitFor(() => {
      expect(screen.getByText('No team members yet')).toBeInTheDocument();
    });
  });

  it('handles API error when fetching members', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<MembersManagementSection />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to load team members',
        variant: 'destructive',
      });
    });
  });

  it('disables invite button when disabled prop is true', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMembersData,
    });

    render(<MembersManagementSection disabled={true} />);

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });

    // Invite button should be disabled
    const inviteButton = screen.getByText('Invite Member');
    expect(inviteButton).toBeDisabled();
  });
});