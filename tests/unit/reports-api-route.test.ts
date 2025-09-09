import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Unit tests for Reports API route structure and validation
 */

describe('Reports API Route Unit Tests', () => {
  it('should import the GET handler successfully', async () => {
    const { GET } = await import('@/app/api/reports/data/route');
    expect(GET).toBeDefined();
    expect(typeof GET).toBe('function');
  });
  
  it('should handle unauthorized requests', async () => {
    // Mock getUserSession to return null (unauthorized)
    vi.doMock('@/lib/database/utils', () => ({
      getUserSession: vi.fn().mockResolvedValue(null),
    }));
    
    const { GET } = await import('@/app/api/reports/data/route');
    const request = new NextRequest('http://localhost:3000/api/reports/data');
    
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized');
    expect(data.correlationId).toBeDefined();
  });
  
  it('should validate query parameters', async () => {
    // Mock getUserSession to return a valid session
    const mockSession = {
      user: { id: 'user-123', email: 'test@example.com', full_name: 'Test User' },
      org: { id: 'org-123', name: 'Test Org' },
      role: 'admin' as const,
    };
    
    vi.doMock('@/lib/database/utils', () => ({
      getUserSession: vi.fn().mockResolvedValue(mockSession),
    }));
    
    // Mock createClient to avoid database calls
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockReturnValue({
        rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    }));
    
    const { GET } = await import('@/app/api/reports/data/route');
    const request = new NextRequest('http://localhost:3000/api/reports/data?timeRange=invalid');
    
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid query parameters');
    expect(data.details).toBeDefined();
    expect(data.correlationId).toBeDefined();
  });
});