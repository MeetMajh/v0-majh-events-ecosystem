"use server"

import { createClient } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe"
import { revalidatePath } from "next/cache"

// ═══════════════════════════════════════════════════════════════════════════════
// Stripe Connect Onboarding
// ═══════════════════════════════════════════════════════════════════════════════

export async function createStripeConnectAccount() {
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
    // Account exists, create account link for onboarding continuation
    const accountLink = await stripe.accountLinks.create({
      account: profile.stripe_connect_account_id,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/financials/payout-methods?refresh=true`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/financials/payout-methods?connected=true`,
      type: "account_onboarding",
    })

    return { success: true, url: accountLink.url }
  }

  // Create new Connect account (Express for simplest UX)
  const account = await stripe.accounts.create({
    type: "express",
    country: "US",
    email: user.email,
    capabilities: {
      transfers: { requested: true },
    },
    metadata: {
      supabase_user_id: user.id,
    },
  })

  // Save account ID to profile
  await supabase
    .from("profiles")
    .update({
      stripe_connect_account_id: account.id,
      stripe_connect_status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)

  // Create onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/financials/payout-methods?refresh=true`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/financials/payout-methods?connected=true`,
    type: "account_onboarding",
  })

  return { success: true, url: accountLink.url }
}

export async function getStripeConnectStatus() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id, stripe_connect_status, stripe_connect_payouts_enabled")
    .eq("id", user.id)
    .single()

  if (!profile?.stripe_connect_account_id) {
    return { status: "not_started", payoutsEnabled: false }
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
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
    }

    return {
      status,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: account.requirements?.currently_due || [],
    }
  } catch (error) {
    console.error("Failed to fetch Stripe Connect status:", error)
    return {
      status: profile.stripe_connect_status,
      payoutsEnabled: profile.stripe_connect_payouts_enabled,
    }
  }
}

export async function createStripeConnectLoginLink() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id")
    .eq("id", user.id)
    .single()

  if (!profile?.stripe_connect_account_id) {
    return { error: "No Stripe Connect account" }
  }

  const loginLink = await stripe.accounts.createLoginLink(profile.stripe_connect_account_id)
  return { success: true, url: loginLink.url }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Prize Payout Execution
// ═══════════════════════════════════════════════════════════════════════════════

