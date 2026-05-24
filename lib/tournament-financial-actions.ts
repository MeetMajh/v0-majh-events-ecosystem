"use server"

import { createClient } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import Stripe from "stripe"

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type TournamentType = "free" | "paid" | "sponsored"
export type PayoutMethod = "bank" | "paypal" | "venmo" | "cashapp" | "western_union" | "platform_balance" | "stripe_connect"
export type EscrowStatus = "pending" | "partially_funded" | "funded" | "releasing" | "released" | "refunded" | "disputed"

export interface PrizeDistribution {
  placement: number
  percentage: number
  fixedAmount?: number
}

export interface TournamentFinancialConfig {
  tournamentType: TournamentType
  entryFeeCents: number
  prizePoolCents: number
  minPlayers?: number
  minPlayersAction?: "cancel" | "refund" | "delay" | "reduce_prize"
  platformFeePercent?: number
  prizeDistributions: PrizeDistribution[]
  sponsorName?: string
  sponsorLogoUrl?: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// Wallet Management
// ═══════════════════════════════════════════════════════════════════════════════

export async function getOrCreateWallet(userId?: string) {
  const supabase = await createClient()
  
  let targetUserId = userId
  if (!targetUserId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }
    targetUserId = user.id
  }

  // Try to get existing wallet
  let { data: wallet } = await supabase
    .from("user_wallets")
    .select("*")
    .eq("user_id", targetUserId)
    .single()

  if (!wallet) {
    // Create new wallet
    const { data: newWallet, error } = await supabase
      .from("user_wallets")
      .insert({
        user_id: targetUserId,
        balance_cents: 0,
        pending_cents: 0,
        lifetime_earnings_cents: 0,
        lifetime_withdrawals_cents: 0,
      })
      .select()
      .single()

    if (error) return { error: error.message }
    wallet = newWallet
  }

  return { wallet }
}

export async function getWalletBalance() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: wallet } = await supabase
    .from("user_wallets")
    .select("balance_cents, pending_cents, lifetime_earnings_cents")
    .eq("user_id", user.id)
    .single()

  return {
    balanceCents: wallet?.balance_cents ?? 0,
    pendingCents: wallet?.pending_cents ?? 0,
    lifetimeEarningsCents: wallet?.lifetime_earnings_cents ?? 0,
  }
}

export async function getWalletTransactions(limit = 20, offset = 0) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from("wallet_transactions")
    .select("*, tournaments(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  return data ?? []
}

// ═══════════════════════════════════════════════════════════════════════════════
// Stripe Connect Onboarding (for Organizers)
// ═══════════════════════════════════════════════════════════════════════════════

export async function createConnectAccount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // Check if user already has a Connect account
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id, stripe_connect_status")
    .eq("id", user.id)
    .single()

  if (profile?.stripe_connect_account_id) {
    // Return existing account link for incomplete accounts
    if (profile.stripe_connect_status !== "complete") {
      const accountLink = await stripe.accountLinks.create({
        account: profile.stripe_connect_account_id,
        refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/financials?connect=refresh`,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/financials?connect=success`,
        type: "account_onboarding",
      })
      return { success: true, onboardingUrl: accountLink.url }
    }
    return { error: "Connect account already complete" }
  }

  // Create new Express account
  const account = await stripe.accounts.create({
    type: "express",
    country: "US",
    email: user.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: {
      supabase_user_id: user.id,
    },
  })

  // Store account ID
  await supabase
    .from("profiles")
    .update({
      stripe_connect_account_id: account.id,
      stripe_connect_status: "pending",
    })
    .eq("id", user.id)

  // Create account link
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/financials?connect=refresh`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/financials?connect=success`,
    type: "account_onboarding",
  })

  return { success: true, onboardingUrl: accountLink.url }
}

