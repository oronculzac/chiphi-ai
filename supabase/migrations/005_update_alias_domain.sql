-- Update alias generation function to use kiro.oronculzac.com domain
CREATE OR REPLACE FUNCTION generate_inbox_alias(org_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  alias_prefix TEXT;
  random_suffix TEXT;
  full_alias TEXT;
BEGIN
  -- Generate a random 8-character suffix
  random_suffix := lower(substring(gen_random_uuid()::text from 1 for 8));
  
  -- Create alias in format: receipts-{random}@kiro.oronculzac.com
  full_alias := 'receipts-' || random_suffix || '@kiro.oronculzac.com';
  
  -- Insert the alias
  INSERT INTO inbox_aliases (org_id, alias_email)
  VALUES (org_uuid, full_alias);
  
  RETURN full_alias;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;