"use server"

import { createClient } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import type { PayoutMethod } from "./tournament-financial-actions"

// ═══════════════════════════════════════════════════════════════════════════════
// Get Player Winnings
// ═══════════════════════════════════════════════════════════════════════════════

export async function getPlayerWinnings() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { pending: [], claimed: [], total: 0 }

  const { data: payouts } = await supabase
    .from("player_payouts")
    .select(`
      *,
      tournaments(id, name, slug)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (!payouts) return { pending: [], claimed: [], total: 0 }

  const pending = payouts.filter((p) => 
    ["pending", "awaiting_details", "processing"].includes(p.status)
  )
  const claimed = payouts.filter((p) => p.status === "completed")

  return {
    pending,
    claimed,
    total: payouts.reduce((sum, p) => sum + p.net_amount_cents, 0),
    pendingTotal: pending.reduce((sum, p) => sum + p.net_amount_cents, 0),
    claimedTotal: claimed.reduce((sum, p) => sum + p.net_amount_cents, 0),
  }
}

export async function getPayoutDetails(payoutId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: payout } = await supabase
    .from("player_payouts")
    .select(`
      *,
      tournaments(id, name, slug, sponsor_name, sponsor_logo_url)
    `)
    .eq("id", payoutId)
    .eq("user_id", user.id)
    .single()

  return payout
}

// ═══════════════════════════════════════════════════════════════════════════════
// Claim Payout - Select Method
// ═══════════════════════════════════════════════════════════════════════════════

export async function selectPayoutMethod(
  payoutId: string,
  method: PayoutMethod,
  options?: {
    payoutDestination?: string
    instantPayout?: boolean
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // Get payout and verify ownership
  const { data: payout } = await supabase
    .from("player_payouts")
    .select("id, status, net_amount_cents, tournament_id")
    .eq("id", payoutId)
    .eq("user_id", user.id)
    .single()

  if (!payout) return { error: "Payout not found" }
  if (payout.status === "completed") {
    return { error: "Payout already completed" }
  }
  if (!["pending", "awaiting_details"].includes(payout.status)) {
    return { error: `Cannot change payout method when status is ${payout.status}` }
  }

  // Get destination from saved payout methods if not provided
  let destination = options?.payoutDestination
  if (!destination && method !== "platform_balance") {
    const { data: savedMethod } = await supabase
      .from("payout_methods")
      .select("account_email, account_handle")
      .eq("user_id", user.id)
      .eq("method_type", method)
      .eq("is_primary", true)
      .single()

    if (savedMethod) {
      destination = savedMethod.account_email || savedMethod.account_handle || undefined
    }
  }

  // Validate method has required info
  if (method !== "platform_balance" && method !== "stripe_connect" && !destination) {
    // Check if user has this method saved
    const { data: anyMethod } = await supabase
      .from("payout_methods")
      .select("id, account_email, account_handle")
      .eq("user_id", user.id)
      .eq("method_type", method)
      .limit(1)
      .single()

    if (!anyMethod) {
      return { error: `Please add a ${method} payout method first` }
    }
    destination = anyMethod.account_email || anyMethod.account_handle || undefined
  }

  // Calculate instant payout fee if applicable
  let instantFee = 0
  if (options?.instantPayout) {
    // 1.5% fee for instant payouts, minimum $0.50
    instantFee = Math.max(50, Math.floor(payout.net_amount_cents * 0.015))
  }

  // Update payout
  const { error } = await supabase
    .from("player_payouts")
    .update({
      payout_method: method,
      payout_destination: destination,
      instant_payout: options?.instantPayout ?? false,
      instant_fee_cents: instantFee,
      status: "pending",
      requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payoutId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/financials")
  revalidatePath(`/dashboard/financials/claim`)
  return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Platform Balance Payout (instant credit to wallet)
// ═══════════════════════════════════════════════════════════════════════════════

export async function claimToPlatformBalance(payoutId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // Get payout
  const { data: payout } = await supabase
    .from("player_payouts")
    .select("*, tournaments(name)")
    .eq("id", payoutId)
    .eq("user_id", user.id)
    .single()

  if (!payout) return { error: "Payout not found" }
  if (payout.status === "completed") {
    return { error: "Already claimed" }
  }

  // Get or create wallet
  let { data: wallet } = await supabase
    .from("user_wallets")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (!wallet) {
    const { data: newWallet, error: walletError } = await supabase
      .from("user_wallets")
      .insert({
        user_id: user.id,
        balance_cents: 0,
        pending_cents: 0,
        lifetime_earnings_cents: 0,
      })
      .select()
      .single()

    if (walletError) return { error: walletError.message }
    wallet = newWallet
  }

  // Update wallet balance
  const newBalance = wallet.balance_cents + payout.net_amount_cents
  const newLifetime = wallet.lifetime_earnings_cents + payout.net_amount_cents

  const { error: updateError } = await supabase
    .from("user_wallets")
    .update({
      balance_cents: newBalance,
      lifetime_earnings_cents: newLifetime,
      updated_at: new Date().toISOString(),
    })
    .eq("id", wallet.id)

  if (updateError) return { error: updateError.message }

  // Create wallet transaction
  await supabase.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    user_id: user.id,
    tournament_id: payout.tournament_id,
    amount_cents: payout.net_amount_cents,
    balance_after_cents: newBalance,
    transaction_type: "prize_win",
    status: "completed",
    reference_type: "player_payout",
    reference_id: payout.id,
    description: `Prize winnings from ${payout.tournaments?.name || "tournament"}`,
  })

  // Update payout status
  await supabase
    .from("player_payouts")
    .update({
      payout_method: "platform_balance",
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payoutId)

  // Update profile earnings
  await supabase.rpc("increment_profile_earnings", {
    p_user_id: user.id,
    p_amount: payout.net_amount_cents,
  })

  // Notify user
  await supabase.from("financial_alerts").insert({
    user_id: user.id,
    tournament_id: payout.tournament_id,
    alert_type: "payout_sent",
    severity: "info",
    title: "Winnings Added to Wallet",
    message: `$${(payout.net_amount_cents / 100).toFixed(2)} has been added to your platform wallet.`,
    action_url: "/dashboard/financials",
  })

  revalidatePath("/dashboard/financials")
  return { success: true, newBalance }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Process External Payouts (Admin)
// ═══════════════════════════════════════════════════════════════════════════════

export async function processPlayerPayout(payoutId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Check admin role
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (!staffRole || !["owner", "manager"].includes(staffRole.role)) {
    return { error: "Not authorized" }
  }

  // Get payout
  const { data: payout } = await supabase
    .from("player_payouts")
    .select(`
      *,
      profiles:user_id(
        stripe_connect_account_id,
        stripe_connect_payouts_enabled,
        paypal_email,
        venmo_handle,
        cashapp_handle
      )
    `)
    .eq("id", payoutId)
    .single()

  if (!payout) return { error: "Payout not found" }
  if (payout.status === "completed") return { error: "Already completed" }
  if (payout.status !== "pending") {
    return { error: `Cannot process payout with status ${payout.status}` }
  }

  // Update to processing
  await supabase
    .from("player_payouts")
    .update({ 
      status: "processing", 
      processed_at: new Date().toISOString() 
    })
    .eq("id", payoutId)

  const netAmount = payout.net_amount_cents - (payout.instant_fee_cents ?? 0)

  // Process based on method
  if (payout.payout_method === "stripe_connect" && payout.profiles?.stripe_connect_account_id) {
    try {
      const transfer = await stripe.transfers.create({
        amount: netAmount,
        currency: "usd",
        destination: payout.profiles.stripe_connect_account_id,
        metadata: {
          payout_id: payoutId,
          tournament_id: payout.tournament_id,
          type: "player_prize",
        },
      })

      // Trigger instant payout if requested
      if (payout.instant_payout) {
        await stripe.payouts.create(
          {
            amount: netAmount,
            currency: "usd",
            method: "instant",
          },
          {
            stripeAccount: payout.profiles.stripe_connect_account_id,
          }
        )
      }

      await supabase
        .from("player_payouts")
        .update({
          status: "completed",
          stripe_transfer_id: transfer.id,
          completed_at: new Date().toISOString(),
        })
        .eq("id", payoutId)

      // Notify player
      await supabase.from("financial_alerts").insert({
        user_id: payout.user_id,
        tournament_id: payout.tournament_id,
        alert_type: "payout_sent",
        severity: "info",
        title: "Payout Sent",
        message: `Your prize of $${(netAmount / 100).toFixed(2)} has been sent to your connected account.`,
      })

      revalidatePath("/dashboard/admin/financials")
      return { success: true, transferId: transfer.id }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Transfer failed"
      await supabase
        .from("player_payouts")
        .update({ status: "failed", failure_reason: errorMessage })
        .eq("id", payoutId)

      return { error: errorMessage }
    }
  }

  // For non-Stripe methods, mark as processing (manual handling)
  // In production, you would integrate PayPal Payouts, etc.
  return { 
    success: true, 
    message: "Payout marked for manual processing",
    method: payout.payout_method,
    destination: payout.payout_destination,
    amount: netAmount,
  }
}

export async function markPayoutComplete(
  payoutId: string,
  externalReference?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Check admin role
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (!staffRole || !["owner", "manager"].includes(staffRole.role)) {
    return { error: "Not authorized" }
  }

  const { data: payout } = await supabase
    .from("player_payouts")
    .select("user_id, tournament_id, net_amount_cents")
    .eq("id", payoutId)
    .single()

  if (!payout) return { error: "Payout not found" }

  await supabase
    .from("player_payouts")
    .update({
      status: "completed",
      external_reference: externalReference,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payoutId)

  // Notify player
  await supabase.from("financial_alerts").insert({
    user_id: payout.user_id,
    tournament_id: payout.tournament_id,
    alert_type: "payout_sent",
    severity: "info",
    title: "Payout Completed",
    message: `Your prize of $${(payout.net_amount_cents / 100).toFixed(2)} has been sent.${externalReference ? ` Reference: ${externalReference}` : ""}`,
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
  if (!user) redirect("/auth/login")

  // Check admin role
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (!staffRole || !["owner", "manager"].includes(staffRole.role)) {
    return { error: "Not authorized" }
  }

  const { data: payout } = await supabase
    .from("player_payouts")
    .select("user_id, tournament_id")
    .eq("id", payoutId)
    .single()

  if (!payout) return { error: "Payout not found" }

  await supabase
    .from("player_payouts")
    .update({
      status: "failed",
      failure_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payoutId)

  // Notify player
  await supabase.from("financial_alerts").insert({
    user_id: payout.user_id,
    tournament_id: payout.tournament_id,
    alert_type: "payout_failed",
    severity: "error",
    title: "Payout Failed",
    message: `Your payout could not be processed: ${reason}. Please update your payout details.`,
    action_url: "/dashboard/financials",
  })

  revalidatePath("/dashboard/admin/financials")
  return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Withdraw from Platform Balance
// ═══════════════════════════════════════════════════════════════════════════════

export async function withdrawFromWallet(
  amountCents: number,
  method: PayoutMethod,
  destination?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // Minimum withdrawal: $5
  if (amountCents < 500) {
    return { error: "Minimum withdrawal is $5.00" }
  }

  // Get wallet
  const { data: wallet } = await supabase
    .from("user_wallets")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (!wallet) return { error: "No wallet found" }
  if (wallet.balance_cents < amountCents) {
    return { error: "Insufficient balance" }
  }

  // Get payout destination
  let payoutDestination = destination
  if (!payoutDestination) {
    const { data: savedMethod } = await supabase
      .from("payout_methods")
      .select("account_email, account_handle")
      .eq("user_id", user.id)
      .eq("method_type", method)
      .eq("is_primary", true)
      .single()

    if (!savedMethod) {
      return { error: `Please add a ${method} payout method first` }
    }
    payoutDestination = savedMethod.account_email || savedMethod.account_handle || undefined
  }

  // Create pending payout record
  const { data: payout, error: payoutError } = await supabase
    .from("player_payouts")
    .insert({
      tournament_id: null, // Wallet withdrawal, not tournament
      user_id: user.id,
      placement: 0,
      gross_amount_cents: amountCents,
      platform_fee_cents: 0,
      net_amount_cents: amountCents,
      payout_method: method,
      payout_destination: payoutDestination,
      status: "pending",
      requested_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (payoutError) return { error: payoutError.message }

  // Deduct from wallet immediately (hold)
  const newBalance = wallet.balance_cents - amountCents
  const newPending = wallet.pending_cents + amountCents

  await supabase
    .from("user_wallets")
    .update({
      balance_cents: newBalance,
      pending_cents: newPending,
      updated_at: new Date().toISOString(),
    })
    .eq("id", wallet.id)

  // Create wallet transaction
  await supabase.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    user_id: user.id,
    amount_cents: -amountCents,
    balance_after_cents: newBalance,
    transaction_type: "withdrawal",
    status: "pending",
    reference_type: "player_payout",
    reference_id: payout.id,
    description: `Withdrawal to ${method}`,
  })

  revalidatePath("/dashboard/financials")
  return { success: true, payoutId: payout.id }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Get Pending Payouts (Admin)
// ═══════════════════════════════════════════════════════════════════════════════

export async function getPendingPayouts(options?: { tournamentId?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Check admin role
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (!staffRole || !["owner", "manager"].includes(staffRole.role)) {
    return []
  }

  let query = supabase
    .from("player_payouts")
    .select(`
      *,
      profiles:user_id(id, first_name, last_name, email, avatar_url),
      tournaments(id, name, slug)
    `)
    .in("status", ["pending", "processing"])
    .order("requested_at", { ascending: true })

  if (options?.tournamentId) {
    query = query.eq("tournament_id", options.tournamentId)
  }

  const { data } = await query
  return data ?? []
}

export async function getPayoutStats() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Check admin role
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (!staffRole || !["owner", "manager"].includes(staffRole.role)) {
    return null
  }

  const { data: payouts } = await supabase
    .from("player_payouts")
    .select("status, net_amount_cents")

  if (!payouts) return null

  const pending = payouts.filter((p) => p.status === "pending")
  const processing = payouts.filter((p) => p.status === "processing")
  const completed = payouts.filter((p) => p.status === "completed")
  const failed = payouts.filter((p) => p.status === "failed")

  return {
    pendingCount: pending.length,
    pendingAmount: pending.reduce((sum, p) => sum + p.net_amount_cents, 0),
    processingCount: processing.length,
    processingAmount: processing.reduce((sum, p) => sum + p.net_amount_cents, 0),
    completedCount: completed.length,
    completedAmount: completed.reduce((sum, p) => sum + p.net_amount_cents, 0),
    failedCount: failed.length,
    failedAmount: failed.reduce((sum, p) => sum + p.net_amount_cents, 0),
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Payout Method Management
// ═══════════════════════════════════════════════════════════════════════════════

export async function addPayoutMethod(data: {
  method_type: "bank" | "paypal" | "venmo" | "cashapp"
  bank_name?: string
  bank_last_four?: string
  bank_routing_last_four?: string
  account_email?: string
  account_handle?: string
  is_primary?: boolean
  nickname?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // If setting as primary, unset other primary methods first
  if (data.is_primary) {
    await supabase
      .from("payout_methods")
      .update({ is_primary: false })
      .eq("user_id", user.id)
  }

  const { data: method, error } = await supabase
    .from("payout_methods")
    .insert({
      user_id: user.id,
      method_type: data.method_type,
      bank_name: data.bank_name,
      bank_last_four: data.bank_last_four,
      bank_routing_last_four: data.bank_routing_last_four,
      account_email: data.account_email,
      account_handle: data.account_handle,
      is_primary: data.is_primary ?? false,
      nickname: data.nickname,
      verification_status: "unverified",
    })
    .select()
    .single()

  if (error) {
    console.error("Failed to add payout method:", error)
    return { error: "Failed to add payout method" }
  }

  revalidatePath("/dashboard/financials/payout-methods")
  return { success: true, method }
}

export async function removePayoutMethod(methodId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  const { error } = await supabase
    .from("payout_methods")
    .delete()
    .eq("id", methodId)
    .eq("user_id", user.id)

  if (error) {
    console.error("Failed to remove payout method:", error)
    return { error: "Failed to remove payout method" }
  }

  revalidatePath("/dashboard/financials/payout-methods")
  return { success: true }
}

export async function setPrimaryPayoutMethod(methodId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // Unset all other primary methods
  await supabase
    .from("payout_methods")
    .update({ is_primary: false })
    .eq("user_id", user.id)

  // Set this one as primary
  const { error } = await supabase
    .from("payout_methods")
    .update({ is_primary: true, updated_at: new Date().toISOString() })
    .eq("id", methodId)
    .eq("user_id", user.id)

  if (error) {
    console.error("Failed to set primary payout method:", error)
    return { error: "Failed to set primary payout method" }
  }

  revalidatePath("/dashboard/financials/payout-methods")
  return { success: true }
}
