-- =============================================
-- Real-Time Alerts System
-- Webhook notifications + auto-flagging
-- =============================================

-- Alert configurations table
CREATE TABLE IF NOT EXISTS alert_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'dispute_created', 'dispute_lost', 'high_fraud_score', 
    'large_payout', 'payout_failed', 'refund_requested',
    'hold_triggered', 'reconciliation_failed', 'daily_summary'
  )),
  is_enabled BOOLEAN DEFAULT TRUE,
  threshold_amount_cents BIGINT,
  threshold_fraud_score INTEGER,
  webhook_url TEXT,
  slack_webhook_url TEXT,
  email_recipients TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, alert_type)
);

CREATE INDEX IF NOT EXISTS idx_alert_configurations_tenant ON alert_configurations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_configurations_type ON alert_configurations(alert_type);

-- Alert history/log table
CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed', 'skipped')),
  delivered_at TIMESTAMPTZ,
  delivery_error TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES profiles(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_history_tenant ON alert_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_type ON alert_history(alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_history_severity ON alert_history(severity);
CREATE INDEX IF NOT EXISTS idx_alert_history_unacked ON alert_history(acknowledged, created_at) WHERE acknowledged = FALSE;
CREATE INDEX IF NOT EXISTS idx_alert_history_created ON alert_history(created_at DESC);

-- RLS
ALTER TABLE alert_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage alert configs" ON alert_configurations FOR ALL 
USING (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.role IN ('owner', 'manager')))
WITH CHECK (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.role IN ('owner', 'manager')));

CREATE POLICY "Staff can view alert history" ON alert_history FOR SELECT 
USING (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.role IN ('owner', 'manager', 'finance')));

