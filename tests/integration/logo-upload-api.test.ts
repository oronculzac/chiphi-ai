import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST, DELETE } from '@/app/api/settings/organization/logo/route';
import { getUserSession } from '@/lib/database/utils';
import { createClient } from '@/lib/supabase/server';

// Mock dependencies
vi.mock('@/lib/database/utils');
vi.mock('@/lib/supabase/server');

describe('/api/settings/organization/logo', () => {
  const mockGetUserSession = vi.mocked(getUserSession);
  const mockCreateClient = vi.mocked(createClient);
  const mockSupabase = {
    storage: {
      from: vi.fn(),
    },
    rpc: vi.fn(),
    from: vi.fn(),
  };

  const mockStorageBucket = {
    upload: vi.fn(),
    getPublicUrl: vi.fn(),
    remove: vi.fn(),
  };

  const mockSession = {
    user: { id: 'user-123' },
    org: { id: 'org-123' },
    role: 'admin',
  };

  beforeEach(() => {
    mockCreateClient.mockResolvedValue(mockSupabase as any);
    mockSupabase.storage.from.mockReturnValue(mockStorageBucket);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/settings/organization/logo', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockGetUserSession.mockResolvedValue(null);

      const formData = new FormData();
      formData.append('logo', new File(['content'], 'logo.jpg', { type: 'image/jpeg' }));

      const request = new Request('http://localhost/api/settings/organization/logo', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks permissions', async () => {
      mockGetUserSession.mockResolvedValue({
        ...mockSession,
        role: 'member',
      });

      const formData = new FormData();
      formData.append('logo', new File(['content'], 'logo.jpg', { type: 'image/jpeg' }));

      const request = new Request('http://localhost/api/settings/organization/logo', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Insufficient permissions to update organization logo');
    });

    it('should return 400 when no file is provided', async () => {
      mockGetUserSession.mockResolvedValue(mockSession);

      const formData = new FormData();

      const request = new Request('http://localhost/api/settings/organization/logo', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No file provided');
    });

    it('should return 400 for invalid file type', async () => {
      mockGetUserSession.mockResolvedValue(mockSession);

      const formData = new FormData();
      formData.append('logo', new File(['content'], 'document.txt', { type: 'text/plain' }));

      const request = new Request('http://localhost/api/settings/organization/logo', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
    });

    it('should return 400 for file too large', async () => {
      mockGetUserSession.mockResolvedValue(mockSession);

      // Create a file larger than 5MB
      const largeContent = 'x'.repeat(6 * 1024 * 1024);
      const formData = new FormData();
      formData.append('logo', new File([largeContent], 'large.jpg', { type: 'image/jpeg' }));

      const request = new Request('http://localhost/api/settings/organization/logo', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('File size too large. Maximum size is 5MB.');
    });

    it('should upload file successfully', async () => {
      mockGetUserSession.mockResolvedValue(mockSession);

      const mockUploadData = { path: 'logos/org-123-logo-123456789.jpg' };
      const mockPublicUrl = 'https://storage.example.com/logos/org-123-logo-123456789.jpg';
      const mockUpdatedOrg = {
        id: 'org-123',
        name: 'Test Org',
        logo_url: mockPublicUrl,
        updated_at: new Date().toISOString(),
      };

      mockStorageBucket.upload.mockResolvedValue({
        data: mockUploadData,
        error: null,
      });

      mockStorageBucket.getPublicUrl.mockReturnValue({
        data: { publicUrl: mockPublicUrl },
      });

      mockSupabase.rpc.mockResolvedValue({
        data: mockUpdatedOrg,
        error: null,
      });

      const formData = new FormData();
      formData.append('logo', new File(['content'], 'logo.jpg', { type: 'image/jpeg' }));

      const request = new Request('http://localhost/api/settings/organization/logo', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockUpdatedOrg);
      expect(data.message).toBe('Logo uploaded successfully');

      expect(mockStorageBucket.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^logos\/org-org-123-logo-\d+\.jpg$/),
        expect.any(Buffer),
        {
          contentType: 'image/jpeg',
          upsert: false,
        }
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith('update_organization_info', {
        p_org_id: 'org-123',
        p_logo_url: mockPublicUrl,
        p_updated_by: 'user-123',
      });
    });

    it('should handle storage upload failure', async () => {
      mockGetUserSession.mockResolvedValue(mockSession);

      mockStorageBucket.upload.mockResolvedValue({
        data: null,
        error: { message: 'Storage error' },
      });

      const formData = new FormData();
      formData.append('logo', new File(['content'], 'logo.jpg', { type: 'image/jpeg' }));

      const request = new Request('http://localhost/api/settings/organization/logo', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to upload file');
    });

    it('should handle database update failure and clean up uploaded file', async () => {
      mockGetUserSession.mockResolvedValue(mockSession);

      const mockUploadData = { path: 'logos/org-123-logo-123456789.jpg' };
      const mockPublicUrl = 'https://storage.example.com/logos/org-123-logo-123456789.jpg';

      mockStorageBucket.upload.mockResolvedValue({
        data: mockUploadData,
        error: null,
      });

      mockStorageBucket.getPublicUrl.mockReturnValue({
        data: { publicUrl: mockPublicUrl },
      });

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      mockStorageBucket.remove.mockResolvedValue({ error: null });

      const formData = new FormData();
      formData.append('logo', new File(['content'], 'logo.jpg', { type: 'image/jpeg' }));

      const request = new Request('http://localhost/api/settings/organization/logo', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update organization logo');

      // Should clean up the uploaded file
      expect(mockStorageBucket.remove).toHaveBeenCalledWith([mockUploadData.path]);
    });
  });

  describe('DELETE /api/settings/organization/logo', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockGetUserSession.mockResolvedValue(null);

      const request = new Request('http://localhost/api/settings/organization/logo', {
        method: 'DELETE',
      });

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks permissions', async () => {
      mockGetUserSession.mockResolvedValue({
        ...mockSession,
        role: 'member',
      });

      const request = new Request('http://localhost/api/settings/organization/logo', {
        method: 'DELETE',
      });

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Insufficient permissions to update organization logo');
    });

    it('should remove logo successfully', async () => {
      mockGetUserSession.mockResolvedValue(mockSession);

      const mockCurrentOrg = {
        logo_url: 'https://storage.example.com/organization-assets/logos/org-123-logo-123456789.jpg',
      };

      const mockUpdatedOrg = {
        id: 'org-123',
        name: 'Test Org',
        logo_url: null,
        updated_at: new Date().toISOString(),
      };

      const mockFromQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockCurrentOrg,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockFromQuery);

      mockSupabase.rpc.mockResolvedValue({
        data: mockUpdatedOrg,
        error: null,
      });

      mockStorageBucket.remove.mockResolvedValue({ error: null });

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockUpdatedOrg);
      expect(data.message).toBe('Logo removed successfully');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('update_organization_info', {
        p_org_id: 'org-123',
        p_logo_url: null,
        p_updated_by: 'user-123',
      });

      expect(mockStorageBucket.remove).toHaveBeenCalledWith(['logos/org-123-logo-123456789.jpg']);
    });

    it('should handle database update failure', async () => {
      mockGetUserSession.mockResolvedValue(mockSession);

      const mockFromQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { logo_url: null },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockFromQuery);

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to remove organization logo');
    });

    it('should handle storage cleanup failure gracefully', async () => {
      mockGetUserSession.mockResolvedValue(mockSession);

      const mockCurrentOrg = {
        logo_url: 'https://storage.example.com/organization-assets/logos/org-123-logo-123456789.jpg',
      };

      const mockUpdatedOrg = {
        id: 'org-123',
        name: 'Test Org',
        logo_url: null,
        updated_at: new Date().toISOString(),
      };

      const mockFromQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockCurrentOrg,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockFromQuery);

      mockSupabase.rpc.mockResolvedValue({
        data: mockUpdatedOrg,
        error: null,
      });

      // Storage cleanup fails but shouldn't affect the response
      mockStorageBucket.remove.mockRejectedValue(new Error('Storage cleanup failed'));

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockUpdatedOrg);
    });
  });
});