import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

/**
 * Fetch reconciliation audit log for compliance and accounting review
 * 
 * Returns a complete history of all financial corrections including:
 * - Void transactions
 * - Reversals
 * - Recoveries
 * - Dismissals
 * - Wallet syncs
 * - Manual credits
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Verify admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")
    const actionType = searchParams.get("actionType") // Filter by action type
    const environment = searchParams.get("environment") // Filter by test/live

    let query = supabase
      .from("reconciliation_audit_log")
      .select(`
        id,
        action_type,
        target_type,
        target_id,
        user_id,
        performed_by,
        amount_cents,
        previous_balance_cents,
        new_balance_cents,
        reason,
        documentation,
        is_test_data,
        environment,
        status,
        error_message,
        created_at,
        related_transaction_id,
        stripe_session_id,
        idempotency_key
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (actionType) {
      query = query.eq("action_type", actionType)
    }

    if (environment) {
      query = query.eq("environment", environment)
    }

    const { data: auditLogs, error } = await query

    if (error) {
      console.error("Audit log fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get admin emails for display
    const adminIds = [...new Set(auditLogs?.map(log => log.performed_by) || [])]
    const { data: admins } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", adminIds)

    const adminMap = new Map(admins?.map(a => [a.id, a.email]) || [])

    // Enrich with admin emails
    const enrichedLogs = auditLogs?.map(log => ({
      ...log,
      performedByEmail: adminMap.get(log.performed_by) || "Unknown"
    })) || []

    // Get summary counts
    const { data: summaryCounts } = await supabase
      .from("reconciliation_audit_log")
      .select("action_type, environment")
    
    const summary = {
      totalActions: summaryCounts?.length || 0,
      byActionType: {
        void: summaryCounts?.filter(s => s.action_type === "void").length || 0,
        reversal: summaryCounts?.filter(s => s.action_type === "reversal").length || 0,
        recovery: summaryCounts?.filter(s => s.action_type === "recovery").length || 0,
        dismiss: summaryCounts?.filter(s => s.action_type === "dismiss").length || 0,
        wallet_sync: summaryCounts?.filter(s => s.action_type === "wallet_sync").length || 0,
        manual_credit: summaryCounts?.filter(s => s.action_type === "manual_credit").length || 0,
      },
      byEnvironment: {
        live: summaryCounts?.filter(s => s.environment === "live").length || 0,
        test: summaryCounts?.filter(s => s.environment === "test").length || 0,
      }
    }

    return NextResponse.json({
      success: true,
      auditLogs: enrichedLogs,
      summary,
      pagination: {
        limit,
        offset,
        hasMore: (auditLogs?.length || 0) === limit
      }
    })

  } catch (error) {
    console.error("Audit log error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
