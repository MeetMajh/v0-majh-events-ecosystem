"use server"

/*
  BUILD FIX 2026-11-19.

  These two files imported `createServiceClient` from "@/lib/supabase/service".
  That module has NEVER existed — checked across all branches in git history.
  Because lib/auth/role-grant.ts is reachable from both
  app/api/access/code/route.ts and
  app/dashboard/admin/users/[id]/roles/page.tsx, this was a fatal
  module-not-found and `next build` has failed on origin/main since the
  import was introduced on 2026-06-04 (5a22262).

  No new module was written, because the thing it wanted already exists:
  `createAdminClient()` in @/lib/supabase/server — service-role key,
  persistSession false, autoRefreshToken false, and it throws a clear error
  when SUPABASE_SERVICE_ROLE_KEY is absent. It is the established pattern,
  already used by app/dashboard/admin/users/page.tsx,
  app/dashboard/my-events/page.tsx, app/dashboard/player-controller/page.tsx
  and - decisively - by app/dashboard/admin/users/[id]/roles/page.tsx, the
  page that imports THIS file. The page was already doing it right while the
  module it depends on reached for a file that was never created.

  Writing lib/supabase/service.ts would have created a second service-role
  client alongside a working one: two declarations of the same fact, which is
  the defect pattern this whole review keeps finding.

  `createAdminClient()` is synchronous, so the `await` is dropped. It was
  harmless (await on a non-promise resolves it) but it implied an async
  contract that does not exist.

  THIS CLIENT BYPASSES RLS. Authorization is the caller's responsibility, and
  both entry points here do enforce it first via requireStaffAction("manager")
  before any service-role call. That ordering is load-bearing: do not move a
  createAdminClient() call above its authorization check.
*/
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe"
import { requireStaffAction } from "@/lib/auth/require-staff"

interface RefundResult {
  success: boolean
  error?: string
  refundIntentId?: string
  stripeRefundId?: string
  amountRefunded?: number
}

/**
 * Validate if a refund can be processed
 */
export async function validateRefund(
  originalIntentId: string,
  amountCents: number
): Promise<{ success: boolean; error?: string; maxAvailable?: number }> {
  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc("validate_refund", {
    p_original_intent_id: originalIntentId,
    p_amount_cents: amountCents,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return data as { success: boolean; error?: string; maxAvailable?: number }
}

/**
 * Initiate a refund for a payment
 * This creates a refund intent, calls Stripe, then processes via webhook
 */
export async function initiateRefund(
  originalIntentId: string,
  amountCents: number,
  reason: string = "Customer requested refund"
): Promise<RefundResult> {
  const { userId } = await requireStaffAction("manager")
  const serviceClient = createAdminClient()

  // Step 1: Create refund intent via service client
  const { data: intentResult, error: intentError } = await serviceClient.rpc("create_refund_intent", {
    p_original_intent_id: originalIntentId,
    p_amount_cents: amountCents,
    p_reason: reason,
    p_initiated_by: userId,
  })

  if (intentError || !intentResult?.success) {
    return {
      success: false,
      error: intentError?.message || intentResult?.error || "Failed to create refund intent"
    }
  }

  if (intentResult.idempotent) {
    return {
      success: true,
      refundIntentId: intentResult.refund_intent_id,
      amountRefunded: amountCents,
    }
  }

  const { data: originalIntent } = await serviceClient
    .from("financial_intents")
    .select("stripe_payment_intent_id, stripe_checkout_session_id, stripe_charge_id")
    .eq("id", originalIntentId)
    .single()

  if (!originalIntent) {
    return { success: false, error: "Original payment not found" }
  }

  try {
    let chargeId = originalIntent.stripe_charge_id

    if (!chargeId && originalIntent.stripe_payment_intent_id) {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        originalIntent.stripe_payment_intent_id,
        { expand: ["latest_charge"] }
      )
      chargeId = typeof paymentIntent.latest_charge === "string"
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id
    }

    if (!chargeId) {
      return { success: false, error: "No charge found for this payment" }
    }

    const stripeRefund = await stripe.refunds.create({
      charge: chargeId,
      amount: amountCents,
      reason: "requested_by_customer",
      metadata: {
        refund_intent_id: intentResult.refund_intent_id,
        original_intent_id: originalIntentId,
        initiated_by: userId,
      },
    })

    const { data: processResult, error: processError } = await serviceClient.rpc("process_refund_intent", {
      p_refund_intent_id: intentResult.refund_intent_id,
      p_stripe_refund_id: stripeRefund.id,
    })

    if (processError || !processResult?.success) {
      console.error("[Refund] Ledger processing failed:", processError || processResult?.error)
      return {
        success: true,
        refundIntentId: intentResult.refund_intent_id,
        stripeRefundId: stripeRefund.id,
        amountRefunded: amountCents,
        error: "Refund processed but ledger update failed - will reconcile automatically",
      }
    }

    return {
      success: true,
      refundIntentId: intentResult.refund_intent_id,
      stripeRefundId: stripeRefund.id,
      amountRefunded: amountCents,
    }

  } catch (stripeError: any) {
    await serviceClient
      .from("financial_intents")
      .update({
        status: "failed",
        error_message: stripeError.message,
        failure_count: 1,
        last_failure_at: new Date().toISOString(),
      })
      .eq("id", intentResult.refund_intent_id)

    return {
      success: false,
      error: `Stripe error: ${stripeError.message}`,
      refundIntentId: intentResult.refund_intent_id,
    }
  }
}

/**
 * Get refund history for an original payment
 */
export async function getRefundHistory(originalIntentId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("financial_intents")
    .select(`
      id,
      amount_cents,
      status,
      stripe_refund_id,
      metadata,
      created_at,
      reconciled_at
    `)
    .eq("original_intent_id", originalIntentId)
    .eq("intent_type", "refund")
    .order("created_at", { ascending: false })

  if (error) {
    return { success: false, error: error.message, refunds: [] }
  }

  return { success: true, refunds: data || [] }
}

/**
 * Get total refunded amount for an original payment
 */
export async function getTotalRefunded(originalIntentId: string): Promise<number> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("financial_intents")
    .select("amount_cents")
    .eq("original_intent_id", originalIntentId)
    .eq("intent_type", "refund")
    .eq("status", "succeeded")

  return data?.reduce((sum, r) => sum + r.amount_cents, 0) || 0
}