export async function getConnectAccountStatus() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id, stripe_connect_status, stripe_connect_payouts_enabled")
    .eq("id", user.id)
    .single()

  if (!profile?.stripe_connect_account_id) {
    return {
      status: "not_started",
      payoutsEnabled: false,
      accountId: null,
    }
  }

  // Fetch latest status from Stripe
  try {
    const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id)
    
    const status = account.details_submitted 
      ? "complete" 
      : account.requirements?.currently_due?.length 
        ? "incomplete" 
        : "pending"

    // Update local status if changed
    if (status !== profile.stripe_connect_status || account.payouts_enabled !== profile.stripe_connect_payouts_enabled) {
      await supabase
        .from("profiles")
        .update({
          stripe_connect_status: status,
          stripe_connect_payouts_enabled: account.payouts_enabled,
        })
        .eq("id", user.id)
    }

    return {
      status,
      payoutsEnabled: account.payouts_enabled ?? false,
      accountId: account.id,
      chargesEnabled: account.charges_enabled ?? false,
      requirements: account.requirements?.currently_due ?? [],
    }
  } catch {
    return {
      status: profile.stripe_connect_status ?? "unknown",
      payoutsEnabled: profile.stripe_connect_payouts_enabled ?? false,
      accountId: profile.stripe_connect_account_id,
    }
  }
}

export async function createConnectLoginLink() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id")
    .eq("id", user.id)
    .single()

  if (!profile?.stripe_connect_account_id) {
    return { error: "No Connect account found" }
  }

  const loginLink = await stripe.accounts.createLoginLink(profile.stripe_connect_account_id)
  return { success: true, loginUrl: loginLink.url }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Payout Method Management
// ═══════════════════════════════════════════════════════════════════════════════

