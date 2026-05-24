import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check admin access
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["owner", "manager"])
    .single()

  if (!staffRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { alertId, action, notes } = await req.json()

  if (!alertId || !action) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  if (action !== "resolved" && action !== "dismissed") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const { error } = await supabase
    .from("compliance_alerts")
    .update({
      status: action,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
      resolution_notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", alertId)

  if (error) {
    console.error("[Admin Compliance Resolve] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
