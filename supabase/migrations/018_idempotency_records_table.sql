-- Create idempotency records table for email processing
-- This table ensures each (alias, messageId) combination is processed only once per organization

CREATE TABLE email_idempotency_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  message_id TEXT NOT NULL,
  email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
  raw_ref TEXT, -- S3 reference for audit trail (e.g., "chiphi-raw-emails/inbound/message.eml")
  provider TEXT NOT NULL CHECK (provider IN ('ses', 'cloudflare')),
  correlation_id UUID,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint for idempotency: one record per (org_id, alias, message_id)
  CONSTRAINT unique_org_alias_message UNIQUE (org_id, alias, message_id)
);

-- Indexes for performance
CREATE INDEX idx_email_idempotency_records_org_id ON email_idempotency_records(org_id);
CREATE INDEX idx_email_idempotency_records_alias ON email_idempotency_records(org_id, alias);
CREATE INDEX idx_email_idempotency_records_message_id ON email_idempotency_records(message_id);
CREATE INDEX idx_email_idempotency_records_processed_at ON email_idempotency_records(processed_at DESC);
CREATE INDEX idx_email_idempotency_records_correlation_id ON email_idempotency_records(correlation_id);
CREATE INDEX idx_email_idempotency_records_provider ON email_idempotency_records(provider, processed_at DESC);
CREATE INDEX idx_email_idempotency_records_raw_ref ON email_idempotency_records(raw_ref);

-- Enable Row Level Security
ALTER TABLE email_idempotency_records ENABLE ROW LEVEL SECURITY;

-- RLS policy for idempotency records
CREATE POLICY "Users can only access their org's idempotency records"
  ON email_idempotency_records
  FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM org_members 
      WHERE user_id = auth.uid()
    )
  );

-- Grant permissions
GRANT ALL ON email_idempotency_records TO authenticated;
GRANT ALL ON email_idempotency_records TO service_role;

-- Function to check idempotency and create record atomically
CREATE OR REPLACE FUNCTION check_and_create_idempotency_record(
  org_uuid UUID,
  alias_param TEXT,
  message_id_param TEXT,
  provider_param TEXT,
  raw_ref_param TEXT DEFAULT NULL,
  correlation_id_param UUID DEFAULT NULL
)
RETURNS TABLE (
  is_duplicate BOOLEAN,
  record_id UUID,
  existing_email_id UUID,
  existing_processed_at TIMESTAMPTZ
) AS $
DECLARE
  existing_record RECORD;
  new_record_id UUID;
BEGIN
  -- Check for existing record
  SELECT id, email_id, processed_at INTO existing_record
  FROM email_idempotency_records
  WHERE org_id = org_uuid 
    AND alias = alias_param 
    AND message_id = message_id_param;
  
  -- If record exists, return duplicate info
  IF existing_record.id IS NOT NULL THEN
    RETURN QUERY SELECT 
      TRUE as is_duplicate,
      existing_record.id as record_id,
      existing_record.email_id as existing_email_id,
      existing_record.processed_at as existing_processed_at;
    RETURN;
  END IF;
  
  -- Create new record
  INSERT INTO email_idempotency_records (
    org_id, alias, message_id, provider, raw_ref, correlation_id
  )
  VALUES (
    org_uuid, alias_param, message_id_param, provider_param, 
    raw_ref_param, correlation_id_param
  )
  RETURNING id INTO new_record_id;
  
  -- Return new record info
  RETURN QUERY SELECT 
    FALSE as is_duplicate,
    new_record_id as record_id,
    NULL::UUID as existing_email_id,
    NULL::TIMESTAMPTZ as existing_processed_at;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update idempotency record with email ID
CREATE OR REPLACE FUNCTION update_idempotency_record_email_id(
  record_uuid UUID,
  email_uuid UUID
)
RETURNS VOID AS $
BEGIN
  UPDATE email_idempotency_records 
  SET 
    email_id = email_uuid,
    updated_at = NOW()
  WHERE id = record_uuid;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get idempotency statistics
