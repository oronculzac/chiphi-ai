import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import InboundEmailTab from '@/components/settings/inbound-email-tab';

// Mock the toast hook
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the clipboard API and secure context
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

// Mock window.isSecureContext
Object.defineProperty(window, 'isSecureContext', {
  writable: true,
  value: true,
});

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('InboundEmailTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should render loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<InboundEmailTab />);
    
    expect(screen.getByText('Inbound Email Configuration')).toBeInTheDocument();
    expect(screen.getByText('Your Email Alias')).toBeInTheDocument();
    
    // Should show skeleton loading
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should display email alias when loaded successfully', async () => {
    const mockAlias = {
      id: 'alias-123',
      aliasEmail: 'u_test123@chiphi.oronculzac.com',
      isActive: true,
      createdAt: '2024-01-15T10:00:00Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ alias: mockAlias }),
    });

    render(<InboundEmailTab />);

    await waitFor(() => {
      expect(screen.getByTestId('email-alias')).toBeInTheDocument();
    });

    expect(screen.getByTestId('email-alias')).toHaveTextContent('u_test123@chiphi.oronculzac.com');
    expect(screen.getByText('Created on 1/15/2024')).toBeInTheDocument();
    expect(screen.getByTestId('copy-alias-button')).toBeInTheDocument();
  });

  it('should display error message when API call fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(<InboundEmailTab />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch email alias')).toBeInTheDocument();
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('should display message when no alias is found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ alias: null }),
    });

    render(<InboundEmailTab />);

    await waitFor(() => {
      expect(screen.getByText('No email alias found. Please contact support if this issue persists.')).toBeInTheDocument();
    });
  });

  it('should copy email alias to clipboard when copy button is clicked', async () => {
    const mockAlias = {
      id: 'alias-123',
      aliasEmail: 'u_test123@chiphi.oronculzac.com',
      isActive: true,
      createdAt: '2024-01-15T10:00:00Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ alias: mockAlias }),
    });

    render(<InboundEmailTab />);

    await waitFor(() => {
      expect(screen.getByTestId('copy-alias-button')).toBeInTheDocument();
    });

    const copyButton = screen.getByTestId('copy-alias-button');
    fireEvent.click(copyButton);

    // Wait for the async clipboard operation
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('u_test123@chiphi.oronculzac.com');
    });
  });

  it('should make API call to correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ alias: null }),
    });

    render(<InboundEmailTab />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/settings/alias');
    });
  });

  it('should handle network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<InboundEmailTab />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('should display proper formatting for email alias', async () => {
    const mockAlias = {
      id: 'alias-123',
      aliasEmail: 'u_longslug123@chiphi.oronculzac.com',
      isActive: true,
      createdAt: '2024-01-15T10:00:00Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ alias: mockAlias }),
    });

    render(<InboundEmailTab />);

    await waitFor(() => {
      const aliasElement = screen.getByTestId('email-alias');
      expect(aliasElement).toHaveClass('font-mono');
      expect(aliasElement).toHaveTextContent('u_longslug123@chiphi.oronculzac.com');
    });
  });

  it('should show Gmail setup section when alias is loaded', async () => {
    const mockAlias = {
      id: 'alias-123',
      aliasEmail: 'u_test123@chiphi.oronculzac.com',
      isActive: true,
      createdAt: '2024-01-15T10:00:00Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ alias: mockAlias }),
    });
    
    render(<InboundEmailTab />);
    
    await waitFor(() => {
      expect(screen.getByText('Gmail Setup Instructions')).toBeInTheDocument();
    });

    // Should show Gmail setup section with filter string
    expect(screen.getByText('Gmail Filter Criteria')).toBeInTheDocument();
    expect(screen.getByTestId('gmail-filter-string')).toBeInTheDocument();
    expect(screen.getByTestId('copy-gmail-filter-button')).toBeInTheDocument();
  });

  it('should show verification functionality', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<InboundEmailTab />);
    
    expect(screen.getByText('Email Verification')).toBeInTheDocument();
    expect(screen.getByText('Check if your email forwarding is working correctly by getting a verification code.')).toBeInTheDocument();
    expect(screen.getByText('No verification code received')).toBeInTheDocument();
    expect(screen.getByTestId('get-verification-code')).toBeInTheDocument();
  });

  it('should not show Gmail setup section when alias is not loaded', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ alias: null }),
    });
    
    render(<InboundEmailTab />);
    
    await waitFor(() => {
      expect(screen.getByText('No email alias found. Please contact support if this issue persists.')).toBeInTheDocument();
    });

    // Should not show Gmail setup section when no alias
    expect(screen.queryByText('Gmail Filter Criteria')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gmail-filter-string')).not.toBeInTheDocument();
  });
});