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
 * Uses a database transaction (RPC) to ensure atomicity:
 * - wallet deduction
 * - financial_transaction insert
 * - tournament_participant insert
 * All succeed or all fail together.
 */
export async function joinTournament(tournamentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: "You must be signed in" }
  }

  // Call the atomic database function
  const { data, error } = await supabase.rpc("join_tournament", {
    p_user_id: user.id,
    p_tournament_id: tournamentId
  })

  if (error) {
    return { error: error.message }
  }

  // The RPC returns a JSON object with either { success: true } or { error: "..." }
  const result = data as { success?: boolean; error?: string; insufficientFunds?: boolean; balanceCents?: number; requiredCents?: number }

  if (result.error) {
    return {
      error: result.error,
      insufficientFunds: result.insufficientFunds,
      balanceCents: result.balanceCents,
      requiredCents: result.requiredCents
    }
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
