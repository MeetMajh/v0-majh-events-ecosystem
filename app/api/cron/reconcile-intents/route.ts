import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
})

// Service role client for reconciliation (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface FinancialIntent {
  id: string
  user_id: string
  intent_type: string
  amount_cents: number
  status: string
  stripe_payment_intent_id: string | null
  stripe_checkout_session_id: string | null
  failure_count: number
  created_at: string
}

interface ReconciliationResult {
  intent_id: string
  stripe_status: string | null
  internal_status: string
  action: "reconciled" | "skipped" | "failed"
  error?: string
}

export async function GET(req: NextRequest) {
  try {
    // Security: Verify cron secret
    const authHeader = req.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 1. Fetch stale intents that need reconciliation
    const { data: intents, error: fetchError } = await supabaseAdmin.rpc(
      "get_stale_financial_intents"
    )

    if (fetchError) {
      console.error("Failed to fetch stale intents:", fetchError)
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      )
    }

    const results: ReconciliationResult[] = []
    let processed = 0
    let recovered = 0
    let failed = 0

    // 2. Process each stale intent
    for (const intent of (intents as FinancialIntent[]) || []) {
      processed++

      try {
        let stripeStatus: string | null = null
        let stripeChargeId: string | null = null

        // 3. Query Stripe for actual payment status
        if (intent.stripe_payment_intent_id) {
          const pi = await stripe.paymentIntents.retrieve(
            intent.stripe_payment_intent_id
          )
          stripeStatus = pi.status
          
          // Get charge ID if available
          if (pi.latest_charge && typeof pi.latest_charge === "string") {
            stripeChargeId = pi.latest_charge
          }
        } else if (intent.stripe_checkout_session_id) {
          const session = await stripe.checkout.sessions.retrieve(
            intent.stripe_checkout_session_id
          )
          stripeStatus = session.payment_status
          
          // Get payment intent from session
          if (session.payment_intent && typeof session.payment_intent === "string") {
            const pi = await stripe.paymentIntents.retrieve(session.payment_intent)
            if (pi.latest_charge && typeof pi.latest_charge === "string") {
              stripeChargeId = pi.latest_charge
            }
          }
        } else {
          // No Stripe reference - skip
          results.push({
            intent_id: intent.id,
            stripe_status: null,
            internal_status: intent.status,
            action: "skipped",
            error: "No Stripe reference",
          })
          continue
        }

        // 4. Map Stripe status to internal status
        let internalStatus = "processing"

        if (stripeStatus === "succeeded" || stripeStatus === "paid") {
          internalStatus = "succeeded"
        } else if (stripeStatus === "canceled" || stripeStatus === "expired") {
          internalStatus = "canceled"
        } else if (
          stripeStatus === "requires_payment_method" ||
          stripeStatus === "requires_action"
        ) {
          // Still pending user action - don't change status yet
          internalStatus = "requires_action"
        } else if (stripeStatus === "processing") {
          // Still processing - skip for now
          results.push({
            intent_id: intent.id,
            stripe_status: stripeStatus,
            internal_status: "processing",
            action: "skipped",
          })
          continue
        }

        // 5. Only reconcile if status changed to terminal state
        if (internalStatus === "succeeded" || internalStatus === "canceled") {
          const { data: result, error: reconcileError } = await supabaseAdmin.rpc(
            "reconcile_financial_intent",
            {
              p_stripe_session_id: intent.stripe_checkout_session_id,
              p_stripe_payment_intent_id: intent.stripe_payment_intent_id,
              p_status: internalStatus,
              p_stripe_charge_id: stripeChargeId,
              p_error_code: null,
              p_error_message: null,
            }
          )

          if (reconcileError) {
            console.error(`Reconciliation error for ${intent.id}:`, reconcileError)
            failed++
            results.push({
              intent_id: intent.id,
              stripe_status: stripeStatus,
              internal_status: internalStatus,
              action: "failed",
              error: reconcileError.message,
            })
          } else if (result?.success) {
            if (internalStatus === "succeeded") {
              recovered++
            }
            results.push({
              intent_id: intent.id,
              stripe_status: stripeStatus,
              internal_status: internalStatus,
              action: "reconciled",
            })
          }
        } else {
          results.push({
            intent_id: intent.id,
            stripe_status: stripeStatus,
            internal_status: internalStatus,
            action: "skipped",
          })
        }
      } catch (stripeError) {
        console.error(`Stripe error for intent ${intent.id}:`, stripeError)
        failed++

        // Mark as failed after too many retries
        if (intent.failure_count >= 4) {
          await supabaseAdmin.rpc("mark_intent_failed", {
            p_intent_id: intent.id,
            p_error_code: "STRIPE_ERROR",
            p_error_message:
              stripeError instanceof Error
                ? stripeError.message
                : "Unknown Stripe error",
          })
        }

        results.push({
          intent_id: intent.id,
          stripe_status: null,
          internal_status: "failed",
          action: "failed",
          error:
            stripeError instanceof Error
              ? stripeError.message
              : "Unknown error",
        })
      }
    }

    // 6. Get current stats
    const { data: stats } = await supabaseAdmin.rpc("get_reconciliation_stats")

    // 7. Log summary
    console.log("Reconciliation complete:", {
      processed,
      recovered,
      failed,
      stats,
    })

    return NextResponse.json({
      success: true,
      processed,
      recovered,
      failed,
      results,
      stats,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error("Reconciliation worker error:", err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Worker failed",
      },
      { status: 500 }
    )
  }
}
