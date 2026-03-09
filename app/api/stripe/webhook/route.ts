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

  const { type, booking_id, rental_id, invoice_id } = metadata

  console.log("[Stripe Webhook] Processing checkout complete:", { type, booking_id, rental_id, invoice_id })

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
  } catch (err) {
    console.error("[Stripe Webhook] Error processing webhook:", err)
  }
}
