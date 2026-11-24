import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { requireStaffRoute } from "@/lib/auth/require-staff-route"

export async function GET(req: Request) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Tier: "manager". Technical/operational authority; financial reads.
  const guard = await requireStaffRoute("manager")
  if (!guard.ok) return guard.response
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") || "open"
  const severity = searchParams.get("severity") || "all"
  const search = searchParams.get("search") || ""

  let query = supabase
    .from("compliance_alerts")
    .select(`
      id,
      user_id,
      alert_type,
      severity,
      title,
      description,
      status,
      metadata,
      created_at,
      resolved_at,
      resolution_notes,
      profiles!compliance_alerts_user_id_fkey(username, display_name)
    `)
    .order("created_at", { ascending: false })
    .limit(50)

  if (status !== "all") {
    query = query.eq("status", status)
  }

  if (severity !== "all") {
    query = query.eq("severity", severity)
  }

  if (search) {
    query = query.ilike("title", `%${search}%`)
  }

  const { data: alerts, error } = await query

  if (error) {
    console.error("[Admin Compliance Alerts] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ alerts: alerts || [] })
}