export async function executeStripePayout(payoutId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // Get payout details
  const { data: payout } = await supabase
    .from("player_payouts")
    .select(`
      *,
      tournament:tournaments(name)
    `)
    .eq("id", payoutId)
    .single()

  if (!payout) return { error: "Payout not found" }

  // Verify ownership or admin
  if (payout.user_id !== user.id) {
    const { data: staffRole } = await supabase
      .from("staff_roles")
      .select("role")
      .eq("user_id", user.id)
      .single()

    if (!staffRole || !["owner", "manager"].includes(staffRole.role)) {
      return { error: "Not authorized" }
    }
  }

  if (!["pending", "awaiting_details"].includes(payout.status)) {
    return { error: `Payout is ${payout.status}, cannot process` }
  }

  // Handle different payout methods
  switch (payout.payout_method) {
    case "platform_balance":
      return await processPlatformBalancePayout(payout)
    
    case "stripe_connect":
      return await processStripeConnectPayout(payout)
    
    case "bank":
    case "paypal":
    case "venmo":
    case "cashapp":
      // Mark as processing - will be handled manually or via external service
      await supabase
        .from("player_payouts")
        .update({
          status: "processing",
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", payoutId)
      
      return { success: true, message: "Payout marked for manual processing" }
    
    default:
      return { error: `Unknown payout method: ${payout.payout_method}` }
  }
}

async function processPlatformBalancePayout(payout: {
  id: string
  user_id: string
  tournament_id: string
  net_amount_cents: number
  placement: number
}) {
  const supabase = await createClient()

  // Add to user's wallet using DB function
  const { error } = await supabase.rpc("add_to_wallet", {
    p_user_id: payout.user_id,
    p_amount_cents: payout.net_amount_cents,
    p_transaction_type: "prize_win",
    p_tournament_id: payout.tournament_id,
    p_description: `Tournament prize - Placement #${payout.placement}`,
  })

  if (error) {
    console.error("Failed to add to wallet:", error)
    return { error: "Failed to credit wallet" }
  }

  // Update payout status
  await supabase
    .from("player_payouts")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payout.id)

  // Create notification
  await supabase.from("financial_alerts").insert({
    user_id: payout.user_id,
    tournament_id: payout.tournament_id,
    alert_type: "payout_sent",
    severity: "info",
    title: "Prize Added to Wallet",
    message: `Your prize of $${(payout.net_amount_cents / 100).toFixed(2)} has been added to your wallet.`,
    action_url: "/dashboard/financials",
  })

  revalidatePath("/dashboard/financials")
  return { success: true, message: "Prize added to wallet" }
}

async function processStripeConnectPayout(payout: {
  id: string
  user_id: string
  tournament_id: string
  net_amount_cents: number
  placement: number
  tournament?: { name: string }
}) {
  const supabase = await createClient()

  // Get user's Stripe Connect account
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id, stripe_connect_payouts_enabled")
    .eq("id", payout.user_id)
    .single()

  if (!profile?.stripe_connect_account_id) {
    return { error: "No Stripe Connect account. Please set up direct deposit first." }
  }

  if (!profile.stripe_connect_payouts_enabled) {
    return { error: "Stripe Connect account not ready for payouts. Please complete onboarding." }
  }

  try {
    // Create transfer to connected account
    const transfer = await stripe.transfers.create({
      amount: payout.net_amount_cents,
      currency: "usd",
      destination: profile.stripe_connect_account_id,
      metadata: {
        type: "player_prize",
        payout_id: payout.id,
        tournament_id: payout.tournament_id,
        user_id: payout.user_id,
        placement: payout.placement.toString(),
      },
      description: `Prize payout - ${payout.tournament?.name || "Tournament"} - Placement #${payout.placement}`,
    })

    // Update payout with transfer ID
    await supabase
      .from("player_payouts")
      .update({
        status: "processing",
        stripe_transfer_id: transfer.id,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payout.id)

    revalidatePath("/dashboard/financials")
    return { 
      success: true, 
      message: "Transfer initiated. Funds will arrive in 2-3 business days.",
      transferId: transfer.id,
    }
  } catch (error) {
    console.error("Stripe transfer failed:", error)

    // Update payout status to failed
    await supabase
      .from("player_payouts")
      .update({
        status: "failed",
        failure_reason: error instanceof Error ? error.message : "Transfer failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payout.id)

    // Notify user
    await supabase.from("financial_alerts").insert({
      user_id: payout.user_id,
      tournament_id: payout.tournament_id,
      alert_type: "payout_failed",
      severity: "error",
      title: "Payout Failed",
      message: "Your payout could not be processed. Please check your payment details and try again.",
      action_url: "/dashboard/financials/payout-methods",
    })

    return { error: "Transfer failed. Please try again or contact support." }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Bulk Payout Processing
// ═══════════════════════════════════════════════════════════════════════════════

export async function processAllTournamentPayouts(tournamentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // Verify admin
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (!staffRole || !["owner", "manager"].includes(staffRole.role)) {
    return { error: "Admin access required" }
  }

  // Get all pending payouts for tournament
  const { data: payouts } = await supabase
    .from("player_payouts")
    .select("id, user_id, payout_method")
    .eq("tournament_id", tournamentId)
    .eq("status", "pending")

  if (!payouts?.length) {
    return { error: "No pending payouts found" }
  }

  const results = {
    processed: 0,
    failed: 0,
    errors: [] as string[],
  }

  for (const payout of payouts) {
    const result = await executeStripePayout(payout.id)
    if (result.success) {
      results.processed++
    } else {
      results.failed++
      results.errors.push(`Payout ${payout.id}: ${result.error}`)
    }
  }

  // Check if all payouts completed and release escrow
  const { data: remainingPayouts } = await supabase
    .from("player_payouts")
    .select("id")
    .eq("tournament_id", tournamentId)
    .in("status", ["pending", "awaiting_details", "processing"])

  if (!remainingPayouts?.length) {
    // All payouts done, release escrow
    await supabase.rpc("release_escrow", {
      p_escrow_id: tournamentId,
      p_admin_id: user.id,
    })
  }

  revalidatePath("/dashboard/admin/financials")
  return { 
    success: true, 
    ...results,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Player Payout Selection
// ═══════════════════════════════════════════════════════════════════════════════

export async function selectPayoutMethod(
  payoutId: string,
  method: "platform_balance" | "stripe_connect" | "bank" | "paypal" | "venmo" | "cashapp",
  payoutMethodId?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // Get payout
  const { data: payout } = await supabase
    .from("player_payouts")
    .select("*")
    .eq("id", payoutId)
    .single()

  if (!payout) return { error: "Payout not found" }
  if (payout.user_id !== user.id) return { error: "Not your payout" }
  if (!["pending", "awaiting_details"].includes(payout.status)) {
    return { error: "Payout already processed" }
  }

  // Get destination details if using saved method
  let destination: string | undefined
  if (payoutMethodId && ["bank", "paypal", "venmo", "cashapp"].includes(method)) {
    const { data: payoutMethod } = await supabase
      .from("payout_methods")
      .select("*")
      .eq("id", payoutMethodId)
      .eq("user_id", user.id)
      .single()

    if (payoutMethod) {
      destination = payoutMethod.account_email || payoutMethod.account_handle || `****${payoutMethod.bank_last_four}`
    }
  }

  // Validate Stripe Connect if selected
  if (method === "stripe_connect") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_payouts_enabled")
      .eq("id", user.id)
      .single()

    if (!profile?.stripe_connect_account_id || !profile.stripe_connect_payouts_enabled) {
      return { error: "Please complete Stripe Connect setup first" }
    }
  }

  // Update payout method
  const { error } = await supabase
    .from("player_payouts")
    .update({
      payout_method: method,
      payout_destination: destination,
      status: "pending",
      requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payoutId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/financials")
  return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Wallet Withdrawal
// ═══════════════════════════════════════════════════════════════════════════════

export async function initiateWalletWithdrawal(
  amountCents: number,
  method: "stripe_connect" | "bank" | "paypal" | "venmo" | "cashapp",
  payoutMethodId?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  if (amountCents < 1000) {
    return { error: "Minimum withdrawal is $10.00" }
  }

  // Get wallet balance
  const { data: wallet } = await supabase
    .from("user_wallets")
    .select("balance_cents")
    .eq("user_id", user.id)
    .single()

  if (!wallet || wallet.balance_cents < amountCents) {
    return { error: "Insufficient balance" }
  }

  // Get destination if using saved method
  let destination: string | undefined
  if (payoutMethodId) {
    const { data: payoutMethod } = await supabase
      .from("payout_methods")
      .select("*")
      .eq("id", payoutMethodId)
      .eq("user_id", user.id)
      .single()

    if (payoutMethod) {
      destination = payoutMethod.account_email || payoutMethod.account_handle || `****${payoutMethod.bank_last_four}`
    }
  }

  // Handle Stripe Connect withdrawal immediately
  if (method === "stripe_connect") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_payouts_enabled")
      .eq("id", user.id)
      .single()

    if (!profile?.stripe_connect_account_id || !profile.stripe_connect_payouts_enabled) {
      return { error: "Please complete Stripe Connect setup first" }
    }

    try {
      // Deduct from wallet first
      const { error: walletError } = await supabase.rpc("add_to_wallet", {
        p_user_id: user.id,
        p_amount_cents: -amountCents,
        p_transaction_type: "withdrawal",
        p_description: `Withdrawal to Stripe Connect`,
      })

      if (walletError) {
        return { error: "Failed to deduct from wallet" }
      }

      // Create transfer
      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: "usd",
        destination: profile.stripe_connect_account_id,
        metadata: {
          type: "wallet_withdrawal",
          user_id: user.id,
        },
        description: "Wallet withdrawal",
      })

      // Record the organizer payout
      await supabase.from("organizer_payouts").insert({
        organizer_id: user.id,
        amount_cents: amountCents,
        platform_fee_cents: 0,
        net_amount_cents: amountCents,
        payout_type: "manual",
        payout_method: "stripe_connect",
        status: "processing",
        stripe_transfer_id: transfer.id,
      })

      revalidatePath("/dashboard/financials")
      return { 
        success: true, 
        message: "Withdrawal initiated. Funds will arrive in 2-3 business days.",
      }
    } catch (error) {
      // Refund wallet on failure
      await supabase.rpc("add_to_wallet", {
        p_user_id: user.id,
        p_amount_cents: amountCents,
        p_transaction_type: "payout_reversal",
        p_description: "Withdrawal failed - funds returned",
      })

      console.error("Withdrawal failed:", error)
      return { error: "Withdrawal failed. Please try again." }
    }
  }

  // For manual methods, use the DB function
  const { data: payoutId, error } = await supabase.rpc("withdraw_from_wallet", {
    p_user_id: user.id,
    p_amount_cents: amountCents,
    p_payout_method: method,
    p_destination: destination,
  })

  if (error) {
    console.error("Withdrawal failed:", error)
    return { error: error.message || "Withdrawal failed" }
  }

  revalidatePath("/dashboard/financials")
  return { 
    success: true, 
    payoutId,
    message: "Withdrawal request submitted. Processing time varies by method.",
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Admin: Manual Payout Completion
// ═══════════════════════════════════════════════════════════════════════════════

export async function markPayoutCompleted(
  payoutId: string,
  externalReference?: string,
  notes?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // Verify admin
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (!staffRole || !["owner", "manager"].includes(staffRole.role)) {
    return { error: "Admin access required" }
  }

  // Check if it's a player payout or organizer payout
  let isPlayerPayout = true
  let { data: payout } = await supabase
    .from("player_payouts")
    .select("id, user_id, tournament_id, net_amount_cents")
    .eq("id", payoutId)
    .single()

  if (!payout) {
    const { data: orgPayout } = await supabase
      .from("organizer_payouts")
      .select("id, organizer_id, net_amount_cents")
      .eq("id", payoutId)
      .single()

    if (!orgPayout) return { error: "Payout not found" }
    isPlayerPayout = false
    payout = { ...orgPayout, user_id: orgPayout.organizer_id, tournament_id: null }
  }

  const table = isPlayerPayout ? "player_payouts" : "organizer_payouts"
  const userIdField = isPlayerPayout ? "user_id" : "organizer_id"

  const { error } = await supabase
    .from(table)
    .update({
      status: "completed",
      external_reference: externalReference,
      admin_notes: notes,
      processed_by: user.id,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payoutId)

  if (error) return { error: error.message }

  // Notify recipient
  await supabase.from("financial_alerts").insert({
    user_id: payout.user_id,
    tournament_id: payout.tournament_id,
    alert_type: "payout_sent",
    severity: "info",
    title: "Payout Completed",
    message: `Your payout of $${(payout.net_amount_cents / 100).toFixed(2)} has been sent.`,
    action_url: "/dashboard/financials",
  })

  revalidatePath("/dashboard/admin/financials")
  return { success: true }
}

export async function markPayoutFailed(
  payoutId: string,
  reason: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // Verify admin
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (!staffRole || !["owner", "manager"].includes(staffRole.role)) {
    return { error: "Admin access required" }
  }

  // Try player payouts first
  let { data: payout } = await supabase
    .from("player_payouts")
    .select("id, user_id, tournament_id")
    .eq("id", payoutId)
    .single()

  const table = payout ? "player_payouts" : "organizer_payouts"

  if (!payout) {
    const { data: orgPayout } = await supabase
      .from("organizer_payouts")
      .select("id, organizer_id")
      .eq("id", payoutId)
      .single()

    if (!orgPayout) return { error: "Payout not found" }
    payout = { id: orgPayout.id, user_id: orgPayout.organizer_id, tournament_id: null }
  }

  const { error } = await supabase
    .from(table)
    .update({
      status: "failed",
      failure_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payoutId)

  if (error) return { error: error.message }

  // Notify recipient
  await supabase.from("financial_alerts").insert({
    user_id: payout.user_id,
    tournament_id: payout.tournament_id,
    alert_type: "payout_failed",
    severity: "error",
    title: "Payout Failed",
    message: `Your payout could not be processed: ${reason}. Please update your payment details.`,
    action_url: "/dashboard/financials/payout-methods",
  })

  revalidatePath("/dashboard/admin/financials")
  return { success: true }
}