CREATE OR REPLACE FUNCTION get_idempotency_statistics(
  org_uuid UUID DEFAULT NULL,
  hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
  total_records BIGINT,
  provider_breakdown JSONB,
  recent_activity JSONB
) AS $
DECLARE
  cutoff_time TIMESTAMPTZ;
BEGIN
  cutoff_time := NOW() - (hours_back || ' hours')::INTERVAL;
  
  RETURN QUERY
  SELECT 
    COUNT(*) as total_records,
    jsonb_object_agg(
      provider, 
      jsonb_build_object(
        'count', provider_count,
        'percentage', ROUND((provider_count * 100.0 / COUNT(*) OVER()), 2)
      )
    ) as provider_breakdown,
    jsonb_build_object(
      'last_hour', COUNT(*) FILTER (WHERE processed_at >= NOW() - INTERVAL '1 hour'),
      'last_day', COUNT(*) FILTER (WHERE processed_at >= NOW() - INTERVAL '1 day'),
      'last_week', COUNT(*) FILTER (WHERE processed_at >= NOW() - INTERVAL '1 week')
    ) as recent_activity
  FROM (
    SELECT 
      provider,
      COUNT(*) as provider_count,
      processed_at
    FROM email_idempotency_records
    WHERE 
      (org_uuid IS NULL OR org_id = org_uuid)
      AND processed_at >= cutoff_time
    GROUP BY provider, processed_at
  ) provider_stats;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old idempotency records
CREATE OR REPLACE FUNCTION cleanup_old_idempotency_records(
  retention_days INTEGER DEFAULT 90
)
RETURNS INTEGER AS $
DECLARE
  deleted_count INTEGER;
  cutoff_date TIMESTAMPTZ;
BEGIN
  cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
  
  DELETE FROM email_idempotency_records
  WHERE created_at < cutoff_date;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get audit trail for a message
CREATE OR REPLACE FUNCTION get_message_audit_trail(
  org_uuid UUID,
  message_id_param TEXT
)
RETURNS TABLE (
  idempotency_record JSONB,
  processing_logs JSONB,
  raw_ref TEXT
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    to_jsonb(eir.*) as idempotency_record,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'step', pl.step,
          'status', pl.status,
          'timestamp', pl.created_at,
          'details', pl.details,
          'processing_time_ms', pl.processing_time_ms
        ) ORDER BY pl.created_at
      ) FILTER (WHERE pl.id IS NOT NULL),
      '[]'::jsonb
    ) as processing_logs,
    eir.raw_ref
  FROM email_idempotency_records eir
  LEFT JOIN processing_logs pl ON (
    pl.org_id = eir.org_id AND 
    (pl.email_id = eir.email_id OR pl.details->>'messageId' = eir.message_id)
  )
  WHERE eir.org_id = org_uuid AND eir.message_id = message_id_param
  GROUP BY eir.id, eir.raw_ref;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_idempotency_records_updated_at
  BEFORE UPDATE ON email_idempotency_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE email_idempotency_records IS 'Ensures each (alias, messageId) combination is processed only once per organization with S3 audit trail';
COMMENT ON COLUMN email_idempotency_records.raw_ref IS 'S3 reference for audit trail (e.g., chiphi-raw-emails/inbound/message.eml)';
COMMENT ON COLUMN email_idempotency_records.correlation_id IS 'Links related processing operations across the pipeline';
COMMENT ON CONSTRAINT unique_org_alias_message ON email_idempotency_records IS 'Enforces idempotency: one record per (org_id, alias, message_id)';
COMMENT ON FUNCTION check_and_create_idempotency_record IS 'Atomically checks for existing record and creates new one if not found';
COMMENT ON FUNCTION get_message_audit_trail IS 'Returns complete audit trail for a message including idempotency record and processing logs';