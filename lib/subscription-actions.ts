"use server"

import { createClient } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

// ══════════════════════════════════════════════════════════════════════════════
// Membership/Subscription Plans
// ══════════════════════════════════════════════════════════════════════════════

export interface MembershipPlan {
  id: string
  name: string
  description: string
  priceInCents: number
  interval: "month" | "year"
  features: string[]
  stripePriceId?: string
  isPopular?: boolean
}

export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    id: "free",
    name: "Free",
    description: "Perfect for casual players",
    priceInCents: 0,
    interval: "month",
    features: [
      "Join public tournaments",
      "Basic player profile",
      "View leaderboards",
      "Community access",
    ],
  },
  {
    id: "competitor",
    name: "Competitor",
    description: "For dedicated tournament players",
    priceInCents: 999, // $9.99/month
    interval: "month",
    features: [
      "Everything in Free",
      "Priority tournament registration",
      "Advanced statistics",
      "10% off entry fees",
      "Custom profile badge",
      "Early access to features",
    ],
    isPopular: true,
  },
  {
    id: "competitor_annual",
    name: "Competitor (Annual)",
    description: "Best value - save 20%",
    priceInCents: 9590, // $95.90/year ($7.99/month effective)
    interval: "year",
    features: [
      "Everything in Competitor",
      "Save 20% vs monthly",
      "2 free tournament entries/year",
      "Exclusive annual rewards",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For serious competitors and streamers",
    priceInCents: 2499, // $24.99/month
    interval: "month",
    features: [
      "Everything in Competitor",
      "25% off entry fees",
      "Featured profile placement",
      "Stream integration tools",
      "Priority support",
      "Private tournaments",
      "API access",
    ],
  },
]

// ══════════════════════════════════════════════════════════════════════════════
// Create Subscription Checkout
// ══════════════════════════════════════════════════════════════════════════════

export async function createSubscriptionCheckout(planId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  const plan = MEMBERSHIP_PLANS.find((p) => p.id === planId)
  if (!plan || plan.priceInCents === 0) {
    return { error: "Invalid plan selected" }
  }

  // Check if user already has an active subscription
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, subscription_status, subscription_plan")
    .eq("id", user.id)
    .single()

  if (profile?.subscription_status === "active" && profile?.subscription_plan === planId) {
    return { error: "You already have this subscription" }
  }

  // Get or create Stripe customer
  let customerId = profile?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id

    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id)
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  // Create or get the price in Stripe
  // In production, you'd create these prices in Stripe Dashboard and store the IDs
  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: plan.priceInCents,
    recurring: { interval: plan.interval },
    product_data: {
      name: `MAJH ${plan.name} Membership`,
      metadata: { plan_id: plan.id },
    },
  })

  // Create subscription checkout session
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price: price.id,
        quantity: 1,
      },
    ],
    metadata: {
      type: "subscription",
      plan_id: planId,
      user_id: user.id,
    },
    success_url: `${baseUrl}/dashboard/settings?subscription=success`,
    cancel_url: `${baseUrl}/pricing?subscription=cancelled`,
    subscription_data: {
      metadata: {
        plan_id: planId,
        user_id: user.id,
      },
    },
  })

  return { success: true, checkoutUrl: session.url }
}

// ══════════════════════════════════════════════════════════════════════════════
// Manage Subscription (Customer Portal)
// ══════════════════════════════════════════════════════════════════════════════

