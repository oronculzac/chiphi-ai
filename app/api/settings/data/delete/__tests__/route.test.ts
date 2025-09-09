import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE } from '../route';
import { getUserSession } from '@/lib/database/utils';
import { createClient } from '@/lib/supabase/server';

// Mock dependencies
vi.mock('@/lib/database/utils');
vi.mock('@/lib/supabase/server');

const mockGetUserSession = vi.mocked(getUserSession);
const mockCreateClient = vi.mocked(createClient);

describe('/api/settings/data/delete', () => {
  const mockSupabase = {
    rpc: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(mockSupabase as any);
  });

  it('should return 401 when user is not authenticated', async () => {
    mockGetUserSession.mockResolvedValue(null);

    const request = new Request('http://localhost', {
      method: 'DELETE',
      body: JSON.stringify({ dataTypes: ['transactions'] }),
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 when user is not admin or owner', async () => {
    mockGetUserSession.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
      org: { id: 'org-1', name: 'Test Org' },
      role: 'member', // Not admin or owner
    } as any);

    const request = new Request('http://localhost', {
      method: 'DELETE',
      body: JSON.stringify({ dataTypes: ['transactions'] }),
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Insufficient permissions to delete organization data');
  });

  it('should return 400 for invalid data types', async () => {
    mockGetUserSession.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
      org: { id: 'org-1', name: 'Test Org' },
      role: 'admin',
    } as any);

    const request = new Request('http://localhost', {
      method: 'DELETE',
      body: JSON.stringify({ dataTypes: ['invalid'] }),
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details).toBeDefined();
  });

  it('should return 400 for empty data types array', async () => {
    mockGetUserSession.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
      org: { id: 'org-1', name: 'Test Org' },
      role: 'admin',
    } as any);

    const request = new Request('http://localhost', {
      method: 'DELETE',
      body: JSON.stringify({ dataTypes: [] }),
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('should successfully delete selected data types', async () => {
    mockGetUserSession.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
      org: { id: 'org-1', name: 'Test Org' },
      role: 'admin',
    } as any);

    mockSupabase.rpc.mockResolvedValue({
      data: { deleted_count: 75 },
      error: null,
    });

    const request = new Request('http://localhost', {
      method: 'DELETE',
      body: JSON.stringify({ dataTypes: ['transactions', 'emails'] }),
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Data deleted successfully');
    expect(data.deletedCount).toBe(75);
    expect(data.deletedTypes).toEqual(['transactions', 'emails']);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_organization_data', {
      p_org_id: 'org-1',
      p_user_id: 'user-1',
      p_data_types: ['transactions', 'emails'],
    });
  });

  it('should handle all valid data types', async () => {
    mockGetUserSession.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
      org: { id: 'org-1', name: 'Test Org' },
      role: 'owner',
    } as any);

    mockSupabase.rpc.mockResolvedValue({
      data: { deleted_count: 200 },
      error: null,
    });

    const allDataTypes = [
      'transactions',
      'emails',
      'merchantMappings',
      'processingLogs',
      'notifications',
    ];

    const request = new Request('http://localhost', {
      method: 'DELETE',
      body: JSON.stringify({ dataTypes: allDataTypes }),
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.deletedTypes).toEqual(allDataTypes);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_organization_data', {
      p_org_id: 'org-1',
      p_user_id: 'user-1',
      p_data_types: allDataTypes,
    });
  });

  it('should handle database errors', async () => {
    mockGetUserSession.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
      org: { id: 'org-1', name: 'Test Org' },
      role: 'admin',
    } as any);

    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    const request = new Request('http://localhost', {
      method: 'DELETE',
      body: JSON.stringify({ dataTypes: ['transactions'] }),
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to delete data');
  });

  it('should handle insufficient permissions error from database', async () => {
    mockGetUserSession.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
      org: { id: 'org-1', name: 'Test Org' },
      role: 'admin',
    } as any);

    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Insufficient permissions to delete organization data.' },
    });

    const request = new Request('http://localhost', {
      method: 'DELETE',
      body: JSON.stringify({ dataTypes: ['transactions'] }),
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Insufficient permissions to delete data');
  });

  it('should handle organization not found error', async () => {
    mockGetUserSession.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
      org: { id: 'org-1', name: 'Test Org' },
      role: 'admin',
    } as any);

    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Organization not found.' },
    });

    const request = new Request('http://localhost', {
      method: 'DELETE',
      body: JSON.stringify({ dataTypes: ['transactions'] }),
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Organization not found');
  });

  it('should handle malformed JSON', async () => {
    mockGetUserSession.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
      org: { id: 'org-1', name: 'Test Org' },
      role: 'admin',
    } as any);

    const request = new Request('http://localhost', {
      method: 'DELETE',
      body: 'invalid json',
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });
});