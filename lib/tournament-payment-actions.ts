"use server"

import { createClient } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

// ══════════════════════════════════════════════════════════════════════════════
// Tournament Registration Payment
// ══════════════════════════════════════════════════════════════════════════════

export async function createTournamentCheckoutSession(
  tournamentId: string,
  options?: {
    successUrl?: string
    cancelUrl?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // Get tournament details
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, slug, entry_fee_cents, games(name)")
    .eq("id", tournamentId)
    .single()

  if (!tournament) return { error: "Tournament not found" }
  if (!tournament.entry_fee_cents || tournament.entry_fee_cents <= 0) {
    return { error: "Tournament has no entry fee" }
  }

  // Get or create registration
  let { data: registration } = await supabase
    .from("tournament_registrations")
    .select("id, payment_status")
    .eq("tournament_id", tournamentId)
    .eq("player_id", user.id)
    .single()

  if (registration?.payment_status === "paid") {
    return { error: "Already paid for this tournament" }
  }

  if (!registration) {
    // Create pending registration
    const { data: newReg, error: regError } = await supabase
      .from("tournament_registrations")
      .insert({
        tournament_id: tournamentId,
        player_id: user.id,
        registration_type: "paid",
        payment_status: "pending",
        status: "pending_payment",
      })
      .select()
      .single()

    if (regError) return { error: regError.message }
    registration = newReg
  }

  // Get user profile for prefilling
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .single()

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const successUrl = options?.successUrl || `${baseUrl}/esports/tournaments/${tournament.slug}?payment=success`
  const cancelUrl = options?.cancelUrl || `${baseUrl}/esports/tournaments/${tournament.slug}?payment=cancelled`

  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: profile?.email || user.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${tournament.name} - Tournament Entry`,
            description: `Entry fee for ${tournament.name}${tournament.games?.name ? ` (${tournament.games.name})` : ""}`,
          },
          unit_amount: tournament.entry_fee_cents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "tournament_registration",
      tournament_id: tournamentId,
      registration_id: registration.id,
      player_id: user.id,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
  })

  // Update registration with checkout session ID
  await supabase
    .from("tournament_registrations")
    .update({
      stripe_checkout_session: session.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", registration.id)

  return { success: true, checkoutUrl: session.url }
}

export async function createTournamentPaymentIntent(
  tournamentId: string,
  options?: {
    savePaymentMethod?: boolean
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // Get tournament
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, entry_fee_cents")
    .eq("id", tournamentId)
    .single()

  if (!tournament || !tournament.entry_fee_cents) {
    return { error: "Tournament not found or has no entry fee" }
  }

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .single()

  let customerId = profile?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email || user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id

    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id)
  }

  // Create payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: tournament.entry_fee_cents,
    currency: "usd",
    customer: customerId,
    metadata: {
      type: "tournament_registration",
      tournament_id: tournamentId,
      player_id: user.id,
    },
    setup_future_usage: options?.savePaymentMethod ? "on_session" : undefined,
  })

  return {
    success: true,
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Refunds & Cancellations
// ══════════════════════════════════════════════════════════════════════════════

export async function refundTournamentRegistration(
  registrationId: string,
  options?: {
    reason?: string
    refundAmount?: number // Partial refund amount in cents
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Get registration
  const { data: registration } = await supabase
    .from("tournament_registrations")
    .select("*, tournaments(id, name, refund_policy, created_by)")
    .eq("id", registrationId)
    .single()

  if (!registration) return { error: "Registration not found" }

  // Check authorization (staff or tournament creator)
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  const isStaff = staffRole && ["owner", "manager"].includes(staffRole.role)
  const isCreator = registration.tournaments?.created_by === user.id

  if (!isStaff && !isCreator) {
    return { error: "Not authorized to process refunds" }
  }

  if (registration.payment_status !== "paid" || !registration.stripe_payment_intent) {
    return { error: "No payment to refund" }
  }

  // Calculate refund amount
  const refundAmount = options?.refundAmount ?? registration.payment_amount_cents

  try {
    // Create Stripe refund
    const refund = await stripe.refunds.create({
      payment_intent: registration.stripe_payment_intent,
      amount: refundAmount,
      reason: "requested_by_customer",
      metadata: {
        type: "tournament_refund",
        registration_id: registrationId,
        reason: options?.reason || "Tournament withdrawal",
      },
    })

    // Update registration
    const isFullRefund = refundAmount >= (registration.payment_amount_cents ?? 0)

    await supabase
      .from("tournament_registrations")
      .update({
        payment_status: isFullRefund ? "refunded" : "partial_refund",
        status: isFullRefund ? "dropped" : registration.status,
        refund_amount_cents: refundAmount,
        refund_reason: options?.reason,
        stripe_refund_id: refund.id,
        refunded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", registrationId)

    revalidatePath(`/dashboard/tournaments/${registration.tournaments?.id}`)
    return { success: true, refundId: refund.id }
  } catch (err) {
    console.error("[Refund Error]", err)
    return { error: "Failed to process refund" }
  }
}

export async function requestRefund(tournamentId: string, reason?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // Get registration
  const { data: registration } = await supabase
    .from("tournament_registrations")
    .select("*, tournaments(refund_policy, refund_deadline, start_date)")
    .eq("tournament_id", tournamentId)
    .eq("player_id", user.id)
    .single()

  if (!registration) return { error: "Registration not found" }
  if (registration.payment_status !== "paid") {
    return { error: "No payment to refund" }
  }

  // Check refund policy
  const tournament = registration.tournaments
  const now = new Date()

  if (tournament?.refund_policy === "no_refunds") {
    return { error: "This tournament does not allow refunds" }
  }

  if (tournament?.refund_deadline && new Date(tournament.refund_deadline) < now) {
    return { error: "Refund deadline has passed" }
  }

  if (tournament?.start_date && new Date(tournament.start_date) < now) {
    return { error: "Cannot request refund after tournament has started" }
  }

  // Create refund request
  const { error } = await supabase.from("tournament_refund_requests").insert({
    registration_id: registration.id,
    tournament_id: tournamentId,
    player_id: user.id,
    reason: reason,
    status: "pending",
  })

  if (error) return { error: error.message }

  // Update registration status
  await supabase
    .from("tournament_registrations")
    .update({
      status: "refund_requested",
      updated_at: new Date().toISOString(),
    })
    .eq("id", registration.id)

  revalidatePath(`/esports/tournaments`)
  return { success: true }
}

// ══════════════════════════════════════════════════════════════════════════════
// Payment Management (Admin)
// ══════════════════════════════════════════════════════════════════════════════

export async function markPaymentManually(
  registrationId: string,
  options: {
    method: "cash" | "venmo" | "paypal" | "other"
    notes?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Get registration
  const { data: registration } = await supabase
    .from("tournament_registrations")
    .select("tournament_id, tournaments(created_by)")
    .eq("id", registrationId)
    .single()

  if (!registration) return { error: "Registration not found" }

  // Check authorization
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  const isStaff = staffRole && ["owner", "manager", "organizer"].includes(staffRole.role)
  const isCreator = registration.tournaments?.created_by === user.id

  if (!isStaff && !isCreator) {
    return { error: "Not authorized" }
  }

  const { error } = await supabase
    .from("tournament_registrations")
    .update({
      payment_status: "paid",
      status: "registered",
      payment_method: options.method,
      payment_notes: options.notes,
      paid_at: new Date().toISOString(),
      marked_paid_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", registrationId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/tournaments/${registration.tournament_id}`)
  return { success: true }
}

