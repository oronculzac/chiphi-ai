import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PATCH } from '@/app/api/settings/organization/route';

// Mock dependencies
vi.mock('@/lib/database/utils', () => ({
  getUserSession: vi.fn()
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn()
}));

// Import mocked functions
import { getUserSession } from '@/lib/database/utils';
import { createClient } from '@/lib/supabase/server';

const mockGetUserSession = vi.mocked(getUserSession);
const mockCreateClient = vi.mocked(createClient);

const mockSupabaseClient = {
  from: vi.fn(),
  rpc: vi.fn(),
};

const mockSession = {
  user: { id: 'user-123', email: 'test@example.com' },
  org: { id: 'org-123', name: 'Test Org' },
  role: 'admin' as const,
};

const mockOrganization = {
  id: 'org-123',
  name: 'Test Organization',
  logo_url: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('/api/settings/organization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(mockSupabaseClient as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET', () => {
    it('should return organization data for authenticated user', async () => {
      mockGetUserSession.mockResolvedValue(mockSession);
      
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockOrganization,
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        single: mockSingle,
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: mockOrganization,
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('orgs');
      expect(mockSelect).toHaveBeenCalledWith('id, name, logo_url, created_at, updated_at');
      expect(mockEq).toHaveBeenCalledWith('id', 'org-123');
    });

    it('should return 401 for unauthenticated requests', async () => {
      mockGetUserSession.mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        error: 'Unauthorized',
      });
    });

    it('should handle database errors gracefully', async () => {
      mockGetUserSession.mockResolvedValue(mockSession);
      
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        single: mockSingle,
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Failed to fetch organization',
      });
    });
  });

  describe('PATCH', () => {
    it('should update organization name for admin user', async () => {
      mockGetUserSession.mockResolvedValue(mockSession);
      
      const updatedOrg = { ...mockOrganization, name: 'Updated Organization' };
      mockSupabaseClient.rpc.mockResolvedValue({
        data: updatedOrg,
        error: null,
      });

      const request = new NextRequest('http://localhost/api/settings/organization', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated Organization' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: updatedOrg,
        message: 'Organization updated successfully',
      });

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('update_organization_info', {
        p_org_id: 'org-123',
        p_name: 'Updated Organization',
        p_updated_by: 'user-123',
      });
    });

    it('should update organization name for owner user', async () => {
      const ownerSession = { ...mockSession, role: 'owner' as const };
      mockGetUserSession.mockResolvedValue(ownerSession);
      
      const updatedOrg = { ...mockOrganization, name: 'Updated Organization' };
      mockSupabaseClient.rpc.mockResolvedValue({
        data: updatedOrg,
        error: null,
      });

      const request = new NextRequest('http://localhost/api/settings/organization', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated Organization' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 401 for unauthenticated requests', async () => {
      mockGetUserSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/settings/organization', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated Organization' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        error: 'Unauthorized',
      });
    });

    it('should return 403 for member users', async () => {
      const memberSession = { ...mockSession, role: 'member' as const };
      mockGetUserSession.mockResolvedValue(memberSession);

      const request = new NextRequest('http://localhost/api/settings/organization', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated Organization' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data).toEqual({
        error: 'Insufficient permissions to update organization',
      });
    });

    it('should validate request body', async () => {
      mockGetUserSession.mockResolvedValue(mockSession);

      // Test empty name
      const request1 = new NextRequest('http://localhost/api/settings/organization', {
        method: 'PATCH',
        body: JSON.stringify({ name: '' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response1 = await PATCH(request1);
      const data1 = await response1.json();

      expect(response1.status).toBe(400);
      expect(data1.error).toBe('Validation failed');
      expect(data1.details).toBeDefined();

      // Test name too long
      const longName = 'a'.repeat(101);
      const request2 = new NextRequest('http://localhost/api/settings/organization', {
        method: 'PATCH',
        body: JSON.stringify({ name: longName }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response2 = await PATCH(request2);
      const data2 = await response2.json();

      expect(response2.status).toBe(400);
      expect(data2.error).toBe('Validation failed');
    });

    it('should handle database function errors', async () => {
      mockGetUserSession.mockResolvedValue(mockSession);
      
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Insufficient permissions to update organization' },
      });

      const request = new NextRequest('http://localhost/api/settings/organization', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated Organization' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data).toEqual({
        error: 'Insufficient permissions to update organization',
      });
    });

    it('should handle organization not found error', async () => {
      mockGetUserSession.mockResolvedValue(mockSession);
      
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Organization not found' },
      });

      const request = new NextRequest('http://localhost/api/settings/organization', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated Organization' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({
        error: 'Organization not found',
      });
    });

    it('should handle generic database errors', async () => {
      mockGetUserSession.mockResolvedValue(mockSession);
      
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Some other database error' },
      });

      const request = new NextRequest('http://localhost/api/settings/organization', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated Organization' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Failed to update organization',
      });
    });

    it('should trim whitespace from organization name', async () => {
      mockGetUserSession.mockResolvedValue(mockSession);
      
      const updatedOrg = { ...mockOrganization, name: 'Trimmed Organization' };
      mockSupabaseClient.rpc.mockResolvedValue({
        data: updatedOrg,
        error: null,
      });

      const request = new NextRequest('http://localhost/api/settings/organization', {
        method: 'PATCH',
        body: JSON.stringify({ name: '  Trimmed Organization  ' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('update_organization_info', {
        p_org_id: 'org-123',
        p_name: 'Trimmed Organization',
        p_updated_by: 'user-123',
      });
    });

    it('should handle malformed JSON', async () => {
      mockGetUserSession.mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost/api/settings/organization', {
        method: 'PATCH',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Internal server error',
      });
    });
  });
});