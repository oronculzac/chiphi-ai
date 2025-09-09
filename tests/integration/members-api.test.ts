import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@/lib/supabase/server';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// Mock email service
vi.mock('@/lib/services/email-service', () => ({
  emailService: {
    sendInvitationEmail: vi.fn().mockResolvedValue(true),
  },
}));

describe('/api/settings/members', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/settings/members', () => {
    it('returns members and invitations for authenticated user', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'test@example.com' } },
        error: null,
      });

      // Mock org member lookup
      const mockOrgMemberQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { org_id: 'org-1', role: 'admin' },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValueOnce(mockOrgMemberQuery);

      // Mock members query
      const mockMembersQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              user_id: 'user-1',
              role: 'admin',
              created_at: '2024-01-01T00:00:00Z',
              users: { id: 'user-1', email: 'test@example.com', full_name: 'Test User' },
            },
          ],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValueOnce(mockMembersQuery);

      // Mock invitations query
      const mockInvitationsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'invite-1',
              email: 'pending@example.com',
              role: 'member',
              expires_at: '2024-12-31T23:59:59Z',
              created_at: '2024-01-01T00:00:00Z',
              invited_by: 'user-1',
              users: { full_name: 'Test User' },
            },
          ],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValueOnce(mockInvitationsQuery);

      const { GET } = await import('@/app/api/settings/members/route');
      const request = new Request('http://localhost:3000/api/settings/members');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.members).toHaveLength(1);
      expect(data.data.invitations).toHaveLength(1);
      expect(data.data.members[0]).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'admin',
        joined_at: '2024-01-01T00:00:00Z',
      });
    });

    it('returns 401 for unauthenticated user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const { GET } = await import('@/app/api/settings/members/route');
      const request = new Request('http://localhost:3000/api/settings/members');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 404 when user is not a member of any organization', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'test@example.com' } },
        error: null,
      });

      const mockOrgMemberQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Not found'),
        }),
      };
      mockSupabase.from.mockReturnValueOnce(mockOrgMemberQuery);

      const { GET } = await import('@/app/api/settings/members/route');
      const request = new Request('http://localhost:3000/api/settings/members');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Organization not found');
    });
  });

  describe('POST /api/settings/members', () => {
    it('successfully invites a new member', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'admin@example.com' } },
        error: null,
      });

      // Mock org member lookup
      const mockOrgMemberQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { org_id: 'org-1', role: 'admin' },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValueOnce(mockOrgMemberQuery);

      // Mock invite function
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 'invite-123',
        error: null,
      });

      // Mock invitation details query
      const mockInvitationQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            token: 'token-123',
            email: 'newuser@example.com',
            role: 'member',
            orgs: { name: 'Test Org' },
            users: { full_name: 'Admin User' },
          },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValueOnce(mockInvitationQuery);

      const { POST } = await import('@/app/api/settings/members/route');
      const request = new Request('http://localhost:3000/api/settings/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'newuser@example.com',
          role: 'member',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.invitationId).toBe('invite-123');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('invite_org_member', {
        p_org_id: 'org-1',
        p_email: 'newuser@example.com',
        p_role: 'member',
        p_invited_by: 'user-1',
        p_expires_hours: 168,
      });
    });

    it('returns 400 for invalid email', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'admin@example.com' } },
        error: null,
      });

      const { POST } = await import('@/app/api/settings/members/route');
      const request = new Request('http://localhost:3000/api/settings/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'invalid-email',
          role: 'member',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('valid email address');
    });

    it('returns 403 for non-admin user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'member@example.com' } },
        error: null,
      });

      const mockOrgMemberQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { org_id: 'org-1', role: 'member' },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValueOnce(mockOrgMemberQuery);

      const { POST } = await import('@/app/api/settings/members/route');
      const request = new Request('http://localhost:3000/api/settings/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'newuser@example.com',
          role: 'member',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Insufficient permissions to invite members');
    });

    it('handles duplicate member invitation', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'admin@example.com' } },
        error: null,
      });

      const mockOrgMemberQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { org_id: 'org-1', role: 'admin' },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValueOnce(mockOrgMemberQuery);

      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: new Error('User is already a member of this organization.'),
      });

      const { POST } = await import('@/app/api/settings/members/route');
      const request = new Request('http://localhost:3000/api/settings/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'existing@example.com',
          role: 'member',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('User is already a member of this organization');
    });
  });

  describe('PATCH /api/settings/members', () => {
    it('successfully updates member role', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'admin@example.com' } },
        error: null,
      });

      const mockOrgMemberQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { org_id: 'org-1', role: 'admin' },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValueOnce(mockOrgMemberQuery);

      mockSupabase.rpc.mockResolvedValueOnce({
        data: true,
        error: null,
      });

      const { PATCH } = await import('@/app/api/settings/members/route');
      const request = new Request('http://localhost:3000/api/settings/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: '550e8400-e29b-41d4-a716-446655440000',
          role: 'admin',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('update_member_role', {
        p_org_id: 'org-1',
        p_user_id: '550e8400-e29b-41d4-a716-446655440000',
        p_new_role: 'admin',
        p_updated_by: 'user-1',
      });
    });

    it('returns 400 for invalid member ID', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'admin@example.com' } },
        error: null,
      });

      const { PATCH } = await import('@/app/api/settings/members/route');
      const request = new Request('http://localhost:3000/api/settings/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: 'invalid-uuid',
          role: 'admin',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid member ID');
    });
  });

  describe('DELETE /api/settings/members', () => {
    it('successfully removes member', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'admin@example.com' } },
        error: null,
      });

      const mockOrgMemberQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { org_id: 'org-1', role: 'admin' },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValueOnce(mockOrgMemberQuery);

      mockSupabase.rpc.mockResolvedValueOnce({
        data: true,
        error: null,
      });

      const { DELETE } = await import('@/app/api/settings/members/route');
      const request = new Request('http://localhost:3000/api/settings/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('remove_org_member', {
        p_org_id: 'org-1',
        p_user_id: '550e8400-e29b-41d4-a716-446655440000',
        p_removed_by: 'user-1',
      });
    });

    it('prevents removing last owner', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'owner@example.com' } },
        error: null,
      });

      const mockOrgMemberQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { org_id: 'org-1', role: 'owner' },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValueOnce(mockOrgMemberQuery);

      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: new Error('Cannot remove the last owner from the organization.'),
      });

      const { DELETE } = await import('@/app/api/settings/members/route');
      const request = new Request('http://localhost:3000/api/settings/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: '550e8400-e29b-41d4-a716-446655440001',
        }),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Cannot remove the last owner from the organization');
    });
  });
});