export async function addPayoutMethod(data: {
  methodType: "bank" | "paypal" | "venmo" | "cashapp" | "western_union"
  accountEmail?: string
  accountHandle?: string
  bankName?: string
  bankLastFour?: string
  nickname?: string
  setAsPrimary?: boolean
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // If setting as primary, unset other primaries
  if (data.setAsPrimary) {
    await supabase
      .from("payout_methods")
      .update({ is_primary: false })
      .eq("user_id", user.id)
  }

  const { data: method, error } = await supabase
    .from("payout_methods")
    .insert({
      user_id: user.id,
      method_type: data.methodType,
      account_email: data.accountEmail,
      account_handle: data.accountHandle,
      bank_name: data.bankName,
      bank_last_four: data.bankLastFour,
      nickname: data.nickname,
      is_primary: data.setAsPrimary ?? false,
      verification_status: "unverified",
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Update profile preferred method if primary
  if (data.setAsPrimary) {
    await supabase
      .from("profiles")
      .update({ preferred_payout_method: data.methodType })
      .eq("id", user.id)
  }

  revalidatePath("/dashboard/financials")
  return { success: true, method }
}

export async function getPayoutMethods() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from("payout_methods")
    .select("*")
    .eq("user_id", user.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false })

  return data ?? []
}

export async function setPrimaryPayoutMethod(methodId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // Verify ownership
  const { data: method } = await supabase
    .from("payout_methods")
    .select("method_type")
    .eq("id", methodId)
    .eq("user_id", user.id)
    .single()

  if (!method) return { error: "Payout method not found" }

  // Unset all primaries
  await supabase
    .from("payout_methods")
    .update({ is_primary: false })
    .eq("user_id", user.id)

  // Set new primary
  await supabase
    .from("payout_methods")
    .update({ is_primary: true })
    .eq("id", methodId)

  // Update profile
  await supabase
    .from("profiles")
    .update({ preferred_payout_method: method.method_type })
    .eq("id", user.id)

  revalidatePath("/dashboard/financials")
  return { success: true }
}

export async function deletePayoutMethod(methodId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  const { error } = await supabase
    .from("payout_methods")
    .delete()
    .eq("id", methodId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/financials")
  return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Organizer Payouts
// ═══════════════════════════════════════════════════════════════════════════════

export async function getOrganizerEarnings(organizerId?: string) {
  const supabase = await createClient()
  
  let targetId = organizerId
  if (!targetId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }
    targetId = user.id
  }

  // Get tournaments created by this organizer
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select(`
      id,
      name,
      tournament_type,
      entry_fee_cents,
      platform_fee_percent,
      status,
      tournament_payments(amount_cents, platform_fee_cents, status)
    `)
    .eq("created_by", targetId)
    .in("tournament_type", ["paid", "sponsored"])

  if (!tournaments) return { totalEarnings: 0, pendingPayouts: 0, tournaments: [] }

  let totalEarnings = 0
  let pendingPayouts = 0

  const tournamentSummaries = tournaments.map((t) => {
    const payments = (t.tournament_payments as any[]) ?? []
    const successfulPayments = payments.filter((p) => p.status === "succeeded")
    const collected = successfulPayments.reduce((sum, p) => sum + p.amount_cents, 0)
    const platformFees = successfulPayments.reduce((sum, p) => sum + (p.platform_fee_cents ?? 0), 0)
    const net = collected - platformFees

    if (t.status === "completed") {
      totalEarnings += net
    } else if (t.status === "in_progress") {
      pendingPayouts += net
    }

    return {
      id: t.id,
      name: t.name,
      type: t.tournament_type,
      collected,
      platformFees,
      net,
      status: t.status,
    }
  })

  return {
    totalEarnings,
    pendingPayouts,
    tournaments: tournamentSummaries,
  }
}

export async function requestOrganizerPayout(
  tournamentId: string,
  options?: {
    payoutMethod?: PayoutMethod
    payoutDestination?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // Get tournament and verify ownership
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, created_by, status")
    .eq("id", tournamentId)
    .eq("created_by", user.id)
    .single()

  if (!tournament) return { error: "Tournament not found or not authorized" }
  if (tournament.status !== "completed") {
    return { error: "Tournament must be completed before requesting payout" }
  }

  // Calculate available payout
  const { data: payments } = await supabase
    .from("tournament_payments")
    .select("amount_cents, platform_fee_cents")
    .eq("tournament_id", tournamentId)
    .eq("status", "succeeded")

  if (!payments?.length) return { error: "No payments to collect" }

  const totalCollected = payments.reduce((sum, p) => sum + p.amount_cents, 0)
  const platformFees = payments.reduce((sum, p) => sum + (p.platform_fee_cents ?? 0), 0)
  const netAmount = totalCollected - platformFees

  // Check if payout already exists
  const { data: existingPayout } = await supabase
    .from("organizer_payouts")
    .select("id, status")
    .eq("tournament_id", tournamentId)
    .eq("organizer_id", user.id)
    .single()

  if (existingPayout) {
    return { error: `Payout already ${existingPayout.status}` }
  }

  // Get payout method
  let payoutMethod = options?.payoutMethod
  let payoutDestination = options?.payoutDestination

  if (!payoutMethod) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferred_payout_method, stripe_connect_account_id, stripe_connect_payouts_enabled")
      .eq("id", user.id)
      .single()

    if (profile?.stripe_connect_payouts_enabled) {
      payoutMethod = "stripe_connect"
      payoutDestination = profile.stripe_connect_account_id ?? undefined
    } else {
      payoutMethod = (profile?.preferred_payout_method as PayoutMethod) ?? "bank"
    }
  }

  // Create payout request
  const { data: payout, error } = await supabase
    .from("organizer_payouts")
    .insert({
      organizer_id: user.id,
      tournament_id: tournamentId,
      amount_cents: totalCollected,
      platform_fee_cents: platformFees,
      net_amount_cents: netAmount,
      payout_type: "entry_fees",
      payout_method: payoutMethod,
      payout_destination: payoutDestination,
      status: "pending",
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/dashboard/financials")
  return { success: true, payout }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Process Organizer Payout (Admin)
// ═══════════════════════════════════════════════════════════════════════════════

export async function processOrganizerPayout(payoutId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Check staff role
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (!staffRole || !["owner", "manager"].includes(staffRole.role)) {
    return { error: "Not authorized" }
  }

  // Get payout details
  const { data: payout } = await supabase
    .from("organizer_payouts")
    .select("*, profiles:organizer_id(stripe_connect_account_id)")
    .eq("id", payoutId)
    .single()

  if (!payout) return { error: "Payout not found" }
  if (payout.status !== "pending") {
    return { error: `Payout already ${payout.status}` }
  }

  // Update to processing
  await supabase
    .from("organizer_payouts")
    .update({ status: "processing", processed_by: user.id, processed_at: new Date().toISOString() })
    .eq("id", payoutId)

  // Process via Stripe Connect if available
  if (payout.payout_method === "stripe_connect" && payout.profiles?.stripe_connect_account_id) {
    try {
      const transfer = await stripe.transfers.create({
        amount: payout.net_amount_cents,
        currency: "usd",
        destination: payout.profiles.stripe_connect_account_id,
        metadata: {
          payout_id: payoutId,
          tournament_id: payout.tournament_id,
          type: "organizer_payout",
        },
      })

      await supabase
        .from("organizer_payouts")
        .update({
          status: "completed",
          stripe_transfer_id: transfer.id,
          completed_at: new Date().toISOString(),
        })
        .eq("id", payoutId)

      revalidatePath("/dashboard/admin/financials")
      return { success: true, transferId: transfer.id }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Transfer failed"
      await supabase
        .from("organizer_payouts")
        .update({ status: "failed", failure_reason: errorMessage })
        .eq("id", payoutId)

      return { error: errorMessage }
    }
  }

  // For non-Stripe methods, mark as processing (manual handling required)
  return { success: true, message: "Payout marked for manual processing" }
}

// ═══════════════════════════════════════════════════════════════════════════════
// KYC Verification
// ═══════════════════════════════════════════════════════════════════════════════

export async function initiateKYCVerification() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // Check if already verified
  const { data: profile } = await supabase
    .from("profiles")
    .select("kyc_verified")
    .eq("id", user.id)
    .single()

  if (profile?.kyc_verified) {
    return { error: "Already verified" }
  }

  // Create Stripe Identity verification session
  const verificationSession = await stripe.identity.verificationSessions.create({
    type: "document",
    metadata: {
      user_id: user.id,
    },
    options: {
      document: {
        require_matching_selfie: true,
      },
    },
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/financials?kyc=complete`,
  })

  // Store verification record
  await supabase.from("kyc_verifications").insert({
    user_id: user.id,
    verification_type: "identity",
    provider: "stripe_identity",
    provider_session_id: verificationSession.id,
    status: "pending",
  })

  return { success: true, verificationUrl: verificationSession.url }
}

export async function checkKYCStatus() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "not_started" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("kyc_verified, kyc_verified_at")
    .eq("id", user.id)
    .single()

  if (profile?.kyc_verified) {
    return { status: "verified", verifiedAt: profile.kyc_verified_at }
  }

  // Check latest verification
  const { data: verification } = await supabase
    .from("kyc_verifications")
    .select("status, provider_session_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (!verification) {
    return { status: "not_started" }
  }

  // If pending, check with Stripe
  if (verification.status === "pending" && verification.provider_session_id) {
    try {
      const session = await stripe.identity.verificationSessions.retrieve(
        verification.provider_session_id
      )

      if (session.status === "verified") {
        // Update both records
        await supabase
          .from("kyc_verifications")
          .update({ status: "verified" })
          .eq("provider_session_id", verification.provider_session_id)

        await supabase
          .from("profiles")
          .update({
            kyc_verified: true,
            kyc_verified_at: new Date().toISOString(),
          })
          .eq("id", user.id)

        return { status: "verified" }
      } else if (session.status === "requires_input") {
        return { status: "incomplete" }
      }
    } catch {
      // Stripe error, return stored status
    }
  }

  return { status: verification.status }
}