export async function createCustomerPortalSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return { error: "No subscription found" }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${baseUrl}/dashboard/settings`,
  })

  return { success: true, portalUrl: session.url }
}

// ══════════════════════════════════════════════════════════════════════════════
// Cancel Subscription
// ══════════════════════════════════════════════════════════════════════════════

export async function cancelSubscription() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_subscription_id")
    .eq("id", user.id)
    .single()

  if (!profile?.stripe_subscription_id) {
    return { error: "No active subscription" }
  }

  try {
    // Cancel at period end (so they keep access until the end of billing period)
    await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    await supabase
      .from("profiles")
      .update({
        subscription_status: "canceling",
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    revalidatePath("/dashboard/settings")
    return { success: true }
  } catch (error) {
    console.error("[Subscription] Cancel error:", error)
    return { error: "Failed to cancel subscription" }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Get User Subscription Status
// ══════════════════════════════════════════════════════════════════════════════

export async function getSubscriptionStatus() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, subscription_plan, subscription_period_end")
    .eq("id", user.id)
    .single()

  if (!profile) return null

  const plan = MEMBERSHIP_PLANS.find((p) => p.id === profile.subscription_plan)

  return {
    status: profile.subscription_status || "inactive",
    plan: plan || MEMBERSHIP_PLANS[0], // Default to free
    periodEnd: profile.subscription_period_end,
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Prize Pool / Tournament Payouts
// ══════════════════════════════════════════════════════════════════════════════

export interface PrizeDistribution {
  place: number
  percentage: number
  playerId?: string
  amountCents?: number
}

export async function calculatePrizePool(tournamentId: string): Promise<{
  totalPrizeCents: number
  distribution: PrizeDistribution[]
  error?: string
}> {
  const supabase = await createClient()

  // Get tournament details
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, prize_pool_cents, entry_fee_cents, prize_distribution")
    .eq("id", tournamentId)
    .single()

  if (!tournament) {
    return { totalPrizeCents: 0, distribution: [], error: "Tournament not found" }
  }

  // Get paid registrations
  const { data: registrations, count } = await supabase
    .from("tournament_registrations")
    .select("id, payment_amount_cents", { count: "exact" })
    .eq("tournament_id", tournamentId)
    .eq("payment_status", "paid")

  const entryFeeTotal = registrations?.reduce((sum, r) => sum + (r.payment_amount_cents ?? 0), 0) ?? 0
  
  // Total prize = base prize pool + entry fees (configurable split)
  // Typically 70-80% of entry fees go to prize pool
  const entryFeeContribution = Math.floor(entryFeeTotal * 0.7)
  const totalPrizeCents = (tournament.prize_pool_cents ?? 0) + entryFeeContribution

  // Default prize distribution if not specified
  const defaultDistribution: PrizeDistribution[] = [
    { place: 1, percentage: 50 },
    { place: 2, percentage: 25 },
    { place: 3, percentage: 15 },
    { place: 4, percentage: 10 },
  ]

  const distribution = (tournament.prize_distribution as PrizeDistribution[] | null) ?? defaultDistribution

  // Calculate actual amounts
  const distributionWithAmounts = distribution.map((d) => ({
    ...d,
    amountCents: Math.floor((totalPrizeCents * d.percentage) / 100),
  }))

  return {
    totalPrizeCents,
    distribution: distributionWithAmounts,
  }
}

export async function initiatePrizePayout(
  tournamentId: string,
  payouts: Array<{
    playerId: string
    place: number
    amountCents: number
  }>
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // Verify user is tournament organizer or admin
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, created_by, status")
    .eq("id", tournamentId)
    .single()

  if (!tournament) return { error: "Tournament not found" }
  if (tournament.status !== "completed") return { error: "Tournament must be completed" }

  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  const isAuthorized = 
    tournament.created_by === user.id ||
    (staffRole && ["owner", "manager"].includes(staffRole.role))

  if (!isAuthorized) return { error: "Not authorized" }

  // Process payouts
  const results: Array<{ playerId: string; success: boolean; error?: string }> = []

  for (const payout of payouts) {
    try {
      // Get player's Stripe account (they must have connected Stripe for payouts)
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_connect_account_id, first_name, last_name")
        .eq("id", payout.playerId)
        .single()

      if (!profile?.stripe_connect_account_id) {
        // Record as pending - player needs to connect Stripe
        await supabase.from("tournament_payouts").insert({
          tournament_id: tournamentId,
          player_id: payout.playerId,
          place: payout.place,
          amount_cents: payout.amountCents,
          status: "pending_account",
          created_by: user.id,
        })

        results.push({
          playerId: payout.playerId,
          success: false,
          error: "Player has not connected payout account",
        })
        continue
      }

      // Create Stripe transfer
      const transfer = await stripe.transfers.create({
        amount: payout.amountCents,
        currency: "usd",
        destination: profile.stripe_connect_account_id,
        metadata: {
          type: "tournament_prize",
          tournament_id: tournamentId,
          player_id: payout.playerId,
          place: payout.place.toString(),
        },
        description: `${tournament.name} - ${getPlaceLabel(payout.place)} place prize`,
      })

      // Record successful payout
      await supabase.from("tournament_payouts").insert({
        tournament_id: tournamentId,
        player_id: payout.playerId,
        place: payout.place,
        amount_cents: payout.amountCents,
        status: "completed",
        stripe_transfer_id: transfer.id,
        created_by: user.id,
        paid_at: new Date().toISOString(),
      })

      results.push({ playerId: payout.playerId, success: true })
    } catch (error) {
      console.error(`[Payout Error] Player ${payout.playerId}:`, error)
      
      // Record failed payout
      await supabase.from("tournament_payouts").insert({
        tournament_id: tournamentId,
        player_id: payout.playerId,
        place: payout.place,
        amount_cents: payout.amountCents,
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
        created_by: user.id,
      })

      results.push({
        playerId: payout.playerId,
        success: false,
        error: "Transfer failed",
      })
    }
  }

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true, results }
}

function getPlaceLabel(place: number): string {
  switch (place) {
    case 1: return "1st"
    case 2: return "2nd"
    case 3: return "3rd"
    default: return `${place}th`
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Stripe Connect Onboarding (for players to receive payouts)
// ══════════════════════════════════════════════════════════════════════════════

export async function createConnectOnboardingLink() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id, first_name, last_name")
    .eq("id", user.id)
    .single()

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  let accountId = profile?.stripe_connect_account_id

  // Create Connect account if needed
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email,
      metadata: { supabase_user_id: user.id },
      capabilities: {
        transfers: { requested: true },
      },
    })
    accountId = account.id

    await supabase
      .from("profiles")
      .update({ stripe_connect_account_id: accountId })
      .eq("id", user.id)
  }

  // Create onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/dashboard/settings?connect=refresh`,
    return_url: `${baseUrl}/dashboard/settings?connect=success`,
    type: "account_onboarding",
  })

  return { success: true, onboardingUrl: accountLink.url }
}

