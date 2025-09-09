import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InboundEmailTab from '@/components/settings/inbound-email-tab';

// Mock the GmailSetupSection component
vi.mock('@/components/settings/gmail-setup-section', () => ({
  GmailSetupSection: ({ emailAlias }: { emailAlias: string }) => (
    <div data-testid="gmail-setup-section">Gmail Setup for {emailAlias}</div>
  ),
}));

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

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('InboundEmailTab - Verification Code Polling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const mockAliasResponse = {
    alias: {
      id: 'test-id',
      aliasEmail: 'u_test@chiphi.oronculzac.com',
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z'
    }
  };

  it('should display initial verification state', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAliasResponse
    });

    render(<InboundEmailTab />);

    await waitFor(() => {
      expect(screen.getByText('No verification code received')).toBeInTheDocument();
      expect(screen.getByText('Click "Get Verification Code" to start polling')).toBeInTheDocument();
      expect(screen.getByTestId('get-verification-code')).toBeInTheDocument();
    });
  });

  it('should start polling when Get Verification Code is clicked', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAliasResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: null, timestamp: null })
      });

    render(<InboundEmailTab />);

    await waitFor(() => {
      expect(screen.getByTestId('get-verification-code')).toBeInTheDocument();
    });

    const getCodeButton = screen.getByTestId('get-verification-code');
    fireEvent.click(getCodeButton);

    await waitFor(() => {
      expect(screen.getByText('Polling for verification code...')).toBeInTheDocument();
      expect(screen.getByText('Checking every 6 seconds (up to 2 minutes)')).toBeInTheDocument();
      expect(getCodeButton).toBeDisabled();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/alias/verification-code');
  });

  it('should display verification code when received', async () => {
    const verificationCode = 'VERIFY123';
    const timestamp = '2024-01-01T12:00:00Z';

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAliasResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: verificationCode, timestamp })
      });

    render(<InboundEmailTab />);

    await waitFor(() => {
      expect(screen.getByTestId('get-verification-code')).toBeInTheDocument();
    });

    const getCodeButton = screen.getByTestId('get-verification-code');
    fireEvent.click(getCodeButton);

    await waitFor(() => {
      expect(screen.getByTestId('verification-status')).toHaveTextContent('Verified');
      expect(screen.getByTestId('verification-code')).toHaveTextContent(verificationCode);
      expect(screen.getByText(`Code received at ${new Date(timestamp).toLocaleString()}`)).toBeInTheDocument();
    });
  });

  it('should show instructions for testing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAliasResponse
    });

    render(<InboundEmailTab />);

    await waitFor(() => {
      expect(screen.getByText('How to test:')).toBeInTheDocument();
      expect(screen.getByText('Click "Get Verification Code" to start polling')).toBeInTheDocument();
      expect(screen.getByText('Send an email to your alias with "VERIFY" in the subject')).toBeInTheDocument();
      expect(screen.getByText('The system will automatically detect and display the verification code')).toBeInTheDocument();
      expect(screen.getByText('A green "Verified" status indicates your email forwarding is working')).toBeInTheDocument();
    });
  });

  it('should handle API errors during polling', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAliasResponse
      })
      .mockRejectedValueOnce(new Error('Network error'));

    render(<InboundEmailTab />);

    await waitFor(() => {
      expect(screen.getByTestId('get-verification-code')).toBeInTheDocument();
    });

    const getCodeButton = screen.getByTestId('get-verification-code');
    fireEvent.click(getCodeButton);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(screen.queryByText('Polling for verification code...')).not.toBeInTheDocument();
    });
  });

  it('should reset verification state when reset button is clicked', async () => {
    const verificationCode = 'VERIFY789';
    const timestamp = '2024-01-01T12:00:00Z';

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAliasResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: verificationCode, timestamp })
      });

    render(<InboundEmailTab />);

    await waitFor(() => {
      expect(screen.getByTestId('get-verification-code')).toBeInTheDocument();
    });

    // Get verification code
    const getCodeButton = screen.getByTestId('get-verification-code');
    fireEvent.click(getCodeButton);

    await waitFor(() => {
      expect(screen.getByTestId('verification-status')).toHaveTextContent('Verified');
      expect(screen.getByTestId('verification-code')).toHaveTextContent(verificationCode);
    });

    // Reset verification
    const resetButton = screen.getByText('Reset');
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(screen.getByText('No verification code received')).toBeInTheDocument();
      expect(screen.queryByTestId('verification-code')).not.toBeInTheDocument();
      expect(screen.queryByText('Reset')).not.toBeInTheDocument();
    });
  });
});