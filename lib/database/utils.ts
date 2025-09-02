import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { UserSession, Org, User, OrgMember, InboxAlias } from '@/lib/types';

/**
 * Get user session with org information
 */
export async function getUserSession(): Promise<UserSession | null> {
  const supabase = createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return null;
  }

  // Get user profile and org membership
  const { data: userProfile, error: userError } = await supabase
    .from('users')
    .select(`
      *,
      org_members!inner (
        role,
        orgs!inner (*)
      )
    `)
    .eq('id', user.id)
    .single();

  if (userError || !userProfile) {
    return null;
  }

  const orgMember = userProfile.org_members[0];
  const org = orgMember.orgs;

  // Get inbox alias
  const { data: inboxAlias } = await supabase
    .from('inbox_aliases')
    .select('*')
    .eq('org_id', org.id)
    .eq('is_active', true)
    .single();

  return {
    user: userProfile,
    org,
    role: orgMember.role,
    inboxAlias: inboxAlias || undefined,
  };
}

/**
 * Create or update user profile and organization
 */
export async function createUserProfile(
  userId: string,
  email: string,
  fullName?: string
): Promise<string> {
  const supabase = createAdminClient();
  
  const { data: orgId, error } = await supabase.rpc('get_or_create_user_profile', {
    user_uuid: userId,
    user_email: email,
    user_name: fullName,
  });

  if (error) {
    throw new Error(`Failed to create user profile: ${error.message}`);
  }

  return orgId;
}

/**
 * Get organization by ID with member check
 */
export async function getOrganization(orgId: string, userId: string): Promise<Org | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('orgs')
    .select(`
      *,
      org_members!inner (
        role
      )
    `)
    .eq('id', orgId)
    .eq('org_members.user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Check if user has access to organization
 */
export async function hasOrgAccess(orgId: string, userId: string): Promise<boolean> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .single();

  return !error && !!data;
}

/**
 * Get inbox alias for organization
 */
export async function getInboxAlias(orgId: string): Promise<InboxAlias | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('inbox_aliases')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Generate new inbox alias for organization
 */
export async function generateInboxAlias(orgId: string): Promise<string> {
  const supabase = createAdminClient();
  
  const { data, error } = await supabase.rpc('generate_inbox_alias', {
    org_uuid: orgId,
  });

  if (error) {
    throw new Error(`Failed to generate inbox alias: ${error.message}`);
  }

  return data;
}

/**
 * Update merchant mapping
 */
export async function updateMerchantMapping(
  orgId: string,
  merchantName: string,
  category: string,
  subcategory?: string,
  userId?: string
): Promise<void> {
  const supabase = createAdminClient();
  
  const { error } = await supabase.rpc('update_merchant_mapping', {
    org_uuid: orgId,
    merchant_name_param: merchantName,
    category_param: category,
    subcategory_param: subcategory,
    user_uuid: userId,
  });

  if (error) {
    throw new Error(`Failed to update merchant mapping: ${error.message}`);
  }
}

/**
 * Log processing step
 */
export async function logProcessingStep(
  orgId: string,
  emailId: string,
  step: string,
  status: 'started' | 'completed' | 'failed',
  details?: any,
  errorMessage?: string,
  processingTime?: number
): Promise<void> {
  const supabase = createAdminClient();
  
  const { error } = await supabase.rpc('log_processing_step', {
    org_uuid: orgId,
    email_uuid: emailId,
    step_name: step,
    step_status: status,
    step_details: details,
    error_msg: errorMessage,
    processing_time: processingTime,
  });

  if (error) {
    console.error('Failed to log processing step:', error);
    // Don't throw error for logging failures
  }
}

/**
 * Check rate limit for organization
 */
export async function checkRateLimit(
  orgId: string,
  endpoint: string,
  maxRequests = 100,
  windowMinutes = 60
): Promise<boolean> {
  const supabase = createAdminClient();
  
  const { data, error } = await supabase.rpc('check_rate_limit', {
    org_uuid: orgId,
    endpoint_name: endpoint,
    max_requests: maxRequests,
    window_minutes: windowMinutes,
  });

  if (error) {
    console.error('Rate limit check failed:', error);
    return false; // Allow request if rate limit check fails
  }

  return data;
}