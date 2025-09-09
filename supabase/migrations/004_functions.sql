-- Function to generate unique inbox alias
CREATE OR REPLACE FUNCTION generate_inbox_alias(org_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  alias_prefix TEXT;
  random_suffix TEXT;
  full_alias TEXT;
BEGIN
  -- Generate a random 8-character suffix
  random_suffix := lower(substring(gen_random_uuid()::text from 1 for 8));
  
  -- Create alias in format: receipts-{random}@yourdomain.com
  full_alias := 'receipts-' || random_suffix || '@kiro.oronculzac.com';
  
  -- Insert the alias
  INSERT INTO inbox_aliases (org_id, alias_email)
  VALUES (org_uuid, full_alias);
  
  RETURN full_alias;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get or create user profile
CREATE OR REPLACE FUNCTION get_or_create_user_profile(user_uuid UUID, user_email TEXT, user_name TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
  org_uuid UUID;
BEGIN
  -- Insert or update user profile
  INSERT INTO users (id, email, full_name)
  VALUES (user_uuid, user_email, user_name)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, users.full_name),
    updated_at = NOW();
  
  -- Check if user has an organization
  SELECT org_id INTO org_uuid
  FROM org_members
  WHERE user_id = user_uuid
  LIMIT 1;
  
  -- If no organization, create one
  IF org_uuid IS NULL THEN
    INSERT INTO orgs (name) VALUES (COALESCE(user_name, 'My Organization'))
    RETURNING id INTO org_uuid;
    
    -- Add user as owner
    INSERT INTO org_members (org_id, user_id, role)
    VALUES (org_uuid, user_uuid, 'owner');
    
    -- Generate inbox alias
    PERFORM generate_inbox_alias(org_uuid);
  END IF;
  
  RETURN org_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update merchant mapping
CREATE OR REPLACE FUNCTION update_merchant_mapping(
  org_uuid UUID,
  merchant_name_param TEXT,
  category_param TEXT,
  subcategory_param TEXT DEFAULT NULL,
  user_uuid UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO merchant_map (org_id, merchant_name, category, subcategory, created_by)
  VALUES (org_uuid, merchant_name_param, category_param, subcategory_param, user_uuid)
  ON CONFLICT (org_id, merchant_name) DO UPDATE SET
    category = EXCLUDED.category,
    subcategory = EXCLUDED.subcategory,
    created_by = EXCLUDED.created_by,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log processing steps
CREATE OR REPLACE FUNCTION log_processing_step(
  org_uuid UUID,
  email_uuid UUID,
  step_name TEXT,
  step_status TEXT,
  step_details JSONB DEFAULT NULL,
  error_msg TEXT DEFAULT NULL,
  processing_time INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO processing_logs (org_id, email_id, step, status, details, error_message, processing_time_ms)
  VALUES (org_uuid, email_uuid, step_name, step_status, step_details, error_msg, processing_time);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
  org_uuid UUID,
  endpoint_name TEXT,
  max_requests INTEGER DEFAULT 100,
  window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
  window_start_time TIMESTAMPTZ;
BEGIN
  -- Calculate window start time
  window_start_time := date_trunc('hour', NOW()) + 
    (EXTRACT(minute FROM NOW())::INTEGER / window_minutes) * (window_minutes || ' minutes')::INTERVAL;
  
  -- Get current count for this window
  SELECT COALESCE(requests_count, 0) INTO current_count
  FROM rate_limits
  WHERE org_id = org_uuid 
    AND endpoint = endpoint_name 
    AND window_start = window_start_time;
  
  -- If under limit, increment and allow
  IF current_count < max_requests THEN
    INSERT INTO rate_limits (org_id, endpoint, requests_count, window_start)
    VALUES (org_uuid, endpoint_name, 1, window_start_time)
    ON CONFLICT (org_id, endpoint, window_start) DO UPDATE SET
      requests_count = rate_limits.requests_count + 1,
      updated_at = NOW();
    
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
--
 Function to check if RLS is enabled on a table
CREATE OR REPLACE FUNCTION check_rls_enabled(table_name TEXT)
RETURNS BOOLEAN AS $
DECLARE
  rls_enabled BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class
  WHERE relname = table_name;
  
  RETURN COALESCE(rls_enabled, FALSE);
END;
$ LANGUAGE plpgsql SECURITY DEFINER;