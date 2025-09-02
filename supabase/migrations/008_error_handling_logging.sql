-- Error Handling and Logging Enhancement Migration
-- This migration adds comprehensive error handling, logging, and notification infrastructure

-- User notifications table
CREATE TABLE user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('processing_error', 'processing_complete', 'system_maintenance')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin notifications table
CREATE TABLE admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('security_alert', 'system_alert', 'performance_alert')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Error tracking table for detailed error analysis
CREATE TABLE error_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_details JSONB,
  stack_trace TEXT,
  step TEXT NOT NULL,
  retryable BOOLEAN DEFAULT FALSE,
  retry_count INTEGER DEFAULT 0,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance metrics table for monitoring
CREATE TABLE performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('processing_time', 'ai_cost', 'api_latency', 'error_rate')),
  metric_value DECIMAL(10,4) NOT NULL,
  metric_unit TEXT NOT NULL,
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI usage tracking for cost monitoring
CREATE TABLE ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL CHECK (service_type IN ('language_detection', 'translation', 'data_extraction')),
  model_name TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd DECIMAL(10,6),
  processing_time_ms INTEGER,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System health monitoring table
CREATE TABLE system_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value DECIMAL(10,4) NOT NULL,
  metric_unit TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'critical')),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_notifications_user_id_created_at ON user_notifications(user_id, created_at DESC);
CREATE INDEX idx_user_notifications_read ON user_notifications(user_id, read, created_at DESC);
CREATE INDEX idx_admin_notifications_severity_created_at ON admin_notifications(severity, created_at DESC);
CREATE INDEX idx_admin_notifications_acknowledged ON admin_notifications(acknowledged, created_at DESC);
CREATE INDEX idx_error_tracking_org_created_at ON error_tracking(org_id, created_at DESC);
CREATE INDEX idx_error_tracking_resolved ON error_tracking(resolved, created_at DESC);
CREATE INDEX idx_performance_metrics_org_type_created_at ON performance_metrics(org_id, metric_type, created_at DESC);
CREATE INDEX idx_ai_usage_logs_org_created_at ON ai_usage_logs(org_id, created_at DESC);
CREATE INDEX idx_system_health_created_at ON system_health(created_at DESC);

-- Enhanced processing logs with error correlation
ALTER TABLE processing_logs ADD COLUMN error_id UUID REFERENCES error_tracking(id);
ALTER TABLE processing_logs ADD COLUMN correlation_id UUID;
CREATE INDEX idx_processing_logs_correlation_id ON processing_logs(correlation_id);
CREATE INDEX idx_processing_logs_error_id ON processing_logs(error_id);

-- Function to log AI usage and costs
CREATE OR REPLACE FUNCTION log_ai_usage(
  org_uuid UUID,
  email_uuid UUID,
  service_type_param TEXT,
  model_name_param TEXT,
  input_tokens_param INTEGER,
  output_tokens_param INTEGER,
  cost_usd_param DECIMAL(10,6),
  processing_time_ms_param INTEGER,
  success_param BOOLEAN DEFAULT TRUE,
  error_message_param TEXT DEFAULT NULL
)
RETURNS VOID AS $
BEGIN
  INSERT INTO ai_usage_logs (
    org_id, email_id, service_type, model_name, 
    input_tokens, output_tokens, cost_usd, 
    processing_time_ms, success, error_message
  )
  VALUES (
    org_uuid, email_uuid, service_type_param, model_name_param,
    input_tokens_param, output_tokens_param, cost_usd_param,
    processing_time_ms_param, success_param, error_message_param
  );
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track errors with correlation
CREATE OR REPLACE FUNCTION track_error(
  org_uuid UUID,
  email_uuid UUID,
  error_type_param TEXT,
  error_message_param TEXT,
  error_details_param JSONB,
  stack_trace_param TEXT,
  step_param TEXT,
  retryable_param BOOLEAN DEFAULT FALSE,
  correlation_id_param UUID DEFAULT NULL
)
RETURNS UUID AS $
DECLARE
  error_uuid UUID;
BEGIN
  INSERT INTO error_tracking (
    org_id, email_id, error_type, error_message, 
    error_details, stack_trace, step, retryable
  )
  VALUES (
    org_uuid, email_uuid, error_type_param, error_message_param,
    error_details_param, stack_trace_param, step_param, retryable_param
  )
  RETURNING id INTO error_uuid;
  
  -- Update processing log with error correlation if correlation_id provided
  IF correlation_id_param IS NOT NULL THEN
    UPDATE processing_logs 
    SET error_id = error_uuid, correlation_id = correlation_id_param
    WHERE org_id = org_uuid AND email_id = email_uuid 
      AND created_at >= NOW() - INTERVAL '1 hour'
      AND correlation_id IS NULL;
  END IF;
  
  RETURN error_uuid;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record performance metrics
