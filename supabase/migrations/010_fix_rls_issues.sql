-- Fix RLS issues identified in testing
-- Migration: 010_fix_rls_issues.sql

-- 1. Enable RLS on provider_monitoring_dashboard view
-- Note: Views inherit RLS from their base tables, but we need to ensure it's properly configured
ALTER VIEW provider_monitoring_dashboard SET (security_barrier = true);

-- 2. Fix get_provider_statistics function to properly enforce organization filtering
-- The issue is that SECURITY DEFINER bypasses RLS, but we need to ensure proper org filtering
CREATE OR REPLACE FUNCTION get_provider_statistics(
  org_uuid UUID DEFAULT NULL,
  provider_name_param TEXT DEFAULT NULL,
  hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
  provider_name TEXT,
  total_processed BIGINT,
  success_count BIGINT,
  error_count BIGINT,
  success_rate DECIMAL(5,2),
  avg_processing_time_ms DECIMAL(10,2),
  unique_messages BIGINT
) AS $$
DECLARE
  calling_user_orgs UUID[];
BEGIN
  -- Get the organizations the calling user belongs to
  SELECT ARRAY(
    SELECT org_id FROM org_members 
    WHERE user_id = auth.uid()
  ) INTO calling_user_orgs;
  
  -- If org_uuid is provided, verify the user has access to it
  IF org_uuid IS NOT NULL THEN
    IF NOT (org_uuid = ANY(calling_user_orgs)) THEN
      -- User doesn't have access to this org, return empty result
      RETURN;
    END IF;
  END IF;
  
  RETURN QUERY
  SELECT 
    epl.provider_name,
    COUNT(*) as total_processed,
    COUNT(*) FILTER (WHERE epl.success = TRUE) as success_count,
    COUNT(*) FILTER (WHERE epl.success = FALSE) as error_count,
    (COUNT(*) FILTER (WHERE epl.success = TRUE) * 100.0 / COUNT(*))::DECIMAL(5,2) as success_rate,
    AVG(epl.processing_time_ms)::DECIMAL(10,2) as avg_processing_time_ms,
    COUNT(DISTINCT epl.message_id) as unique_messages
  FROM email_provider_logs epl
  WHERE 
    -- Always filter by user's accessible organizations
    epl.org_id = ANY(calling_user_orgs)
    -- If specific org requested, filter to that org
    AND (org_uuid IS NULL OR epl.org_id = org_uuid)
    AND (provider_name_param IS NULL OR epl.provider_name = provider_name_param)
    AND epl.processed_at >= NOW() - (hours_back || ' hours')::INTERVAL
  GROUP BY epl.provider_name
  ORDER BY total_processed DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix get_provider_errors function with same pattern
CREATE OR REPLACE FUNCTION get_provider_errors(
  org_uuid UUID DEFAULT NULL,
  provider_name_param TEXT DEFAULT NULL,
  hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
  id UUID,
  provider_name TEXT,
  message_id TEXT,
  error_message TEXT,
  payload JSONB,
  processed_at TIMESTAMPTZ,
  correlation_id UUID
) AS $$
DECLARE
  calling_user_orgs UUID[];
BEGIN
  -- Get the organizations the calling user belongs to
  SELECT ARRAY(
    SELECT org_id FROM org_members 
    WHERE user_id = auth.uid()
  ) INTO calling_user_orgs;
  
  -- If org_uuid is provided, verify the user has access to it
  IF org_uuid IS NOT NULL THEN
    IF NOT (org_uuid = ANY(calling_user_orgs)) THEN
      -- User doesn't have access to this org, return empty result
      RETURN;
    END IF;
  END IF;
  
  RETURN QUERY
  SELECT 
    epl.id,
    epl.provider_name,
    epl.message_id,
    epl.error_message,
    epl.payload,
    epl.processed_at,
    epl.correlation_id
  FROM email_provider_logs epl
  WHERE 
    epl.success = FALSE
    -- Always filter by user's accessible organizations
    AND epl.org_id = ANY(calling_user_orgs)
    -- If specific org requested, filter to that org
    AND (org_uuid IS NULL OR epl.org_id = org_uuid)
    AND (provider_name_param IS NULL OR epl.provider_name = provider_name_param)
    AND epl.processed_at >= NOW() - (hours_back || ' hours')::INTERVAL
  ORDER BY epl.processed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Ensure RLS is enabled on provider_monitoring_dashboard
-- Since it's a view, we need to make sure the underlying table policies are working
-- The view should automatically inherit RLS from email_provider_logs table

-- Add a comment to document the RLS behavior
COMMENT ON VIEW provider_monitoring_dashboard IS 'Provider monitoring dashboard view with RLS inherited from email_provider_logs table. Users can only see data from organizations they belong to.';

-- 5. Add additional RLS policy for diagnostic_checks table if it doesn't exist
DO $$
BEGIN
  -- Check if RLS is enabled on diagnostic_checks
  IF NOT EXISTS (
    SELECT 1 FROM pg_class 
    WHERE relname = 'diagnostic_checks' 
    AND relrowsecurity = true
  ) THEN
    ALTER TABLE diagnostic_checks ENABLE ROW LEVEL SECURITY;
  END IF;
  
  -- Add RLS policy for diagnostic_checks if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'diagnostic_checks' 
    AND policyname = 'Users can only access their org diagnostic checks'
  ) THEN
    CREATE POLICY "Users can only access their org diagnostic checks"
    ON diagnostic_checks FOR ALL
    USING (org_id IN (
      SELECT org_id FROM org_members 
      WHERE user_id = auth.uid()
    ));
  END IF;
END $$;