-- Enhance processing logs table with audit trail fields
-- This migration adds raw_ref and message_id fields for S3 audit trail and correlation

-- Add raw_ref field for S3 audit trail
ALTER TABLE processing_logs ADD COLUMN raw_ref TEXT;

-- Add message_id field for correlation with email messages
ALTER TABLE processing_logs ADD COLUMN message_id TEXT;

-- Create indexes for efficient correlation ID and rawRef lookups
CREATE INDEX IF NOT EXISTS idx_processing_logs_raw_ref ON processing_logs(raw_ref) WHERE raw_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_processing_logs_message_id ON processing_logs(message_id) WHERE message_id IS NOT NULL;

-- Create composite index for efficient audit trail queries
CREATE INDEX IF NOT EXISTS idx_processing_logs_org_message_id ON processing_logs(org_id, message_id) WHERE message_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN processing_logs.raw_ref IS 'S3 reference for audit trail (e.g., chiphi-raw-emails/inbound/message.eml)';
COMMENT ON COLUMN processing_logs.message_id IS 'Email message ID for correlation with idempotency records';

-- Update the log_processing_step function to accept raw_ref and message_id parameters
CREATE OR REPLACE FUNCTION log_processing_step(
  org_uuid UUID,
  email_uuid UUID,
  step_name TEXT,
  step_status TEXT,
  step_details JSONB DEFAULT NULL,
  error_msg TEXT DEFAULT NULL,
  processing_time INTEGER DEFAULT NULL,
  correlation_id_param UUID DEFAULT NULL,
  raw_ref_param TEXT DEFAULT NULL,
  message_id_param TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO processing_logs (
    org_id, 
    email_id, 
    step, 
    status, 
    details, 
    error_message, 
    processing_time_ms,
    correlation_id,
    raw_ref,
    message_id
  )
  VALUES (
    org_uuid, 
    email_uuid, 
    step_name, 
    step_status, 
    step_details, 
    error_msg, 
    processing_time,
    correlation_id_param,
    raw_ref_param,
    message_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get processing logs with audit trail
CREATE OR REPLACE FUNCTION get_processing_logs_with_audit(
  org_uuid UUID,
  message_id_param TEXT DEFAULT NULL,
  raw_ref_param TEXT DEFAULT NULL,
  limit_param INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  email_id UUID,
  step TEXT,
  status TEXT,
  details JSONB,
  error_message TEXT,
  processing_time_ms INTEGER,
  correlation_id UUID,
  raw_ref TEXT,
  message_id TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pl.id,
    pl.email_id,
    pl.step,
    pl.status,
    pl.details,
    pl.error_message,
    pl.processing_time_ms,
    pl.correlation_id,
    pl.raw_ref,
    pl.message_id,
    pl.created_at
  FROM processing_logs pl
  WHERE pl.org_id = org_uuid
    AND (message_id_param IS NULL OR pl.message_id = message_id_param)
    AND (raw_ref_param IS NULL OR pl.raw_ref = raw_ref_param)
  ORDER BY pl.created_at DESC
  LIMIT limit_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION log_processing_step TO authenticated;
GRANT EXECUTE ON FUNCTION get_processing_logs_with_audit TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION log_processing_step IS 'Enhanced logging function with audit trail support (raw_ref and message_id)';
COMMENT ON FUNCTION get_processing_logs_with_audit IS 'Retrieves processing logs with audit trail filtering by message_id or raw_ref';