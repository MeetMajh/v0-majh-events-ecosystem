import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateApiKey } from "@/lib/middleware/api-auth"
import { checkRateLimit } from "@/lib/middleware/rate-limit"
import { checkIdempotency, storeIdempotentResponse } from "@/lib/middleware/idempotency"
import { apiError, apiSuccess } from "@/lib/middleware/api-response"
import { stripe } from "@/lib/stripe"

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    const authResult = await validateApiKey(req)
    if (!authResult.valid) {
      return apiError("authentication_error", authResult.error || "Invalid API key")
    }

    if (!authResult.scopes?.includes("write")) {
      return apiError("authorization_error", "API key does not have write permission")
    }

    const rateLimitResult = await checkRateLimit(authResult.api_key_id, 30) // Lower limit for purchases
    if (!rateLimitResult.allowed) {
      return apiError("rate_limit_exceeded", "Rate limit exceeded", { rateLimit: rateLimitResult })
    }

    // Check idempotency
    const idempotencyKey = req.headers.get("idempotency-key")
    if (idempotencyKey) {
      const cached = await checkIdempotency(req, authResult.tenant_id)
      if (cached.found && cached.response) {
        return NextResponse.json(cached.response.body, {
          status: cached.response.status,
          headers: { "Idempotent-Replayed": "true" },
        })
      }
    }

    const supabase = await createClient()
    const body = await req.json()

    const {
      event_id,
      user_id,
      email,
      first_name,
      last_name,
      items, // [{ticket_type_id, quantity}]
      promo_code,
      return_url,
    } = body

    if (!event_id || !email || !items || !Array.isArray(items) || items.length === 0) {
      return apiError("invalid_request", "event_id, email, and items are required")
    }

    // Validate event
    const { data: event } = await supabase
      .from("events")
      .select("id, name, status, tenant_id")
      .eq("id", event_id)
      .eq("tenant_id", authResult.tenant_id)
      .single()

    if (!event) {
      return apiError("resource_not_found", "Event not found")
    }

    if (event.status !== "published") {
      return apiError("invalid_request", "Event is not available for ticket sales")
    }

    // Check availability for all items first
    for (const item of items) {
      const { data: availability } = await supabase.rpc("check_ticket_availability", {
        p_ticket_type_id: item.ticket_type_id,
        p_quantity: item.quantity,
      })

      if (!availability?.available) {
        return apiError("invalid_request", availability?.error || "Tickets not available")
      }
    }

    // Create order via RPC
    const { data: orderResult, error: orderError } = await supabase.rpc("create_ticket_order", {
      p_tenant_id: authResult.tenant_id,
      p_event_id: event_id,
      p_user_id: user_id || null,
      p_email: email,
      p_first_name: first_name || "",
      p_last_name: last_name || "",
      p_items: items,
      p_promo_code: promo_code || null,
      p_idempotency_key: idempotencyKey,
    })

    if (orderError || !orderResult?.success) {
      return apiError("invalid_request", orderResult?.error || orderError?.message || "Failed to create order")
    }

    // If order is free, complete immediately
    if (orderResult.total_cents === 0) {
      const { data: completeResult } = await supabase.rpc("complete_ticket_order", {
        p_order_id: orderResult.order_id,
        p_stripe_payment_intent_id: "free_order",
        p_stripe_checkout_session_id: null,
      })

      const response = {
        order_id: orderResult.order_id,
        order_number: orderResult.order_number,
        status: "paid",
        total_cents: 0,
        is_free: true,
      }

      if (idempotencyKey) {
        await storeIdempotentResponse(
          req,
          authResult.tenant_id,
          authResult.api_key_id,
          { status: 201, body: response },
          Date.now() - startTime
        )
      }

      return apiSuccess(response, { status: 201 })
    }

    // Create Stripe Checkout Session
    const baseUrl = return_url || process.env.NEXT_PUBLIC_APP_URL || "https://majhevents.com"
    
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: await Promise.all(items.map(async (item: { ticket_type_id: string; quantity: number }) => {
        const { data: ticketType } = await supabase
          .from("ticket_types")
          .select("name, price_cents")
          .eq("id", item.ticket_type_id)
          .single()

        return {
          price_data: {
            currency: "usd",
            product_data: {
              name: ticketType?.name || "Ticket",
              description: `Ticket for ${event.name}`,
            },
            unit_amount: ticketType?.price_cents || 0,
          },
          quantity: item.quantity,
        }
      })),
      metadata: {
        type: "ticket_purchase",
        tenant_id: authResult.tenant_id,
        order_id: orderResult.order_id,
        event_id: event_id,
      },
      success_url: `${baseUrl}/tickets/confirmation?order_id=${orderResult.order_id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/events/${event_id}?cancelled=true`,
      expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
    })

    // Update order with Stripe session ID
    await supabase
      .from("ticket_orders")
      .update({ 
        stripe_checkout_session_id: session.id,
        status: "processing",
      })
      .eq("id", orderResult.order_id)

    const response = {
      order_id: orderResult.order_id,
      order_number: orderResult.order_number,
      status: "processing",
      subtotal_cents: orderResult.subtotal_cents,
      fees_cents: orderResult.fees_cents,
      discount_cents: orderResult.discount_cents,
      total_cents: orderResult.total_cents,
      checkout_url: session.url,
      checkout_session_id: session.id,
      expires_at: new Date(Date.now() + 1800000).toISOString(),
    }

    if (idempotencyKey) {
      await storeIdempotentResponse(
        req,
        authResult.tenant_id,
        authResult.api_key_id,
        { status: 201, body: response },
        Date.now() - startTime
      )
    }

    return apiSuccess(response, { status: 201 })
  } catch (error) {
    console.error("[API] Ticket Purchase error:", error)
    return apiError("internal_error", "An unexpected error occurred")
  }
}