export async function getPaymentSummary(tournamentId: string) {
  const supabase = await createClient()

  const { data: registrations } = await supabase
    .from("tournament_registrations")
    .select("payment_status, payment_amount_cents, refund_amount_cents")
    .eq("tournament_id", tournamentId)

  if (!registrations) return null

  const summary = {
    totalRegistrations: registrations.length,
    paidCount: registrations.filter(r => r.payment_status === "paid").length,
    pendingCount: registrations.filter(r => r.payment_status === "pending").length,
    refundedCount: registrations.filter(r => r.payment_status === "refunded").length,
    totalCollected: registrations
      .filter(r => r.payment_status === "paid")
      .reduce((sum, r) => sum + (r.payment_amount_cents ?? 0), 0),
    totalRefunded: registrations
      .reduce((sum, r) => sum + (r.refund_amount_cents ?? 0), 0),
  }

  return {
    ...summary,
    netRevenue: summary.totalCollected - summary.totalRefunded,
  }
}

export async function getPendingRefundRequests(tournamentId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Check staff status
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (!staffRole || !["owner", "manager", "organizer"].includes(staffRole.role)) {
    return []
  }

  let query = supabase
    .from("tournament_refund_requests")
    .select(`
      *,
      profiles(id, display_name, avatar_url),
      tournaments(id, name, slug),
      tournament_registrations(payment_amount_cents)
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (tournamentId) {
    query = query.eq("tournament_id", tournamentId)
  }

  const { data } = await query
  return data ?? []
}

export async function processRefundRequest(
  requestId: string,
  action: "approve" | "deny",
  options?: {
    refundAmount?: number
    notes?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Get request
  const { data: request } = await supabase
    .from("tournament_refund_requests")
    .select("*, tournament_registrations(*)")
    .eq("id", requestId)
    .single()

  if (!request) return { error: "Request not found" }

  // Check authorization
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (!staffRole || !["owner", "manager"].includes(staffRole.role)) {
    return { error: "Not authorized" }
  }

  if (action === "approve") {
    // Process the refund
    const result = await refundTournamentRegistration(
      request.registration_id,
      {
        reason: request.reason || "Refund request approved",
        refundAmount: options?.refundAmount,
      }
    )

    if ("error" in result) return result
  }

  // Update request status
  await supabase
    .from("tournament_refund_requests")
    .update({
      status: action === "approve" ? "approved" : "denied",
      processed_by: user.id,
      processed_at: new Date().toISOString(),
      admin_notes: options?.notes,
    })
    .eq("id", requestId)

  // Update registration if denied
  if (action === "deny") {
    await supabase
      .from("tournament_registrations")
      .update({
        status: "registered",
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.registration_id)
  }

  revalidatePath(`/dashboard/tournaments/${request.tournament_id}`)
  return { success: true }
}
