-- Provider Tracking and Diagnostics Migration
-- This migration adds email provider tracking and diagnostic monitoring infrastructure

-- Email provider logs table for tracking provider-specific processing
CREATE TABLE email_provider_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL CHECK (provider_name IN ('cloudflare', 'ses')),
  message_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  processing_time_ms INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  correlation_id UUID,
  
  -- Unique constraint for message idempotency per organization
  CONSTRAINT unique_message_per_org UNIQUE (org_id, message_id)
);

-- Diagnostic checks table for system health monitoring
CREATE TABLE diagnostic_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type TEXT NOT NULL CHECK (check_type IN ('css_health', 'component_integrity', 'database_connectivity', 'provider_health', 'queue_health', 'storage_health')),
  check_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'warning')),
  details JSONB,
  execution_time_ms INTEGER,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX idx_email_provider_logs_org_id_processed_at ON email_provider_logs(org_id, processed_at DESC);
CREATE INDEX idx_email_provider_logs_provider_name_processed_at ON email_provider_logs(provider_name, processed_at DESC);
CREATE INDEX idx_email_provider_logs_success_processed_at ON email_provider_logs(success, processed_at DESC);
CREATE INDEX idx_email_provider_logs_correlation_id ON email_provider_logs(correlation_id);
CREATE INDEX idx_diagnostic_checks_type_checked_at ON diagnostic_checks(check_type, checked_at DESC);
CREATE INDEX idx_diagnostic_checks_status_checked_at ON diagnostic_checks(status, checked_at DESC);

-- Enable Row Level Security
ALTER TABLE email_provider_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_checks ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_provider_logs
CREATE POLICY "Users can only access their org's provider logs"
  ON email_provider_logs
  FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM org_members 
      WHERE user_id = auth.uid()
    )
  );

-- RLS policies for diagnostic_checks (admin access only)
CREATE POLICY "Only admins can access diagnostic checks"
  ON diagnostic_checks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

-- System can insert diagnostic checks
CREATE POLICY "System can insert diagnostic checks"
  ON diagnostic_checks
  FOR INSERT
  WITH CHECK (true);

