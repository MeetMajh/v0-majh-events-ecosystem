"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface Wallet {
  id: string
  user_id: string
  balance_cents: number
  created_at: string
  updated_at: string
}

export interface Tournament {
  id: string
  name: string
  slug: string
  entry_fee_cents: number
  max_participants: number | null
  status: string
  start_date: string
  games?: { name: string; slug: string }
}

/**
 * Get user's wallet - creates one if it doesn't exist
 */
export async function getWallet() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: "You must be signed in" }
  }

  // Try to get existing wallet
  let { data: wallet, error } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", user.id)
    .single()

  // If no wallet exists, create one
  if (error?.code === "PGRST116" || !wallet) {
    const { data: newWallet, error: createError } = await supabase
      .from("wallets")
      .insert({
        user_id: user.id,
        balance_cents: 0,
      })
      .select()
      .single()

    if (createError) {
      return { error: createError.message }
    }
    wallet = newWallet
  } else if (error) {
    return { error: error.message }
  }

  return { data: wallet as Wallet }
}

/**
 * Join a tournament using wallet balance
 * Flow:
 * 1. Fetch wallet
 * 2. Check balance >= entry_fee_cents
 * 3. Insert financial_transaction (-entry_fee)
 * 4. Update wallet balance
 * 5. Insert tournament_participant (paid = true)
 */
export async function joinTournament(tournamentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: "You must be signed in" }
  }

  // 1. Get tournament details
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id, name, slug, entry_fee_cents, max_participants, status")
    .eq("id", tournamentId)
    .single()

  if (tournamentError || !tournament) {
    return { error: "Tournament not found" }
  }

  if (tournament.status !== "registration") {
    return { error: "Registration is closed for this tournament" }
  }

  // 2. Check if already registered
  const { data: existingParticipant } = await supabase
    .from("tournament_participants")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("user_id", user.id)
    .single()

  if (existingParticipant) {
    return { error: "You are already registered for this tournament" }
  }

  // 3. Check capacity
  if (tournament.max_participants) {
    const { count } = await supabase
      .from("tournament_participants")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", tournamentId)

    if ((count ?? 0) >= tournament.max_participants) {
      return { error: "Tournament is full" }
    }
  }

  // 4. Get wallet
  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", user.id)
    .single()

  // If no wallet exists and tournament has entry fee, return error
  if (walletError?.code === "PGRST116" && tournament.entry_fee_cents > 0) {
    return { error: "No wallet found. Please add funds first." }
  }

  if (walletError && walletError.code !== "PGRST116") {
    return { error: walletError.message }
  }

  // 5. Check balance if paid tournament
  if (tournament.entry_fee_cents > 0) {
    if (!wallet || wallet.balance_cents < tournament.entry_fee_cents) {
      const needed = tournament.entry_fee_cents - (wallet?.balance_cents ?? 0)
      return { 
        error: `Insufficient funds. You need $${(needed / 100).toFixed(2)} more.`,
        insufficientFunds: true,
        balanceCents: wallet?.balance_cents ?? 0,
        requiredCents: tournament.entry_fee_cents
      }
    }

    // 6. Deduct funds from wallet
    const newBalance = wallet.balance_cents - tournament.entry_fee_cents
    const { error: updateWalletError } = await supabase
      .from("wallets")
      .update({ 
        balance_cents: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id)

    if (updateWalletError) {
      return { error: `Failed to deduct funds: ${updateWalletError.message}` }
    }

    // 7. Record transaction
    const { error: transactionError } = await supabase
      .from("financial_transactions")
      .insert({
        user_id: user.id,
        amount_cents: -tournament.entry_fee_cents,
        type: "entry_fee",
        description: `Entry fee for ${tournament.name}`,
        reference_id: tournamentId,
        reference_type: "tournament",
      })

    if (transactionError) {
      // Rollback wallet update
      await supabase
        .from("wallets")
        .update({ balance_cents: wallet.balance_cents })
        .eq("user_id", user.id)
      return { error: `Failed to record transaction: ${transactionError.message}` }
    }
  }

  // 8. Join tournament
  const { error: joinError } = await supabase
    .from("tournament_participants")
    .insert({
      tournament_id: tournamentId,
      user_id: user.id,
      status: "registered",
      payment_status: tournament.entry_fee_cents > 0 ? "paid" : "free",
      registered_at: new Date().toISOString()
    })

  if (joinError) {
    // Rollback if paid tournament
    if (tournament.entry_fee_cents > 0 && wallet) {
      await supabase
        .from("wallets")
        .update({ balance_cents: wallet.balance_cents })
        .eq("user_id", user.id)
    }
    if (joinError.code === "23505") {
      return { error: "You are already registered for this tournament" }
    }
    return { error: `Failed to join tournament: ${joinError.message}` }
  }

  revalidatePath("/esports")
  revalidatePath("/dashboard")
  return { success: true }
}

/**
 * Leave a tournament and refund if applicable
 */
export async function leaveTournament(tournamentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: "You must be signed in" }
  }

  // Get tournament details
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, entry_fee_cents, status")
    .eq("id", tournamentId)
    .single()

  if (!tournament) {
    return { error: "Tournament not found" }
  }

  // Check if can withdraw (only during registration)
  if (tournament.status !== "registration") {
    return { error: "Cannot withdraw after registration closes" }
  }

  // Get participant record
  const { data: participant } = await supabase
    .from("tournament_participants")
    .select("id, payment_status")
    .eq("tournament_id", tournamentId)
    .eq("user_id", user.id)
    .single()

  if (!participant) {
    return { error: "You are not registered for this tournament" }
  }

  // If paid, refund to wallet
  if (participant.payment_status === "paid" && tournament.entry_fee_cents > 0) {
    // Get current wallet
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance_cents")
      .eq("user_id", user.id)
      .single()

    if (wallet) {
      // Refund to wallet
      await supabase
        .from("wallets")
        .update({ 
          balance_cents: wallet.balance_cents + tournament.entry_fee_cents,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user.id)

      // Record refund transaction
      await supabase
        .from("financial_transactions")
        .insert({
          user_id: user.id,
          amount_cents: tournament.entry_fee_cents,
          type: "refund",
          description: `Refund for withdrawing from ${tournament.name}`,
          reference_id: tournamentId,
          reference_type: "tournament",
        })
    }
  }

  // Remove from tournament
  const { error: deleteError } = await supabase
    .from("tournament_participants")
    .delete()
    .eq("tournament_id", tournamentId)
    .eq("user_id", user.id)

  if (deleteError) {
    return { error: `Failed to withdraw: ${deleteError.message}` }
  }

  revalidatePath("/esports")
  revalidatePath("/dashboard")
  return { success: true, refunded: participant.payment_status === "paid" }
}

/**
 * Get tournaments user has joined
 */
export async function getMyTournaments() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: "You must be signed in" }
  }

  const { data, error } = await supabase
    .from("tournament_participants")
    .select(`
      id,
      status,
      payment_status,
      registered_at,
      tournaments (
        id,
        name,
        slug,
        status,
        start_date,
        entry_fee_cents,
        games (name, slug)
      )
    `)
    .eq("user_id", user.id)
    .order("registered_at", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { data }
}

/**
 * Check if user is registered for a tournament
 */
export async function isRegisteredForTournament(tournamentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return false
  }

  const { data } = await supabase
    .from("tournament_participants")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("user_id", user.id)
    .single()

  return !!data
}

/**
 * Get tournament participant count
 */
export async function getTournamentParticipantCount(tournamentId: string) {
  const supabase = await createClient()
  
  const { count } = await supabase
    .from("tournament_participants")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)

  return count ?? 0
}