CREATE OR REPLACE FUNCTION record_performance_metric(
  org_uuid UUID,
  metric_type_param TEXT,
  metric_value_param DECIMAL(10,4),
  metric_unit_param TEXT,
  context_param JSONB DEFAULT NULL
)
RETURNS VOID AS $
BEGIN
  INSERT INTO performance_metrics (org_id, metric_type, metric_value, metric_unit, context)
  VALUES (org_uuid, metric_type_param, metric_value_param, metric_unit_param, context_param);
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update system health metrics
CREATE OR REPLACE FUNCTION update_system_health(
  metric_name_param TEXT,
  metric_value_param DECIMAL(10,4),
  metric_unit_param TEXT,
  status_param TEXT,
  details_param JSONB DEFAULT NULL
)
RETURNS VOID AS $
BEGIN
  INSERT INTO system_health (metric_name, metric_value, metric_unit, status, details)
  VALUES (metric_name_param, metric_value_param, metric_unit_param, status_param, details_param);
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get error statistics for monitoring
CREATE OR REPLACE FUNCTION get_error_statistics(
  org_uuid UUID DEFAULT NULL,
  hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
  error_type TEXT,
  error_count BIGINT,
  retry_count_avg DECIMAL(10,2),
  resolved_count BIGINT,
  resolution_rate DECIMAL(5,2)
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    et.error_type,
    COUNT(*) as error_count,
    AVG(et.retry_count)::DECIMAL(10,2) as retry_count_avg,
    COUNT(*) FILTER (WHERE et.resolved = TRUE) as resolved_count,
    (COUNT(*) FILTER (WHERE et.resolved = TRUE) * 100.0 / COUNT(*))::DECIMAL(5,2) as resolution_rate
  FROM error_tracking et
  WHERE 
    (org_uuid IS NULL OR et.org_id = org_uuid)
    AND et.created_at >= NOW() - (hours_back || ' hours')::INTERVAL
  GROUP BY et.error_type
  ORDER BY error_count DESC;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get AI usage costs by organization
CREATE OR REPLACE FUNCTION get_ai_usage_costs(
  org_uuid UUID,
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  service_type TEXT,
  total_cost_usd DECIMAL(10,6),
  total_tokens BIGINT,
  request_count BIGINT,
  avg_cost_per_request DECIMAL(10,6),
  success_rate DECIMAL(5,2)
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    aul.service_type,
    SUM(aul.cost_usd) as total_cost_usd,
    SUM(aul.input_tokens + aul.output_tokens) as total_tokens,
    COUNT(*) as request_count,
    AVG(aul.cost_usd) as avg_cost_per_request,
    (COUNT(*) FILTER (WHERE aul.success = TRUE) * 100.0 / COUNT(*))::DECIMAL(5,2) as success_rate
  FROM ai_usage_logs aul
  WHERE 
    aul.org_id = org_uuid
    AND aul.created_at >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY aul.service_type
  ORDER BY total_cost_usd DESC;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get system health summary
CREATE OR REPLACE FUNCTION get_system_health_summary()
RETURNS TABLE (
  metric_name TEXT,
  current_value DECIMAL(10,4),
  metric_unit TEXT,
  status TEXT,
  last_updated TIMESTAMPTZ
) AS $
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (sh.metric_name)
    sh.metric_name,
    sh.metric_value as current_value,
    sh.metric_unit,
    sh.status,
    sh.created_at as last_updated
  FROM system_health sh
  ORDER BY sh.metric_name, sh.created_at DESC;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS policies for new tables
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;

-- User notifications RLS
CREATE POLICY "Users can only access their own notifications"
ON user_notifications FOR ALL
USING (user_id = auth.uid());

-- Admin notifications RLS (only for admin users)
CREATE POLICY "Only admins can access admin notifications"
ON admin_notifications FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
  )
);

-- Error tracking RLS
CREATE POLICY "Users can only access their org's error tracking"
ON error_tracking FOR ALL
USING (org_id IN (
  SELECT org_id FROM org_members 
  WHERE user_id = auth.uid()
));

-- Performance metrics RLS
CREATE POLICY "Users can only access their org's performance metrics"
ON performance_metrics FOR ALL
USING (org_id IN (
  SELECT org_id FROM org_members 
  WHERE user_id = auth.uid()
));

-- AI usage logs RLS
CREATE POLICY "Users can only access their org's AI usage logs"
ON ai_usage_logs FOR ALL
USING (org_id IN (
  SELECT org_id FROM org_members 
  WHERE user_id = auth.uid()
));

-- System health RLS (only for admin users)
CREATE POLICY "Only admins can access system health"
ON system_health FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
  )
);

-- Create a view for error dashboard
CREATE VIEW error_dashboard AS
SELECT 
  et.id,
  et.org_id,
  et.error_type,
  et.error_message,
  et.step,
  et.retryable,
  et.retry_count,
  et.resolved,
  et.created_at,
  o.name as org_name,
  COUNT(pl.id) as related_logs_count
FROM error_tracking et
JOIN orgs o ON et.org_id = o.id
LEFT JOIN processing_logs pl ON et.id = pl.error_id
GROUP BY et.id, o.name
ORDER BY et.created_at DESC;

-- Grant access to the view
GRANT SELECT ON error_dashboard TO authenticated;

-- Create RLS policy for the view
CREATE POLICY "Users can only see their org's errors in dashboard"
ON error_dashboard FOR SELECT
USING (org_id IN (
  SELECT org_id FROM org_members 
  WHERE user_id = auth.uid()
));