-- Function to log provider processing with idempotency check
CREATE OR REPLACE FUNCTION log_provider_processing(
  org_uuid UUID,
  provider_name_param TEXT,
  message_id_param TEXT,
  payload_param JSONB,
  processing_time_ms_param INTEGER,
  success_param BOOLEAN,
  error_message_param TEXT DEFAULT NULL,
  correlation_id_param UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_uuid UUID;
  existing_log_uuid UUID;
BEGIN
  -- Check for existing log with same org_id and message_id
  SELECT id INTO existing_log_uuid
  FROM email_provider_logs
  WHERE org_id = org_uuid AND message_id = message_id_param;
  
  -- If already exists, return existing UUID (idempotency)
  IF existing_log_uuid IS NOT NULL THEN
    RETURN existing_log_uuid;
  END IF;
  
  -- Insert new log entry
  INSERT INTO email_provider_logs (
    org_id, provider_name, message_id, payload,
    processing_time_ms, success, error_message, correlation_id
  )
  VALUES (
    org_uuid, provider_name_param, message_id_param, payload_param,
    processing_time_ms_param, success_param, error_message_param, correlation_id_param
  )
  RETURNING id INTO log_uuid;
  
  RETURN log_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record diagnostic check results
CREATE OR REPLACE FUNCTION record_diagnostic_check(
  check_type_param TEXT,
  check_name_param TEXT,
  status_param TEXT,
  details_param JSONB DEFAULT NULL,
  execution_time_ms_param INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  check_uuid UUID;
BEGIN
  INSERT INTO diagnostic_checks (
    check_type, check_name, status, details, execution_time_ms
  )
  VALUES (
    check_type_param, check_name_param, status_param, 
    details_param, execution_time_ms_param
  )
  RETURNING id INTO check_uuid;
  
  RETURN check_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get provider processing statistics
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
BEGIN
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
    (org_uuid IS NULL OR epl.org_id = org_uuid)
    AND (provider_name_param IS NULL OR epl.provider_name = provider_name_param)
    AND epl.processed_at >= NOW() - (hours_back || ' hours')::INTERVAL
  GROUP BY epl.provider_name
  ORDER BY total_processed DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get diagnostic check summary
CREATE OR REPLACE FUNCTION get_diagnostic_summary(
  check_type_param TEXT DEFAULT NULL,
  hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
  check_type TEXT,
  check_name TEXT,
  latest_status TEXT,
  last_checked TIMESTAMPTZ,
  pass_count BIGINT,
  fail_count BIGINT,
  warning_count BIGINT,
  avg_execution_time_ms DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (dc.check_type, dc.check_name)
    dc.check_type,
    dc.check_name,
    dc.status as latest_status,
    dc.checked_at as last_checked,
    COUNT(*) FILTER (WHERE dc.status = 'pass') OVER (PARTITION BY dc.check_type, dc.check_name) as pass_count,
    COUNT(*) FILTER (WHERE dc.status = 'fail') OVER (PARTITION BY dc.check_type, dc.check_name) as fail_count,
    COUNT(*) FILTER (WHERE dc.status = 'warning') OVER (PARTITION BY dc.check_type, dc.check_name) as warning_count,
    AVG(dc.execution_time_ms) OVER (PARTITION BY dc.check_type, dc.check_name)::DECIMAL(10,2) as avg_execution_time_ms
  FROM diagnostic_checks dc
  WHERE 
    (check_type_param IS NULL OR dc.check_type = check_type_param)
    AND dc.checked_at >= NOW() - (hours_back || ' hours')::INTERVAL
  ORDER BY dc.check_type, dc.check_name, dc.checked_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check message idempotency
CREATE OR REPLACE FUNCTION check_message_idempotency(
  org_uuid UUID,
  message_id_param TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO existing_count
  FROM email_provider_logs
  WHERE org_id = org_uuid AND message_id = message_id_param;
  
  RETURN existing_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get provider error details for debugging
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
BEGIN
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
    AND (org_uuid IS NULL OR epl.org_id = org_uuid)
    AND (provider_name_param IS NULL OR epl.provider_name = provider_name_param)
    AND epl.processed_at >= NOW() - (hours_back || ' hours')::INTERVAL
  ORDER BY epl.processed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for provider monitoring dashboard
CREATE VIEW provider_monitoring_dashboard AS
SELECT 
  epl.id,
  epl.org_id,
  epl.provider_name,
  epl.message_id,
  epl.success,
  epl.processing_time_ms,
  epl.processed_at,
  epl.error_message,
  o.name as org_name,
  CASE 
    WHEN epl.processing_time_ms < 1000 THEN 'fast'
    WHEN epl.processing_time_ms < 5000 THEN 'normal'
    ELSE 'slow'
  END as performance_category
FROM email_provider_logs epl
JOIN orgs o ON epl.org_id = o.id
ORDER BY epl.processed_at DESC;

-- Grant access to the view
GRANT SELECT ON provider_monitoring_dashboard TO authenticated;

-- Create RLS policy for the view
CREATE POLICY "Users can only see their org's provider monitoring"
ON provider_monitoring_dashboard FOR SELECT
USING (org_id IN (
  SELECT org_id FROM org_members 
  WHERE user_id = auth.uid()
));

-- Create a view for diagnostic monitoring dashboard
CREATE VIEW diagnostic_monitoring_dashboard AS
SELECT 
  dc.id,
  dc.check_type,
  dc.check_name,
  dc.status,
  dc.execution_time_ms,
  dc.checked_at,
  dc.details,
  CASE 
    WHEN dc.status = 'pass' THEN 'success'
    WHEN dc.status = 'warning' THEN 'warning'
    ELSE 'error'
  END as status_category
FROM diagnostic_checks dc
ORDER BY dc.checked_at DESC;

-- Grant access to the view (admin only through RLS)
GRANT SELECT ON diagnostic_monitoring_dashboard TO authenticated;

-- Create RLS policy for the diagnostic view (admin only)
CREATE POLICY "Only admins can see diagnostic monitoring"
ON diagnostic_monitoring_dashboard FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
  )
);

-- Add correlation between provider logs and processing logs
ALTER TABLE processing_logs ADD COLUMN provider_log_id UUID REFERENCES email_provider_logs(id);
CREATE INDEX idx_processing_logs_provider_log_id ON processing_logs(provider_log_id);

-- Function to link provider logs with processing logs
CREATE OR REPLACE FUNCTION link_provider_processing_logs(
  provider_log_uuid UUID,
  correlation_id_param UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE processing_logs 
  SET provider_log_id = provider_log_uuid
  WHERE correlation_id = correlation_id_param
    AND provider_log_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE email_provider_logs IS 'Tracks email processing by different providers (Cloudflare, SES) with idempotency enforcement';
COMMENT ON TABLE diagnostic_checks IS 'System health and diagnostic check results for monitoring application stability';
COMMENT ON FUNCTION log_provider_processing IS 'Logs provider processing with automatic idempotency checking based on org_id and message_id';
COMMENT ON FUNCTION record_diagnostic_check IS 'Records diagnostic check results for system monitoring';
COMMENT ON FUNCTION check_message_idempotency IS 'Checks if a message has already been processed for an organization';
COMMENT ON CONSTRAINT unique_message_per_org ON email_provider_logs IS 'Ensures each message is processed only once per organization for idempotency';