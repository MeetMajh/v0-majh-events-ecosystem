"use server"

import { createClient } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

/**
 * Create a Stripe Checkout session for adding funds to wallet
 * Returns the checkout URL for redirect
 */
export async function createWalletDepositCheckout(amountCents: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: "You must be signed in" }
  }

  if (amountCents < 500) {
    return { error: "Minimum deposit is $5.00" }
  }

  if (amountCents > 50000) {
    return { error: "Maximum deposit is $500.00" }
  }

  // Get the origin for return URL
  const headersList = await headers()
  const origin = headersList.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  try {
    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Wallet Deposit",
              description: `Add $${(amountCents / 100).toFixed(2)} to your MAJH wallet`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "wallet_deposit",
        user_id: user.id,
        amount_cents: amountCents.toString(),
      },
      success_url: `${origin}/dashboard/wallet?deposit=success`,
      cancel_url: `${origin}/dashboard/wallet?deposit=cancelled`,
    })

    return { checkoutUrl: session.url }
  } catch (error) {
    console.error("[wallet-actions] Failed to create checkout session:", error)
    return { error: "Failed to create checkout session" }
  }
}

/**
 * Process wallet deposit after successful Stripe payment
 * Called by the webhook handler
 */
export async function processWalletDeposit(userId: string, amountCents: number, stripeSessionId: string) {
  const { createClient } = await import("@supabase/supabase-js")
  
  // Use service role for webhook context
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check for idempotency - prevent duplicate deposits
  const { data: existingTx } = await supabaseAdmin
    .from("financial_transactions")
    .select("id")
    .eq("stripe_session_id", stripeSessionId)
    .single()

  if (existingTx) {
    console.log("[wallet-actions] Duplicate deposit prevented:", stripeSessionId)
    return { success: true, duplicate: true }
  }

  // Get or create wallet
  let { data: wallet } = await supabaseAdmin
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .single()

  if (!wallet) {
    const { data: newWallet, error: createError } = await supabaseAdmin
      .from("wallets")
      .insert({ user_id: userId, balance_cents: 0 })
      .select()
      .single()

    if (createError) {
      console.error("[wallet-actions] Failed to create wallet:", createError)
      return { error: createError.message }
    }
    wallet = newWallet
  }

  // Update wallet balance
  const newBalance = (wallet?.balance_cents ?? 0) + amountCents
  const { error: updateError } = await supabaseAdmin
    .from("wallets")
    .update({ 
      balance_cents: newBalance,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId)

  if (updateError) {
    console.error("[wallet-actions] Failed to update wallet:", updateError)
    return { error: updateError.message }
  }

  // Record transaction
  const { error: txError } = await supabaseAdmin
    .from("financial_transactions")
    .insert({
      user_id: userId,
      amount_cents: amountCents,
      type: "deposit",
      status: "completed",
      description: "Stripe wallet deposit",
      stripe_session_id: stripeSessionId,
    })

  if (txError) {
    console.error("[wallet-actions] Failed to record transaction:", txError)
    // Don't fail - wallet was already updated
  }

  console.log("[wallet-actions] Deposit processed:", { userId, amountCents, newBalance })
  return { success: true, newBalance }
}

/**
 * Request withdrawal from wallet to bank via Stripe Connect
 */
export async function requestWalletWithdrawal(amountCents: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: "You must be signed in" }
  }

  if (amountCents < 1000) {
    return { error: "Minimum withdrawal is $10.00" }
  }

  // Get wallet balance
  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance_cents")
    .eq("user_id", user.id)
    .single()

  if (!wallet || wallet.balance_cents < amountCents) {
    return { error: "Insufficient funds" }
  }

  // Check if user has Stripe Connect set up
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id, stripe_connect_payouts_enabled, kyc_verified")
    .eq("id", user.id)
    .single()

  if (!profile?.stripe_connect_account_id) {
    return { error: "Please set up your payout account first", needsConnect: true }
  }

  if (!profile.stripe_connect_payouts_enabled) {
    return { error: "Your payout account setup is incomplete", needsConnect: true }
  }

  if (!profile.kyc_verified) {
    return { error: "Please complete identity verification first", needsKYC: true }
  }

  // Create withdrawal request (pending admin approval for large amounts)
  const needsApproval = amountCents >= 10000 // $100+

  // Deduct from wallet
  const newBalance = wallet.balance_cents - amountCents
  const { error: walletError } = await supabase
    .from("wallets")
    .update({ 
      balance_cents: newBalance,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", user.id)

  if (walletError) {
    return { error: "Failed to process withdrawal" }
  }

  // Record pending withdrawal transaction
  const { data: tx, error: txError } = await supabase
    .from("financial_transactions")
    .insert({
      user_id: user.id,
      amount_cents: -amountCents,
      type: "withdrawal",
      status: needsApproval ? "pending" : "processing",
      description: `Withdrawal to bank account`,
    })
    .select()
    .single()

  if (txError) {
    // Rollback wallet deduction
    await supabase
      .from("wallets")
      .update({ balance_cents: wallet.balance_cents })
      .eq("user_id", user.id)
    return { error: "Failed to create withdrawal request" }
  }

  // For amounts under $100, process immediately
  if (!needsApproval) {
    try {
      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: "usd",
        destination: profile.stripe_connect_account_id,
        metadata: {
          type: "wallet_withdrawal",
          user_id: user.id,
          transaction_id: tx.id,
        },
      })

      // Update transaction with Stripe transfer ID
      await supabase
        .from("financial_transactions")
        .update({ 
          status: "completed",
          stripe_transfer_id: transfer.id,
        })
        .eq("id", tx.id)

      revalidatePath("/dashboard/wallet")
      revalidatePath("/dashboard/financials")
      return { success: true, transferId: transfer.id }
    } catch (stripeError: any) {
      // Rollback on Stripe failure
      await supabase
        .from("wallets")
        .update({ balance_cents: wallet.balance_cents })
        .eq("user_id", user.id)
      await supabase
        .from("financial_transactions")
        .update({ status: "failed" })
        .eq("id", tx.id)
      
      return { error: stripeError.message || "Failed to process payout" }
    }
  }

  revalidatePath("/dashboard/wallet")
  revalidatePath("/dashboard/financials")
  return { success: true, pendingApproval: true }
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

