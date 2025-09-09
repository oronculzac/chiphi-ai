-- Provider Performance Logs Table
-- This table tracks provider performance metrics for monitoring and optimization

CREATE TABLE provider_performance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('ses', 'cloudflare')),
  operation TEXT NOT NULL CHECK (operation IN ('verify', 'parse', 'process', 'health_check')),
  latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0),
  success BOOLEAN NOT NULL,
  error_type TEXT,
  error_message TEXT,
  correlation_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance monitoring queries
CREATE INDEX idx_provider_performance_logs_org_id ON provider_performance_logs(org_id);
CREATE INDEX idx_provider_performance_logs_provider ON provider_performance_logs(provider, created_at DESC);
CREATE INDEX idx_provider_performance_logs_operation ON provider_performance_logs(provider, operation, created_at DESC);
CREATE INDEX idx_provider_performance_logs_success ON provider_performance_logs(provider, success, created_at DESC);
CREATE INDEX idx_provider_performance_logs_correlation_id ON provider_performance_logs(correlation_id);
CREATE INDEX idx_provider_performance_logs_created_at ON provider_performance_logs(created_at DESC);
CREATE INDEX idx_provider_performance_logs_latency ON provider_performance_logs(provider, latency_ms, created_at DESC);

-- Composite index for performance statistics queries
CREATE INDEX idx_provider_performance_logs_stats ON provider_performance_logs(provider, success, created_at DESC, latency_ms);

-- Enable Row Level Security
ALTER TABLE provider_performance_logs ENABLE ROW LEVEL SECURITY;

-- RLS policy for provider performance logs
CREATE POLICY "Users can only access their org's provider performance logs"
  ON provider_performance_logs
  FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM org_members 
      WHERE user_id = auth.uid()
    )
  );

-- Grant permissions
GRANT ALL ON provider_performance_logs TO authenticated;
GRANT ALL ON provider_performance_logs TO service_role;

-- Function to get provider performance statistics
CREATE OR REPLACE FUNCTION get_provider_performance_stats(
  p_provider TEXT DEFAULT NULL,
  p_org_id UUID DEFAULT NULL,
  p_hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
  provider TEXT,
  total_requests BIGINT,
  successful_requests BIGINT,
  failed_requests BIGINT,
  success_rate NUMERIC,
  average_latency_ms NUMERIC,
  p95_latency_ms INTEGER,
  p99_latency_ms INTEGER,
  error_breakdown JSONB
) AS $$
DECLARE
  cutoff_time TIMESTAMP WITH TIME ZONE;
BEGIN
  cutoff_time := NOW() - (p_hours_back || ' hours')::INTERVAL;
  
  RETURN QUERY
  WITH provider_stats AS (
    SELECT 
      ppl.provider,
      COUNT(*) as total_requests,
      COUNT(*) FILTER (WHERE ppl.success = true) as successful_requests,
      COUNT(*) FILTER (WHERE ppl.success = false) as failed_requests,
      AVG(ppl.latency_ms) as average_latency_ms,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ppl.latency_ms) as p95_latency_ms,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ppl.latency_ms) as p99_latency_ms
    FROM provider_performance_logs ppl
    WHERE 
      ppl.created_at >= cutoff_time
      AND (p_provider IS NULL OR ppl.provider = p_provider)
      AND (p_org_id IS NULL OR ppl.org_id = p_org_id)
    GROUP BY ppl.provider
  ),
  error_stats AS (
    SELECT 
      ppl.provider,
      jsonb_agg(
        jsonb_build_object(
          'error_type', ppl.error_type,
          'count', error_count,
          'percentage', ROUND((error_count::NUMERIC / total_requests::NUMERIC) * 100, 2)
        )
      ) as error_breakdown
    FROM (
      SELECT 
        ppl.provider,
        ppl.error_type,
        COUNT(*) as error_count,
        (SELECT COUNT(*) FROM provider_performance_logs ppl2 
         WHERE ppl2.provider = ppl.provider 
         AND ppl2.created_at >= cutoff_time
         AND (p_org_id IS NULL OR ppl2.org_id = p_org_id)) as total_requests
      FROM provider_performance_logs ppl
      WHERE 
        ppl.created_at >= cutoff_time
        AND ppl.success = false
        AND ppl.error_type IS NOT NULL
        AND (p_provider IS NULL OR ppl.provider = p_provider)
        AND (p_org_id IS NULL OR ppl.org_id = p_org_id)
      GROUP BY ppl.provider, ppl.error_type
    ) ppl
    GROUP BY ppl.provider
  )
  SELECT 
    ps.provider,
    ps.total_requests,
    ps.successful_requests,
    ps.failed_requests,
    CASE 
      WHEN ps.total_requests > 0 THEN ROUND((ps.successful_requests::NUMERIC / ps.total_requests::NUMERIC) * 100, 2)
      ELSE 0
    END as success_rate,
    ROUND(ps.average_latency_ms, 2) as average_latency_ms,
    ps.p95_latency_ms::INTEGER,
    ps.p99_latency_ms::INTEGER,
    COALESCE(es.error_breakdown, '[]'::jsonb) as error_breakdown
  FROM provider_stats ps
  LEFT JOIN error_stats es ON ps.provider = es.provider
  ORDER BY ps.provider;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get provider health summary
