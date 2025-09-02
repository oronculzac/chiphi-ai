-- Transaction processing and storage functions
-- Requirements: 3.1, 3.2, 3.3, 7.3, 7.4

-- Function to create transaction with validation and PII redaction
CREATE OR REPLACE FUNCTION create_transaction(
  org_uuid UUID,
  email_uuid UUID,
  transaction_date DATE,
  amount_param DECIMAL(10,2),
  currency_param TEXT,
  merchant_param TEXT,
  last4_param TEXT DEFAULT NULL,
  category_param TEXT,
  subcategory_param TEXT DEFAULT NULL,
  notes_param TEXT DEFAULT NULL,
  confidence_param INTEGER,
  explanation_param TEXT,
  original_text_param TEXT DEFAULT NULL,
  translated_text_param TEXT DEFAULT NULL,
  source_language_param TEXT DEFAULT NULL
)
RETURNS UUID AS $
DECLARE
  transaction_uuid UUID;
  sanitized_last4 TEXT;
BEGIN
  -- Validate required parameters
  IF org_uuid IS NULL OR email_uuid IS NULL OR transaction_date IS NULL OR 
     amount_param IS NULL OR amount_param <= 0 OR currency_param IS NULL OR 
     merchant_param IS NULL OR category_param IS NULL OR 
     confidence_param IS NULL OR explanation_param IS NULL THEN
    RAISE EXCEPTION 'Missing or invalid required transaction parameters';
  END IF;

  -- Validate confidence score
  IF confidence_param < 0 OR confidence_param > 100 THEN
    RAISE EXCEPTION 'Confidence score must be between 0 and 100';
  END IF;

  -- Validate currency format (3-letter ISO code)
  IF LENGTH(currency_param) != 3 OR currency_param !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Currency must be a 3-letter ISO code';
  END IF;

  -- Sanitize last4 (extract only last 4 digits)
  IF last4_param IS NOT NULL THEN
    sanitized_last4 := RIGHT(REGEXP_REPLACE(last4_param, '[^0-9]', '', 'g'), 4);
    IF LENGTH(sanitized_last4) != 4 THEN
      sanitized_last4 := NULL;
    END IF;
  END IF;

  -- Insert transaction
  INSERT INTO transactions (
    org_id, email_id, date, amount, currency, merchant, last4,
    category, subcategory, notes, confidence, explanation,
    original_text, translated_text, source_language
  )
  VALUES (
    org_uuid, email_uuid, transaction_date, amount_param, currency_param, 
    merchant_param, sanitized_last4, category_param, subcategory_param, 
    notes_param, confidence_param, explanation_param,
    original_text_param, translated_text_param, source_language_param
  )
  RETURNING id INTO transaction_uuid;

  RETURN transaction_uuid;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update transaction with validation
