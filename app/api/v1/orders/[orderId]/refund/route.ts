import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateApiKey } from "@/lib/middleware/api-auth"
import { checkIdempotency, storeIdempotentResponse } from "@/lib/middleware/idempotency"
import { apiError, apiSuccess } from "@/lib/middleware/api-response"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    const authResult = await validateApiKey(req)
    if (!authResult.valid) {
      return apiError("authentication_error", authResult.error || "Invalid API key", 401)
    }

    if (!authResult.scopes?.includes("write")) {
      return apiError("permission_denied", "API key does not have write permission", 403)
    }

    // Check idempotency
    const idempotencyKey = req.headers.get("idempotency-key")
    if (idempotencyKey) {
      const cached = await checkIdempotency(authResult.tenant_id, idempotencyKey)
      if (cached) {
        return apiSuccess(cached, { "Idempotent-Replayed": "true" })
      }
    }

    const supabase = await createClient()
    const body = await req.json()

    const { amount_cents, reason } = body

    // Get order
    const { data: order } = await supabase
      .from("ticket_orders")
      .select("*")
      .eq("id", orderId)
      .eq("tenant_id", authResult.tenant_id)
      .single()

    if (!order) {
      return apiError("not_found", "Order not found", 404)
    }

    if (!["paid", "partially_refunded"].includes(order.status)) {
      return apiError("invalid_request", "Order cannot be refunded", 400)
    }

    const refundAmount = amount_cents || (order.total_cents - order.amount_refunded_cents)
    const maxRefundable = order.total_cents - order.amount_refunded_cents

    if (refundAmount > maxRefundable) {
      return apiError("invalid_request", `Maximum refundable amount is ${maxRefundable} cents`, 400)
    }

    // Process Stripe refund if there's a payment intent
    if (order.stripe_payment_intent_id && order.stripe_payment_intent_id !== "free_order") {
      try {
        await stripe.refunds.create({
          payment_intent: order.stripe_payment_intent_id,
          amount: refundAmount,
          reason: "requested_by_customer",
        })
      } catch (stripeError) {
        console.error("[API] Stripe refund error:", stripeError)
        return apiError("payment_error", "Failed to process refund with Stripe", 500)
      }
    }

    // Process ledger refund
    const { data: refundResult, error: refundError } = await supabase.rpc("refund_ticket_order", {
      p_order_id: orderId,
      p_refund_amount_cents: refundAmount,
      p_reason: reason || null,
    })

    if (refundError || !refundResult?.success) {
      return apiError("refund_error", refundResult?.error || refundError?.message || "Refund failed", 500)
    }

    const response = {
      order_id: orderId,
      refund_amount_cents: refundAmount,
      status: refundAmount >= maxRefundable ? "refunded" : "partially_refunded",
      total_refunded_cents: order.amount_refunded_cents + refundAmount,
    }

    if (idempotencyKey) {
      await storeIdempotentResponse(authResult.tenant_id, idempotencyKey, response)
    }

    return apiSuccess(response)
  } catch (error) {
    console.error("[API] Order Refund error:", error)
    return apiError("internal_error", "An unexpected error occurred", 500)
  }
}
