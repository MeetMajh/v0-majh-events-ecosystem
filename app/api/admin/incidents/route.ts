import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()
    
  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const severity = searchParams.get("severity")
  const status = searchParams.get("status") || "active" // active = unacknowledged

  // Build query
  let query = supabase
    .from("system_alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)

  if (severity) {
    query = query.eq("severity", severity)
  }

  if (status === "active") {
    query = query.is("acknowledged_at", null)
  } else if (status === "acknowledged") {
    query = query.not("acknowledged_at", "is", null)
  }

  const { data: alerts, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get counts by severity
  const [
    { count: criticalCount },
    { count: warningCount },
    { count: infoCount },
    { count: totalActiveCount },
  ] = await Promise.all([
    supabase.from("system_alerts").select("*", { count: "exact", head: true }).eq("severity", "critical").is("acknowledged_at", null),
    supabase.from("system_alerts").select("*", { count: "exact", head: true }).eq("severity", "warning").is("acknowledged_at", null),
    supabase.from("system_alerts").select("*", { count: "exact", head: true }).eq("severity", "info").is("acknowledged_at", null),
    supabase.from("system_alerts").select("*", { count: "exact", head: true }).is("acknowledged_at", null),
  ])

  return NextResponse.json({
    alerts,
    counts: {
      critical: criticalCount || 0,
      warning: warningCount || 0,
      info: infoCount || 0,
      total: totalActiveCount || 0,
    }
  })
}

// Acknowledge an alert
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()
    
  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const { alertId, action, notes } = await request.json()

  if (action === "acknowledge") {
    const { error } = await supabase
      .from("system_alerts")
      .update({ 
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: user.id,
        resolution_notes: notes || null
      })
      .eq("id", alertId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log to audit
    await supabase.from("reconciliation_audit_log").insert({
      action_type: "alert_acknowledged",
      target_type: "system_alert",
      target_id: alertId,
      performed_by: user.id,
      reason: notes || "Alert acknowledged",
      status: "completed"
    })

    return NextResponse.json({ success: true, action: "acknowledged" })
  }

  if (action === "escalate") {
    // Update alert severity
    const { error } = await supabase
      .from("system_alerts")
      .update({ severity: "critical" })
      .eq("id", alertId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log escalation
    await supabase.from("reconciliation_audit_log").insert({
      action_type: "alert_escalated",
      target_type: "system_alert",
      target_id: alertId,
      performed_by: user.id,
      reason: notes || "Alert escalated to critical",
      status: "completed"
    })

    return NextResponse.json({ success: true, action: "escalated" })
  }

  if (action === "create_incident") {
    // Create a formal incident record
    const { data: alert } = await supabase
      .from("system_alerts")
      .select("*")
      .eq("id", alertId)
      .single()

    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 })
    }

    // Log incident creation
    await supabase.from("reconciliation_audit_log").insert({
      action_type: "incident_created",
      target_type: "system_alert",
      target_id: alertId,
      performed_by: user.id,
      reason: `Incident created from alert: ${alert.message}`,
      status: "active",
      metadata: {
        alert_type: alert.alert_type,
        severity: alert.severity,
        source: alert.source,
        details: alert.details
      }
    })

    return NextResponse.json({ 
      success: true, 
      action: "incident_created",
      alert 
    })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
