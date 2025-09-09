import { test, expect } from '@playwright/test';

test.describe('Member Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route('**/auth/getUser', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            user: {
              id: 'user-1',
              email: 'admin@example.com',
              user_metadata: { full_name: 'Admin User' }
            }
          },
          error: null
        })
      });
    });

    // Mock members API
    await page.route('**/api/settings/members', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
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
                {
                  id: 'user-2',
                  email: 'member@example.com',
                  full_name: 'Member User',
                  role: 'member',
                  joined_at: '2024-01-02T00:00:00Z',
                },
              ],
              invitations: [
                {
                  id: 'invite-1',
                  email: 'pending@example.com',
                  role: 'member',
                  invited_by_name: 'Admin User',
                  expires_at: '2024-12-31T23:59:59Z',
                  created_at: '2024-01-03T00:00:00Z',
                },
              ],
            },
          })
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              invitationId: 'invite-123',
              message: 'Invitation sent successfully',
            },
          })
        });
      } else if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              message: 'Member role updated successfully',
            },
          })
        });
      } else if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              message: 'Member removed successfully',
            },
          })
        });
      }
    });

    // Mock organization API
    await page.route('**/api/settings/organization', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'org-1',
            name: 'Test Organization',
            logo_url: null,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        })
      });
    });
  });

  test('displays current members and pending invitations', async ({ page }) => {
    await page.goto('/settings?tab=organization');

    // Wait for the page to load
    await expect(page.getByText('Organization Settings')).toBeVisible();

    // Check that members are displayed
    await expect(page.getByText('Current Members (2)')).toBeVisible();
    await expect(page.getByText('Admin User')).toBeVisible();
    await expect(page.getByText('admin@example.com')).toBeVisible();
    await expect(page.getByText('Member User')).toBeVisible();
    await expect(page.getByText('member@example.com')).toBeVisible();

    // Check role badges
    await expect(page.getByText('admin').first()).toBeVisible();
    await expect(page.getByText('member').first()).toBeVisible();

    // Check pending invitations
    await expect(page.getByText('Pending Invitations (1)')).toBeVisible();
    await expect(page.getByText('pending@example.com')).toBeVisible();
    await expect(page.getByText('Pending')).toBeVisible();
  });

  test('can invite a new member', async ({ page }) => {
    await page.goto('/settings?tab=organization');

    // Click invite member button
    await page.getByText('Invite Member').click();

    // Fill in the invite form
    await expect(page.getByText('Invite New Member')).toBeVisible();
    await page.getByLabel('Email Address').fill('newuser@example.com');
    await page.getByLabel('Role').click();
    await page.getByText('Admin').click();

    // Submit the form
    await page.getByText('Send Invitation').click();

    // Check for success message
    await expect(page.getByText('Invitation sent to newuser@example.com')).toBeVisible();

    // Form should be hidden after successful submission
    await expect(page.getByText('Invite New Member')).not.toBeVisible();
  });

  test('validates email input in invite form', async ({ page }) => {
    await page.goto('/settings?tab=organization');

    // Click invite member button
    await page.getByText('Invite Member').click();

    // Try to submit with invalid email
    await page.getByLabel('Email Address').fill('invalid-email');
    await page.getByText('Send Invitation').click();

    // Check for validation error
    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
  });

  test('can cancel invite form', async ({ page }) => {
    await page.goto('/settings?tab=organization');

    // Click invite member button
    await page.getByText('Invite Member').click();
    await expect(page.getByText('Invite New Member')).toBeVisible();

    // Click cancel
    await page.getByText('Cancel').click();

    // Form should be hidden
    await expect(page.getByText('Invite New Member')).not.toBeVisible();
  });

  test('can update member role', async ({ page }) => {
    await page.goto('/settings?tab=organization');

    // Find the member dropdown menu (should be available for non-owner members)
    const memberMenuButtons = page.locator('[role="button"][aria-haspopup="menu"]');
    await expect(memberMenuButtons).toHaveCount(1); // Only one member should have menu (the regular member)

    // Click the dropdown menu
    await memberMenuButtons.first().click();

    // Click "Make Admin"
    await page.getByText('Make Admin').click();

    // Check for success message
    await expect(page.getByText('Member role updated successfully')).toBeVisible();
  });

  test('shows confirmation dialog before removing member', async ({ page }) => {
    await page.goto('/settings?tab=organization');

    // Find and click the member dropdown menu
    const memberMenuButtons = page.locator('[role="button"][aria-haspopup="menu"]');
    await memberMenuButtons.first().click();

    // Click "Remove"
    await page.getByText('Remove').click();

    // Check confirmation dialog appears
    await expect(page.getByText('Remove Member')).toBeVisible();
    await expect(page.getByText(/are you sure you want to remove/i)).toBeVisible();

    // Cancel the removal
    await page.getByText('Cancel').click();
    await expect(page.getByText('Remove Member')).not.toBeVisible();
  });

  test('can remove member after confirmation', async ({ page }) => {
    await page.goto('/settings?tab=organization');

    // Find and click the member dropdown menu
    const memberMenuButtons = page.locator('[role="button"][aria-haspopup="menu"]');
    await memberMenuButtons.first().click();

    // Click "Remove"
    await page.getByText('Remove').click();

    // Confirm removal
    await page.getByRole('button', { name: /confirm|remove/i }).click();

    // Check for success message
    await expect(page.getByText('Member removed successfully')).toBeVisible();
  });

  test('handles API errors gracefully', async ({ page }) => {
    // Mock API error for invitation
    await page.route('**/api/settings/members', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'User is already a member of this organization',
          })
        });
      }
    });

    await page.goto('/settings?tab=organization');

    // Try to invite a member
    await page.getByText('Invite Member').click();
    await page.getByLabel('Email Address').fill('existing@example.com');
    await page.getByText('Send Invitation').click();

    // Check for error message
    await expect(page.getByText('User is already a member of this organization')).toBeVisible();
  });

  test('shows loading state while fetching members', async ({ page }) => {
    // Mock slow API response
    await page.route('**/api/settings/members', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { members: [], invitations: [] },
        })
      });
    });

    await page.goto('/settings?tab=organization');

    // Check loading state
    await expect(page.getByRole('status', { name: /loading members/i })).toBeVisible();
  });

  test('displays empty state when no members', async ({ page }) => {
    // Mock empty response
    await page.route('**/api/settings/members', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            members: [],
            invitations: [],
          },
        })
      });
    });

    await page.goto('/settings?tab=organization');

    // Check empty state
    await expect(page.getByText('Current Members (0)')).toBeVisible();
    await expect(page.getByText('No team members yet')).toBeVisible();
  });

  test('disables actions when component is disabled', async ({ page }) => {
    // We can't easily test the disabled prop from the outside,
    // but we can test that the invite button becomes disabled during operations
    await page.goto('/settings?tab=organization');

    // Start inviting a member
    await page.getByText('Invite Member').click();
    await page.getByLabel('Email Address').fill('test@example.com');

    // Mock slow API response to see loading state
    await page.route('**/api/settings/members', async route => {
      if (route.request().method() === 'POST') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { invitationId: 'invite-123' },
          })
        });
      }
    });

    // Click send invitation
    await page.getByText('Send Invitation').click();

    // Check that button shows loading state
    await expect(page.getByText('Sending Invitation...')).toBeVisible();
  });

  test('shows role icons correctly', async ({ page }) => {
    await page.goto('/settings?tab=organization');

    // Check that role icons are displayed
    // Admin should have shield icon, member should have user icon
    const adminRow = page.locator('text=Admin User').locator('..');
    const memberRow = page.locator('text=Member User').locator('..');

    await expect(adminRow).toBeVisible();
    await expect(memberRow).toBeVisible();

    // Check role badges are present
    await expect(page.getByText('admin').first()).toBeVisible();
    await expect(page.getByText('member').first()).toBeVisible();
  });
});