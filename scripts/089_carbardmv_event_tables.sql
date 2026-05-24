-- CARBARDMV Event Booking Tables
-- Run this BEFORE 090_seed_event_packages.sql

-- Event Packages table
CREATE TABLE IF NOT EXISTS cb_event_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  base_price_cents INTEGER NOT NULL DEFAULT 0,
  duration_hours INTEGER NOT NULL DEFAULT 2,
  max_guests INTEGER NOT NULL DEFAULT 10,
  includes JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Event Add-ons table
CREATE TABLE IF NOT EXISTS cb_event_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  price_type TEXT DEFAULT 'flat' CHECK (price_type IN ('flat', 'per_hour', 'per_guest')),
  category TEXT DEFAULT 'equipment',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Catering Categories table
CREATE TABLE IF NOT EXISTS cb_catering_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Catering Items table
CREATE TABLE IF NOT EXISTS cb_catering_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES cb_catering_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  price_type TEXT DEFAULT 'per_person' CHECK (price_type IN ('per_person', 'flat', 'per_item')),
  min_quantity INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Event Bookings table
CREATE TABLE IF NOT EXISTS cb_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  package_id UUID REFERENCES cb_event_packages(id),
  
  -- Contact info
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  company_name TEXT,
  
  -- Event details
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  guest_count INTEGER NOT NULL DEFAULT 10,
  event_type TEXT,
  special_requests TEXT,
  
  -- Pricing
  base_price_cents INTEGER DEFAULT 0,
  addons_price_cents INTEGER DEFAULT 0,
  catering_price_cents INTEGER DEFAULT 0,
  subtotal_cents INTEGER DEFAULT 0,
  tax_cents INTEGER DEFAULT 0,
  total_cents INTEGER DEFAULT 0,
  deposit_cents INTEGER DEFAULT 0,
  deposit_paid BOOLEAN DEFAULT false,
  
  -- Status
  status TEXT DEFAULT 'inquiry' CHECK (status IN ('inquiry', 'pending', 'confirmed', 'deposit_paid', 'completed', 'cancelled')),
  
  -- Stripe
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  
  -- Metadata
  selected_addons JSONB DEFAULT '[]'::jsonb,
  selected_catering JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Booking Payments table
CREATE TABLE IF NOT EXISTS cb_booking_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES cb_bookings(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  payment_type TEXT DEFAULT 'deposit' CHECK (payment_type IN ('deposit', 'final', 'refund')),
  stripe_payment_intent_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE cb_event_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cb_event_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE cb_catering_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cb_catering_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cb_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cb_booking_payments ENABLE ROW LEVEL SECURITY;

-- Public read access for packages, addons, catering
CREATE POLICY "Anyone can view active packages" ON cb_event_packages FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can view active addons" ON cb_event_addons FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can view active catering categories" ON cb_catering_categories FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can view active catering items" ON cb_catering_items FOR SELECT USING (is_active = true);

-- Booking policies
CREATE POLICY "Users can view their own bookings" ON cb_bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create bookings" ON cb_bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own bookings" ON cb_bookings FOR UPDATE USING (auth.uid() = user_id);

-- Payment policies
CREATE POLICY "Users can view their booking payments" ON cb_booking_payments FOR SELECT 
  USING (EXISTS (SELECT 1 FROM cb_bookings WHERE cb_bookings.id = booking_id AND cb_bookings.user_id = auth.uid()));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cb_bookings_user_id ON cb_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_cb_bookings_event_date ON cb_bookings(event_date);
CREATE INDEX IF NOT EXISTS idx_cb_bookings_status ON cb_bookings(status);
CREATE INDEX IF NOT EXISTS idx_cb_catering_items_category ON cb_catering_items(category_id);