/**
 * Add funds directly to wallet (for testing/admin only)
 * In production, use createWalletDepositCheckout instead
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
    status: "completed",
    description: "Test deposit (admin)",
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/wallet")
  
  return { success: true, newBalance }
}

/**
 * Admin function to manually credit a wallet
 * Used for failed webhook recovery or manual adjustments
 */
export async function adminCreditWallet(
  targetUserId: string,
  amountCents: number,
  description: string,
  stripeSessionId?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: "You must be signed in" }
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    return { error: "Unauthorized - admin access required" }
  }

  // Check for duplicate if stripe session ID provided
  if (stripeSessionId) {
    const { data: existingTx } = await supabase
      .from("financial_transactions")
      .select("id")
      .eq("stripe_session_id", stripeSessionId)
      .single()

    if (existingTx) {
      return { error: "This payment has already been processed" }
    }
  }

  // Get or create wallet
  let { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", targetUserId)
    .single()

  if (!wallet) {
    const { data: newWallet, error: createError } = await supabase
      .from("wallets")
      .insert({ user_id: targetUserId, balance_cents: 0 })
      .select()
      .single()
    
    if (createError) {
      return { error: `Failed to create wallet: ${createError.message}` }
    }
    wallet = newWallet
  }

  // Update wallet balance
  const newBalance = wallet.balance_cents + amountCents
  const { error: updateError } = await supabase
    .from("wallets")
    .update({ 
      balance_cents: newBalance,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", targetUserId)

  if (updateError) {
    return { error: updateError.message }
  }

  // Record transaction as manual_credit (separate from Stripe deposits)
  await supabase.from("financial_transactions").insert({
    user_id: targetUserId,
    amount_cents: amountCents,
    type: "manual_credit",
    status: "completed",
    description: description || "Admin manual credit",
    stripe_session_id: stripeSessionId,
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/wallet")
  revalidatePath("/admin")
  
  return { 
    success: true, 
    previousBalance: wallet.balance_cents,
    newBalance,
    credited: amountCents
  }
}

/**
 * Sync wallet balance from transactions (no new entry created)
 * Used when transactions exist but wallet balance is out of sync
 * This recalculates the balance from all completed transactions
 */
export async function syncWalletBalance(targetUserId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: "You must be signed in" }
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    return { error: "Unauthorized - admin access required" }
  }

  // Get all completed transactions for this user
  const { data: transactions, error: txError } = await supabase
    .from("financial_transactions")
    .select("amount_cents, type")
    .eq("user_id", targetUserId)
    .eq("status", "completed")

  if (txError) {
    return { error: `Failed to fetch transactions: ${txError.message}` }
  }

  // Calculate correct balance from transactions
  // Deposits and prizes are positive, entry_fee and withdrawal are negative (stored as negative)
  const calculatedBalance = transactions?.reduce((sum, tx) => {
    return sum + (tx.amount_cents || 0)
  }, 0) || 0

  // Get current wallet
  let { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", targetUserId)
    .single()

  const previousBalance = wallet?.balance_cents || 0

  if (!wallet) {
    // Create wallet with calculated balance
    const { error: createError } = await supabase
      .from("wallets")
      .insert({ user_id: targetUserId, balance_cents: calculatedBalance })
    
    if (createError) {
      return { error: `Failed to create wallet: ${createError.message}` }
    }
  } else {
    // Update wallet to calculated balance
    const { error: updateError } = await supabase
      .from("wallets")
      .update({ 
        balance_cents: calculatedBalance,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", targetUserId)

    if (updateError) {
      return { error: updateError.message }
    }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/wallet")
  revalidatePath("/admin")
  
  return { 
    success: true, 
    previousBalance,
    newBalance: calculatedBalance,
    transactionCount: transactions?.length || 0,
    adjustment: calculatedBalance - previousBalance
  }
}
