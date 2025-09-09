import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE } from '../route';
import { getUserSession } from '@/lib/database/utils';
import { createClient } from '@/lib/supabase/server';

// Mock dependencies
vi.mock('@/lib/database/utils');
vi.mock('@/lib/supabase/server');

const mockGetUserSession = vi.mocked(getUserSession);
const mockCreateClient = vi.mocked(createClient);

describe('/api/settings/account/delete', () => {
  const mockSupabase = {
    rpc: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(mockSupabase as any);
  });

  it('should return 401 when user is not authenticated', async () => {
    mockGetUserSession.mockResolvedValue(null);

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 when user is not an owner', async () => {
    mockGetUserSession.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
      org: { id: 'org-1', name: 'Test Org' },
      role: 'admin', // Not owner
    } as any);

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Only organization owners can delete the account');
  });

  it('should successfully delete account when user is owner', async () => {
    mockGetUserSession.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
      org: { id: 'org-1', name: 'Test Org' },
      role: 'owner',
    } as any);

    mockSupabase.rpc.mockResolvedValue({
      data: { deleted_count: 150 },
      error: null,
    });

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Account deleted successfully');
    expect(data.deletedCount).toBe(150);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_organization_account', {
      p_org_id: 'org-1',
      p_user_id: 'user-1',
    });
  });

  it('should handle database errors', async () => {
    mockGetUserSession.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
      org: { id: 'org-1', name: 'Test Org' },
      role: 'owner',
    } as any);

    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to delete account');
  });

  it('should handle insufficient permissions error from database', async () => {
    mockGetUserSession.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
      org: { id: 'org-1', name: 'Test Org' },
      role: 'owner',
    } as any);

    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Insufficient permissions to delete organization account.' },
    });

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Insufficient permissions to delete account');
  });

  it('should handle organization not found error', async () => {
    mockGetUserSession.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
      org: { id: 'org-1', name: 'Test Org' },
      role: 'owner',
    } as any);

    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Organization not found.' },
    });

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Organization not found');
  });

  it('should handle unexpected errors', async () => {
    mockGetUserSession.mockRejectedValue(new Error('Unexpected error'));

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });
});