import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  })

  const statements = [
    // Staff shifts table
    `CREATE TABLE IF NOT EXISTS cb_staff_shifts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      staff_id UUID REFERENCES profiles(id),
      booking_id UUID,
      shift_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      role TEXT NOT NULL,
      location TEXT,
      notes TEXT,
      status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Prep tasks table
    `CREATE TABLE IF NOT EXISTS cb_prep_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID,
      catering_order_id UUID,
      assigned_to UUID REFERENCES profiles(id),
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL CHECK (category IN ('food_prep', 'setup', 'cleaning', 'inventory', 'other')),
      priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
      due_date DATE,
      due_time TIME,
      completed_at TIMESTAMPTZ,
      completed_by UUID REFERENCES profiles(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Bookings table (if needed)
    `CREATE TABLE IF NOT EXISTS cb_bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID REFERENCES profiles(id),
      customer_name TEXT NOT NULL,
      customer_email TEXT,
      customer_phone TEXT,
      event_type TEXT NOT NULL,
      event_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      location TEXT,
      guest_count INTEGER,
      notes TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
      total_amount DECIMAL(10,2),
      deposit_paid DECIMAL(10,2),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Menu items table
    `CREATE TABLE IF NOT EXISTS cb_menu_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      is_available BOOLEAN DEFAULT true,
      image_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Inventory table
    `CREATE TABLE IF NOT EXISTS cb_inventory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
      unit TEXT NOT NULL,
      min_quantity DECIMAL(10,2),
      cost_per_unit DECIMAL(10,2),
      supplier TEXT,
      last_restocked TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // RLS policies
    `ALTER TABLE cb_staff_shifts ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE cb_prep_tasks ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE cb_bookings ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE cb_menu_items ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE cb_inventory ENABLE ROW LEVEL SECURITY`,

    // Allow staff to manage shifts
    `DROP POLICY IF EXISTS "Staff can manage shifts" ON cb_staff_shifts`,
    `CREATE POLICY "Staff can manage shifts" ON cb_staff_shifts FOR ALL USING (
      EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid())
    )`,

    // Allow staff to manage prep tasks
    `DROP POLICY IF EXISTS "Staff can manage prep tasks" ON cb_prep_tasks`,
    `CREATE POLICY "Staff can manage prep tasks" ON cb_prep_tasks FOR ALL USING (
      EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid())
    )`,

    // Allow staff to manage bookings
    `DROP POLICY IF EXISTS "Staff can manage bookings" ON cb_bookings`,
    `CREATE POLICY "Staff can manage bookings" ON cb_bookings FOR ALL USING (
      EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid())
    )`,

    // Allow staff to manage menu items
    `DROP POLICY IF EXISTS "Staff can manage menu" ON cb_menu_items`,
    `CREATE POLICY "Staff can manage menu" ON cb_menu_items FOR ALL USING (
      EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid())
    )`,

    // Allow staff to manage inventory
    `DROP POLICY IF EXISTS "Staff can manage inventory" ON cb_inventory`,
    `CREATE POLICY "Staff can manage inventory" ON cb_inventory FOR ALL USING (
      EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid())
    )`,

    // Public can view menu items
    `DROP POLICY IF EXISTS "Public can view menu" ON cb_menu_items`,
    `CREATE POLICY "Public can view menu" ON cb_menu_items FOR SELECT USING (is_available = true)`,
  ]

  const results = []
  for (const sql of statements) {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(() => ({ error: null }))
    // Try direct query if rpc doesn't work
    if (error) {
      const { error: directError } = await supabase.from('_migrations').select().limit(0).catch(() => ({ error: null }))
      results.push({ sql: sql.substring(0, 50), error: error?.message || directError?.message || 'unknown' })
    } else {
      results.push({ sql: sql.substring(0, 50), success: true })
    }
  }

  return NextResponse.json({ 
    message: "Setup attempted. Please run the SQL statements in your Supabase dashboard SQL editor.",
    sql: statements.join(';\n\n'),
    results 
  })
}

export async function GET() {
  return NextResponse.json({
    message: "POST to this endpoint to get the SQL statements needed for CarbarDMV tables"
  })
}
