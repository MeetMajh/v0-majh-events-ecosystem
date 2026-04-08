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
      await handleCheckoutComplete(session)
      break
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session
      console.log("[Stripe Webhook] Checkout expired:", session.id)
      // Optionally mark booking as expired
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

  const { type, booking_id, rental_id, invoice_id, tournament_id, registration_id, player_id } = metadata

  console.log("[Stripe Webhook] Processing checkout complete:", { type, booking_id, rental_id, invoice_id, tournament_id })

  try {
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