export async function getConnectAccountStatus() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id")
    .eq("id", user.id)
    .single()

  if (!profile?.stripe_connect_account_id) {
    return { connected: false, status: "not_started" }
  }

  try {
    const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id)

    return {
      connected: true,
      status: account.details_submitted ? "complete" : "incomplete",
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    }
  } catch {
    return { connected: false, status: "error" }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Get Payout History
// ══════════════════════════════════════════════════════════════════════════════

export async function getPayoutHistory(options?: { tournamentId?: string; playerId?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from("tournament_payouts")
    .select(`
      *,
      tournaments(id, name, slug),
      profiles!tournament_payouts_player_id_fkey(id, first_name, last_name, avatar_url)
    `)
    .order("created_at", { ascending: false })

  if (options?.tournamentId) {
    query = query.eq("tournament_id", options.tournamentId)
  }

  if (options?.playerId) {
    query = query.eq("player_id", options.playerId)
  } else {
    // Show only user's own payouts unless they're staff
    const { data: staffRole } = await supabase
      .from("staff_roles")
      .select("role")
      .eq("user_id", user.id)
      .single()

    if (!staffRole || !["owner", "manager"].includes(staffRole.role)) {
      query = query.eq("player_id", user.id)
    }
  }

  const { data } = await query
  return data ?? []
}
