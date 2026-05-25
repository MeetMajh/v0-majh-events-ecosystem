import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
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
      profiles(username, display_name, email)
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
