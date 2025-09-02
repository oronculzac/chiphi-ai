-- Enhanced analytics functions for real-time dashboard
-- Requirements: 6.1, 6.2, 6.3, 6.4

-- Function to get month-to-date total for organization
CREATE OR REPLACE FUNCTION get_month_to_date_total(org_uuid UUID)
RETURNS DECIMAL(12,2) AS $
DECLARE
  current_month_start DATE;
  current_month_end DATE;
  total_amount DECIMAL(12,2);
BEGIN
  -- Calculate current month boundaries
  current_month_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  current_month_end := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;

  -- Get month-to-date total
  SELECT COALESCE(SUM(amount), 0) INTO total_amount
  FROM transactions
  WHERE org_id = org_uuid
    AND date >= current_month_start
    AND date <= current_month_end;

  RETURN total_amount;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get category breakdown with percentages
CREATE OR REPLACE FUNCTION get_category_breakdown(
  org_uuid UUID,
  days_back INTEGER DEFAULT 90
)
RETURNS TABLE(
  category TEXT,
  amount DECIMAL(12,2),
  count BIGINT,
  percentage INTEGER
) AS $
DECLARE
  start_date DATE;
  total_amount DECIMAL(12,2);
BEGIN
  -- Calculate date range
  start_date := CURRENT_DATE - INTERVAL '1 day' * days_back;

  -- Get total amount for percentage calculation
  SELECT COALESCE(SUM(t.amount), 0) INTO total_amount
  FROM transactions t
  WHERE t.org_id = org_uuid
    AND t.date >= start_date;

  -- Return category breakdown
  RETURN QUERY
  SELECT 
    t.category,
    SUM(t.amount) as amount,
    COUNT(*) as count,
    CASE 
      WHEN total_amount > 0 THEN ROUND((SUM(t.amount) / total_amount * 100))::INTEGER
      ELSE 0
    END as percentage
  FROM transactions t
  WHERE t.org_id = org_uuid
    AND t.date >= start_date
  GROUP BY t.category
  ORDER BY SUM(t.amount) DESC;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get 30-day spending trend
CREATE OR REPLACE FUNCTION get_spending_trend(
  org_uuid UUID,
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE(
  date DATE,
  amount DECIMAL(12,2)
) AS $
DECLARE
  start_date DATE;
  end_date DATE;
  iter_date DATE;
BEGIN
  -- Calculate date range
  end_date := CURRENT_DATE;
  start_date := end_date - INTERVAL '1 day' * days_back;

  -- Generate all dates in range with spending amounts
  iter_date := start_date;
  WHILE iter_date <= end_date LOOP
    RETURN QUERY
    SELECT 
      iter_date as date,
      COALESCE(
        (SELECT SUM(t.amount) 
         FROM transactions t 
         WHERE t.org_id = org_uuid 
           AND t.date = iter_date), 
        0::DECIMAL(12,2)
      ) as amount;
    
    iter_date := iter_date + INTERVAL '1 day';
  END LOOP;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced comprehensive analytics function
CREATE OR REPLACE FUNCTION get_comprehensive_analytics(
  org_uuid UUID
)
RETURNS TABLE(
  month_to_date_total DECIMAL(12,2),
  category_breakdown JSONB,
  spending_trend JSONB,
  recent_transactions_count BIGINT
) AS $
DECLARE
  mtd_total DECIMAL(12,2);
  category_data JSONB;
  trend_data JSONB;
  recent_count BIGINT;
BEGIN
  -- Get month-to-date total
  SELECT get_month_to_date_total(org_uuid) INTO mtd_total;

  -- Get category breakdown as JSON
  SELECT jsonb_agg(
    jsonb_build_object(
      'category', cb.category,
      'amount', cb.amount,
      'count', cb.count,
      'percentage', cb.percentage
    ) ORDER BY cb.amount DESC
  ) INTO category_data
  FROM get_category_breakdown(org_uuid, 90) cb;

  -- Get spending trend as JSON
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', st.date,
      'amount', st.amount
    ) ORDER BY st.date
  ) INTO trend_data
  FROM get_spending_trend(org_uuid, 30) st;

  -- Get recent transactions count
  SELECT COUNT(*) INTO recent_count
  FROM transactions t
  WHERE t.org_id = org_uuid
    AND t.created_at >= CURRENT_DATE - INTERVAL '7 days';

  -- Return comprehensive analytics
  RETURN QUERY
  SELECT 
    mtd_total,
    COALESCE(category_data, '[]'::jsonb),
    COALESCE(trend_data, '[]'::jsonb),
    recent_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get real-time transaction count for organization
CREATE OR REPLACE FUNCTION get_transaction_count(
  org_uuid UUID,
  days_back INTEGER DEFAULT 30
)
RETURNS BIGINT AS $
DECLARE
  start_date DATE;
  transaction_count BIGINT;
BEGIN
  start_date := CURRENT_DATE - INTERVAL '1 day' * days_back;

  SELECT COUNT(*) INTO transaction_count
  FROM transactions
  WHERE org_id = org_uuid
    AND date >= start_date;

  RETURN transaction_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for better analytics performance
CREATE INDEX IF NOT EXISTS idx_transactions_org_date 
ON transactions(org_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_org_category 
ON transactions(org_id, category);

CREATE INDEX IF NOT EXISTS idx_transactions_org_created_at 
ON transactions(org_id, created_at DESC);

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_month_to_date_total(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_category_breakdown(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_spending_trend(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_comprehensive_analytics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_transaction_count(UUID, INTEGER) TO authenticated;