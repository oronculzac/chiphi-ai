-- Additional analytics functions for insights system
-- Requirements: 6.4, 6.5 - Predefined analytics functions for security

-- Function to get merchant spending totals
CREATE OR REPLACE FUNCTION get_merchant_spending(
  org_uuid UUID,
  days_back INTEGER DEFAULT 90
)
RETURNS TABLE(
  merchant TEXT,
  amount DECIMAL(12,2),
  transaction_count BIGINT,
  avg_amount DECIMAL(12,2)
) AS $
DECLARE
  start_date DATE;
BEGIN
  start_date := CURRENT_DATE - INTERVAL '1 day' * days_back;

  RETURN QUERY
  SELECT 
    t.merchant,
    SUM(t.amount) as amount,
    COUNT(*) as transaction_count,
    AVG(t.amount) as avg_amount
  FROM transactions t
  WHERE t.org_id = org_uuid
    AND t.date >= start_date
  GROUP BY t.merchant
  ORDER BY SUM(t.amount) DESC;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get confidence score statistics
CREATE OR REPLACE FUNCTION get_confidence_stats(
  org_uuid UUID,
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE(
  high_confidence_count BIGINT,
  medium_confidence_count BIGINT,
  low_confidence_count BIGINT,
  total_count BIGINT,
  avg_confidence DECIMAL(5,2)
) AS $
DECLARE
  start_date DATE;
BEGIN
  start_date := CURRENT_DATE - INTERVAL '1 day' * days_back;

  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE t.confidence > 80) as high_confidence_count,
    COUNT(*) FILTER (WHERE t.confidence BETWEEN 50 AND 80) as medium_confidence_count,
    COUNT(*) FILTER (WHERE t.confidence < 50) as low_confidence_count,
    COUNT(*) as total_count,
    AVG(t.confidence) as avg_confidence
  FROM transactions t
  WHERE t.org_id = org_uuid
    AND t.date >= start_date;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to compare spending between two periods
CREATE OR REPLACE FUNCTION compare_spending_periods(
  org_uuid UUID,
  current_days INTEGER DEFAULT 30,
  previous_days INTEGER DEFAULT 30
)
RETURNS TABLE(
  current_period_total DECIMAL(12,2),
  previous_period_total DECIMAL(12,2),
  change_amount DECIMAL(12,2),
  change_percentage DECIMAL(5,2)
) AS $
DECLARE
  current_start DATE;
  current_end DATE;
  previous_start DATE;
  previous_end DATE;
  current_total DECIMAL(12,2);
  previous_total DECIMAL(12,2);
BEGIN
  -- Calculate date ranges
  current_end := CURRENT_DATE;
  current_start := current_end - INTERVAL '1 day' * current_days;
  previous_end := current_start;
  previous_start := previous_end - INTERVAL '1 day' * previous_days;

  -- Get current period total
  SELECT COALESCE(SUM(t.amount), 0) INTO current_total
  FROM transactions t
  WHERE t.org_id = org_uuid
    AND t.date >= current_start
    AND t.date <= current_end;

  -- Get previous period total
  SELECT COALESCE(SUM(t.amount), 0) INTO previous_total
  FROM transactions t
  WHERE t.org_id = org_uuid
    AND t.date >= previous_start
    AND t.date < previous_end;

  RETURN QUERY
  SELECT 
    current_total,
    previous_total,
    current_total - previous_total as change_amount,
    CASE 
      WHEN previous_total > 0 THEN ((current_total - previous_total) / previous_total * 100)
      ELSE 0
    END as change_percentage;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get spending by day of week
CREATE OR REPLACE FUNCTION get_spending_by_day_of_week(
  org_uuid UUID,
  days_back INTEGER DEFAULT 90
)
RETURNS TABLE(
  day_of_week INTEGER,
  day_name TEXT,
  total_amount DECIMAL(12,2),
  transaction_count BIGINT,
  avg_amount DECIMAL(12,2)
) AS $
DECLARE
  start_date DATE;
BEGIN
  start_date := CURRENT_DATE - INTERVAL '1 day' * days_back;

  RETURN QUERY
  SELECT 
    EXTRACT(DOW FROM t.date)::INTEGER as day_of_week,
    CASE EXTRACT(DOW FROM t.date)
      WHEN 0 THEN 'Sunday'
      WHEN 1 THEN 'Monday'
      WHEN 2 THEN 'Tuesday'
      WHEN 3 THEN 'Wednesday'
      WHEN 4 THEN 'Thursday'
      WHEN 5 THEN 'Friday'
      WHEN 6 THEN 'Saturday'
    END as day_name,
    SUM(t.amount) as total_amount,
    COUNT(*) as transaction_count,
    AVG(t.amount) as avg_amount
  FROM transactions t
  WHERE t.org_id = org_uuid
    AND t.date >= start_date
  GROUP BY EXTRACT(DOW FROM t.date)
  ORDER BY EXTRACT(DOW FROM t.date);
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent transaction activity summary
CREATE OR REPLACE FUNCTION get_recent_activity_summary(
  org_uuid UUID,
  days_back INTEGER DEFAULT 7
)
RETURNS TABLE(
  total_amount DECIMAL(12,2),
  transaction_count BIGINT,
  unique_merchants BIGINT,
  unique_categories BIGINT,
  avg_daily_spending DECIMAL(12,2),
  highest_single_transaction DECIMAL(12,2),
  most_frequent_category TEXT
) AS $
DECLARE
  start_date DATE;
  total_amt DECIMAL(12,2);
  txn_count BIGINT;
  merchant_count BIGINT;
  category_count BIGINT;
  daily_avg DECIMAL(12,2);
  highest_txn DECIMAL(12,2);
  top_category TEXT;
BEGIN
  start_date := CURRENT_DATE - INTERVAL '1 day' * days_back;

  -- Get basic stats
  SELECT 
    COALESCE(SUM(t.amount), 0),
    COUNT(*),
    COUNT(DISTINCT t.merchant),
    COUNT(DISTINCT t.category),
    COALESCE(SUM(t.amount) / days_back, 0),
    COALESCE(MAX(t.amount), 0)
  INTO total_amt, txn_count, merchant_count, category_count, daily_avg, highest_txn
  FROM transactions t
  WHERE t.org_id = org_uuid
    AND t.date >= start_date;

  -- Get most frequent category
  SELECT t.category INTO top_category
  FROM transactions t
  WHERE t.org_id = org_uuid
    AND t.date >= start_date
  GROUP BY t.category
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  RETURN QUERY
  SELECT 
    total_amt,
    txn_count,
    merchant_count,
    category_count,
    daily_avg,
    highest_txn,
    COALESCE(top_category, 'N/A');
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create additional indexes for insights performance
CREATE INDEX IF NOT EXISTS idx_transactions_org_merchant 
ON transactions(org_id, merchant);

CREATE INDEX IF NOT EXISTS idx_transactions_org_confidence 
ON transactions(org_id, confidence);

CREATE INDEX IF NOT EXISTS idx_transactions_date_dow 
ON transactions(EXTRACT(DOW FROM date));

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_merchant_spending(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_confidence_stats(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION compare_spending_periods(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_spending_by_day_of_week(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_activity_summary(UUID, INTEGER) TO authenticated;