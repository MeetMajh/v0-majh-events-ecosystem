"use server"

import { createClient } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe"
import { nanoid } from "nanoid"

// ═══════════════════════════════════════════════════════════════════════════════
// FINANCIAL INTENTS - STRIPE INTEGRATION LAYER
// ═══════════════════════════════════════════════════════════════════════════════
// 
// Flow:
// 1. Create intent in DB (idempotent)
// 2. Call Stripe
// 3. Update intent with Stripe IDs
// 4. Webhook reconciles on completion
// 5. Ledger entry created atomically
//
// ═══════════════════════════════════════════════════════════════════════════════

type IntentType = 
  | "tournament_entry"
  | "wallet_deposit" 
  | "escrow_fund"
  | "ticket_purchase"
  | "subscription"
  | "payout"
  | "refund"
  | "prize_distribution"

type ReferenceType = 
  | "tournament"
  | "event"
  | "ticket_order"
  | "subscription"
  | "wallet"
  | "escrow"
  | "payout_request"

interface CreateIntentParams {
  intentType: IntentType
  amountCents: number
  referenceType?: ReferenceType
  referenceId?: string
  metadata?: Record<string, unknown>
  tenantId?: string
  idempotencyKey?: string
}

interface IntentResult {
  success: boolean
  intentId?: string
  checkoutUrl?: string
  error?: string
  idempotent?: boolean
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE CHECKOUT SESSION WITH INTENT TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

export async function createTrackedCheckoutSession(
  params: CreateIntentParams & {
    successUrl: string
    cancelUrl: string
    lineItems?: Array<{
      name: string
      description?: string
      amountCents: number
      quantity: number
    }>
  }
): Promise<IntentResult> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  // Generate idempotency key if not provided
  const idempotencyKey = params.idempotencyKey || 
    `${params.intentType}_${params.referenceId || user.id}_${nanoid(10)}`

  try {
    // 1. Create financial intent (idempotent)
    const { data: intentResult, error: intentError } = await supabase.rpc(
      "create_financial_intent",
      {
        p_idempotency_key: idempotencyKey,
        p_user_id: user.id,
        p_intent_type: params.intentType,
        p_amount_cents: params.amountCents,
        p_reference_type: params.referenceType || null,
        p_reference_id: params.referenceId || null,
        p_tenant_id: params.tenantId || null,
        p_metadata: params.metadata || {},
      }
    )

    if (intentError) {
      console.error("Failed to create financial intent:", intentError)
      return { success: false, error: intentError.message }
    }

    if (!intentResult?.success) {
      return { success: false, error: intentResult?.error || "Failed to create intent" }
    }

    // If idempotent (already exists), check if we have a checkout URL
    if (intentResult.idempotent && intentResult.stripe_checkout_session_id) {
      // Retrieve existing session
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(
          intentResult.stripe_checkout_session_id
        )
        if (existingSession.status === "open" && existingSession.url) {
          return {
            success: true,
            intentId: intentResult.intent_id,
            checkoutUrl: existingSession.url,
            idempotent: true,
          }
        }
      } catch {
        // Session expired or invalid, create new one
      }
    }

