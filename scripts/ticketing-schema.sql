-- MAJH TICKETING MODULE SCHEMA
-- Part 1: Core Tables

-- ===========================================
-- EVENTS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  short_description TEXT,
  location_name TEXT,
  location_address TEXT,
  location_city TEXT,
  location_state TEXT,
  location_country TEXT DEFAULT 'US',
  location_coordinates JSONB, -- {lat, lng}
  venue_id UUID, -- future: link to venues table
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  doors_open_at TIMESTAMPTZ,
  timezone TEXT DEFAULT 'America/New_York',
  capacity INT,
  is_online BOOLEAN DEFAULT FALSE,
  online_url TEXT,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed', 'postponed')),
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'unlisted')),
  require_approval BOOLEAN DEFAULT FALSE,
  age_restriction TEXT CHECK (age_restriction IN ('all_ages', '18+', '21+')),
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(tenant_id, slug);

-- ===========================================
-- TICKET TYPES (Tiers)
-- ===========================================
CREATE TABLE IF NOT EXISTS ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INT NOT NULL DEFAULT 0,
  compare_at_price_cents INT, -- for showing discounts
  quantity_total INT NOT NULL,
  quantity_sold INT DEFAULT 0,
  quantity_reserved INT DEFAULT 0, -- held in carts
  min_per_order INT DEFAULT 1,
  max_per_order INT DEFAULT 10,
  sales_start_at TIMESTAMPTZ,
  sales_end_at TIMESTAMPTZ,
  visibility TEXT DEFAULT 'visible' CHECK (visibility IN ('visible', 'hidden', 'password')),
  access_password TEXT, -- for password-protected tiers
  sort_order INT DEFAULT 0,
  is_free BOOLEAN GENERATED ALWAYS AS (price_cents = 0) STORED,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_types_event ON ticket_types(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_tenant ON ticket_types(tenant_id);

-- ===========================================
-- TICKET ORDERS
-- ===========================================
CREATE TABLE IF NOT EXISTS ticket_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id),
  user_id UUID REFERENCES auth.users(id),
  order_number TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded')),
  subtotal_cents INT NOT NULL DEFAULT 0,
  fees_cents INT NOT NULL DEFAULT 0,
  tax_cents INT NOT NULL DEFAULT 0,
  discount_cents INT NOT NULL DEFAULT 0,
  total_cents INT NOT NULL DEFAULT 0,
  amount_refunded_cents INT DEFAULT 0,
  currency TEXT DEFAULT 'usd',
  promo_code_id UUID,
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  ledger_transaction_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ, -- for pending orders
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_ticket_orders_tenant ON ticket_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_orders_event ON ticket_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_orders_user ON ticket_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_orders_status ON ticket_orders(status);
CREATE INDEX IF NOT EXISTS idx_ticket_orders_stripe ON ticket_orders(stripe_payment_intent_id);

-- ===========================================
-- TICKET ORDER ITEMS
-- ===========================================
CREATE TABLE IF NOT EXISTS ticket_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ticket_orders(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES ticket_types(id),
  quantity INT NOT NULL,
  unit_price_cents INT NOT NULL,
  total_cents INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON ticket_order_items(order_id);

-- ===========================================
-- TICKETS (Individual Admission)
-- ===========================================
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id),
  ticket_type_id UUID NOT NULL REFERENCES ticket_types(id),
  order_id UUID REFERENCES ticket_orders(id),
  owner_user_id UUID REFERENCES auth.users(id),
  attendee_email TEXT,
  attendee_first_name TEXT,
  attendee_last_name TEXT,
  ticket_number TEXT NOT NULL,
  qr_code TEXT UNIQUE NOT NULL,
  barcode TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'checked_in', 'cancelled', 'refunded', 'transferred', 'expired')),
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES auth.users(id),
  check_in_location TEXT,
  transfer_count INT DEFAULT 0,
  max_transfers INT DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, ticket_number)
);

CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_owner ON tickets(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_order ON tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr ON tickets(qr_code);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

-- ===========================================
-- PROMO CODES
-- ===========================================
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id), -- NULL = applies to all events
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value INT NOT NULL, -- percentage (0-100) or cents
  max_uses INT,
  times_used INT DEFAULT 0,
  min_order_cents INT,
  applies_to TEXT DEFAULT 'all' CHECK (applies_to IN ('all', 'specific_types')),
  ticket_type_ids UUID[],
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_tenant ON promo_codes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(tenant_id, code);

-- ===========================================
-- CHECK-IN LOG (Audit Trail)
-- ===========================================
CREATE TABLE IF NOT EXISTS ticket_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  event_id UUID NOT NULL REFERENCES events(id),
  action TEXT NOT NULL CHECK (action IN ('check_in', 'check_out', 'denied')),
  performed_by UUID REFERENCES auth.users(id),
  location TEXT,
  device_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_check_ins_ticket ON ticket_check_ins(ticket_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_event ON ticket_check_ins(event_id);

-- ===========================================
-- RLS POLICIES
-- ===========================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_check_ins ENABLE ROW LEVEL SECURITY;

-- Events: Public can view published, members can manage
DROP POLICY IF EXISTS "Public can view published events" ON events;
CREATE POLICY "Public can view published events" ON events
  FOR SELECT USING (status = 'published' AND visibility = 'public');

DROP POLICY IF EXISTS "Tenant members can manage events" ON events;
CREATE POLICY "Tenant members can manage events" ON events
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid())
  );

-- Ticket Types: Public can view for published events
DROP POLICY IF EXISTS "Public can view ticket types" ON ticket_types;
CREATE POLICY "Public can view ticket types" ON ticket_types
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE status = 'published')
    AND visibility = 'visible'
  );

DROP POLICY IF EXISTS "Tenant members can manage ticket types" ON ticket_types;
CREATE POLICY "Tenant members can manage ticket types" ON ticket_types
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid())
  );

-- Orders: Users see own, admins see all tenant
DROP POLICY IF EXISTS "Users can view own orders" ON ticket_orders;
CREATE POLICY "Users can view own orders" ON ticket_orders
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Tenant admins can manage orders" ON ticket_orders;
CREATE POLICY "Tenant admins can manage orders" ON ticket_orders
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Tickets: Owners see own, admins see all
DROP POLICY IF EXISTS "Users can view own tickets" ON tickets;
CREATE POLICY "Users can view own tickets" ON tickets
  FOR SELECT USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Tenant members can manage tickets" ON tickets;
CREATE POLICY "Tenant members can manage tickets" ON tickets
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid())
  );

-- Promo codes: Admins only
DROP POLICY IF EXISTS "Tenant admins can manage promo codes" ON promo_codes;
CREATE POLICY "Tenant admins can manage promo codes" ON promo_codes
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Check-ins: Members can view
DROP POLICY IF EXISTS "Tenant members can manage check-ins" ON ticket_check_ins;
CREATE POLICY "Tenant members can manage check-ins" ON ticket_check_ins
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid())
  );

-- ===========================================
-- GRANTS
-- ===========================================
GRANT SELECT ON events TO anon;
GRANT SELECT ON ticket_types TO anon;
GRANT SELECT, INSERT, UPDATE ON events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ticket_types TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ticket_orders TO authenticated;
GRANT SELECT, INSERT ON ticket_order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON tickets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON promo_codes TO authenticated;
GRANT SELECT, INSERT ON ticket_check_ins TO authenticated;
