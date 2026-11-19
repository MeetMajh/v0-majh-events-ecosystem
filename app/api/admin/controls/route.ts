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

/**
 * GET /api/admin/controls
 * 
 * Get all system control settings
 */
export async function GET() {
  try {
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
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { data: controls, error } = await supabase
      .from("system_controls")
      .select("*")
      .order("control_type")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      controls: controls || []
    })

  } catch (error) {
    console.error("System controls fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/admin/controls
 * 
 * Toggle system control (kill switch, circuit breaker, etc.)
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check admin access - only owner can toggle controls
    const { data: staffRole } = await supabase
      .from("staff_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .single()

    if (!staffRole) {
      return NextResponse.json({ error: "Owner access required for system controls" }, { status: 403 })
    }

    const { controlType, enabled, reason, thresholdValue } = await req.json()

    if (!controlType) {
      return NextResponse.json({ error: "Control type is required" }, { status: 400 })
    }

    // Handle threshold update
    if (thresholdValue !== undefined) {
      const { data, error: updateError } = await supabase
        .from("system_controls")
        .update({ 
          threshold_value: thresholdValue,
          updated_at: new Date().toISOString(),
          updated_by: user.id
        })
        .eq("control_type", controlType)
        .select()
        .single()

      if (updateError) {
        console.error("Threshold update error:", updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Threshold ${controlType} updated to ${thresholdValue}`,
        control: data
      })
    }

    // Handle toggle
    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Enabled must be a boolean" }, { status: 400 })
    }

    // Use atomic RPC for toggle
    const { data: result, error: rpcError } = await createAdminClient().rpc("toggle_system_control", {
      p_control_type: controlType,
      p_enabled: enabled,
      p_admin_id: user.id,
      p_reason: reason || null
    })

    if (rpcError) {
      console.error("RPC error:", rpcError)
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    if (!result?.success) {
      return NextResponse.json({ 
        success: false,
        error: result?.error || "Failed to toggle control" 
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `System control ${controlType} ${enabled ? "enabled" : "disabled"}`,
      control_type: result.control_type,
      is_enabled: result.is_enabled
    })

  } catch (error) {
    console.error("System control toggle error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
