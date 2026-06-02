"use server"

import { createClient } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe"
import { createServiceClient } from "@/lib/supabase/service"
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
  const supabase = await createServiceClient()

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
  const serviceClient = await createServiceClient()

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
