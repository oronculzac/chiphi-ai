-- Reports MVP Database Functions
-- Migration: 020_reports_mvp_functions.sql
-- Requirements: 1.1, 2.1, 3.1, 9.1, 9.2

-- Function to get report totals with comparison to previous period
CREATE OR REPLACE FUNCTION fn_report_totals(
  p_org_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE (
  current_total DECIMAL(12,2),
  previous_total DECIMAL(12,2),
  change_amount DECIMAL(12,2),
  change_percentage DECIMAL(5,2)
) 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  period_days INTEGER;
  previous_start_date DATE;
  previous_end_date DATE;
  current_amount DECIMAL(12,2);
  previous_amount DECIMAL(12,2);
  change_amt DECIMAL(12,2);
  change_pct DECIMAL(5,2);
BEGIN
  -- Validate input parameters
  IF p_start_date > p_end_date THEN
    RAISE EXCEPTION 'Start date cannot be after end date';
  END IF;

  -- Calculate period length in days
  period_days := p_end_date - p_start_date + 1;
  
  -- Calculate previous period dates (same duration)
  previous_end_date := p_start_date - 1;
  previous_start_date := previous_end_date - period_days + 1;

  -- Get current period total
  SELECT COALESCE(SUM(amount), 0) INTO current_amount
  FROM transactions
  WHERE org_id = p_org_id
    AND date >= p_start_date
    AND date <= p_end_date;

  -- Get previous period total
  SELECT COALESCE(SUM(amount), 0) INTO previous_amount
  FROM transactions
  WHERE org_id = p_org_id
    AND date >= previous_start_date
    AND date <= previous_end_date;

  -- Calculate change amount
  change_amt := current_amount - previous_amount;

  -- Calculate change percentage
  IF previous_amount > 0 THEN
    change_pct := (change_amt / previous_amount) * 100;
  ELSE
    change_pct := CASE 
      WHEN current_amount > 0 THEN 100.00
      ELSE 0.00
    END;
  END IF;

  -- Return results
  RETURN QUERY
  SELECT 
    current_amount as current_total,
    previous_amount as previous_total,
    change_amt as change_amount,
    change_pct as change_percentage;
END;
$$;

-- Function to get spending breakdown by category
CREATE OR REPLACE FUNCTION fn_report_by_category(
  p_org_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_categories TEXT[] DEFAULT NULL
) RETURNS TABLE (
  category TEXT,
  amount DECIMAL(12,2),
  percentage DECIMAL(5,2),
  count INTEGER
) 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  total_amount DECIMAL(12,2);
BEGIN
  -- Validate input parameters
  IF p_start_date > p_end_date THEN
    RAISE EXCEPTION 'Start date cannot be after end date';
  END IF;

  -- Get total amount for percentage calculation
  SELECT COALESCE(SUM(t.amount), 0) INTO total_amount
  FROM transactions t
  WHERE t.org_id = p_org_id
    AND t.date >= p_start_date
    AND t.date <= p_end_date
    AND (p_categories IS NULL OR t.category = ANY(p_categories));

  -- Return category breakdown
  RETURN QUERY
  SELECT 
    t.category,
    SUM(t.amount) as amount,
    CASE 
      WHEN total_amount > 0 THEN ROUND((SUM(t.amount) / total_amount * 100), 2)
      ELSE 0.00
    END as percentage,
    COUNT(*)::INTEGER as count
  FROM transactions t
  WHERE t.org_id = p_org_id
    AND t.date >= p_start_date
    AND t.date <= p_end_date
    AND (p_categories IS NULL OR t.category = ANY(p_categories))
  GROUP BY t.category
  ORDER BY SUM(t.amount) DESC;
END;
$$;

-- Function to get daily spending data
CREATE OR REPLACE FUNCTION fn_report_daily(
  p_org_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_categories TEXT[] DEFAULT NULL,
  p_search TEXT DEFAULT NULL
) RETURNS TABLE (
  date DATE,
  amount DECIMAL(12,2),
  transaction_count INTEGER
) 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  iter_date DATE;
  daily_amount DECIMAL(12,2);
  daily_count INTEGER;
BEGIN
  -- Validate input parameters
  IF p_start_date > p_end_date THEN
    RAISE EXCEPTION 'Start date cannot be after end date';
  END IF;

  -- Limit date range to prevent excessive computation (max 1 year)
  IF p_end_date - p_start_date > 365 THEN
    RAISE EXCEPTION 'Date range cannot exceed 365 days';
  END IF;

  -- Generate daily data for each date in range
  iter_date := p_start_date;
  WHILE iter_date <= p_end_date LOOP
    -- Get daily amount and count with filters
    SELECT 
      COALESCE(SUM(t.amount), 0),
      COUNT(*)::INTEGER
    INTO daily_amount, daily_count
    FROM transactions t
    WHERE t.org_id = p_org_id
      AND t.date = iter_date
      AND (p_categories IS NULL OR t.category = ANY(p_categories))
      AND (p_search IS NULL OR 
           t.merchant ILIKE '%' || p_search || '%' OR 
           t.notes ILIKE '%' || p_search || '%');

    -- Return the daily data point
    RETURN QUERY
    SELECT 
      iter_date as date,
      daily_amount as amount,
      daily_count as transaction_count;
    
    iter_date := iter_date + 1;
  END LOOP;
END;
$$;

-- Additional indexes for optimal report query performance
-- These complement existing indexes with report-specific optimizations

-- Composite index for report totals function
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_reports_totals 
ON transactions (org_id, date, amount);

-- Full-text search index for merchant and notes search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_search_text 
ON transactions USING gin(to_tsvector('english', merchant || ' ' || COALESCE(notes, '')));

-- Partial index for recent transactions (performance optimization)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_recent_reports 
ON transactions (org_id, date DESC, category, amount);

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION fn_report_totals(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_report_by_category(UUID, DATE, DATE, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_report_daily(UUID, DATE, DATE, TEXT[], TEXT) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION fn_report_totals IS 'Returns current period total with comparison to previous period of same duration';
COMMENT ON FUNCTION fn_report_by_category IS 'Returns spending breakdown by category with percentages and transaction counts';
COMMENT ON FUNCTION fn_report_daily IS 'Returns daily spending amounts and transaction counts with optional category and search filters';