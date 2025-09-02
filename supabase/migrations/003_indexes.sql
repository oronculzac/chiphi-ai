-- Performance indexes for common queries

-- Org members lookup (used in RLS policies)
CREATE INDEX idx_org_members_user_id ON org_members(user_id);
CREATE INDEX idx_org_members_org_id ON org_members(org_id);

-- Email processing
CREATE INDEX idx_emails_org_id ON emails(org_id);
CREATE INDEX idx_emails_message_id ON emails(message_id);
CREATE INDEX idx_emails_processed_at ON emails(processed_at);

-- Transaction queries
CREATE INDEX idx_transactions_org_id ON transactions(org_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_merchant ON transactions(merchant);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- Merchant mapping lookups
CREATE INDEX idx_merchant_map_org_merchant ON merchant_map(org_id, merchant_name);
CREATE INDEX idx_merchant_map_updated_at ON merchant_map(updated_at);

-- Processing logs for debugging
CREATE INDEX idx_processing_logs_email_id ON processing_logs(email_id);
CREATE INDEX idx_processing_logs_created_at ON processing_logs(created_at);

-- Rate limiting
CREATE INDEX idx_rate_limits_org_endpoint ON rate_limits(org_id, endpoint);
CREATE INDEX idx_rate_limits_window_start ON rate_limits(window_start);

-- Inbox aliases
CREATE INDEX idx_inbox_aliases_org_id ON inbox_aliases(org_id);
CREATE INDEX idx_inbox_aliases_email ON inbox_aliases(alias_email);