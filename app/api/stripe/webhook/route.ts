import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { createClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

// We need a service role client for webhook (no auth context)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err)
    return NextResponse.json(
      { error: `Webhook signature verification failed` },
      { status: 400 }
    )
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      // Reconcile financial intent first (if exists)
      await reconcileFinancialIntent(session, "succeeded")
      // Then handle specific checkout types
      await handleCheckoutComplete(session)
      break
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session
      // Reconcile as expired/canceled
      await reconcileFinancialIntent(session, "expired")
      break
    }

    // ── Subscription Events ──
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription
      await handleSubscriptionUpdate(subscription)
      break
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription
      await handleSubscriptionCanceled(subscription)
      break
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice
      if (invoice.subscription) {
        console.log("[Stripe Webhook] Subscription invoice paid:", invoice.id)
      }
      break
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice
      if (invoice.subscription) {
        await handleSubscriptionPaymentFailed(invoice)
      }
      break
    }

    // ── Connect Events (for payouts) ──
    case "account.updated": {
      const account = event.data.object as Stripe.Account
      await handleConnectAccountUpdate(account)
      break
    }

    case "transfer.created": {
      const transfer = event.data.object as Stripe.Transfer
      console.log("[Stripe Webhook] Transfer created:", transfer.id, transfer.amount)
      break
    }

    // ── Identity Verification Events ──
    case "identity.verification_session.verified": {
      const session = event.data.object as Stripe.Identity.VerificationSession
      await handleIdentityVerified(session)
      break
    }

    case "identity.verification_session.requires_input": {
      const session = event.data.object as Stripe.Identity.VerificationSession
      console.log("[Stripe Webhook] Identity verification needs input:", session.id)
      break
    }

    // ── Payment Intent Events (for escrow funding) ──
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      await handlePaymentIntentSucceeded(paymentIntent)
      break
    }

    // ── Transfer Events (for payouts) ──
    case "transfer.paid": {
      const transfer = event.data.object as Stripe.Transfer
      await handleTransferCompleted(transfer)
      break
    }

    case "transfer.failed": {
      const transfer = event.data.object as Stripe.Transfer
      await handleTransferFailed(transfer)
      break
    }

    case "transfer.reversed": {
      const transfer = event.data.object as Stripe.Transfer
      await handleTransferReversed(transfer)
      break
    }

    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const metadata = session.metadata
  if (!metadata) {
    console.log("[Stripe Webhook] No metadata in session")
    return
  }

  const { type, booking_id, rental_id, invoice_id, tournament_id, registration_id, player_id, user_id, amount_cents, order_id, tenant_id, event_id } = metadata

  console.log("[Stripe Webhook] Processing checkout complete:", { type, booking_id, rental_id, invoice_id, tournament_id, user_id, order_id })

  try {
    // ── Wallet Deposit ──
    if (type === "wallet_deposit" && user_id && amount_cents) {
      const amountCentsNum = parseInt(amount_cents, 10)
      const tenantId = metadata.tenant_id
      
      // Check for idempotency
      const { data: existingTx } = await supabaseAdmin
        .from("financial_transactions")
        .select("id")
        .eq("stripe_session_id", session.id)
        .single()

      if (existingTx) {
        console.log("[Stripe Webhook] Duplicate wallet deposit prevented:", session.id)
        return
      }

      // Get or create wallet (legacy table support)
      let { data: wallet } = await supabaseAdmin
        .from("wallets")
        .select("*")
        .eq("user_id", user_id)
        .single()

      if (!wallet) {
        const { data: newWallet } = await supabaseAdmin
          .from("wallets")
          .insert({ user_id, balance_cents: 0 })
          .select()
          .single()
        wallet = newWallet
      }

      // Update legacy wallet balance
      const newBalance = (wallet?.balance_cents ?? 0) + amountCentsNum
      await supabaseAdmin
        .from("wallets")
        .update({ 
          balance_cents: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user_id)

      // Record in legacy financial_transactions table
      await supabaseAdmin
        .from("financial_transactions")
        .insert({
          user_id,
          amount_cents: amountCentsNum,
          type: "deposit",
          status: "completed",
          description: "Stripe wallet deposit",
          stripe_session_id: session.id,
          stripe_payment_intent: session.payment_intent as string,
        })

      // ── NEW: Record in double-entry ledger ──
      if (tenantId) {
        const idempotencyKey = `stripe_deposit_${session.id}`
        const { data: ledgerResult, error: ledgerError } = await supabaseAdmin.rpc("ledger_deposit", {
          p_tenant_id: tenantId,
          p_user_id: user_id,
          p_amount_cents: amountCentsNum,
          p_stripe_session_id: session.id,
          p_idempotency_key: idempotencyKey,
        })

        if (ledgerError) {
          console.error("[Stripe Webhook] Ledger deposit error:", ledgerError)
        } else {
          console.log("[Stripe Webhook] Ledger deposit recorded:", ledgerResult)
        }
      }

      console.log("[Stripe Webhook] Wallet deposit processed:", { user_id, amountCentsNum, newBalance })
      return
    }

    if (type === "event_booking" && booking_id) {
      // Update event booking: mark deposit as paid and status to confirmed
      const { error } = await supabaseAdmin
        .from("cb_bookings")
        .update({
          deposit_paid: true,
          status: "confirmed",
          stripe_payment_intent: session.payment_intent as string,
          updated_at: new Date().toISOString(),
        })
        .eq("id", booking_id)

      if (error) {
        console.error("[Stripe Webhook] Failed to update event booking:", error)
      } else {
        console.log("[Stripe Webhook] Event booking confirmed:", booking_id)
      }
    }

    if (type === "rental_booking" && rental_id) {
      // Update rental booking: mark deposit as paid and status to confirmed
      const { error } = await supabaseAdmin
        .from("cb_rental_bookings")
        .update({
          deposit_paid: true,
          status: "confirmed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", rental_id)

      if (error) {
        console.error("[Stripe Webhook] Failed to update rental booking:", error)
      } else {
        console.log("[Stripe Webhook] Rental booking confirmed:", rental_id)
      }
    }

    if (type === "invoice_payment" && invoice_id) {
      // Get the invoice to check the amount
      const { data: invoice } = await supabaseAdmin
        .from("cb_invoices")
        .select("amount_paid_cents, total_cents")
        .eq("id", invoice_id)
        .single()

      if (invoice && session.amount_total) {
        const newPaid = invoice.amount_paid_cents + session.amount_total
        const status = newPaid >= invoice.total_cents ? "paid" : "partial"

        const { error } = await supabaseAdmin
          .from("cb_invoices")
          .update({
            amount_paid_cents: newPaid,
            status,
            stripe_payment_link: session.payment_intent as string,
            updated_at: new Date().toISOString(),
            ...(status === "paid" ? { paid_at: new Date().toISOString() } : {}),
          })
          .eq("id", invoice_id)

        if (error) {
          console.error("[Stripe Webhook] Failed to update invoice:", error)
        } else {
          console.log("[Stripe Webhook] Invoice payment recorded:", invoice_id)
        }
      }
    }

    // ── Tournament Registration Payment ──
    if (type === "tournament_registration" && tournament_id && registration_id) {
      const { error } = await supabaseAdmin
        .from("tournament_registrations")
        .update({
          payment_status: "paid",
          status: "registered",
          stripe_payment_intent: session.payment_intent as string,
          stripe_checkout_session: session.id,
          payment_amount_cents: session.amount_total,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", registration_id)

      if (error) {
        console.error("[Stripe Webhook] Failed to update tournament registration:", error)
      } else {
        console.log("[Stripe Webhook] Tournament registration payment confirmed:", registration_id)

        // Optionally create a points transaction for registering
        if (player_id) {
          await supabaseAdmin.from("points_transactions").insert({
            user_id: player_id,
            amount: 10, // Award 10 points for tournament registration
            type: "tournament_registration",
            description: "Points earned for tournament registration",
            reference_id: tournament_id,
          })

          // Update profile points balance
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("points_balance")
            .eq("id", player_id)
            .single()

          if (profile) {
            await supabaseAdmin
              .from("profiles")
              .update({ points_balance: (profile.points_balance ?? 0) + 10 })
              .eq("id", player_id)
          }
        }
      }
    }

    // ── Tournament Refund Processing ──
    if (type === "tournament_refund" && registration_id) {
      const { error } = await supabaseAdmin
        .from("tournament_registrations")
        .update({
          payment_status: "refunded",
          status: "dropped",
          refund_amount_cents: session.amount_total,
          refunded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", registration_id)

      if (error) {
        console.error("[Stripe Webhook] Failed to process tournament refund:", error)
      } else {
        console.log("[Stripe Webhook] Tournament refund processed:", registration_id)
      }
    }

    // ── Subscription Checkout ──
    if (type === "subscription" && metadata.user_id && metadata.plan_id) {
      console.log("[Stripe Webhook] Subscription checkout completed:", metadata.plan_id)
      // Subscription is handled via customer.subscription.created event
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // TICKET PURCHASE COMPLETION
    // ══════════════════════════════════════════════════════════════════════════════
    if (type === "ticket_purchase" && order_id) {
      const idempotencyKey = `ticket_order_${session.id}`
      
      // Check idempotency
      const { data: existingOrder } = await supabaseAdmin
        .from("ticket_orders")
        .select("id, status")
        .eq("stripe_session_id", session.id)
        .single()

      if (existingOrder && existingOrder.status === "completed") {
        console.log("[Stripe Webhook] Duplicate ticket order prevented:", session.id)
        return
      }

      // Use atomic RPC to complete the order
      const { data: result, error: rpcError } = await supabaseAdmin.rpc("complete_ticket_order", {
        p_order_id: order_id,
        p_stripe_session_id: session.id,
        p_stripe_payment_intent: session.payment_intent as string,
        p_idempotency_key: idempotencyKey,
      })

      if (rpcError) {
        console.error("[Stripe Webhook] Ticket order completion error:", rpcError)
        return
      }

      if (!result?.success) {
        console.error("[Stripe Webhook] Ticket order failed:", result?.error)
        return
      }

      console.log("[Stripe Webhook] Ticket order completed:", {
        order_id,
        tickets_issued: result.tickets_issued,
        total_cents: result.total_cents,
      })

      // Record in ledger if tenant_id is present
      if (tenant_id && session.amount_total) {
        const { data: ledgerResult, error: ledgerError } = await supabaseAdmin.rpc("ledger_ticket_sale", {
          p_tenant_id: tenant_id,
          p_order_id: order_id,
          p_amount_cents: session.amount_total,
          p_stripe_session_id: session.id,
          p_idempotency_key: `ledger_ticket_${session.id}`,
        })

        if (ledgerError) {
          console.error("[Stripe Webhook] Ledger ticket sale error:", ledgerError)
        } else {
          console.log("[Stripe Webhook] Ledger ticket sale recorded:", ledgerResult)
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // TICKET REFUND
    // ══════════════════════════════════════════════════════════════════════════════
    if (type === "ticket_refund" && order_id) {
      const { data: result, error: rpcError } = await supabaseAdmin.rpc("process_ticket_refund", {
        p_order_id: order_id,
        p_reason: metadata.refund_reason || "Customer requested refund",
        p_refund_amount_cents: session.amount_total ? session.amount_total : null,
      })

      if (rpcError) {
        console.error("[Stripe Webhook] Ticket refund error:", rpcError)
      } else {
        console.log("[Stripe Webhook] Ticket refund processed:", result)
      }
    }
  } catch (err) {
    console.error("[Stripe Webhook] Error processing webhook:", err)
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Subscription Handlers
// ══════════════════════════════════════════════════════════════════════════════

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id
  const planId = subscription.metadata?.plan_id

  if (!userId) {
    // Try to find user by customer ID
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", subscription.customer as string)
      .single()

    if (!profile) {
      console.error("[Stripe Webhook] Cannot find user for subscription:", subscription.id)
      return
    }

    await updateUserSubscription(profile.id, subscription, planId)
  } else {
    await updateUserSubscription(userId, subscription, planId)
  }
}

async function updateUserSubscription(
  userId: string,
  subscription: Stripe.Subscription,
  planId?: string
) {
  const status = subscription.status === "active" || subscription.status === "trialing"
    ? "active"
    : subscription.status === "past_due"
      ? "past_due"
      : subscription.cancel_at_period_end
        ? "canceling"
        : "inactive"

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      subscription_status: status,
      subscription_plan: planId || subscription.metadata?.plan_id,
      stripe_subscription_id: subscription.id,
      subscription_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (error) {
    console.error("[Stripe Webhook] Failed to update subscription:", error)
  } else {
    console.log("[Stripe Webhook] Subscription updated:", userId, status)
  }
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id

  if (!userId) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("stripe_subscription_id", subscription.id)
      .single()

    if (profile) {
      await cancelUserSubscription(profile.id)
    }
  } else {
    await cancelUserSubscription(userId)
  }
}

async function cancelUserSubscription(userId: string) {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      subscription_status: "inactive",
      subscription_plan: "free",
      stripe_subscription_id: null,
      subscription_period_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (error) {
    console.error("[Stripe Webhook] Failed to cancel subscription:", error)
  } else {
    console.log("[Stripe Webhook] Subscription canceled:", userId)
  }
}

async function handleSubscriptionPaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .single()

  if (profile) {
    await supabaseAdmin
      .from("profiles")
      .update({
        subscription_status: "past_due",
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id)

    console.log("[Stripe Webhook] Subscription payment failed:", profile.id)
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Connect Account Handlers
// ══════════════════════════════════════════════════════════════════════════════

async function handleConnectAccountUpdate(account: Stripe.Account) {
  const userId = account.metadata?.supabase_user_id

  if (!userId) return

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      stripe_connect_status: account.details_submitted ? "complete" : "incomplete",
      stripe_connect_payouts_enabled: account.payouts_enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (error) {
    console.error("[Stripe Webhook] Failed to update Connect account:", error)
  } else {
    console.log("[Stripe Webhook] Connect account updated:", userId, account.payouts_enabled)
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Identity Verification Handlers
// ══════════════════════════════════════════════════════════════════════════════

async function handleIdentityVerified(session: Stripe.Identity.VerificationSession) {
  const userId = session.metadata?.user_id

  if (!userId) {
    console.error("[Stripe Webhook] No user_id in identity session metadata")
    return
  }

  // Update KYC verification record
  const { error: kycError } = await supabaseAdmin
    .from("kyc_verifications")
    .update({
      status: "verified",
      updated_at: new Date().toISOString(),
    })
    .eq("provider_session_id", session.id)

  if (kycError) {
    console.error("[Stripe Webhook] Failed to update KYC record:", kycError)
  }

  // Update user profile
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      kyc_verified: true,
      kyc_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (profileError) {
    console.error("[Stripe Webhook] Failed to update profile KYC:", profileError)
  } else {
    console.log("[Stripe Webhook] Identity verified for user:", userId)
  }

  // Create notification
  await supabaseAdmin.from("financial_alerts").insert({
    user_id: userId,
    alert_type: "kyc_required",
    severity: "info",
    title: "Identity Verified",
    message: "Your identity has been successfully verified. You can now receive payouts.",
    action_url: "/dashboard/financials",
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// Escrow & Tournament Financial Handlers
// ══════════════════════════════════════════════════════════════════════════════

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const metadata = paymentIntent.metadata
  if (!metadata) return

  // Handle escrow funding
  if (metadata.type === "escrow_funding" && metadata.tournament_id && metadata.escrow_id) {
    console.log("[Stripe Webhook] Escrow funding succeeded:", metadata.tournament_id)

    // Update escrow account
    const { error: escrowError } = await supabaseAdmin
      .from("escrow_accounts")
      .update({
        status: "funded",
        funded_amount_cents: paymentIntent.amount,
        funded_at: new Date().toISOString(),
        funding_method: "card",
        verification_status: "verified",
        updated_at: new Date().toISOString(),
      })
      .eq("id", metadata.escrow_id)

    if (escrowError) {
      console.error("[Stripe Webhook] Failed to update escrow:", escrowError)
      return
    }

    // Update tournament status
    const { error: tournamentError } = await supabaseAdmin
      .from("tournaments")
      .update({
        escrow_status: "funded",
        escrow_funded_at: new Date().toISOString(),
        status: "registration",
      })
      .eq("id", metadata.tournament_id)

    if (tournamentError) {
      console.error("[Stripe Webhook] Failed to update tournament:", tournamentError)
      return
    }

    // Notify organizer
    if (metadata.funded_by) {
      const { data: tournament } = await supabaseAdmin
        .from("tournaments")
        .select("name")
        .eq("id", metadata.tournament_id)
        .single()

      await supabaseAdmin.from("financial_alerts").insert({
        user_id: metadata.funded_by,
        tournament_id: metadata.tournament_id,
        alert_type: "escrow_funded",
        severity: "info",
        title: "Prize Pool Funded",
        message: `The $${(paymentIntent.amount / 100).toFixed(2)} prize pool for ${tournament?.name || "your tournament"} has been successfully funded. The tournament is now open for registration.`,
        action_url: `/dashboard/tournaments/${metadata.tournament_id}`,
      })
    }

    console.log("[Stripe Webhook] Escrow funded successfully:", metadata.tournament_id)
  }

  // Handle tournament payment
  if (metadata.type === "tournament_payment" && metadata.tournament_id && metadata.user_id) {
    // Record the payment
    await supabaseAdmin.from("tournament_payments").insert({
      tournament_id: metadata.tournament_id,
      user_id: metadata.user_id,
      registration_id: metadata.registration_id || null,
      amount_cents: paymentIntent.amount,
      platform_fee_cents: Math.floor(paymentIntent.amount * 0.05), // 5% platform fee
      net_amount_cents: paymentIntent.amount - Math.floor(paymentIntent.amount * 0.05),
      payment_method: "card",
      status: "succeeded",
      stripe_payment_intent_id: paymentIntent.id,
    })

    console.log("[Stripe Webhook] Tournament payment recorded:", paymentIntent.id)
  }
}

async function handleTransferCompleted(transfer: Stripe.Transfer) {
  const metadata = transfer.metadata
  if (!metadata) return

  // Handle payout_requests table (new system)
  if (metadata.payout_id && !metadata.type) {
    await supabaseAdmin.rpc("handle_stripe_transfer_event", {
      p_transfer_id: transfer.id,
      p_event_type: "transfer.paid",
    })
    console.log("[Stripe Webhook] Payout request completed via RPC:", metadata.payout_id)
    return
  }

  if (metadata.type === "player_prize" && metadata.payout_id) {
    await supabaseAdmin
      .from("player_payouts")
      .update({
        status: "completed",
        stripe_transfer_id: transfer.id,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", metadata.payout_id)

    // Notify player
    const { data: payout } = await supabaseAdmin
      .from("player_payouts")
      .select("user_id, tournament_id, net_amount_cents")
      .eq("id", metadata.payout_id)
      .single()

    if (payout) {
      await supabaseAdmin.from("financial_alerts").insert({
        user_id: payout.user_id,
        tournament_id: payout.tournament_id,
        alert_type: "payout_sent",
        severity: "info",
        title: "Prize Money Sent",
        message: `Your prize of $${(payout.net_amount_cents / 100).toFixed(2)} has been sent to your account.`,
      })
    }

    console.log("[Stripe Webhook] Player payout completed:", metadata.payout_id)
  }

  if (metadata.type === "organizer_payout" && metadata.payout_id) {
    await supabaseAdmin
      .from("organizer_payouts")
      .update({
        status: "completed",
        stripe_transfer_id: transfer.id,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", metadata.payout_id)

    console.log("[Stripe Webhook] Organizer payout completed:", metadata.payout_id)
  }
}

async function handleTransferFailed(transfer: Stripe.Transfer) {
  const metadata = transfer.metadata
  if (!metadata) return

  // Handle payout_requests table (new system)
  if (metadata.payout_id && !metadata.type) {
    await supabaseAdmin.rpc("handle_stripe_transfer_event", {
      p_transfer_id: transfer.id,
      p_event_type: "transfer.failed",
      p_failure_message: "Transfer failed - please update payment details",
    })
    console.log("[Stripe Webhook] Payout request failed via RPC:", metadata.payout_id)
    return
  }

  const failureReason = "Transfer failed - please update payment details"

  if (metadata.type === "player_prize" && metadata.payout_id) {
    await supabaseAdmin
      .from("player_payouts")
      .update({
        status: "failed",
        failure_reason: failureReason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", metadata.payout_id)

    // Notify player
    const { data: payout } = await supabaseAdmin
      .from("player_payouts")
      .select("user_id, tournament_id")
      .eq("id", metadata.payout_id)
      .single()

    if (payout) {
      await supabaseAdmin.from("financial_alerts").insert({
        user_id: payout.user_id,
        tournament_id: payout.tournament_id,
        alert_type: "payout_failed",
        severity: "error",
        title: "Payout Failed",
        message: "Your payout could not be processed. Please verify your payment details and try again.",
        action_url: "/dashboard/financials",
      })
    }

    console.log("[Stripe Webhook] Player payout failed:", metadata.payout_id)
  }

  if (metadata.type === "organizer_payout" && metadata.payout_id) {
    await supabaseAdmin
      .from("organizer_payouts")
      .update({
        status: "failed",
        failure_reason: failureReason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", metadata.payout_id)

    console.log("[Stripe Webhook] Organizer payout failed:", metadata.payout_id)
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Financial Intent Reconciliation
// ══════════════════════════════════════════════════════════════════════════════

async function reconcileFinancialIntent(
  session: Stripe.Checkout.Session,
  status: "succeeded" | "failed" | "expired" | "canceled"
) {
  const metadata = session.metadata
  
  // Only reconcile if this was created via financial_intents system
  if (!metadata?.intent_id) {
    return
  }

  const statusMap: Record<string, string> = {
    succeeded: "succeeded",
    failed: "failed",
    expired: "expired",
    canceled: "canceled",
  }

  const { data, error } = await supabaseAdmin.rpc("reconcile_financial_intent", {
    p_stripe_session_id: session.id,
    p_stripe_payment_intent_id: session.payment_intent as string || null,
    p_status: statusMap[status],
    p_stripe_charge_id: null,
    p_error_code: null,
    p_error_message: null,
  })

  if (error) {
    console.error("[Stripe Webhook] Intent reconciliation error:", error)
  } else if (data?.success) {
    console.log("[Stripe Webhook] Intent reconciled:", data.intent_id, status)
  }
}

async function handleTransferReversed(transfer: Stripe.Transfer) {
  const metadata = transfer.metadata
  if (!metadata) return

  // Handle payout_requests table (new system)
  if (metadata.payout_id) {
    await supabaseAdmin.rpc("handle_stripe_transfer_event", {
      p_transfer_id: transfer.id,
      p_event_type: "transfer.reversed",
      p_failure_message: "Transfer was reversed",
    })
    console.log("[Stripe Webhook] Payout request reversed:", metadata.payout_id)
  }
}
