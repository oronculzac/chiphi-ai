import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

describe('/api/alias/verification-code Integration Tests', () => {
  let supabase: any;
  let serviceClient: any;
  let testOrgId: string;
  let testUserId: string;
  let authToken: string;

  beforeEach(async () => {
    supabase = await createClient();
    serviceClient = createServiceClient();

    // Create test organization
    const { data: org, error: orgError } = await serviceClient
      .from('orgs')
      .insert({
        name: 'Test Verification Org',
        slug: 'test-verification-org'
      })
      .select()
      .single();

    if (orgError) throw orgError;
    testOrgId = org.id;

    // Create test user
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email: 'verification-test@example.com',
      password: 'test-password-123',
      email_confirm: true
    });

    if (authError) throw authError;
    testUserId = authData.user.id;

    // Add user to organization
    const { error: memberError } = await serviceClient
      .from('org_members')
      .insert({
        org_id: testOrgId,
        user_id: testUserId,
        role: 'owner'
      });

    if (memberError) throw memberError;

    // Get auth token for API requests
    const { data: sessionData, error: sessionError } = await serviceClient.auth.admin.generateLink({
      type: 'magiclink',
      email: 'verification-test@example.com'
    });

    if (sessionError) throw sessionError;
    authToken = sessionData.properties?.access_token || '';
  });

  afterEach(async () => {
    // Clean up test data
    if (testOrgId) {
      await serviceClient
        .from('orgs')
        .delete()
        .eq('id', testOrgId);
    }

    if (testUserId) {
      await serviceClient.auth.admin.deleteUser(testUserId);
    }
  });

  it('should return null when no verification code exists', async () => {
    const response = await fetch('http://localhost:3000/api/alias/verification-code', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toEqual({
      code: null,
      timestamp: null
    });
  });

  it('should return verification code when one exists', async () => {
    const testCode = 'VERIFY123';

    // Store verification code using database function
    const { error: storeError } = await serviceClient
      .rpc('store_verification_code', {
        p_org_id: testOrgId,
        p_code: testCode,
        p_expires_minutes: 30
      });

    expect(storeError).toBeNull();

    const response = await fetch('http://localhost:3000/api/alias/verification-code', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.code).toBe(testCode);
    expect(data.timestamp).toBeTruthy();
    expect(new Date(data.timestamp)).toBeInstanceOf(Date);
  });

  it('should return latest verification code when multiple exist', async () => {
    const oldCode = 'VERIFY_OLD';
    const newCode = 'VERIFY_NEW';

    // Store first code
    await serviceClient
      .rpc('store_verification_code', {
        p_org_id: testOrgId,
        p_code: oldCode,
        p_expires_minutes: 30
      });

    // Wait a moment to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 100));

    // Store second code
    await serviceClient
      .rpc('store_verification_code', {
        p_org_id: testOrgId,
        p_code: newCode,
        p_expires_minutes: 30
      });

    const response = await fetch('http://localhost:3000/api/alias/verification-code', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.code).toBe(newCode); // Should return the latest code
  });

  it('should not return expired verification codes', async () => {
    const expiredCode = 'VERIFY_EXPIRED';

    // Store expired code (expires in 0 minutes, so immediately expired)
    await serviceClient
      .rpc('store_verification_code', {
        p_org_id: testOrgId,
        p_code: expiredCode,
        p_expires_minutes: 0
      });

    // Wait a moment to ensure expiration
    await new Promise(resolve => setTimeout(resolve, 100));

    const response = await fetch('http://localhost:3000/api/alias/verification-code', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.code).toBeNull(); // Expired code should not be returned
  });

  it('should return 401 for unauthenticated requests', async () => {
    const response = await fetch('http://localhost:3000/api/alias/verification-code', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(response.status).toBe(401);
    
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should enforce multi-tenant isolation', async () => {
    // Create another organization and user
    const { data: otherOrg, error: otherOrgError } = await serviceClient
      .from('orgs')
      .insert({
        name: 'Other Test Org',
        slug: 'other-test-org'
      })
      .select()
      .single();

    if (otherOrgError) throw otherOrgError;

    const { data: otherAuthData, error: otherAuthError } = await serviceClient.auth.admin.createUser({
      email: 'other-verification-test@example.com',
      password: 'test-password-123',
      email_confirm: true
    });

    if (otherAuthError) throw otherAuthError;

    // Add other user to other organization
    await serviceClient
      .from('org_members')
      .insert({
        org_id: otherOrg.id,
        user_id: otherAuthData.user.id,
        role: 'owner'
      });

    // Store verification code for the other organization
    await serviceClient
      .rpc('store_verification_code', {
        p_org_id: otherOrg.id,
        p_code: 'OTHER_ORG_CODE',
        p_expires_minutes: 30
      });

    // Store verification code for our test organization
    await serviceClient
      .rpc('store_verification_code', {
        p_org_id: testOrgId,
        p_code: 'OUR_ORG_CODE',
        p_expires_minutes: 30
      });

    // Request with our user's token should only see our org's code
    const response = await fetch('http://localhost:3000/api/alias/verification-code', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.code).toBe('OUR_ORG_CODE'); // Should only see our org's code

    // Clean up
    await serviceClient
      .from('orgs')
      .delete()
      .eq('id', otherOrg.id);
    
    await serviceClient.auth.admin.deleteUser(otherAuthData.user.id);
  });

  it('should handle database errors gracefully', async () => {
    // Create a user without organization membership to trigger error
    const { data: noOrgUser, error: noOrgUserError } = await serviceClient.auth.admin.createUser({
      email: 'no-org-user@example.com',
      password: 'test-password-123',
      email_confirm: true
    });

    if (noOrgUserError) throw noOrgUserError;

    const { data: noOrgSessionData, error: noOrgSessionError } = await serviceClient.auth.admin.generateLink({
      type: 'magiclink',
      email: 'no-org-user@example.com'
    });

    if (noOrgSessionError) throw noOrgSessionError;
    const noOrgAuthToken = noOrgSessionData.properties?.access_token || '';

    const response = await fetch('http://localhost:3000/api/alias/verification-code', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${noOrgAuthToken}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.status).toBe(401); // Should return unauthorized for user without org
    
    // Clean up
    await serviceClient.auth.admin.deleteUser(noOrgUser.id);
  });
});