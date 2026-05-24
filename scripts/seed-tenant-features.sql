-- Enable all features for MAJH Events tenant
-- Run this to activate the ticketing, financial, and other modules

INSERT INTO tenant_features (tenant_id, feature_key, is_enabled, enabled_at)
VALUES
  ('8dd63bc0-1742-478e-8743-dc55ce2b7127', 'wallets', true, NOW()),
  ('8dd63bc0-1742-478e-8743-dc55ce2b7127', 'tournaments', true, NOW()),
  ('8dd63bc0-1742-478e-8743-dc55ce2b7127', 'ticketing', true, NOW()),
  ('8dd63bc0-1742-478e-8743-dc55ce2b7127', 'escrow', true, NOW()),
  ('8dd63bc0-1742-478e-8743-dc55ce2b7127', 'payouts', true, NOW()),
  ('8dd63bc0-1742-478e-8743-dc55ce2b7127', 'api_access', true, NOW()),
  ('8dd63bc0-1742-478e-8743-dc55ce2b7127', 'advanced_analytics', true, NOW()),
  ('8dd63bc0-1742-478e-8743-dc55ce2b7127', 'webhook_events', true, NOW()),
  ('8dd63bc0-1742-478e-8743-dc55ce2b7127', 'venue_management', true, NOW()),
  ('8dd63bc0-1742-478e-8743-dc55ce2b7127', 'staff_management', true, NOW()),
  ('8dd63bc0-1742-478e-8743-dc55ce2b7127', 'badge_printing', true, NOW())
ON CONFLICT (tenant_id, feature_key) 
DO UPDATE SET is_enabled = true, updated_at = NOW();

-- Verify features are enabled
SELECT get_tenant_features('8dd63bc0-1742-478e-8743-dc55ce2b7127'::uuid);
