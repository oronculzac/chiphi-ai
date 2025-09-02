-- Create table for storing email content hashes for duplicate detection
CREATE TABLE email_content_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique hash per org
  UNIQUE(org_id, content_hash)
);

-- Create index for fast hash lookups
CREATE INDEX idx_email_content_hashes_org_hash ON email_content_hashes(org_id, content_hash);
CREATE INDEX idx_email_content_hashes_email_id ON email_content_hashes(email_id);
CREATE INDEX idx_email_content_hashes_created_at ON email_content_hashes(created_at);

-- Enable RLS
ALTER TABLE email_content_hashes ENABLE ROW LEVEL SECURITY;

-- RLS policy for email content hashes
CREATE POLICY "Users can only access their org's email content hashes"
ON email_content_hashes FOR ALL
USING (org_id IN (
  SELECT org_id FROM org_members 
  WHERE user_id = auth.uid()
));

-- Grant permissions
GRANT ALL ON email_content_hashes TO authenticated;
GRANT ALL ON email_content_hashes TO service_role;