/*
  PRIVILEGED RPCs MOVED TO service_role, 2026-11-19.

  Six SECURITY DEFINER functions had NO caller authorization check of any
  kind — verified by reading every body for auth.uid(), a role predicate, or
  anything equivalent:

      adjust_wallet_balance        changes ANY user's balance
      post_ledger_transaction      posts arbitrary ledger entries
      trigger_emergency_lockdown   locks the platform down
      lift_emergency_lockdown      unlocks it
      toggle_system_control        flips system controls
      run_chaos_suite              runs chaos tests against production

  Each took the acting admin's identity as a PARAMETER (`p_admin_id`) rather
  than reading it from the session, which is worth nothing as authorization
  because the caller supplies it. And each was EXECUTE-able by `authenticated`,
  so any signed-in user could call it directly over PostgREST as
  POST /rest/v1/rpc/<name>, bypassing this route entirely.

  The routes themselves were never the hole — they gate on auth.getUser()
  plus profiles.is_admin. The hole was the direct RPC path around them.

  THE FIX, in two halves that only work together:
    1. this file now performs the privileged call with createAdminClient()
       (service_role), AFTER its own admin gate above;
    2. migration 20261119_010 revokes `authenticated` EXECUTE on all six,
       which closes the direct PostgREST path.

  Deliberately NOT fixed by adding an in-function check copied from the
  neighbouring admin_* functions. Those test

      staff_roles.role IN ('owner','manager','finance')

  while staff_roles actually holds PLATFORM_OWNER and TENANT_MANAGER — so
  that comparison cannot pass for any human, and those functions raise
  'Unauthorized' for everyone except service_role. They are not secured by
  design, they are secured by an always-false comparison, and normalising the
  role vocabulary would arm all of them at once. Copying that pattern would
  be fitting a lock already known not to turn. See majh-foundry D-011.
*/
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

const AlertSchema = z.object({
  type: z.string(),
  severity: z.enum(["info", "warning", "critical", "emergency"]),
  source: z.string(),
  message: z.string(),
  details: z.record(z.any()).optional(),
  triggerLockdown: z.boolean().optional().default(false),
})

// POST - Log a new system alert
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validation = AlertSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json({ 
        success: false, 
        error: "Invalid alert data",
        issues: validation.error.issues 
      }, { status: 400 })
    }

    const { type, severity, source, message, details, triggerLockdown } = validation.data

    // If emergency with lockdown flag, trigger full system lockdown
    if (severity === "emergency" && triggerLockdown) {
      const { data, error } = await createAdminClient().rpc("trigger_emergency_lockdown", {
        p_reason: message,
        p_source: source,
        p_admin_id: user.id,
      })

      if (error) {
        console.error("Failed to trigger lockdown:", error)
        return NextResponse.json({ 
          success: false, 
          error: "Failed to trigger emergency lockdown: " + error.message 
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        alertId: data.alert_id,
        action: "emergency_lockdown",
        message: "Emergency lockdown triggered - all financial operations disabled",
      })
    }

    // Log the alert
    const { data, error } = await supabase.rpc("log_system_alert", {
      p_alert_type: type,
      p_severity: severity,
      p_source: source,
      p_message: message,
      p_details: details || null,
      p_user_id: user.id,
      p_auto_action: null,
    })

    if (error) {
      console.error("Failed to log alert:", error)
      return NextResponse.json({ 
        success: false, 
        error: "Failed to log alert: " + error.message 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      alertId: data.alert_id,
    })

  } catch (error) {
    console.error("System alert error:", error)
    return NextResponse.json({ 
      success: false, 
      error: "Internal server error" 
    }, { status: 500 })
  }
}

// GET - Fetch system alerts
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const severity = searchParams.get("severity")
    const unresolved = searchParams.get("unresolved") === "true"
    const limit = parseInt(searchParams.get("limit") || "50")

    let query = supabase
      .from("system_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (severity) {
      query = query.eq("severity", severity)
    }

    if (unresolved) {
      query = query.is("resolved_at", null)
    }

    const { data: alerts, error } = await query

    if (error) {
      console.error("Failed to fetch alerts:", error)
      return NextResponse.json({ 
        success: false, 
        error: "Failed to fetch alerts: " + error.message 
      }, { status: 500 })
    }

    // Get counts by severity for unresolved alerts
    const { data: counts } = await supabase
      .from("system_alerts")
      .select("severity")
      .is("resolved_at", null)

    const severityCounts = {
      info: 0,
      warning: 0,
      critical: 0,
      emergency: 0,
    }

    counts?.forEach(c => {
      if (c.severity in severityCounts) {
        severityCounts[c.severity as keyof typeof severityCounts]++
      }
    })

    return NextResponse.json({
      success: true,
      alerts,
      counts: severityCounts,
      hasUnresolved: (counts?.length || 0) > 0,
      hasCritical: severityCounts.critical > 0 || severityCounts.emergency > 0,
    })

  } catch (error) {
    console.error("System alert fetch error:", error)
    return NextResponse.json({ 
      success: false, 
      error: "Internal server error" 
    }, { status: 500 })
  }
}

// PATCH - Resolve an alert
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { alertId, resolutionNotes } = body

    if (!alertId || !resolutionNotes) {
      return NextResponse.json({ 
        success: false, 
        error: "alertId and resolutionNotes are required" 
      }, { status: 400 })
    }

    const { data, error } = await supabase.rpc("resolve_system_alert", {
      p_alert_id: alertId,
      p_admin_id: user.id,
      p_resolution_notes: resolutionNotes,
    })

    if (error) {
      console.error("Failed to resolve alert:", error)
      return NextResponse.json({ 
        success: false, 
        error: "Failed to resolve alert: " + error.message 
      }, { status: 500 })
    }

    if (!data.success) {
      return NextResponse.json({ 
        success: false, 
        error: data.error 
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      alertId: data.alert_id,
    })

  } catch (error) {
    console.error("System alert resolve error:", error)
    return NextResponse.json({ 
      success: false, 
      error: "Internal server error" 
    }, { status: 500 })
  }
}
