import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"
import { requireCronAuth } from "@/lib/cron-auth"

// ═══════════════════════════════════════════════════════════════════════════════
// PAYOUT EXECUTION WORKER
// Processes eligible payouts via Stripe Connect transfers
// Runs every 5 minutes via Vercel Cron
// ═══════════════════════════════════════════════════════════════════════════════

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface EligiblePayout {
  id: string
  user_id: string
  tournament_id: string
  amount_cents: number
  placement: number
  stripe_connect_account_id: string
  user_email: string
  tournament_name: string
  failure_count: number
}

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req)
  if (authError) return authError

  try {

    // 1. Fetch eligible payouts
    const { data: payouts, error: fetchError } = await supabase.rpc(
      "get_eligible_payouts",
      { p_limit: 25 }
    )

    if (fetchError) {
      console.error("Failed to fetch eligible payouts:", fetchError)
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      )
    }

    if (!payouts || payouts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No eligible payouts to process",
        processed: 0,
        succeeded: 0,
        failed: 0,
      })
    }

    let processed = 0
    let succeeded = 0
    let failed = 0
    const results: Array<{ id: string; status: string; error?: string }> = []

    for (const payout of payouts as EligiblePayout[]) {
      processed++

      try {
        // 2. Pre-flight eligibility check (disputes, holds, etc.)
        const { data: eligibility, error: eligibilityError } = await supabase.rpc(
          "check_payout_eligibility",
          { p_payout_id: payout.id }
        )

        if (eligibilityError || !eligibility?.eligible) {
          // Skip if not eligible (dispute, hold, etc.)
          results.push({ 
            id: payout.id, 
            status: "ineligible", 
            error: eligibility?.reason || eligibilityError?.message 
          })
          continue
        }

        // 3. Mark as processing (atomic lock)
        const { data: lockResult, error: lockError } = await supabase.rpc(
          "mark_payout_processing",
          { p_payout_id: payout.id }
        )

        if (lockError || !lockResult?.success) {
          // Skip if already processing or status changed
          results.push({ 
            id: payout.id, 
            status: "skipped", 
            error: lockResult?.error || lockError?.message 
          })
          continue
        }

        // 3. Create ledger movement (escrow → payout clearing)
        let ledgerTxId: string | null = null
        try {
          const { data: ledgerResult } = await supabase.rpc(
            "ledger_tournament_payout",
            {
              p_tenant_id: null, // Will use default tenant
              p_tournament_id: payout.tournament_id,
              p_user_id: payout.user_id,
              p_amount_cents: payout.amount_cents,
              p_placement: payout.placement,
              p_payout_request_id: payout.id,
            }
          )
          if (ledgerResult?.transaction_id) {
            ledgerTxId = ledgerResult.transaction_id
          }
        } catch (ledgerErr) {
          // Log but continue - ledger is important but not blocking
          console.error("Ledger error (continuing):", ledgerErr)
        }

        // 4. Execute Stripe Connect transfer
        const transfer = await stripe.transfers.create({
          amount: payout.amount_cents,
          currency: "usd",
          destination: payout.stripe_connect_account_id,
          description: `Tournament payout: ${payout.tournament_name} - Place #${payout.placement}`,
          metadata: {
            payout_id: payout.id,
            tournament_id: payout.tournament_id,
            user_id: payout.user_id,
            placement: String(payout.placement),
          },
        })

        // 5. Execute payout request (single source of truth for ledger + completion)
        const { data: execResult, error: execError } = await supabase.rpc(
          "execute_payout_request",
          {
            p_payout_request_id: payout.id,
            p_stripe_transfer_id: transfer.id,
          }
        )

        if (execError || !execResult?.success) {
          // Fallback to legacy complete_payout if execute_payout_request not available
          const { error: completeError } = await supabase.rpc("complete_payout", {
            p_payout_id: payout.id,
            p_stripe_transfer_id: transfer.id,
            p_ledger_tx_id: ledgerTxId,
          })

          if (completeError) {
            console.error("Failed to mark payout complete:", completeError)
          }
        }

        succeeded++
        results.push({ id: payout.id, status: "completed" })

      } catch (err) {
        failed++
        const errorMessage = err instanceof Error ? err.message : "Unknown error"
        
        // Determine if error is permanent
        const isPermanent = 
          errorMessage.includes("account_invalid") ||
          errorMessage.includes("no_external_account") ||
          errorMessage.includes("account_closed")

        // Mark as failed with retry logic
        await supabase.rpc("fail_payout", {
          p_payout_id: payout.id,
          p_reason: errorMessage,
          p_permanent: isPermanent,
        })

        results.push({ id: payout.id, status: "failed", error: errorMessage })
        console.error(`Payout ${payout.id} failed:`, errorMessage)
      }
    }

    // Log summary
    console.log(`Payout worker completed: ${processed} processed, ${succeeded} succeeded, ${failed} failed`)

    return NextResponse.json({
      success: true,
      processed,
      succeeded,
      failed,
      results,
    })
  } catch (err) {
    console.error("Payout worker error:", err)
    return NextResponse.json(
      { success: false, error: "Worker failed" },
      { status: 500 }
    )
  }
}
