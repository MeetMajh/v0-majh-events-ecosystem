"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

/**
 * Add funds to user's wallet
 * In production, this would integrate with Stripe to process payment first
 * For now, it adds funds directly for testing
 */
export async function addFundsToWallet(amountCents: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: "You must be signed in" }
  }

  if (amountCents < 100) {
    return { error: "Minimum amount is $1.00" }
  }

  if (amountCents > 50000) {
    return { error: "Maximum amount is $500.00" }
  }

  // Get or create wallet
  let { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (!wallet) {
    const { data: newWallet, error: createError } = await supabase
      .from("wallets")
      .insert({ user_id: user.id, balance_cents: 0 })
      .select()
      .single()

    if (createError) {
      return { error: createError.message }
    }
    wallet = newWallet
  }

  // Update wallet balance
  const newBalance = (wallet?.balance_cents ?? 0) + amountCents
  const { error: updateError } = await supabase
    .from("wallets")
    .update({ 
      balance_cents: newBalance,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", user.id)

  if (updateError) {
    return { error: updateError.message }
  }

  // Record transaction
  await supabase.from("financial_transactions").insert({
    user_id: user.id,
    amount_cents: amountCents,
    type: "deposit",
    description: "Added funds to wallet",
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/wallet")
  
  return { success: true, newBalance }
}

/**
 * Get user's wallet balance
 */
export async function getWalletBalance() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: "You must be signed in" }
  }

  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance_cents")
    .eq("user_id", user.id)
    .single()

  return { balanceCents: wallet?.balance_cents ?? 0 }
}
