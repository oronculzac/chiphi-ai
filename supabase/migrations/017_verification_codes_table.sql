-- Create verification codes table for Gmail setup wizard
-- This table stores verification codes extracted from Gmail forwarding emails

CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '10 minutes'),
  used_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT verification_codes_alias_check CHECK (alias ~ '^u_[a-zA-Z0-9_-]+@[a-zA-Z0-9.-]+$')
);

-- Create index for efficient alias and expiration queries
CREATE INDEX IF NOT EXISTS idx_verification_codes_alias_expires 
ON verification_codes (alias, expires_at) 
WHERE used_at IS NULL;

-- Create index for cleanup of expired codes
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires 
ON verification_codes (expires_at) 
WHERE used_at IS NULL;

-- Enable RLS
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- RLS policy: Allow access based on organization membership through alias
-- Extract org slug from alias and check membership
CREATE POLICY "Users can access verification codes for their org aliases"
  ON verification_codes
  FOR ALL
  USING (
    -- Extract org slug from alias (u_orgslug@domain)
    SUBSTRING(alias FROM '^u_([a-zA-Z0-9_-]+)@') IN (
      SELECT o.slug 
      FROM organizations o
      JOIN org_members om ON o.id = om.org_id
      WHERE om.user_id = auth.uid()
    )
  );

-- Function to automatically clean up expired verification codes
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM verification_codes 
  WHERE expires_at < NOW() 
    AND used_at IS NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Create a scheduled job to clean up expired codes (runs every 5 minutes)
-- Note: This requires pg_cron extension which may not be available in all environments
-- In production, this should be handled by a cron job or scheduled task
DO $$
BEGIN
  -- Only create cron job if pg_cron extension is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-expired-verification-codes',
      '*/5 * * * *', -- Every 5 minutes
      'SELECT cleanup_expired_verification_codes();'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors if pg_cron is not available
    NULL;
END;
$$;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON verification_codes TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_verification_codes() TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE verification_codes IS 'Stores Gmail verification codes for inbox alias setup wizard';
COMMENT ON COLUMN verification_codes.alias IS 'Email alias in format u_orgslug@domain';
COMMENT ON COLUMN verification_codes.code IS '6-7 digit verification code from Gmail';
COMMENT ON COLUMN verification_codes.expires_at IS 'Expiration time (default 10 minutes from creation)';
COMMENT ON COLUMN verification_codes.used_at IS 'Timestamp when code was used (NULL if unused)';