CREATE OR REPLACE FUNCTION get_provider_health_summary(
  p_hours_back INTEGER DEFAULT 1
)
RETURNS TABLE (
  provider TEXT,
  healthy BOOLEAN,
  success_rate NUMERIC,
  average_latency_ms NUMERIC,
  last_successful_request TIMESTAMP WITH TIME ZONE,
  last_error JSONB
) AS $$
DECLARE
  cutoff_time TIMESTAMP WITH TIME ZONE;
BEGIN
  cutoff_time := NOW() - (p_hours_back || ' hours')::INTERVAL;
  
  RETURN QUERY
  WITH provider_stats AS (
    SELECT 
      ppl.provider,
      COUNT(*) as total_requests,
      COUNT(*) FILTER (WHERE ppl.success = true) as successful_requests,
      AVG(ppl.latency_ms) as average_latency_ms
    FROM provider_performance_logs ppl
    WHERE ppl.created_at >= cutoff_time
    GROUP BY ppl.provider
  ),
  last_success AS (
    SELECT DISTINCT ON (ppl.provider)
      ppl.provider,
      ppl.created_at as last_successful_request
    FROM provider_performance_logs ppl
    WHERE ppl.success = true
    ORDER BY ppl.provider, ppl.created_at DESC
  ),
  last_errors AS (
    SELECT DISTINCT ON (ppl.provider)
      ppl.provider,
      jsonb_build_object(
        'type', ppl.error_type,
        'message', ppl.error_message,
        'timestamp', ppl.created_at
      ) as last_error
    FROM provider_performance_logs ppl
    WHERE ppl.success = false
    ORDER BY ppl.provider, ppl.created_at DESC
  )
  SELECT 
    ps.provider,
    CASE 
      WHEN ps.total_requests > 0 AND 
           (ps.successful_requests::NUMERIC / ps.total_requests::NUMERIC) > 0.95 AND 
           ps.average_latency_ms < 5000 
      THEN true
      ELSE false
    END as healthy,
    CASE 
      WHEN ps.total_requests > 0 THEN ROUND((ps.successful_requests::NUMERIC / ps.total_requests::NUMERIC) * 100, 2)
      ELSE 0
    END as success_rate,
    ROUND(ps.average_latency_ms, 2) as average_latency_ms,
    ls.last_successful_request,
    le.last_error
  FROM provider_stats ps
  LEFT JOIN last_success ls ON ps.provider = ls.provider
  LEFT JOIN last_errors le ON ps.provider = le.provider
  ORDER BY ps.provider;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old provider performance logs
CREATE OR REPLACE FUNCTION cleanup_old_provider_performance_logs(
  retention_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
  cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
  cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
  
  DELETE FROM provider_performance_logs
  WHERE created_at < cutoff_date;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for updated_at
CREATE TRIGGER update_provider_performance_logs_updated_at
  BEFORE UPDATE ON provider_performance_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE provider_performance_logs IS 'Tracks provider performance metrics for monitoring and optimization';
COMMENT ON COLUMN provider_performance_logs.latency_ms IS 'Operation latency in milliseconds';
COMMENT ON COLUMN provider_performance_logs.correlation_id IS 'Links performance metrics to specific email processing operations';
COMMENT ON COLUMN provider_performance_logs.metadata IS 'Additional provider-specific metadata for debugging';

COMMENT ON FUNCTION get_provider_performance_stats IS 'Returns comprehensive performance statistics for email providers';
COMMENT ON FUNCTION get_provider_health_summary IS 'Returns health summary for all providers based on recent performance';
COMMENT ON FUNCTION cleanup_old_provider_performance_logs IS 'Removes old provider performance logs to prevent database bloat';