import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * GET /api/admin/integrity
 * 
 * Runs comprehensive financial integrity checks:
 * - Wallet balance reconciliation
 * - Risk flag detection
 * - System control status
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

    // Run reconciliation check
    const { data: reconciliationResult, error: reconcileError } = await supabase.rpc(
      "run_daily_reconciliation"
    )

    // Run risk flag check
    const { data: riskResult, error: riskError } = await supabase.rpc(
      "check_risk_flags"
    )

    // Get system controls status
    const { data: systemControls } = await supabase
      .from("system_controls")
      .select("*")
      .order("control_type")

    // Get recent audit events
    const { data: recentAuditEvents } = await supabase
      .from("reconciliation_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10)

    // Calculate health score
    const mismatches = reconciliationResult?.mismatches_found || 0
    const riskFlags = riskResult?.flagged_users || 0
    const controlsDisabled = systemControls?.filter((c: { is_enabled: boolean }) => !c.is_enabled).length || 0
    
    let healthScore = 100
    healthScore -= mismatches * 15 // -15 per mismatch
    healthScore -= riskFlags * 10 // -10 per flagged user
    healthScore -= controlsDisabled * 5 // -5 per disabled control
    healthScore = Math.max(0, healthScore)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      healthScore,
      reconciliation: {
        success: !reconcileError,
        error: reconcileError?.message,
        mismatches_found: mismatches,
        mismatches: reconciliationResult?.mismatches || [],
      },
      riskFlags: {
        success: !riskError,
        error: riskError?.message,
        flagged_users: riskFlags,
        flags: riskResult?.flags || [],
      },
      systemControls: systemControls || [],
      recentAuditEvents: recentAuditEvents || [],
    })

  } catch (error) {
    console.error("Integrity check error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/admin/integrity/reconcile
 * 
 * Manually trigger reconciliation check
 */
export async function POST(req: Request) {
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

    const { action } = await req.json()

    if (action === "reconcile") {
      const { data: result, error } = await supabase.rpc("run_daily_reconciliation")
      
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Reconciliation complete. Found ${result?.mismatches_found || 0} mismatches.`,
        result
      })
    }

    if (action === "check_risks") {
      const { data: result, error } = await supabase.rpc("check_risk_flags")
      
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Risk check complete. Found ${result?.flagged_users || 0} flagged users.`,
        result
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })

  } catch (error) {
    console.error("Integrity action error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
