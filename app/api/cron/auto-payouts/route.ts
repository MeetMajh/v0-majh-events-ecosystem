import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Auto-Payout Engine Cron
 * Runs every 5 minutes to:
 * 1. Recalculate health scores for active organizers
 * 2. Process auto-payouts for eligible organizers
 * 3. Create alerts for high-risk decisions
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createClient()
  const results = {
    tenants_processed: 0,
    health_scores_updated: 0,
    payouts_processed: 0,
    payouts_approved: 0,
    payouts_held: 0,
    errors: [] as string[],
  }

  try {
    // Get all active tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("status", "active")

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`)
    }

    for (const tenant of tenants || []) {
      try {
        results.tenants_processed++

        // 1. Recalculate health scores for organizers with recent activity
        const { data: activeOrganizers } = await supabase
          .from("tournaments")
          .select("organizer_id")
          .eq("tenant_id", tenant.id)
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .limit(100)

        const uniqueOrganizers = [...new Set((activeOrganizers || []).map(t => t.organizer_id))]
        
        for (const organizerId of uniqueOrganizers) {
          const { data: healthResult, error: healthError } = await supabase.rpc(
            "calculate_organizer_health_score",
            { p_organizer_id: organizerId }
          )

          if (healthError) {
            results.errors.push(`Health score error for ${organizerId}: ${healthError.message}`)
          } else if (healthResult?.success) {
            results.health_scores_updated++

            // Create alert for critical risk tier
            if (healthResult.risk_tier === "critical") {
              await supabase.rpc("create_alert", {
                p_tenant_id: tenant.id,
                p_alert_type: "high_fraud_score",
                p_severity: "critical",
                p_title: "Critical Risk Organizer Detected",
                p_message: `Organizer ${organizerId} has a critical risk score of ${healthResult.overall_score}`,
                p_resource_type: "organizer_health_score",
                p_resource_id: organizerId,
                p_metadata: {
                  overall_score: healthResult.overall_score,
                  risk_tier: healthResult.risk_tier,
                  metrics: healthResult.metrics,
                },
              })
            }
          }
        }

        // 2. Process auto-payouts
        const { data: autoPayoutResult, error: autoPayoutError } = await supabase.rpc(
          "process_auto_payouts",
          { p_tenant_id: tenant.id, p_limit: 50 }
        )

        if (autoPayoutError) {
          results.errors.push(`Auto-payout error for ${tenant.name}: ${autoPayoutError.message}`)
        } else if (autoPayoutResult?.success) {
          results.payouts_processed += autoPayoutResult.processed || 0
          results.payouts_approved += autoPayoutResult.approved || 0
          results.payouts_held += autoPayoutResult.held || 0

          // Create alert for held payouts
          if (autoPayoutResult.held > 0) {
            await supabase.rpc("create_alert", {
              p_tenant_id: tenant.id,
              p_alert_type: "hold_triggered",
              p_severity: "warning",
              p_title: `${autoPayoutResult.held} Payout(s) Auto-Held`,
              p_message: `Auto-payout engine held ${autoPayoutResult.held} payout(s) due to risk factors`,
              p_resource_type: "payout_batch",
              p_metadata: {
                held: autoPayoutResult.held,
                approved: autoPayoutResult.approved,
                processed: autoPayoutResult.processed,
              },
            })
          }
        }
      } catch (tenantError) {
        results.errors.push(`Tenant ${tenant.name} error: ${String(tenantError)}`)
      }
    }

    // Log summary to audit
    await supabase.from("audit_log").insert({
      action: "auto_payout_cron_completed",
      resource_type: "cron",
      metadata: results,
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    })
  } catch (error) {
    console.error("Auto-payout cron error:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        results,
      },
      { status: 500 }
    )
  }
}
