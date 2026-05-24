import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET - Fetch chaos test history
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check admin access
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  // Get chaos mode status
  const { data: chaosControl } = await supabase
    .from("system_controls")
    .select("is_enabled")
    .eq("control_type", "chaos_mode_enabled")
    .single()

  // Get test history
  const { data: history, error } = await supabase.rpc("get_chaos_test_history", { p_limit: 20 })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    chaosModeEnabled: chaosControl?.is_enabled || false,
    history: history || []
  })
}

// POST - Run chaos test suite
export async function POST() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check admin access
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  // Run chaos suite
  const { data, error } = await supabase.rpc("run_chaos_suite", {
    p_admin_id: user.id
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
