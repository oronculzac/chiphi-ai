-- Enable Row Level Security on all tables
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Organizations policies
CREATE POLICY "Users can view orgs they belong to"
ON orgs FOR SELECT
USING (id IN (
  SELECT org_id FROM org_members 
  WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update orgs they own"
ON orgs FOR UPDATE
USING (id IN (
  SELECT org_id FROM org_members 
  WHERE user_id = auth.uid() AND role = 'owner'
));

-- Users policies
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE
USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
ON users FOR INSERT
WITH CHECK (id = auth.uid());

-- Organization members policies
CREATE POLICY "Users can view org members for their orgs"
ON org_members FOR SELECT
USING (org_id IN (
  SELECT org_id FROM org_members 
  WHERE user_id = auth.uid()
));

CREATE POLICY "Org owners can manage members"
ON org_members FOR ALL
USING (org_id IN (
  SELECT org_id FROM org_members 
  WHERE user_id = auth.uid() AND role = 'owner'
));

-- Inbox aliases policies
CREATE POLICY "Users can access their org's inbox aliases"
ON inbox_aliases FOR ALL
USING (org_id IN (
  SELECT org_id FROM org_members 
  WHERE user_id = auth.uid()
));

-- Emails policies
CREATE POLICY "Users can access their org's emails"
ON emails FOR ALL
USING (org_id IN (
  SELECT org_id FROM org_members 
  WHERE user_id = auth.uid()
));

-- Transactions policies
CREATE POLICY "Users can access their org's transactions"
ON transactions FOR ALL
USING (org_id IN (
  SELECT org_id FROM org_members 
  WHERE user_id = auth.uid()
));

-- Merchant map policies
CREATE POLICY "Users can access their org's merchant mappings"
ON merchant_map FOR ALL
USING (org_id IN (
  SELECT org_id FROM org_members 
  WHERE user_id = auth.uid()
));

-- Processing logs policies
CREATE POLICY "Users can view their org's processing logs"
ON processing_logs FOR SELECT
USING (org_id IN (
  SELECT org_id FROM org_members 
  WHERE user_id = auth.uid()
));

CREATE POLICY "System can insert processing logs"
ON processing_logs FOR INSERT
WITH CHECK (true);

-- Rate limits policies
CREATE POLICY "Users can view their org's rate limits"
ON rate_limits FOR SELECT
USING (org_id IN (
  SELECT org_id FROM org_members 
  WHERE user_id = auth.uid()
));

CREATE POLICY "System can manage rate limits"
ON rate_limits FOR ALL
WITH CHECK (true);