-- Settings MVP Database Schema
-- This migration adds the necessary tables and functions for the Settings MVP feature

-- Add logo_url column to existing orgs table
ALTER TABLE orgs ADD COLUMN logo_url TEXT;

-- Organization invitations tracking
CREATE TABLE org_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  token TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES users(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification preferences
CREATE TABLE notifications_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  receipt_processed BOOLEAN DEFAULT true,
  daily_summary BOOLEAN DEFAULT false,
  weekly_summary BOOLEAN DEFAULT false,
  summary_emails TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- Email verification codes (temporary storage)
CREATE TABLE email_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security on new tables
ALTER TABLE org_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for org_invitations
CREATE POLICY "Users can view invitations for their orgs"
ON org_invitations FOR SELECT
USING (org_id IN (
  SELECT org_id FROM org_members 
  WHERE user_id = auth.uid()
));

CREATE POLICY "Org admins and owners can manage invitations"
ON org_invitations FOR ALL
USING (org_id IN (
  SELECT org_id FROM org_members 
  WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
));

-- RLS Policies for notifications_prefs
CREATE POLICY "Users can view their own notification preferences"
ON notifications_prefs FOR SELECT
USING (user_id = auth.uid() AND org_id IN (
  SELECT org_id FROM org_members 
  WHERE user_id = auth.uid()
));

CREATE POLICY "Users can manage their own notification preferences"
ON notifications_prefs FOR ALL
USING (user_id = auth.uid() AND org_id IN (
  SELECT org_id FROM org_members 
  WHERE user_id = auth.uid()
));

-- RLS Policies for email_verification_codes
CREATE POLICY "Users can view verification codes for their orgs"
ON email_verification_codes FOR SELECT
USING (org_id IN (
  SELECT org_id FROM org_members 
  WHERE user_id = auth.uid()
));

CREATE POLICY "System can manage verification codes"
ON email_verification_codes FOR ALL
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_org_invitations_org_id ON org_invitations(org_id);
CREATE INDEX idx_org_invitations_email ON org_invitations(email);
CREATE INDEX idx_org_invitations_token ON org_invitations(token);
CREATE INDEX idx_org_invitations_expires_at ON org_invitations(expires_at);

CREATE INDEX idx_notifications_prefs_org_user ON notifications_prefs(org_id, user_id);

CREATE INDEX idx_email_verification_codes_org_id ON email_verification_codes(org_id);
CREATE INDEX idx_email_verification_codes_expires_at ON email_verification_codes(expires_at);

-- Function to invite a member to an organization
CREATE OR REPLACE FUNCTION invite_org_member(
  p_org_id UUID,
  p_email TEXT,
  p_role TEXT,
  p_invited_by UUID,
  p_expires_hours INTEGER DEFAULT 168 -- 7 days default
)
RETURNS UUID AS $$
DECLARE
  invitation_token TEXT;
  invitation_id UUID;
BEGIN
  -- Validate role
  IF p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role. Must be admin or member.';
  END IF;
  
  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM org_members om
    JOIN users u ON om.user_id = u.id
    WHERE om.org_id = p_org_id AND u.email = p_email
  ) THEN
    RAISE EXCEPTION 'User is already a member of this organization.';
  END IF;
  
  -- Check if there's already a pending invitation
  IF EXISTS (
    SELECT 1 FROM org_invitations
    WHERE org_id = p_org_id 
      AND email = p_email 
      AND accepted_at IS NULL 
      AND expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'There is already a pending invitation for this email.';
  END IF;
  
  -- Generate invitation token
  invitation_token := encode(gen_random_bytes(32), 'hex');
  
  -- Insert invitation
  INSERT INTO org_invitations (
    org_id, 
    email, 
    role, 
    token, 
    invited_by, 
    expires_at
  )
  VALUES (
    p_org_id,
    p_email,
    p_role,
    invitation_token,
    p_invited_by,
    NOW() + (p_expires_hours || ' hours')::INTERVAL
  )
  RETURNING id INTO invitation_id;
  
  RETURN invitation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept an organization invitation
CREATE OR REPLACE FUNCTION accept_org_invitation(
  p_token TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  invitation_record RECORD;
  user_email TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM users WHERE id = p_user_id;
  
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'User not found.';
  END IF;
  
  -- Get invitation details
  SELECT * INTO invitation_record
  FROM org_invitations
  WHERE token = p_token
    AND email = user_email
    AND accepted_at IS NULL
    AND expires_at > NOW();
  
  IF invitation_record IS NULL THEN
    RETURN FALSE; -- Invalid or expired invitation
  END IF;
  
  -- Add user to organization
  INSERT INTO org_members (org_id, user_id, role)
  VALUES (invitation_record.org_id, p_user_id, invitation_record.role)
  ON CONFLICT (org_id, user_id) DO UPDATE SET
    role = EXCLUDED.role;
  
  -- Mark invitation as accepted
  UPDATE org_invitations
  SET accepted_at = NOW(), updated_at = NOW()
  WHERE id = invitation_record.id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update member role
CREATE OR REPLACE FUNCTION update_member_role(
  p_org_id UUID,
  p_user_id UUID,
  p_new_role TEXT,
  p_updated_by UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Validate role
  IF p_new_role NOT IN ('owner', 'admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role. Must be owner, admin, or member.';
  END IF;
  
  -- Check if the user making the change has permission
  IF NOT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id 
      AND user_id = p_updated_by 
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to update member role.';
  END IF;
  
  -- Prevent removing the last owner
  IF p_new_role != 'owner' AND EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id AND user_id = p_user_id AND role = 'owner'
  ) THEN
    IF (SELECT COUNT(*) FROM org_members WHERE org_id = p_org_id AND role = 'owner') = 1 THEN
      RAISE EXCEPTION 'Cannot remove the last owner from the organization.';
    END IF;
  END IF;
  
  -- Update the role
  UPDATE org_members
  SET role = p_new_role
  WHERE org_id = p_org_id AND user_id = p_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove member from organization
CREATE OR REPLACE FUNCTION remove_org_member(
  p_org_id UUID,
  p_user_id UUID,
  p_removed_by UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if the user making the change has permission
  IF NOT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id 
      AND user_id = p_removed_by 
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to remove member.';
  END IF;
  
  -- Prevent removing the last owner
  IF EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id AND user_id = p_user_id AND role = 'owner'
  ) THEN
    IF (SELECT COUNT(*) FROM org_members WHERE org_id = p_org_id AND role = 'owner') = 1 THEN
      RAISE EXCEPTION 'Cannot remove the last owner from the organization.';
    END IF;
  END IF;
  
  -- Remove the member
  DELETE FROM org_members
  WHERE org_id = p_org_id AND user_id = p_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get or create notification preferences
CREATE OR REPLACE FUNCTION get_or_create_notification_prefs(
  p_org_id UUID,
  p_user_id UUID
)
RETURNS notifications_prefs AS $$
DECLARE
  prefs_record notifications_prefs;
BEGIN
  -- Try to get existing preferences
  SELECT * INTO prefs_record
  FROM notifications_prefs
  WHERE org_id = p_org_id AND user_id = p_user_id;
  
  -- If not found, create default preferences
  IF prefs_record IS NULL THEN
    INSERT INTO notifications_prefs (org_id, user_id)
    VALUES (p_org_id, p_user_id)
    RETURNING * INTO prefs_record;
  END IF;
  
  RETURN prefs_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update notification preferences
CREATE OR REPLACE FUNCTION update_notification_prefs(
  p_org_id UUID,
  p_user_id UUID,
  p_receipt_processed BOOLEAN DEFAULT NULL,
  p_daily_summary BOOLEAN DEFAULT NULL,
  p_weekly_summary BOOLEAN DEFAULT NULL,
  p_summary_emails TEXT[] DEFAULT NULL
)
RETURNS notifications_prefs AS $$
DECLARE
  prefs_record notifications_prefs;
BEGIN
  -- Ensure preferences exist
  SELECT * INTO prefs_record FROM get_or_create_notification_prefs(p_org_id, p_user_id);
  
  -- Update preferences
  UPDATE notifications_prefs
  SET 
    receipt_processed = COALESCE(p_receipt_processed, receipt_processed),
    daily_summary = COALESCE(p_daily_summary, daily_summary),
    weekly_summary = COALESCE(p_weekly_summary, weekly_summary),
    summary_emails = COALESCE(p_summary_emails, summary_emails),
    updated_at = NOW()
  WHERE org_id = p_org_id AND user_id = p_user_id
  RETURNING * INTO prefs_record;
  
  RETURN prefs_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to store email verification code
CREATE OR REPLACE FUNCTION store_verification_code(
  p_org_id UUID,
  p_code TEXT,
  p_expires_minutes INTEGER DEFAULT 30
)
RETURNS UUID AS $$
DECLARE
  code_id UUID;
BEGIN
  -- Clean up expired codes first
  DELETE FROM email_verification_codes
  WHERE expires_at < NOW();
  
  -- Insert new verification code
  INSERT INTO email_verification_codes (
    org_id,
    code,
    expires_at
  )
  VALUES (
    p_org_id,
    p_code,
    NOW() + (p_expires_minutes || ' minutes')::INTERVAL
  )
  RETURNING id INTO code_id;
  
  RETURN code_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get latest verification code for an organization
CREATE OR REPLACE FUNCTION get_latest_verification_code(
  p_org_id UUID
)
RETURNS TEXT AS $$
DECLARE
  verification_code TEXT;
BEGIN
  -- Clean up expired codes first
  DELETE FROM email_verification_codes
  WHERE expires_at < NOW();
  
  -- Get the latest non-expired code
  SELECT code INTO verification_code
  FROM email_verification_codes
  WHERE org_id = p_org_id AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN verification_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update organization info
CREATE OR REPLACE FUNCTION update_organization_info(
  p_org_id UUID,
  p_name TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_updated_by UUID DEFAULT NULL
)
RETURNS orgs AS $$
DECLARE
  org_record orgs;
BEGIN
  -- Check if user has permission to update organization
  IF p_updated_by IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id 
      AND user_id = p_updated_by 
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to update organization.';
  END IF;
  
  -- Update organization
  UPDATE orgs
  SET 
    name = COALESCE(p_name, name),
    logo_url = COALESCE(p_logo_url, logo_url),
    updated_at = NOW()
  WHERE id = p_org_id
  RETURNING * INTO org_record;
  
  IF org_record IS NULL THEN
    RAISE EXCEPTION 'Organization not found.';
  END IF;
  
  RETURN org_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;