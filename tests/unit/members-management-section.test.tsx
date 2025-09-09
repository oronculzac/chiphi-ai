import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
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

describe('MembersManagementSection', () => {
  beforeEach(() => {
    vi.mocked(useToast).mockReturnValue({ toast: mockToast });
    mockFetch.mockReset();
    mockToast.mockReset();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const mockMembersData = {
    success: true,
    data: {
      members: [
        {
          id: 'user-1',
          email: 'owner@example.com',
          full_name: 'Owner User',
          role: 'owner',
          joined_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'user-2',
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'admin',
          joined_at: '2024-01-02T00:00:00Z',
        },
        {
          id: 'user-3',
          email: 'member@example.com',
          full_name: null,
          role: 'member',
          joined_at: '2024-01-03T00:00:00Z',
        },
      ],
      invitations: [
        {
          id: 'invite-1',
          email: 'pending@example.com',
          role: 'member',
          invited_by_name: 'Owner User',
          expires_at: '2024-12-31T23:59:59Z',
          created_at: '2024-01-04T00:00:00Z',
        },
      ],
    },
  };

  it('renders loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<MembersManagementSection />);
    
    expect(screen.getByRole('status', { name: /loading members/i })).toBeInTheDocument();
  });

  it('renders members and invitations after loading', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMembersData,
    });

    render(<MembersManagementSection />);

    await waitFor(() => {
      expect(screen.getByText((content, element) => {
        return element?.textContent === 'Current Members (3)';
      })).toBeInTheDocument();
    });

    // Check members are displayed
    expect(screen.getByText('Owner User')).toBeInTheDocument();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('member@example.com')).toBeInTheDocument();

    // Check role badges
    expect(screen.getByText('owner')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('member')).toBeInTheDocument();

    // Check pending invitations
    expect(screen.getByText((content, element) => {
      return element?.textContent === 'Pending Invitations (1)';
    })).toBeInTheDocument();
    expect(screen.getByText('pending@example.com')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
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

    // Verify API was not called
    expect(mockFetch).toHaveBeenCalledTimes(1); // Only the initial fetch
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

  it('shows member management options for non-owner members', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMembersData,
    });

    render(<MembersManagementSection />);

    await waitFor(() => {
      expect(screen.getByText(/Current Members \(3\)/)).toBeInTheDocument();
    });

    // Admin and member should have management options (owner should not)
    const memberRows = screen.getAllByRole('button').filter(button => 
      button.querySelector('svg') && button.getAttribute('aria-haspopup') === 'menu'
    );
    expect(memberRows).toHaveLength(2); // Admin and member
  });

  it('updates member role successfully', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockMembersData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockMembersData,
      });

    render(<MembersManagementSection />);

    await waitFor(() => {
      expect(screen.getByText(/Current Members \(3\)/)).toBeInTheDocument();
    });

    // Find and click the dropdown menu for a member
    const memberMenuButtons = screen.getAllByRole('button').filter(button => 
      button.querySelector('svg') && button.getAttribute('aria-haspopup') === 'menu'
    );
    
    fireEvent.click(memberMenuButtons[0]);

    await waitFor(() => {
      const makeAdminOption = screen.getByText('Make Admin');
      fireEvent.click(makeAdminOption);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/settings/members', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId: expect.any(String),
          role: 'admin',
        }),
      });
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Success',
      description: 'Member role updated successfully',
    });
  });

  it('shows confirmation dialog before removing member', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMembersData,
    });

    render(<MembersManagementSection />);

    await waitFor(() => {
      expect(screen.getByText(/Current Members \(3\)/)).toBeInTheDocument();
    });

    // Find and click the dropdown menu for a member
    const memberMenuButtons = screen.getAllByRole('button').filter(button => 
      button.querySelector('svg') && button.getAttribute('aria-haspopup') === 'menu'
    );
    
    fireEvent.click(memberMenuButtons[0]);

    await waitFor(() => {
      const removeOption = screen.getByText('Remove');
      fireEvent.click(removeOption);
    });

    // Check confirmation dialog appears
    expect(screen.getByText('Remove Member')).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to remove/i)).toBeInTheDocument();
  });

  it('disables all actions when disabled prop is true', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMembersData,
    });

    render(<MembersManagementSection disabled={true} />);

    await waitFor(() => {
      expect(screen.getByText(/Current Members \(3\)/)).toBeInTheDocument();
    });

    // Invite button should be disabled
    const inviteButton = screen.getByText('Invite Member');
    expect(inviteButton).toBeDisabled();
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
      expect(screen.getByText(/Current Members \(0\)/)).toBeInTheDocument();
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
});