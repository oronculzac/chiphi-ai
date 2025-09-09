import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
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

describe('Gmail Setup Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should generate correct Gmail filter string for different aliases', async () => {
    const testCases = [
      {
        alias: 'u_test123@chiphi.oronculzac.com',
        expectedFilter: 'to:(u_test123@chiphi.oronculzac.com) OR subject:(receipt OR invoice OR purchase OR order OR payment)'
      },
      {
        alias: 'u_long_organization_name@chiphi.oronculzac.com',
        expectedFilter: 'to:(u_long_organization_name@chiphi.oronculzac.com) OR subject:(receipt OR invoice OR purchase OR order OR payment)'
      },
      {
        alias: 'u_special-chars_123@chiphi.oronculzac.com',
        expectedFilter: 'to:(u_special-chars_123@chiphi.oronculzac.com) OR subject:(receipt OR invoice OR purchase OR order OR payment)'
      }
    ];

    for (const testCase of testCases) {
      const mockAlias = {
        id: 'alias-123',
        aliasEmail: testCase.alias,
        isActive: true,
        createdAt: '2024-01-15T10:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alias: mockAlias }),
      });

      const { unmount } = render(React.createElement(InboundEmailTab));

      await waitFor(() => {
        expect(screen.getByTestId('gmail-filter-string')).toBeInTheDocument();
      });

      const filterElement = screen.getByTestId('gmail-filter-string');
      expect(filterElement.textContent).toBe(testCase.expectedFilter);

      unmount();
      vi.clearAllMocks();
    }
  });

  it('should display Gmail setup instructions with proper structure', async () => {
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

    render(React.createElement(InboundEmailTab));

    await waitFor(() => {
      expect(screen.getByText('Gmail Setup Instructions')).toBeInTheDocument();
    });

    // Check main sections
    expect(screen.getByText('Gmail Filter Criteria')).toBeInTheDocument();
    expect(screen.getByText('Step-by-Step Setup')).toBeInTheDocument();
    expect(screen.getByText('Mobile Gmail App')).toBeInTheDocument();
    expect(screen.getByText('💡 Pro Tips')).toBeInTheDocument();

    // Check all setup steps
    expect(screen.getByText('Open Gmail Settings')).toBeInTheDocument();
    expect(screen.getByText('Create New Filter')).toBeInTheDocument();
    expect(screen.getByText('Set Filter Action')).toBeInTheDocument();
    expect(screen.getByText('Apply Filter')).toBeInTheDocument();

    // Check step 3 includes the alias
    expect(screen.getByText(`Choose "Forward it to" and enter your alias: ${mockAlias.aliasEmail}`)).toBeInTheDocument();
  });

  it('should have copy button for Gmail filter string', async () => {
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

    render(React.createElement(InboundEmailTab));

    await waitFor(() => {
      expect(screen.getByTestId('copy-gmail-filter-button')).toBeInTheDocument();
    });

    const copyButton = screen.getByTestId('copy-gmail-filter-button');
    expect(copyButton).toBeVisible();
    expect(copyButton).toHaveTextContent('Copy Filter');
  });

  it('should display mobile-specific instructions and badges', async () => {
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

    render(React.createElement(InboundEmailTab));

    await waitFor(() => {
      expect(screen.getByText('Mobile Gmail App')).toBeInTheDocument();
    });

    // Check mobile instructions
    expect(screen.getByText(/For mobile setup, use the Gmail web interface/)).toBeInTheDocument();
    expect(screen.getByText('Desktop Required')).toBeInTheDocument();
    expect(screen.getByText('Web Interface Only')).toBeInTheDocument();
  });

  it('should display pro tips section with helpful information', async () => {
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

    render(React.createElement(InboundEmailTab));

    await waitFor(() => {
      expect(screen.getByText('💡 Pro Tips')).toBeInTheDocument();
    });

    // Check pro tips content
    expect(screen.getByText(/Test the filter by sending a test email/)).toBeInTheDocument();
    expect(screen.getByText(/You can modify the filter criteria/)).toBeInTheDocument();
    expect(screen.getByText(/Consider creating a Gmail label/)).toBeInTheDocument();
  });

  it('should not display Gmail setup when no alias is available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ alias: null }),
    });

    render(React.createElement(InboundEmailTab));

    await waitFor(() => {
      expect(screen.getByText('No email alias found. Please contact support if this issue persists.')).toBeInTheDocument();
    });

    // Should not show Gmail setup components
    expect(screen.queryByText('Gmail Filter Criteria')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gmail-filter-string')).not.toBeInTheDocument();
    expect(screen.queryByTestId('copy-gmail-filter-button')).not.toBeInTheDocument();
  });

  it('should handle API errors gracefully and not show Gmail setup', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(React.createElement(InboundEmailTab));

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch email alias')).toBeInTheDocument();
    });

    // Should not show Gmail setup when there's an error
    expect(screen.queryByText('Gmail Filter Criteria')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gmail-filter-string')).not.toBeInTheDocument();
  });
});