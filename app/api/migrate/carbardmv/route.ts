import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST() {
  const supabase = await createClient()
  
  // Check if user is authenticated and has owner/manager role
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (!staffRole || !["owner", "manager"].includes(staffRole.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 })
  }

  const results: { table: string; status: string; error?: string }[] = []

  // Create cb_staff_shifts table
  const { error: shiftsError } = await supabase.rpc("exec_sql", {
    sql: `
      CREATE TABLE IF NOT EXISTS cb_staff_shifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        staff_id UUID REFERENCES profiles(id),
        booking_id UUID,
        shift_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        role TEXT NOT NULL,
        location TEXT,
        notes TEXT,
        status TEXT DEFAULT 'scheduled',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  })

  if (shiftsError) {
    // Try direct insert to test if table exists
    const { error: testError } = await supabase
      .from("cb_staff_shifts")
      .select("id")
      .limit(1)
    
    if (testError?.code === "42P01") {
      results.push({ table: "cb_staff_shifts", status: "failed", error: "Table does not exist and cannot be created via API. Please run SQL in Supabase dashboard." })
    } else {
      results.push({ table: "cb_staff_shifts", status: "exists" })
    }
  } else {
    results.push({ table: "cb_staff_shifts", status: "created" })
  }

  // Create cb_prep_tasks table
  const { error: tasksError } = await supabase.rpc("exec_sql", {
    sql: `
      CREATE TABLE IF NOT EXISTS cb_prep_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID,
        assigned_to UUID REFERENCES profiles(id),
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'pending',
        due_date DATE,
        due_time TIME,
        completed_at TIMESTAMPTZ,
        completed_by UUID REFERENCES profiles(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  })

  if (tasksError) {
    // Try direct insert to test if table exists
    const { error: testError } = await supabase
      .from("cb_prep_tasks")
      .select("id")
      .limit(1)
    
    if (testError?.code === "42P01") {
      results.push({ table: "cb_prep_tasks", status: "failed", error: "Table does not exist and cannot be created via API. Please run SQL in Supabase dashboard." })
    } else {
      results.push({ table: "cb_prep_tasks", status: "exists" })
    }
  } else {
    results.push({ table: "cb_prep_tasks", status: "created" })
  }

  // Check if any tables need manual creation
  const needsManualSetup = results.some(r => r.status === "failed")

  return NextResponse.json({
    success: !needsManualSetup,
    results,
    message: needsManualSetup 
      ? "Some tables need to be created manually in Supabase SQL Editor"
      : "All tables are ready",
    sql: needsManualSetup ? getManualSQL() : undefined
  })
}

export async function GET() {
  const supabase = await createClient()
  
  // Check table status
  const results: { table: string; exists: boolean }[] = []

  const { error: shiftsError } = await supabase
    .from("cb_staff_shifts")
    .select("id")
    .limit(1)
  results.push({ table: "cb_staff_shifts", exists: shiftsError?.code !== "42P01" })

  const { error: tasksError } = await supabase
    .from("cb_prep_tasks")
    .select("id")
    .limit(1)
  results.push({ table: "cb_prep_tasks", exists: tasksError?.code !== "42P01" })

  const allExist = results.every(r => r.exists)

  return NextResponse.json({
    ready: allExist,
    results,
    sql: allExist ? undefined : getManualSQL()
  })
}

function getManualSQL() {
  return `-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql/new)

-- Staff Shifts Table
CREATE TABLE IF NOT EXISTS cb_staff_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES profiles(id),
  booking_id UUID,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  role TEXT NOT NULL,
  location TEXT,
  notes TEXT,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prep Tasks Table
CREATE TABLE IF NOT EXISTS cb_prep_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID,
  assigned_to UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  due_date DATE,
  due_time TIME,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE cb_staff_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cb_prep_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all authenticated staff)
CREATE POLICY "Staff can manage shifts" ON cb_staff_shifts FOR ALL 
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid()));

CREATE POLICY "Staff can manage prep tasks" ON cb_prep_tasks FOR ALL 
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid()));
`
}
