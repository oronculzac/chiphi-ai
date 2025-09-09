import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/lib/config';
import { GET } from '@/app/api/settings/alias/route';
import { NextRequest } from 'next/server';

// Create admin client for test setup
const adminClient = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

describe('Alias API Integration Tests', () => {
  let testUserId: string;
  let testOrgId: string;
  let testAliasId: string;

  beforeEach(async () => {
    // Create test user
    const { data: user, error: userError } = await adminClient.auth.admin.createUser({
      email: `alias-test-${Date.now()}@example.com`,
      password: 'test-password-123',
      email_confirm: true,
    });

    if (userError || !user.user) {
      throw new Error(`Failed to create test user: ${userError?.message}`);
    }

    testUserId = user.user.id;

    // Create test organization
    const { data: org, error: orgError } = await adminClient
      .from('orgs')
      .insert({
        name: `Test Org ${Date.now()}`,
      })
      .select()
      .single();

    if (orgError || !org) {
      throw new Error(`Failed to create test org: ${orgError?.message}`);
    }

    testOrgId = org.id;

    // Add user to organization
    const { error: memberError } = await adminClient
      .from('org_members')
      .insert({
        org_id: testOrgId,
        user_id: testUserId,
        role: 'owner',
      });

    if (memberError) {
      throw new Error(`Failed to add user to org: ${memberError.message}`);
    }

    // Insert user profile
    const { error: profileError } = await adminClient
      .from('users')
      .insert({
        id: testUserId,
        email: `alias-test-${Date.now()}@example.com`,
        full_name: 'Test User',
      });

    if (profileError) {
      throw new Error(`Failed to create user profile: ${profileError.message}`);
    }
  });

  afterEach(async () => {
    // Clean up test data
    if (testAliasId) {
      await adminClient.from('inbox_aliases').delete().eq('id', testAliasId);
    }
    if (testOrgId) {
      await adminClient.from('org_members').delete().eq('org_id', testOrgId);
      await adminClient.from('orgs').delete().eq('id', testOrgId);
    }
    if (testUserId) {
      await adminClient.from('users').delete().eq('id', testUserId);
      await adminClient.auth.admin.deleteUser(testUserId);
    }
  });

  it('should create new alias when none exists', async () => {
    // Mock the getUserSession function to return our test user
    const mockGetUserSession = async () => ({
      user: {
        id: testUserId,
        email: `alias-test-${Date.now()}@example.com`,
        full_name: 'Test User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      org: {
        id: testOrgId,
        name: `Test Org ${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      role: 'owner' as const,
    });

    // Mock the module
    const { vi } = await import('vitest');
    vi.doMock('@/lib/database/utils', () => ({
      getUserSession: mockGetUserSession,
    }));

    const request = new NextRequest('http://localhost:3000/api/settings/alias');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.alias).toBeDefined();
    expect(data.alias.aliasEmail).toMatch(/^u_[a-z0-9]{8}@chiphi\.oronculzac\.com$/);
    expect(data.alias.isActive).toBe(true);

    testAliasId = data.alias.id;

    // Verify alias was created in database
    const { data: dbAlias, error } = await adminClient
      .from('inbox_aliases')
      .select('*')
      .eq('id', testAliasId)
      .single();

    expect(error).toBeNull();
    expect(dbAlias).toBeDefined();
    expect(dbAlias.org_id).toBe(testOrgId);
    expect(dbAlias.alias_email).toBe(data.alias.aliasEmail);
    expect(dbAlias.is_active).toBe(true);
  });

  it('should return existing alias when one exists', async () => {
    // Create existing alias
    const existingAliasEmail = 'u_existing@chiphi.oronculzac.com';
    const { data: existingAlias, error: createError } = await adminClient
      .from('inbox_aliases')
      .insert({
        org_id: testOrgId,
        alias_email: existingAliasEmail,
        is_active: true,
      })
      .select()
      .single();

    if (createError || !existingAlias) {
      throw new Error(`Failed to create existing alias: ${createError?.message}`);
    }

    testAliasId = existingAlias.id;

    // Mock the getUserSession function
    const mockGetUserSession = async () => ({
      user: {
        id: testUserId,
        email: `alias-test-${Date.now()}@example.com`,
        full_name: 'Test User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      org: {
        id: testOrgId,
        name: `Test Org ${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      role: 'owner' as const,
    });

    const { vi } = await import('vitest');
    vi.doMock('@/lib/database/utils', () => ({
      getUserSession: mockGetUserSession,
    }));

    const request = new NextRequest('http://localhost:3000/api/settings/alias');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.alias).toBeDefined();
    expect(data.alias.id).toBe(testAliasId);
    expect(data.alias.aliasEmail).toBe(existingAliasEmail);
    expect(data.alias.isActive).toBe(true);
  });

  it('should return 401 when no session exists', async () => {
    // Mock getUserSession to return null
    const { vi } = await import('vitest');
    vi.doMock('@/lib/database/utils', () => ({
      getUserSession: async () => null,
    }));

    const request = new NextRequest('http://localhost:3000/api/settings/alias');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should generate unique alias slugs', async () => {
    const aliases = new Set<string>();
    
    // Generate multiple aliases and check uniqueness
    for (let i = 0; i < 10; i++) {
      // Create a new org for each test to avoid conflicts
      const { data: org, error: orgError } = await adminClient
        .from('orgs')
        .insert({
          name: `Test Org Unique ${Date.now()}-${i}`,
        })
        .select()
        .single();

      if (orgError || !org) {
        throw new Error(`Failed to create test org: ${orgError?.message}`);
      }

      const orgId = org.id;

      // Add user to organization
      await adminClient
        .from('org_members')
        .insert({
          org_id: orgId,
          user_id: testUserId,
          role: 'owner',
        });

      // Mock getUserSession for this org
      const mockGetUserSession = async () => ({
        user: {
          id: testUserId,
          email: `alias-test-${Date.now()}@example.com`,
          full_name: 'Test User',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        org: {
          id: orgId,
          name: `Test Org Unique ${Date.now()}-${i}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        role: 'owner' as const,
      });

      const { vi } = await import('vitest');
      vi.doMock('@/lib/database/utils', () => ({
        getUserSession: mockGetUserSession,
      }));

      const request = new NextRequest('http://localhost:3000/api/settings/alias');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.alias.aliasEmail).toMatch(/^u_[a-z0-9]{8}@chiphi\.oronculzac\.com$/);
      
      aliases.add(data.alias.aliasEmail);

      // Clean up
      await adminClient.from('inbox_aliases').delete().eq('org_id', orgId);
      await adminClient.from('org_members').delete().eq('org_id', orgId);
      await adminClient.from('orgs').delete().eq('id', orgId);
    }

    // All aliases should be unique
    expect(aliases.size).toBe(10);
  });

  it('should handle database errors gracefully', async () => {
    // Mock getUserSession to return invalid org ID
    const mockGetUserSession = async () => ({
      user: {
        id: testUserId,
        email: `alias-test-${Date.now()}@example.com`,
        full_name: 'Test User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      org: {
        id: 'invalid-org-id',
        name: 'Invalid Org',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      role: 'owner' as const,
    });

    const { vi } = await import('vitest');
    vi.doMock('@/lib/database/utils', () => ({
      getUserSession: mockGetUserSession,
    }));

    const request = new NextRequest('http://localhost:3000/api/settings/alias');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to create email alias');
  });
});