import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import OrganizationTab from '../organization-tab';
import InboundEmailTab from '../inbound-email-tab';
import NotificationsTab from '../notifications-tab';

// Mock the toast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn()
  })
}));

// Mock the child components that aren't directly related to error handling
jest.mock('../logo-upload', () => {
  return function MockLogoUpload({ onLogoUpdate, disabled }: any) {
    return (
      <div data-testid="logo-upload">
        <button 
          onClick={() => onLogoUpdate('new-logo-url')}
          disabled={disabled}
        >
          Upload Logo
        </button>
      </div>
    );
  };
});

jest.mock('../members-management-section', () => {
  return function MockMembersManagementSection({ disabled }: any) {
    return (
      <div data-testid="members-management" data-disabled={disabled}>
        Members Management
      </div>
    );
  };
});

jest.mock('../gmail-setup-section', () => {
  return function MockGmailSetupSection({ emailAlias }: any) {
    return <div data-testid="gmail-setup">Gmail Setup for {emailAlias}</div>;
  };
});

// Setup MSW server for API mocking
const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Error Recovery Integration Tests', () => {
  describe('OrganizationTab Error Recovery', () => {
    it('should show error state and allow retry when API fails', async () => {
      // Mock API failure
      server.use(
        rest.get('/api/settings/organization', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Server error' }));
        })
      );

      render(<OrganizationTab />);

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText('Failed to load organization data')).toBeInTheDocument();
        expect(screen.getByText(/There was a problem loading your organization information/)).toBeInTheDocument();
      });

      // Should have retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      // Mock successful retry
      server.use(
        rest.get('/api/settings/organization', (req, res, ctx) => {
          return res(ctx.json({
            success: true,
            data: {
              id: '1',
              name: 'Test Organization',
              logo_url: null,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z'
            }
          }));
        })
      );

      // Click retry
      fireEvent.click(retryButton);

      // Should show success state
      await waitFor(() => {
        expect(screen.getByText('Organization Settings')).toBeInTheDocument();
        expect(screen.getByText('Test Organization')).toBeInTheDocument();
      });
    });

    it('should handle optimistic updates with rollback on error', async () => {
      // Mock successful initial load
      server.use(
        rest.get('/api/settings/organization', (req, res, ctx) => {
          return res(ctx.json({
            success: true,
            data: {
              id: '1',
              name: 'Original Name',
              logo_url: null,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z'
            }
          }));
        })
      );

      render(<OrganizationTab />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Original Name')).toBeInTheDocument();
      });

      // Click edit button
      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);

      // Change name
      const nameInput = screen.getByDisplayValue('Original Name');
      fireEvent.change(nameInput, { target: { value: 'New Name' } });

      // Mock API failure for update
      server.use(
        rest.patch('/api/settings/organization', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Update failed' }));
        })
      );

      // Click save
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      // Should rollback to original name after error
      await waitFor(() => {
        expect(screen.getByText('Original Name')).toBeInTheDocument();
        expect(screen.queryByText('New Name')).not.toBeInTheDocument();
      });
    });

    it('should show partial error state when data exists but operations fail', async () => {
      // Mock successful initial load
      server.use(
        rest.get('/api/settings/organization', (req, res, ctx) => {
          return res(ctx.json({
            success: true,
            data: {
              id: '1',
              name: 'Test Organization',
              logo_url: null,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z'
            }
          }));
        })
      );

      render(<OrganizationTab />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Test Organization')).toBeInTheDocument();
      });

      // Simulate a subsequent API failure (e.g., during an update)
      server.use(
        rest.patch('/api/settings/organization', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Network error' }));
        })
      );

      // Try to edit and save
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      const nameInput = screen.getByDisplayValue('Test Organization');
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      // Should show error alert but keep existing data visible
      await waitFor(() => {
        expect(screen.getByText(/Some operations may be temporarily unavailable/)).toBeInTheDocument();
        expect(screen.getByText('Test Organization')).toBeInTheDocument(); // Data still visible
      });
    });
  });

  describe('InboundEmailTab Error Recovery', () => {
    it('should show error state and allow retry when alias API fails', async () => {
      // Mock API failure
      server.use(
        rest.get('/api/settings/alias', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Failed to fetch alias' }));
        })
      );

      render(<InboundEmailTab />);

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText('Failed to load email configuration')).toBeInTheDocument();
      });

      // Should have retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      // Mock successful retry
      server.use(
        rest.get('/api/settings/alias', (req, res, ctx) => {
          return res(ctx.json({
            alias: {
              id: '1',
              aliasEmail: 'u_test@chiphi.oronculzac.com',
              isActive: true,
              createdAt: '2024-01-01T00:00:00Z'
            }
          }));
        })
      );

      // Click retry
      fireEvent.click(retryButton);

      // Should show success state
      await waitFor(() => {
        expect(screen.getByText('Inbound Email Configuration')).toBeInTheDocument();
        expect(screen.getByText('u_test@chiphi.oronculzac.com')).toBeInTheDocument();
      });
    });

    it('should handle verification code polling with retry', async () => {
      // Mock successful alias load
      server.use(
        rest.get('/api/settings/alias', (req, res, ctx) => {
          return res(ctx.json({
            alias: {
              id: '1',
              aliasEmail: 'u_test@chiphi.oronculzac.com',
              isActive: true,
              createdAt: '2024-01-01T00:00:00Z'
            }
          }));
        })
      );

      // Mock verification code API with initial failure then success
      let callCount = 0;
      server.use(
        rest.get('/api/alias/verification-code', (req, res, ctx) => {
          callCount++;
          if (callCount === 1) {
            return res(ctx.status(500), ctx.json({ error: 'Server error' }));
          }
          return res(ctx.json({ code: 'VERIFY123', timestamp: '2024-01-01T00:00:00Z' }));
        })
      );

      render(<InboundEmailTab />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('u_test@chiphi.oronculzac.com')).toBeInTheDocument();
      });

      // Click verification button
      const verifyButton = screen.getByTestId('get-verification-code');
      fireEvent.click(verifyButton);

      // Should eventually show verification code after retry
      await waitFor(() => {
        expect(screen.getByText('VERIFY123')).toBeInTheDocument();
        expect(screen.getByText('Verified')).toBeInTheDocument();
      }, { timeout: 10000 });
    });
  });

  describe('NotificationsTab Error Recovery', () => {
    it('should show error state and allow retry when preferences API fails', async () => {
      // Mock API failure
      server.use(
        rest.get('/api/settings/notifications', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Server error' }));
        })
      );

      render(<NotificationsTab />);

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText('Failed to load notification preferences')).toBeInTheDocument();
      });

      // Should have retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      // Mock successful retry
      server.use(
        rest.get('/api/settings/notifications', (req, res, ctx) => {
          return res(ctx.json({
            receiptProcessed: true,
            dailySummary: false,
            weeklySummary: false,
            summaryEmails: []
          }));
        })
      );

      // Click retry
      fireEvent.click(retryButton);

      // Should show success state
      await waitFor(() => {
        expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
        expect(screen.getByText('New receipt processed')).toBeInTheDocument();
      });
    });

    it('should handle optimistic updates for toggle switches with rollback', async () => {
      // Mock successful initial load
      server.use(
        rest.get('/api/settings/notifications', (req, res, ctx) => {
          return res(ctx.json({
            receiptProcessed: true,
            dailySummary: false,
            weeklySummary: false,
            summaryEmails: []
          }));
        })
      );

      render(<NotificationsTab />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
      });

      // Mock API failure for update
      server.use(
        rest.put('/api/settings/notifications', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Update failed' }));
        })
      );

      // Toggle daily summary switch
      const dailySummarySwitch = screen.getByRole('switch', { name: /daily summary/i });
      expect(dailySummarySwitch).not.toBeChecked();

      fireEvent.click(dailySummarySwitch);

      // Should rollback to original state after error
      await waitFor(() => {
        expect(dailySummarySwitch).not.toBeChecked();
      });
    });
  });

  describe('Network Resilience', () => {
    it('should handle intermittent network failures with automatic retry', async () => {
      let attemptCount = 0;
      
      // Mock API that fails twice then succeeds
      server.use(
        rest.get('/api/settings/organization', (req, res, ctx) => {
          attemptCount++;
          if (attemptCount <= 2) {
            return res.networkError('Network error');
          }
          return res(ctx.json({
            success: true,
            data: {
              id: '1',
              name: 'Test Organization',
              logo_url: null,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z'
            }
          }));
        })
      );

      render(<OrganizationTab />);

      // Should eventually succeed after retries
      await waitFor(() => {
        expect(screen.getByText('Test Organization')).toBeInTheDocument();
      }, { timeout: 10000 });

      expect(attemptCount).toBe(3); // Should have retried twice
    });

    it('should handle rate limiting with exponential backoff', async () => {
      let attemptCount = 0;
      
      // Mock API that returns 429 then succeeds
      server.use(
        rest.get('/api/settings/organization', (req, res, ctx) => {
          attemptCount++;
          if (attemptCount === 1) {
            return res(ctx.status(429), ctx.json({ error: 'Rate limited' }));
          }
          return res(ctx.json({
            success: true,
            data: {
              id: '1',
              name: 'Test Organization',
              logo_url: null,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z'
            }
          }));
        })
      );

      render(<OrganizationTab />);

      // Should eventually succeed after rate limit retry
      await waitFor(() => {
        expect(screen.getByText('Test Organization')).toBeInTheDocument();
      }, { timeout: 10000 });

      expect(attemptCount).toBe(2); // Should have retried once
    });
  });
});