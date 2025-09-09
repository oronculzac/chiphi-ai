-- Account and Data Deletion Functions
-- This migration adds functions for account deletion and selective data deletion

-- Function to delete entire organization account
CREATE OR REPLACE FUNCTION delete_organization_account(
  p_org_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $
DECLARE
  deleted_count INTEGER := 0;
  temp_count INTEGER;
BEGIN
  -- Check if user has permission to delete organization (must be owner)
  IF NOT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id 
      AND user_id = p_user_id 
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to delete organization account.';
  END IF;
  
  -- Check if organization exists
  IF NOT EXISTS (SELECT 1 FROM orgs WHERE id = p_org_id) THEN
    RAISE EXCEPTION 'Organization not found.';
  END IF;
  
  -- Delete all organization data in proper order (respecting foreign key constraints)
  
  -- Delete email content hashes
  DELETE FROM email_content_hashes 
  WHERE email_id IN (SELECT id FROM emails WHERE org_id = p_org_id);
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Delete email idempotency records
  DELETE FROM email_idempotency_records WHERE org_id = p_org_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Delete email verification codes
  DELETE FROM email_verification_codes WHERE org_id = p_org_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Delete notification preferences
  DELETE FROM notifications_prefs WHERE org_id = p_org_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Delete organization invitations
  DELETE FROM org_invitations WHERE org_id = p_org_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Delete processing logs
  DELETE FROM processing_logs WHERE org_id = p_org_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Delete error tracking
  DELETE FROM error_tracking WHERE org_id = p_org_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Delete performance metrics
  DELETE FROM performance_metrics WHERE org_id = p_org_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Delete AI usage logs
  DELETE FROM ai_usage_logs WHERE org_id = p_org_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Delete email provider logs
  DELETE FROM email_provider_logs WHERE org_id = p_org_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Delete rate limits
  DELETE FROM rate_limits WHERE org_id = p_org_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Delete merchant mappings
  DELETE FROM merchant_map WHERE org_id = p_org_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Delete transactions
  DELETE FROM transactions WHERE org_id = p_org_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Delete emails
  DELETE FROM emails WHERE org_id = p_org_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Delete inbox aliases
  DELETE FROM inbox_aliases WHERE org_id = p_org_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Delete organization members
  DELETE FROM org_members WHERE org_id = p_org_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Finally, delete the organization itself
  DELETE FROM orgs WHERE id = p_org_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  RETURN jsonb_build_object('deleted_count', deleted_count);
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete selective organization data
CREATE OR REPLACE FUNCTION delete_organization_data(
  p_org_id UUID,
  p_user_id UUID,
  p_data_types TEXT[]
)
RETURNS JSONB AS $
DECLARE
  deleted_count INTEGER := 0;
  temp_count INTEGER;
  data_type TEXT;
BEGIN
  -- Check if user has permission to delete organization data (admin or owner)
  IF NOT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id 
      AND user_id = p_user_id 
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to delete organization data.';
  END IF;
  
  -- Check if organization exists
  IF NOT EXISTS (SELECT 1 FROM orgs WHERE id = p_org_id) THEN
    RAISE EXCEPTION 'Organization not found.';
  END IF;
  
  -- Process each data type
  FOREACH data_type IN ARRAY p_data_types
  LOOP
    CASE data_type
      WHEN 'transactions' THEN
        -- Delete transactions and related data
        DELETE FROM email_content_hashes 
        WHERE email_id IN (
          SELECT e.id FROM emails e 
          JOIN transactions t ON e.id = t.email_id 
          WHERE e.org_id = p_org_id
        );
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        deleted_count := deleted_count + temp_count;
        
        DELETE FROM transactions WHERE org_id = p_org_id;
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        deleted_count := deleted_count + temp_count;
        
      WHEN 'emails' THEN
        -- Delete emails and related content hashes
        DELETE FROM email_content_hashes 
        WHERE email_id IN (SELECT id FROM emails WHERE org_id = p_org_id);
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        deleted_count := deleted_count + temp_count;
        
        DELETE FROM emails WHERE org_id = p_org_id;
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        deleted_count := deleted_count + temp_count;
        
      WHEN 'merchantMappings' THEN
        -- Delete merchant mappings
        DELETE FROM merchant_map WHERE org_id = p_org_id;
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        deleted_count := deleted_count + temp_count;
        
      WHEN 'processingLogs' THEN
        -- Delete processing logs and related monitoring data
        DELETE FROM processing_logs WHERE org_id = p_org_id;
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        deleted_count := deleted_count + temp_count;
        
        DELETE FROM error_tracking WHERE org_id = p_org_id;
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        deleted_count := deleted_count + temp_count;
        
        DELETE FROM performance_metrics WHERE org_id = p_org_id;
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        deleted_count := deleted_count + temp_count;
        
        DELETE FROM ai_usage_logs WHERE org_id = p_org_id;
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        deleted_count := deleted_count + temp_count;
        
        DELETE FROM email_provider_logs WHERE org_id = p_org_id;
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        deleted_count := deleted_count + temp_count;
        
      WHEN 'notifications' THEN
        -- Delete notification preferences
        DELETE FROM notifications_prefs WHERE org_id = p_org_id;
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        deleted_count := deleted_count + temp_count;
        
      ELSE
        RAISE EXCEPTION 'Invalid data type: %', data_type;
    END CASE;
  END LOOP;
  
  RETURN jsonb_build_object('deleted_count', deleted_count);
END;
$ LANGUAGE plpgsql SECURITY DEFINER;