CREATE POLICY "Service role manages alerts" ON alert_history FOR ALL 
USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- =============================================
-- Create Alert Function
-- =============================================
CREATE OR REPLACE FUNCTION create_alert(
  p_tenant_id UUID,
  p_alert_type TEXT,
  p_severity TEXT,
  p_title TEXT,
  p_message TEXT DEFAULT NULL,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  v_alert_id UUID;
  v_config RECORD;
BEGIN
  -- Check if alert type is enabled
  SELECT * INTO v_config 
  FROM alert_configurations 
  WHERE tenant_id = p_tenant_id AND alert_type = p_alert_type AND is_enabled = TRUE;

  -- Insert alert regardless (for history)
  INSERT INTO alert_history (
    tenant_id, alert_type, severity, title, message, 
    resource_type, resource_id, metadata, delivery_status
  ) VALUES (
    p_tenant_id, p_alert_type, p_severity, p_title, p_message,
    p_resource_type, p_resource_id, p_metadata,
    CASE WHEN v_config IS NOT NULL THEN 'pending' ELSE 'skipped' END
  ) RETURNING id INTO v_alert_id;

  RETURN jsonb_build_object(
    'success', true,
    'alert_id', v_alert_id,
    'delivery_status', CASE WHEN v_config IS NOT NULL THEN 'pending' ELSE 'skipped' END,
    'has_webhook', v_config.webhook_url IS NOT NULL,
    'has_slack', v_config.slack_webhook_url IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Get Pending Alerts (for webhook worker)
-- =============================================
CREATE OR REPLACE FUNCTION get_pending_alerts(p_limit INTEGER DEFAULT 50)
RETURNS JSONB AS $$
DECLARE
  v_alerts JSONB;
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT jsonb_agg(row_to_json(t)) INTO v_alerts
  FROM (
    SELECT 
      ah.id,
      ah.tenant_id,
      ah.alert_type,
      ah.severity,
      ah.title,
      ah.message,
      ah.resource_type,
      ah.resource_id,
      ah.metadata,
      ah.created_at,
      ac.webhook_url,
      ac.slack_webhook_url,
      ac.email_recipients
    FROM alert_history ah
    JOIN alert_configurations ac ON ac.tenant_id = ah.tenant_id AND ac.alert_type = ah.alert_type
    WHERE ah.delivery_status = 'pending'
    AND ac.is_enabled = TRUE
    ORDER BY 
      CASE ah.severity 
        WHEN 'critical' THEN 0 
        WHEN 'warning' THEN 1 
        ELSE 2 
      END,
      ah.created_at ASC
    LIMIT p_limit
  ) t;

  RETURN jsonb_build_object('alerts', COALESCE(v_alerts, '[]'::jsonb));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Mark Alert Delivered
-- =============================================
CREATE OR REPLACE FUNCTION mark_alert_delivered(
  p_alert_id UUID,
  p_success BOOLEAN,
  p_error TEXT DEFAULT NULL
) RETURNS JSONB AS $$
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE alert_history SET
    delivery_status = CASE WHEN p_success THEN 'sent' ELSE 'failed' END,
    delivered_at = CASE WHEN p_success THEN NOW() ELSE NULL END,
    delivery_error = p_error
  WHERE id = p_alert_id;

  RETURN jsonb_build_object('success', true, 'alert_id', p_alert_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Get Active Alerts (unacknowledged)
-- =============================================
CREATE OR REPLACE FUNCTION get_active_alerts(
  p_tenant_id UUID,
  p_severity TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
) RETURNS JSONB AS $$
DECLARE
  v_alerts JSONB;
  v_counts JSONB;
BEGIN
  IF auth.role() != 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'finance')
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  -- Get counts by severity
  SELECT jsonb_build_object(
    'critical', COUNT(*) FILTER (WHERE severity = 'critical' AND acknowledged = FALSE),
    'warning', COUNT(*) FILTER (WHERE severity = 'warning' AND acknowledged = FALSE),
    'info', COUNT(*) FILTER (WHERE severity = 'info' AND acknowledged = FALSE),
    'total', COUNT(*) FILTER (WHERE acknowledged = FALSE)
  ) INTO v_counts
  FROM alert_history
  WHERE tenant_id = p_tenant_id;

  -- Get alerts
  SELECT jsonb_agg(row_to_json(t)) INTO v_alerts
  FROM (
    SELECT 
      id, alert_type, severity, title, message,
      resource_type, resource_id, metadata,
      delivery_status, created_at, acknowledged
    FROM alert_history
    WHERE tenant_id = p_tenant_id
    AND (p_severity IS NULL OR severity = p_severity)
    ORDER BY 
      acknowledged ASC,
      CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
      created_at DESC
    LIMIT p_limit
  ) t;

  RETURN jsonb_build_object(
    'alerts', COALESCE(v_alerts, '[]'::jsonb),
    'counts', v_counts
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Acknowledge Alert
-- =============================================
CREATE OR REPLACE FUNCTION acknowledge_alert(p_alert_id UUID)
RETURNS JSONB AS $$
BEGIN
  IF auth.role() != 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'finance')
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  UPDATE alert_history SET
    acknowledged = TRUE,
    acknowledged_by = auth.uid(),
    acknowledged_at = NOW()
  WHERE id = p_alert_id;

  RETURN jsonb_build_object('success', true, 'alert_id', p_alert_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Acknowledge All Alerts
-- =============================================
CREATE OR REPLACE FUNCTION acknowledge_all_alerts(p_tenant_id UUID, p_severity TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.role() != 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  UPDATE alert_history SET
    acknowledged = TRUE,
    acknowledged_by = auth.uid(),
    acknowledged_at = NOW()
  WHERE tenant_id = p_tenant_id
  AND acknowledged = FALSE
  AND (p_severity IS NULL OR severity = p_severity);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'acknowledged_count', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Get/Update Alert Configuration
-- =============================================
CREATE OR REPLACE FUNCTION get_alert_configurations(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_configs JSONB;
BEGIN
  IF auth.role() != 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  SELECT jsonb_agg(row_to_json(ac)) INTO v_configs
  FROM alert_configurations ac
  WHERE tenant_id = p_tenant_id
  ORDER BY alert_type;

  RETURN jsonb_build_object('configurations', COALESCE(v_configs, '[]'::jsonb));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION upsert_alert_configuration(
  p_tenant_id UUID,
  p_alert_type TEXT,
  p_is_enabled BOOLEAN DEFAULT TRUE,
  p_threshold_amount_cents BIGINT DEFAULT NULL,
  p_threshold_fraud_score INTEGER DEFAULT NULL,
  p_webhook_url TEXT DEFAULT NULL,
  p_slack_webhook_url TEXT DEFAULT NULL,
  p_email_recipients TEXT[] DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_config_id UUID;
BEGIN
  IF auth.role() != 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  INSERT INTO alert_configurations (
    tenant_id, alert_type, is_enabled, threshold_amount_cents,
    threshold_fraud_score, webhook_url, slack_webhook_url, email_recipients
  ) VALUES (
    p_tenant_id, p_alert_type, p_is_enabled, p_threshold_amount_cents,
    p_threshold_fraud_score, p_webhook_url, p_slack_webhook_url, p_email_recipients
  )
  ON CONFLICT (tenant_id, alert_type) DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled,
    threshold_amount_cents = COALESCE(EXCLUDED.threshold_amount_cents, alert_configurations.threshold_amount_cents),
    threshold_fraud_score = COALESCE(EXCLUDED.threshold_fraud_score, alert_configurations.threshold_fraud_score),
    webhook_url = COALESCE(EXCLUDED.webhook_url, alert_configurations.webhook_url),
    slack_webhook_url = COALESCE(EXCLUDED.slack_webhook_url, alert_configurations.slack_webhook_url),
    email_recipients = COALESCE(EXCLUDED.email_recipients, alert_configurations.email_recipients),
    updated_at = NOW()
  RETURNING id INTO v_config_id;

  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    auth.uid(), 'alert_config_updated', 'alert_configuration', v_config_id,
    jsonb_build_object('alert_type', p_alert_type, 'is_enabled', p_is_enabled)
  );

  RETURN jsonb_build_object('success', true, 'config_id', v_config_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Auto-flag High Risk Payouts
-- =============================================
CREATE OR REPLACE FUNCTION auto_flag_high_risk_payout()
RETURNS TRIGGER AS $$
DECLARE
  v_config RECORD;
  v_tenant_id UUID;
BEGIN
  -- Get tenant_id from profile
  SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = NEW.user_id;

  -- Check for high fraud score alert
  SELECT * INTO v_config 
  FROM alert_configurations 
  WHERE tenant_id = v_tenant_id 
  AND alert_type = 'high_fraud_score' 
  AND is_enabled = TRUE;

  IF FOUND AND v_config.threshold_fraud_score IS NOT NULL THEN
    IF NEW.fraud_score >= v_config.threshold_fraud_score THEN
      -- Auto-hold the payout
      NEW.is_on_hold := TRUE;
      NEW.hold_reason := 'Auto-flagged: High fraud score (' || NEW.fraud_score || ')';
      NEW.hold_created_at := NOW();

      -- Create alert
      PERFORM create_alert(
        v_tenant_id,
        'high_fraud_score',
        'critical',
        'High Fraud Score Detected',
        'Payout auto-held due to fraud score of ' || NEW.fraud_score,
        'payout_request',
        NEW.id,
        jsonb_build_object(
          'fraud_score', NEW.fraud_score,
          'amount_cents', NEW.amount_cents,
          'user_id', NEW.user_id
        )
      );
    END IF;
  END IF;

  -- Check for large payout alert
  SELECT * INTO v_config 
  FROM alert_configurations 
  WHERE tenant_id = v_tenant_id 
  AND alert_type = 'large_payout' 
  AND is_enabled = TRUE;

  IF FOUND AND v_config.threshold_amount_cents IS NOT NULL THEN
    IF NEW.amount_cents >= v_config.threshold_amount_cents THEN
      -- Create alert (don't auto-hold, just notify)
      PERFORM create_alert(
        v_tenant_id,
        'large_payout',
        'warning',
        'Large Payout Pending',
        'Payout of $' || (NEW.amount_cents / 100.0)::text || ' requires attention',
        'payout_request',
        NEW.id,
        jsonb_build_object(
          'amount_cents', NEW.amount_cents,
          'user_id', NEW.user_id,
          'threshold_cents', v_config.threshold_amount_cents
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (drop if exists first)
DROP TRIGGER IF EXISTS trg_auto_flag_payout ON payout_requests;
CREATE TRIGGER trg_auto_flag_payout
  BEFORE INSERT OR UPDATE OF fraud_score, amount_cents
  ON payout_requests
  FOR EACH ROW
  EXECUTE FUNCTION auto_flag_high_risk_payout();

-- =============================================
-- Permissions
-- =============================================
GRANT EXECUTE ON FUNCTION create_alert(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION get_pending_alerts(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION mark_alert_delivered(UUID, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_active_alerts(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION acknowledge_alert(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION acknowledge_all_alerts(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_alert_configurations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_alert_configuration(UUID, TEXT, BOOLEAN, BIGINT, INTEGER, TEXT, TEXT, TEXT[]) TO authenticated;
