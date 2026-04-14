"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Helper function to sum amounts
function sumCents(items: { amount_cents?: number; balance_cents?: number; funded_amount_cents?: number }[] | null, field: "amount_cents" | "balance_cents" | "funded_amount_cents" = "amount_cents"): number {
  if (!items) return 0
  return items.reduce((sum, item) => sum + Math.abs((item as Record<string, number>)[field] || 0), 0)
}

export async function getFinancialOverview() {
  const supabase = await createClient()

  const [
    { data: deposits },
    { data: wallets },
    { data: escrow },
    { data: payouts },
  ] = await Promise.all([
    supabase
      .from("financial_transactions")
      .select("amount_cents")
      .eq("type", "deposit")
      .eq("status", "completed"),
    supabase
      .from("wallets")
      .select("balance_cents"),
    supabase
      .from("escrow_accounts")
      .select("funded_amount_cents, status")
      .neq("status", "released"),
    supabase
      .from("tournament_payouts")
      .select("amount_cents"),
  ])

  return {
    deposits: sumCents(deposits),
    walletBalance: sumCents(wallets, "balance_cents"),
    escrow: sumCents(escrow, "funded_amount_cents"),
    payouts: sumCents(payouts),
  }
}

export async function reverseTransaction({
  transactionId,
  reason,
  type,
}: {
  transactionId: string
  reason: string
  type: "wallet" | "stripe" | "adjustment"
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Check admin access
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["owner", "manager"])
    .single()

  if (!staffRole) throw new Error("Not authorized")

  // Get the original transaction
  const { data: tx, error: txError } = await supabase
    .from("financial_transactions")
    .select("*")
    .eq("id", transactionId)
    .single()

  if (txError || !tx) throw new Error("Transaction not found")
  if (tx.reversed_at) throw new Error("Transaction already reversed")

  // Call the perform_reversal RPC function
  const { data: result, error: rpcError } = await supabase
    .rpc("perform_reversal", {
      p_transaction_id: transactionId,
      p_reason: reason,
      p_admin_id: user.id,
      p_idempotency_key: `reversal_${transactionId}_${Date.now()}`,
    })

  if (rpcError) throw new Error(rpcError.message)
  
  // Handle Stripe refund if needed
  if (type === "stripe" && tx.stripe_payment_intent_id) {
    // This would call Stripe API in production
    console.log("[v0] Would process Stripe refund for:", tx.stripe_payment_intent_id)
  }

  revalidatePath("/dashboard/admin/control-panel")
  revalidatePath("/dashboard/admin/control-panel/transactions")
  revalidatePath("/dashboard/admin/control-panel/reversals")
  
  return result
}

export async function approveWithdrawal(withdrawalId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Check admin access
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["owner", "manager"])
    .single()

  if (!staffRole) throw new Error("Not authorized")

  // Update withdrawal status
  const { error } = await supabase
    .from("financial_transactions")
    .update({ status: "processing" })
    .eq("id", withdrawalId)
    .eq("type", "withdrawal")
    .eq("status", "pending")

  if (error) throw new Error(error.message)

  // In production, this would initiate the Stripe payout
  // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
  // await stripe.transfers.create({ ... })

  revalidatePath("/dashboard/admin/control-panel/withdrawals")
  
  return { success: true }
}

export async function rejectWithdrawal(withdrawalId: string, reason: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Check admin access
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["owner", "manager"])
    .single()

  if (!staffRole) throw new Error("Not authorized")

  // Get the withdrawal to return funds
  const { data: withdrawal } = await supabase
    .from("financial_transactions")
    .select("*")
    .eq("id", withdrawalId)
    .eq("type", "withdrawal")
    .eq("status", "pending")
    .single()

  if (!withdrawal) throw new Error("Withdrawal not found")

  // Mark as failed
  await supabase
    .from("financial_transactions")
    .update({ 
      status: "failed",
      description: `Rejected: ${reason}`
    })
    .eq("id", withdrawalId)

  // Return funds to wallet
  await supabase
    .from("wallets")
    .update({ 
      balance_cents: supabase.sql`balance_cents + ${Math.abs(withdrawal.amount_cents)}`
    })
    .eq("user_id", withdrawal.user_id)

  // Log to audit
  await supabase
    .from("reconciliation_audit_log")
    .insert({
      action_type: "withdrawal_rejected",
      target_type: "transaction",
      target_id: withdrawalId,
      user_id: withdrawal.user_id,
      performed_by: user.id,
      amount_cents: withdrawal.amount_cents,
      reason,
      status: "completed",
    })

  revalidatePath("/dashboard/admin/control-panel/withdrawals")
  
  return { success: true }
}

export async function releaseEscrow(escrowId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Check admin access
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["owner", "manager"])
    .single()

  if (!staffRole) throw new Error("Not authorized")

  // Update escrow status
  const { data: escrow, error } = await supabase
    .from("escrow_accounts")
    .update({ status: "released" })
    .eq("id", escrowId)
    .eq("status", "funded")
    .select()
    .single()

  if (error) throw new Error(error.message)

  // Log to audit
  await supabase
    .from("reconciliation_audit_log")
    .insert({
      action_type: "escrow_release",
      target_type: "escrow",
      target_id: escrowId,
      performed_by: user.id,
      amount_cents: escrow.funded_amount_cents,
      reason: "Manual release by admin",
      status: "completed",
    })

  revalidatePath("/dashboard/admin/control-panel/escrow")
  
  return { success: true }
}