CREATE OR REPLACE FUNCTION update_transaction_safe(
  transaction_uuid UUID,
  org_uuid UUID,
  user_uuid UUID,
  amount_param DECIMAL(10,2) DEFAULT NULL,
  currency_param TEXT DEFAULT NULL,
  merchant_param TEXT DEFAULT NULL,
  last4_param TEXT DEFAULT NULL,
  category_param TEXT DEFAULT NULL,
  subcategory_param TEXT DEFAULT NULL,
  notes_param TEXT DEFAULT NULL,
  confidence_param INTEGER DEFAULT NULL,
  explanation_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $
DECLARE
  sanitized_last4 TEXT;
  update_count INTEGER;
BEGIN
  -- Validate confidence score if provided
  IF confidence_param IS NOT NULL AND (confidence_param < 0 OR confidence_param > 100) THEN
    RAISE EXCEPTION 'Confidence score must be between 0 and 100';
  END IF;

  -- Validate currency format if provided
  IF currency_param IS NOT NULL AND (LENGTH(currency_param) != 3 OR currency_param !~ '^[A-Z]{3}$') THEN
    RAISE EXCEPTION 'Currency must be a 3-letter ISO code';
  END IF;

  -- Validate amount if provided
  IF amount_param IS NOT NULL AND amount_param <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than 0';
  END IF;

  -- Sanitize last4 if provided
  IF last4_param IS NOT NULL THEN
    sanitized_last4 := RIGHT(REGEXP_REPLACE(last4_param, '[^0-9]', '', 'g'), 4);
    IF LENGTH(sanitized_last4) != 4 THEN
      sanitized_last4 := NULL;
    END IF;
  END IF;

  -- Update transaction (RLS will enforce org access)
  UPDATE transactions SET
    amount = COALESCE(amount_param, amount),
    currency = COALESCE(currency_param, currency),
    merchant = COALESCE(merchant_param, merchant),
    last4 = COALESCE(sanitized_last4, last4),
    category = COALESCE(category_param, category),
    subcategory = COALESCE(subcategory_param, subcategory),
    notes = COALESCE(notes_param, notes),
    confidence = COALESCE(confidence_param, confidence),
    explanation = COALESCE(explanation_param, explanation),
    updated_at = NOW()
  WHERE id = transaction_uuid AND org_id = org_uuid;

  GET DIAGNOSTICS update_count = ROW_COUNT;
  
  RETURN update_count > 0;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get transaction statistics for organization
CREATE OR REPLACE FUNCTION get_transaction_stats(
  org_uuid UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE(
  total_transactions BIGINT,
  total_amount DECIMAL(12,2),
  average_confidence DECIMAL(5,2),
  low_confidence_count BIGINT,
  category_breakdown JSONB
) AS $
DECLARE
  date_filter TEXT := '';
BEGIN
  -- Build date filter if provided
  IF start_date IS NOT NULL AND end_date IS NOT NULL THEN
    date_filter := ' AND date BETWEEN ''' || start_date || ''' AND ''' || end_date || '''';
  ELSIF start_date IS NOT NULL THEN
    date_filter := ' AND date >= ''' || start_date || '''';
  ELSIF end_date IS NOT NULL THEN
    date_filter := ' AND date <= ''' || end_date || '''';
  END IF;

  RETURN QUERY EXECUTE '
    WITH stats AS (
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(AVG(confidence), 0) as average_confidence,
        COUNT(*) FILTER (WHERE confidence < 80) as low_confidence_count
      FROM transactions 
      WHERE org_id = $1' || date_filter || '
    ),
    categories AS (
      SELECT 
        jsonb_agg(
          jsonb_build_object(
            ''category'', category,
            ''count'', count,
            ''amount'', amount
          ) ORDER BY amount DESC
        ) as category_breakdown
      FROM (
        SELECT 
          category,
          COUNT(*) as count,
          SUM(amount) as amount
        FROM transactions 
        WHERE org_id = $1' || date_filter || '
        GROUP BY category
      ) cat_stats
    )
    SELECT 
      s.total_transactions,
      s.total_amount,
      ROUND(s.average_confidence, 2) as average_confidence,
      s.low_confidence_count,
      COALESCE(c.category_breakdown, ''[]''::jsonb) as category_breakdown
    FROM stats s
    CROSS JOIN categories c'
  USING org_uuid;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get transactions with filtering and pagination
CREATE OR REPLACE FUNCTION get_transactions_filtered(
  org_uuid UUID,
  limit_param INTEGER DEFAULT 50,
  offset_param INTEGER DEFAULT 0,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  category_filter TEXT DEFAULT NULL,
  min_confidence INTEGER DEFAULT NULL,
  sort_by TEXT DEFAULT 'date',
  sort_order TEXT DEFAULT 'desc'
)
RETURNS TABLE(
  id UUID,
  email_id UUID,
  date DATE,
  amount DECIMAL(10,2),
  currency TEXT,
  merchant TEXT,
  last4 TEXT,
  category TEXT,
  subcategory TEXT,
  notes TEXT,
  confidence INTEGER,
  explanation TEXT,
  original_text TEXT,
  translated_text TEXT,
  source_language TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  total_count BIGINT
) AS $
DECLARE
  where_clause TEXT := 'WHERE org_id = $1';
  order_clause TEXT;
  query_text TEXT;
BEGIN
  -- Build WHERE clause
  IF start_date IS NOT NULL THEN
    where_clause := where_clause || ' AND date >= ''' || start_date || '''';
  END IF;
  
  IF end_date IS NOT NULL THEN
    where_clause := where_clause || ' AND date <= ''' || end_date || '''';
  END IF;
  
  IF category_filter IS NOT NULL THEN
    where_clause := where_clause || ' AND category = ''' || category_filter || '''';
  END IF;
  
  IF min_confidence IS NOT NULL THEN
    where_clause := where_clause || ' AND confidence >= ' || min_confidence;
  END IF;

  -- Build ORDER clause
  IF sort_by NOT IN ('date', 'amount', 'confidence', 'created_at') THEN
    sort_by := 'date';
  END IF;
  
  IF sort_order NOT IN ('asc', 'desc') THEN
    sort_order := 'desc';
  END IF;
  
  order_clause := 'ORDER BY ' || sort_by || ' ' || sort_order;

  -- Build complete query
  query_text := '
    SELECT 
      t.*,
      COUNT(*) OVER() as total_count
    FROM transactions t ' ||
    where_clause || ' ' ||
    order_clause || '
    LIMIT ' || limit_param || ' OFFSET ' || offset_param;

  RETURN QUERY EXECUTE query_text USING org_uuid;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete transaction with audit logging
CREATE OR REPLACE FUNCTION delete_transaction_safe(
  transaction_uuid UUID,
  org_uuid UUID,
  user_uuid UUID
)
RETURNS BOOLEAN AS $
DECLARE
  delete_count INTEGER;
  transaction_data JSONB;
BEGIN
  -- Get transaction data for audit log before deletion
  SELECT to_jsonb(t.*) INTO transaction_data
  FROM transactions t
  WHERE id = transaction_uuid AND org_id = org_uuid;

  IF transaction_data IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Delete transaction (RLS will enforce org access)
  DELETE FROM transactions 
  WHERE id = transaction_uuid AND org_id = org_uuid;

  GET DIAGNOSTICS delete_count = ROW_COUNT;

  -- Log deletion for audit trail
  IF delete_count > 0 THEN
    INSERT INTO processing_logs (org_id, email_id, step, status, details)
    VALUES (
      org_uuid, 
      (transaction_data->>'email_id')::UUID,
      'transaction_deletion',
      'completed',
      jsonb_build_object(
        'deleted_by', user_uuid,
        'transaction_data', transaction_data,
        'deleted_at', NOW()
      )
    );
  END IF;

  RETURN delete_count > 0;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to bulk update transaction categories (for merchant mapping corrections)
CREATE OR REPLACE FUNCTION bulk_update_transaction_categories(
  org_uuid UUID,
  merchant_name_param TEXT,
  new_category TEXT,
  new_subcategory TEXT DEFAULT NULL,
  user_uuid UUID DEFAULT NULL
)
RETURNS INTEGER AS $
DECLARE
  update_count INTEGER;
BEGIN
  -- Validate parameters
  IF org_uuid IS NULL OR merchant_name_param IS NULL OR new_category IS NULL THEN
    RAISE EXCEPTION 'Missing required parameters for bulk category update';
  END IF;

  -- Update all transactions for this merchant in the organization
  UPDATE transactions SET
    category = new_category,
    subcategory = new_subcategory,
    updated_at = NOW()
  WHERE org_id = org_uuid 
    AND LOWER(merchant) = LOWER(merchant_name_param);

  GET DIAGNOSTICS update_count = ROW_COUNT;

  -- Log bulk update for audit trail
  IF update_count > 0 THEN
    INSERT INTO processing_logs (org_id, email_id, step, status, details)
    VALUES (
      org_uuid,
      NULL, -- No specific email for bulk operations
      'bulk_category_update',
      'completed',
      jsonb_build_object(
        'merchant', merchant_name_param,
        'new_category', new_category,
        'new_subcategory', new_subcategory,
        'updated_count', update_count,
        'updated_by', user_uuid,
        'updated_at', NOW()
      )
    );
  END IF;

  RETURN update_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate transaction data integrity
CREATE OR REPLACE FUNCTION validate_transaction_integrity(org_uuid UUID)
RETURNS TABLE(
  issue_type TEXT,
  issue_count BIGINT,
  sample_ids UUID[]
) AS $
BEGIN
  RETURN QUERY
  -- Check for missing required fields
  SELECT 
    'missing_required_fields' as issue_type,
    COUNT(*) as issue_count,
    ARRAY_AGG(id ORDER BY created_at DESC LIMIT 5) as sample_ids
  FROM transactions
  WHERE org_id = org_uuid
    AND (date IS NULL OR amount IS NULL OR amount <= 0 OR 
         currency IS NULL OR merchant IS NULL OR category IS NULL OR
         confidence IS NULL OR explanation IS NULL)
  HAVING COUNT(*) > 0

  UNION ALL

  -- Check for invalid confidence scores
  SELECT 
    'invalid_confidence_scores' as issue_type,
    COUNT(*) as issue_count,
    ARRAY_AGG(id ORDER BY created_at DESC LIMIT 5) as sample_ids
  FROM transactions
  WHERE org_id = org_uuid
    AND (confidence < 0 OR confidence > 100)
  HAVING COUNT(*) > 0

  UNION ALL

  -- Check for invalid currency codes
  SELECT 
    'invalid_currency_codes' as issue_type,
    COUNT(*) as issue_count,
    ARRAY_AGG(id ORDER BY created_at DESC LIMIT 5) as sample_ids
  FROM transactions
  WHERE org_id = org_uuid
    AND (LENGTH(currency) != 3 OR currency !~ '^[A-Z]{3}$')
  HAVING COUNT(*) > 0

  UNION ALL

  -- Check for invalid last4 format
  SELECT 
    'invalid_last4_format' as issue_type,
    COUNT(*) as issue_count,
    ARRAY_AGG(id ORDER BY created_at DESC LIMIT 5) as sample_ids
  FROM transactions
  WHERE org_id = org_uuid
    AND last4 IS NOT NULL
    AND (LENGTH(last4) != 4 OR last4 !~ '^[0-9]{4}$')
  HAVING COUNT(*) > 0;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;