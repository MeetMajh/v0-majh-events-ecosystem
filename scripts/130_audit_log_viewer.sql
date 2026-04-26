-- =============================================
-- AUDIT LOG VIEWER + ENHANCED PAYOUT FILTERS
-- =============================================

-- 1. get_audit_log() - Filterable audit log viewer
CREATE OR REPLACE FUNCTION get_audit_log(
  p_tenant_id UUID,
  p_action_filter TEXT DEFAULT NULL,
  p_resource_type_filter TEXT DEFAULT NULL,
  p_user_id_filter UUID DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
  v_logs JSONB;
  v_total INTEGER;
  v_caller_role TEXT;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'manager', 'finance')
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  v_start := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
  v_end := COALESCE(p_end_date, NOW());

  -- Count total matching
  SELECT COUNT(*) INTO v_total
  FROM audit_log al
  LEFT JOIN profiles p ON p.id = al.user_id
  WHERE (p.tenant_id = p_tenant_id OR al.user_id IS NULL)
    AND al.created_at BETWEEN v_start AND v_end
    AND (p_action_filter IS NULL OR al.action ILIKE '%' || p_action_filter || '%')
    AND (p_resource_type_filter IS NULL OR al.resource_type = p_resource_type_filter)
    AND (p_user_id_filter IS NULL OR al.user_id = p_user_id_filter);

  -- Get paginated logs
  SELECT jsonb_agg(row_to_json(t)) INTO v_logs
  FROM (
    SELECT 
      al.id,
      al.user_id,
      al.action,
      al.resource_type,
      al.resource_id,
      al.metadata,
      al.created_at,
      p.display_name AS user_display_name,
      p.email AS user_email,
      p.avatar_url AS user_avatar_url
    FROM audit_log al
    LEFT JOIN profiles p ON p.id = al.user_id
    WHERE (p.tenant_id = p_tenant_id OR al.user_id IS NULL)
      AND al.created_at BETWEEN v_start AND v_end
      AND (p_action_filter IS NULL OR al.action ILIKE '%' || p_action_filter || '%')
      AND (p_resource_type_filter IS NULL OR al.resource_type = p_resource_type_filter)
      AND (p_user_id_filter IS NULL OR al.user_id = p_user_id_filter)
    ORDER BY al.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) t;

  RETURN jsonb_build_object(
    'logs', COALESCE(v_logs, '[]'::jsonb),
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset,
    'period', jsonb_build_object('start', v_start, 'end', v_end)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. get_audit_log_actions() - List all unique actions for filtering
CREATE OR REPLACE FUNCTION get_audit_log_actions(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_actions JSONB;
BEGIN
  IF auth.role() != 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'manager', 'finance')
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  SELECT jsonb_agg(DISTINCT action ORDER BY action) INTO v_actions
  FROM audit_log al
  LEFT JOIN profiles p ON p.id = al.user_id
  WHERE p.tenant_id = p_tenant_id OR al.user_id IS NULL;

  RETURN jsonb_build_object('actions', COALESCE(v_actions, '[]'::jsonb));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. get_audit_log_resource_types() - List all unique resource types
CREATE OR REPLACE FUNCTION get_audit_log_resource_types(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_types JSONB;
BEGIN
  IF auth.role() != 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'manager', 'finance')
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  SELECT jsonb_agg(DISTINCT resource_type ORDER BY resource_type) INTO v_types
  FROM audit_log al
  LEFT JOIN profiles p ON p.id = al.user_id
  WHERE (p.tenant_id = p_tenant_id OR al.user_id IS NULL)
    AND resource_type IS NOT NULL;

  RETURN jsonb_build_object('resource_types', COALESCE(v_types, '[]'::jsonb));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. bulk_approve_payouts() - Approve multiple payouts at once
CREATE OR REPLACE FUNCTION bulk_approve_payouts(
  p_payout_ids UUID[],
  p_admin_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_payout_id UUID;
  v_approved INTEGER := 0;
  v_skipped INTEGER := 0;
  v_errors JSONB := '[]'::jsonb;
  v_result JSONB;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'manager', 'finance')
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  FOREACH v_payout_id IN ARRAY p_payout_ids
  LOOP
    BEGIN
      v_result := admin_approve_payout(v_payout_id, COALESCE(p_admin_id, auth.uid()));
      
      IF (v_result->>'success')::boolean = true THEN
        v_approved := v_approved + 1;
      ELSE
        v_skipped := v_skipped + 1;
        v_errors := v_errors || jsonb_build_object('id', v_payout_id, 'error', v_result->>'error');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_object('id', v_payout_id, 'error', SQLERRM);
    END;
  END LOOP;

  INSERT INTO audit_log (user_id, action, resource_type, metadata)
  VALUES (
    COALESCE(p_admin_id, auth.uid()),
    'bulk_payouts_approved',
    'payout_request',
    jsonb_build_object('approved', v_approved, 'skipped', v_skipped, 'total', array_length(p_payout_ids, 1))
  );

  RETURN jsonb_build_object(
    'success', true,
    'approved', v_approved,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. bulk_release_holds() - Release holds on multiple payouts
CREATE OR REPLACE FUNCTION bulk_release_holds(
  p_payout_ids UUID[],
  p_admin_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_payout_id UUID;
  v_released INTEGER := 0;
  v_skipped INTEGER := 0;
  v_errors JSONB := '[]'::jsonb;
  v_result JSONB;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'manager', 'finance')
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  FOREACH v_payout_id IN ARRAY p_payout_ids
  LOOP
    BEGIN
      v_result := release_payout_hold(v_payout_id, COALESCE(p_admin_id, auth.uid()));
      
      IF (v_result->>'success')::boolean = true THEN
        v_released := v_released + 1;
      ELSE
        v_skipped := v_skipped + 1;
        v_errors := v_errors || jsonb_build_object('id', v_payout_id, 'error', v_result->>'error');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_object('id', v_payout_id, 'error', SQLERRM);
    END;
  END LOOP;

  INSERT INTO audit_log (user_id, action, resource_type, metadata)
  VALUES (
    COALESCE(p_admin_id, auth.uid()),
    'bulk_holds_released',
    'payout_request',
    jsonb_build_object('released', v_released, 'skipped', v_skipped, 'total', array_length(p_payout_ids, 1))
  );

  RETURN jsonb_build_object(
    'success', true,
    'released', v_released,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. get_payouts_advanced() - Enhanced payout query with more filters
CREATE OR REPLACE FUNCTION get_payouts_advanced(
  p_tenant_id UUID,
  p_status TEXT DEFAULT NULL,
  p_is_held BOOLEAN DEFAULT NULL,
  p_min_amount INTEGER DEFAULT NULL,
  p_max_amount INTEGER DEFAULT NULL,
  p_tournament_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'created_at',
  p_sort_order TEXT DEFAULT 'desc',
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
  v_payouts JSONB;
  v_total INTEGER;
  v_stats JSONB;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'manager', 'finance')
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  -- Count and stats
  SELECT 
    COUNT(*),
    jsonb_build_object(
      'total_amount_cents', COALESCE(SUM(pr.amount_cents), 0),
      'held_count', COUNT(*) FILTER (WHERE pr.is_on_hold = TRUE),
      'held_amount_cents', COALESCE(SUM(pr.amount_cents) FILTER (WHERE pr.is_on_hold = TRUE), 0),
      'pending_count', COUNT(*) FILTER (WHERE pr.status IN ('pending', 'eligible', 'approved')),
      'pending_amount_cents', COALESCE(SUM(pr.amount_cents) FILTER (WHERE pr.status IN ('pending', 'eligible', 'approved')), 0)
    )
  INTO v_total, v_stats
  FROM payout_requests pr
  JOIN profiles p ON p.id = pr.user_id
  LEFT JOIN tournaments t ON t.id = pr.tournament_id
  WHERE p.tenant_id = p_tenant_id
    AND (p_status IS NULL OR pr.status = p_status)
    AND (p_is_held IS NULL OR pr.is_on_hold = p_is_held)
    AND (p_min_amount IS NULL OR pr.amount_cents >= p_min_amount)
    AND (p_max_amount IS NULL OR pr.amount_cents <= p_max_amount)
    AND (p_tournament_id IS NULL OR pr.tournament_id = p_tournament_id)
    AND (p_user_id IS NULL OR pr.user_id = p_user_id)
    AND (p_search IS NULL OR p.display_name ILIKE '%' || p_search || '%' OR p.email ILIKE '%' || p_search || '%' OR t.name ILIKE '%' || p_search || '%');

  -- Get paginated payouts
  SELECT jsonb_agg(row_to_json(t)) INTO v_payouts
  FROM (
    SELECT 
      pr.id,
      pr.user_id,
      pr.tournament_id,
      pr.amount_cents,
      pr.net_amount_cents,
      pr.placement,
      pr.status,
      pr.is_on_hold,
      pr.hold_reason,
      pr.hold_until,
      pr.failure_count,
      pr.failure_reason,
      pr.stripe_transfer_id,
      pr.created_at,
      pr.processed_at,
      pr.updated_at,
      p.display_name AS user_display_name,
      p.email AS user_email,
      p.avatar_url AS user_avatar_url,
      p.stripe_connect_account_id,
      p.stripe_connect_payouts_enabled,
      t.name AS tournament_name
    FROM payout_requests pr
    JOIN profiles p ON p.id = pr.user_id
    LEFT JOIN tournaments t ON t.id = pr.tournament_id
    WHERE p.tenant_id = p_tenant_id
      AND (p_status IS NULL OR pr.status = p_status)
      AND (p_is_held IS NULL OR pr.is_on_hold = p_is_held)
      AND (p_min_amount IS NULL OR pr.amount_cents >= p_min_amount)
      AND (p_max_amount IS NULL OR pr.amount_cents <= p_max_amount)
      AND (p_tournament_id IS NULL OR pr.tournament_id = p_tournament_id)
      AND (p_user_id IS NULL OR pr.user_id = p_user_id)
      AND (p_search IS NULL OR p.display_name ILIKE '%' || p_search || '%' OR p.email ILIKE '%' || p_search || '%' OR t.name ILIKE '%' || p_search || '%')
    ORDER BY
      CASE WHEN p_sort_by = 'created_at' AND p_sort_order = 'desc' THEN pr.created_at END DESC,
      CASE WHEN p_sort_by = 'created_at' AND p_sort_order = 'asc' THEN pr.created_at END ASC,
      CASE WHEN p_sort_by = 'amount' AND p_sort_order = 'desc' THEN pr.amount_cents END DESC,
      CASE WHEN p_sort_by = 'amount' AND p_sort_order = 'asc' THEN pr.amount_cents END ASC,
      CASE WHEN p_sort_by = 'status' THEN 
        CASE pr.status 
          WHEN 'pending' THEN 0 
          WHEN 'eligible' THEN 1 
          WHEN 'approved' THEN 2 
          WHEN 'processing' THEN 3 
          ELSE 4 
        END 
      END,
      pr.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) t;

  RETURN jsonb_build_object(
    'payouts', COALESCE(v_payouts, '[]'::jsonb),
    'total', v_total,
    'stats', v_stats,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissions
GRANT EXECUTE ON FUNCTION get_audit_log(UUID, TEXT, TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_audit_log_actions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_audit_log_resource_types(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_approve_payouts(UUID[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_release_holds(UUID[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_payouts_advanced(UUID, TEXT, BOOLEAN, INTEGER, INTEGER, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
