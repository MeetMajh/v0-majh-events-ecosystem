import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// POST - Toggle chaos mode
export async function POST(request: Request) {
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

  const { enabled } = await request.json()

  // Toggle chaos mode via system controls
  const { error } = await supabase.rpc("toggle_system_control", {
    p_control_type: "chaos_mode_enabled",
    p_is_enabled: enabled,
    p_admin_id: user.id,
    p_reason: enabled ? "Chaos testing enabled" : "Chaos testing disabled"
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ 
    success: true, 
    chaosModeEnabled: enabled 
  })
}