    // 2. Create Stripe Checkout Session
    const lineItems = params.lineItems?.map(item => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name,
          description: item.description,
        },
        unit_amount: item.amountCents,
      },
      quantity: item.quantity,
    })) || [{
      price_data: {
        currency: "usd",
        product_data: {
          name: formatIntentTypeLabel(params.intentType),
          description: `Payment for ${params.intentType.replace(/_/g, " ")}`,
        },
        unit_amount: params.amountCents,
      },
      quantity: 1,
    }]

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        type: params.intentType,
        intent_id: intentResult.intent_id,
        idempotency_key: idempotencyKey,
        user_id: user.id,
        reference_type: params.referenceType || "",
        reference_id: params.referenceId || "",
        tenant_id: params.tenantId || "",
        amount_cents: params.amountCents.toString(),
      },
    }, {
      idempotencyKey: `stripe_${idempotencyKey}`,
    })

    // 3. Update intent with Stripe session ID
    await supabase.rpc("update_intent_with_stripe", {
      p_intent_id: intentResult.intent_id,
      p_stripe_checkout_session_id: session.id,
      p_status: "processing",
    })

    return {
      success: true,
      intentId: intentResult.intent_id,
      checkoutUrl: session.url!,
      idempotent: false,
    }

  } catch (error) {
    console.error("Failed to create tracked checkout session:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create checkout",
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOURNAMENT ENTRY WITH INTENT TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

export async function createTournamentEntryCheckout(
  tournamentId: string,
  entryFeeCents: number,
  tournamentName: string,
  successUrl: string,
  cancelUrl: string
): Promise<IntentResult> {
  return createTrackedCheckoutSession({
    intentType: "tournament_entry",
    amountCents: entryFeeCents,
    referenceType: "tournament",
    referenceId: tournamentId,
    idempotencyKey: `tournament_entry_${tournamentId}_${Date.now()}`,
    successUrl,
    cancelUrl,
    lineItems: [{
      name: `Tournament Entry: ${tournamentName}`,
      description: `Entry fee for ${tournamentName}`,
      amountCents: entryFeeCents,
      quantity: 1,
    }],
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// WALLET DEPOSIT WITH INTENT TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

export async function createWalletDepositCheckout(
  amountCents: number,
  successUrl: string,
  cancelUrl: string,
  tenantId?: string
): Promise<IntentResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  return createTrackedCheckoutSession({
    intentType: "wallet_deposit",
    amountCents,
    referenceType: "wallet",
    referenceId: user.id,
    tenantId,
    idempotencyKey: `wallet_deposit_${user.id}_${amountCents}_${Date.now()}`,
    successUrl,
    cancelUrl,
    lineItems: [{
      name: "Wallet Deposit",
      description: `Add $${(amountCents / 100).toFixed(2)} to your MAJH wallet`,
      amountCents,
      quantity: 1,
    }],
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESCROW FUNDING WITH INTENT TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

export async function createEscrowFundingCheckout(
  tournamentId: string,
  escrowAmountCents: number,
  tournamentName: string,
  successUrl: string,
  cancelUrl: string
): Promise<IntentResult> {
  return createTrackedCheckoutSession({
    intentType: "escrow_fund",
    amountCents: escrowAmountCents,
    referenceType: "escrow",
    referenceId: tournamentId,
    idempotencyKey: `escrow_fund_${tournamentId}_${Date.now()}`,
    successUrl,
    cancelUrl,
    lineItems: [{
      name: `Prize Pool Escrow: ${tournamentName}`,
      description: `Fund prize pool for ${tournamentName}`,
      amountCents: escrowAmountCents,
      quantity: 1,
    }],
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// TICKET PURCHASE WITH INTENT TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

export async function createTicketPurchaseCheckout(
  orderId: string,
  tickets: Array<{
    name: string
    price: number
    quantity: number
  }>,
  successUrl: string,
  cancelUrl: string,
  eventId?: string,
  tenantId?: string
): Promise<IntentResult> {
  const totalCents = tickets.reduce((sum, t) => sum + t.price * t.quantity, 0)
  
  return createTrackedCheckoutSession({
    intentType: "ticket_purchase",
    amountCents: totalCents,
    referenceType: "ticket_order",
    referenceId: orderId,
    tenantId,
    idempotencyKey: `ticket_purchase_${orderId}`,
    metadata: { event_id: eventId },
    successUrl,
    cancelUrl,
    lineItems: tickets.map(t => ({
      name: t.name,
      description: "Event ticket",
      amountCents: t.price,
      quantity: t.quantity,
    })),
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECONCILIATION - CALLED FROM WEBHOOK
// ═══════════════════════════════════════════════════════════════════════════════

export async function reconcileIntentFromWebhook(
  stripeSessionId?: string,
  stripePaymentIntentId?: string,
  status: "succeeded" | "failed" | "canceled" = "succeeded",
  stripeChargeId?: string,
  errorCode?: string,
  errorMessage?: string
): Promise<{ success: boolean; error?: string; result?: Record<string, unknown> }> {
  // Use service role client for webhook context
  const { createClient: createAdminClient } = await import("@supabase/supabase-js")
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabaseAdmin.rpc("reconcile_financial_intent", {
    p_stripe_session_id: stripeSessionId || null,
    p_stripe_payment_intent_id: stripePaymentIntentId || null,
    p_status: status,
    p_stripe_charge_id: stripeChargeId || null,
    p_error_code: errorCode || null,
    p_error_message: errorMessage || null,
  })

  if (error) {
    console.error("Failed to reconcile intent:", error)
    return { success: false, error: error.message }
  }

  return { success: data?.success || false, result: data }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET USER'S PENDING INTENTS
// ═══════════════════════════════════════════════════════════════════════════════

export async function getMyPendingIntents() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Not authenticated", intents: [] }
  }

  const { data, error } = await supabase
    .from("financial_intents")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["pending", "processing", "requires_action"])
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    return { success: false, error: error.message, intents: [] }
  }

  return { success: true, intents: data || [] }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function formatIntentTypeLabel(intentType: IntentType): string {
  const labels: Record<IntentType, string> = {
    tournament_entry: "Tournament Entry Fee",
    wallet_deposit: "Wallet Deposit",
    escrow_fund: "Prize Pool Escrow",
    ticket_purchase: "Event Tickets",
    subscription: "Subscription",
    payout: "Payout",
    refund: "Refund",
    prize_distribution: "Prize Distribution",
  }
  return labels[intentType] || intentType.replace(/_/g, " ")
}
