"use server"

/*
  FIXED 2026-11-19 — `.catch()` on a Supabase query builder.

  Verified by running it against @supabase/supabase-js rather than reasoning
  about it:

      typeof builder.then   -> "function"
      typeof builder.catch  -> "undefined"
      builder.catch(fn)     -> TypeError: ....catch is not a function
      await builder         -> RESOLVES, with the failure in `.error`

  Two bugs in one line, therefore.

  First, PostgrestFilterBuilder is a thenable, not a Promise. It implements
  `then` and nothing else, so `.catch(...)` threw a TypeError the moment the
  line executed — taking down the whole surrounding action, which is the
  opposite of the "don't let this failure block the operation" intent the
  comments state.

  Second, and why `.then(undefined, handler)` would NOT have been a fix
  either: supabase-js does not reject. It catches transport and Postgres
  errors internally and resolves with `{ data: null, error: {...} }`. A
  rejection handler would never have fired even if `.catch` had existed. The
  only way to see a failure is to read `error` off the resolved result.
*/

/*
  PRIVILEGED RPCs MOVED TO service_role, 2026-11-19.

  Six SECURITY DEFINER functions had NO caller authorization check of any
  kind — verified by reading every body for auth.uid(), a role predicate, or
  anything equivalent:

      adjust_wallet_balance        changes ANY user's balance
      post_ledger_transaction      posts arbitrary ledger entries
      trigger_emergency_lockdown   locks the platform down
      lift_emergency_lockdown      unlocks it
      toggle_system_control        flips system controls
      run_chaos_suite              runs chaos tests against production

  Each took the acting admin's identity as a PARAMETER (`p_admin_id`) rather
  than reading it from the session, which is worth nothing as authorization
  because the caller supplies it. And each was EXECUTE-able by `authenticated`,
  so any signed-in user could call it directly over PostgREST as
  POST /rest/v1/rpc/<name>, bypassing this route entirely.

  The routes themselves were never the hole — they gate on auth.getUser()
  plus profiles.is_admin. The hole was the direct RPC path around them.

  THE FIX, in two halves that only work together:
    1. this file now performs the privileged call with createAdminClient()
       (service_role), AFTER its own admin gate above;
    2. migration 20261119_010 revokes `authenticated` EXECUTE on all six,
       which closes the direct PostgREST path.

  Deliberately NOT fixed by adding an in-function check copied from the
  neighbouring admin_* functions. Those test

      staff_roles.role IN ('owner','manager','finance')

  while staff_roles actually holds PLATFORM_OWNER and TENANT_MANAGER — so
  that comparison cannot pass for any human, and those functions raise
  'Unauthorized' for everyone except service_role. They are not secured by
  design, they are secured by an always-false comparison, and normalising the
  role vocabulary would arm all of them at once. Copying that pattern would
  be fitting a lock already known not to turn. See majh-foundry D-011.
*/
import { createClient, createAdminClient } from "@/lib/supabase/server"
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

  // Get all completed transactions for this user (exclude voided)
  const { data: transactions, error: txError } = await supabase
    .from("financial_transactions")
    .select("amount_cents, type")
    .eq("user_id", targetUserId)
    .eq("status", "completed")
    .neq("status", "voided")

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

/**
 * Find wallets where balance doesn't match transaction sum
 * Used for auditing and identifying reconciliation needs
 */
export async function findWalletInconsistencies() {
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

  // Get all wallets with user info
  const { data: wallets, error: walletError } = await supabase
    .from("wallets")
    .select(`
      user_id,
      balance_cents,
      profiles!inner(email)
    `)

  if (walletError) {
    return { error: `Failed to fetch wallets: ${walletError.message}` }
  }

  // Get all completed transactions grouped by user (exclude voided)
  const { data: transactions, error: txError } = await supabase
    .from("financial_transactions")
    .select("user_id, amount_cents, status")
    .in("status", ["completed", "pending"]) // Exclude voided

  if (txError) {
    return { error: `Failed to fetch transactions: ${txError.message}` }
  }

  // Filter to only completed (not voided)
  const validTransactions = transactions?.filter(tx => tx.status === "completed") || []

  // Calculate transaction sums per user (from valid transactions only)
  const txSums: Record<string, number> = {}
  validTransactions.forEach(tx => {
    if (tx.user_id) {
      txSums[tx.user_id] = (txSums[tx.user_id] || 0) + (tx.amount_cents || 0)
    }
  })

  // Find inconsistencies
  const inconsistencies = wallets?.filter(wallet => {
    const txSum = txSums[wallet.user_id] || 0
    return wallet.balance_cents !== txSum
  }).map(wallet => ({
    userId: wallet.user_id,
    email: (wallet.profiles as unknown as { email: string })?.email || "Unknown",
    walletBalance: wallet.balance_cents,
    transactionSum: txSums[wallet.user_id] || 0,
    difference: (txSums[wallet.user_id] || 0) - wallet.balance_cents
  })) || []

  return { 
    success: true, 
    inconsistencies,
    totalWallets: wallets?.length || 0,
    inconsistentCount: inconsistencies.length
  }
}

/**
 * Recalculate all wallet balances from transactions
 * Nuclear option for full reconciliation
 */
export async function recalculateAllWallets() {
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

  // Get all wallets
  const { data: wallets, error: walletError } = await supabase
    .from("wallets")
    .select("user_id, balance_cents")

  if (walletError) {
    return { error: `Failed to fetch wallets: ${walletError.message}` }
  }

  // Get all completed transactions (exclude voided)
  const { data: transactions, error: txError } = await supabase
    .from("financial_transactions")
    .select("user_id, amount_cents, status")
    .in("status", ["completed", "pending"])

  if (txError) {
    return { error: `Failed to fetch transactions: ${txError.message}` }
  }

  // Filter to only completed (not voided) and calculate sums
  const txSums: Record<string, number> = {}
  transactions?.filter(tx => tx.status === "completed").forEach(tx => {
    if (tx.user_id) {
      txSums[tx.user_id] = (txSums[tx.user_id] || 0) + (tx.amount_cents || 0)
    }
  })

  // Update each wallet and track changes
  const details: Array<{
    userId: string
    previousBalance: number
    newBalance: number
    adjustment: number
  }> = []

  for (const wallet of wallets || []) {
    const correctBalance = txSums[wallet.user_id] || 0
    
    if (wallet.balance_cents !== correctBalance) {
      const { error: updateError } = await supabase
        .from("wallets")
        .update({ 
          balance_cents: correctBalance,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", wallet.user_id)

      if (!updateError) {
        details.push({
          userId: wallet.user_id,
          previousBalance: wallet.balance_cents,
          newBalance: correctBalance,
          adjustment: correctBalance - wallet.balance_cents
        })
      }
    }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/wallet")
  revalidatePath("/admin")

  return {
    success: true,
    total: wallets?.length || 0,
    fixed: details.length,
    details
  }
}

/**
 * Void an erroneous transaction (e.g., failed webhook deposit)
 * Changes status to 'voided' so it's excluded from balance calculations
 * but preserved for audit trail
 * 
 * USE FOR: Test payments, ghost webhook records, invalid transactions
 * DO NOT USE FOR: Real money that needs refund (use reverseTransaction instead)
 */
export async function voidTransaction(transactionId: string, reason: string, forceVoidStripe = false) {
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

  // Get the transaction
  const { data: transaction, error: txError } = await supabase
    .from("financial_transactions")
    .select("*")
    .eq("id", transactionId)
    .single()

  if (txError || !transaction) {
    return { error: "Transaction not found" }
  }

  if (transaction.status === "voided") {
    return { error: "Transaction is already voided" }
  }

  // SAFETY CHECK: Warn if voiding a real Stripe transaction
  if (transaction.stripe_event_id && !forceVoidStripe) {
    return { 
      error: "This transaction is linked to a real Stripe event. Use REVERSAL for real money corrections, or confirm force void.",
      hasStripeLink: true,
      stripeEventId: transaction.stripe_event_id
    }
  }

  // Update transaction to voided status with audit trail
  const { error: updateError } = await supabase
    .from("financial_transactions")
    .update({ 
      status: "voided",
      description: `${transaction.description} [VOIDED: ${reason}]`,
      void_reason: reason,
      voided_by: user.id,
      voided_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", transactionId)

  if (updateError) {
    return { error: `Failed to void transaction: ${updateError.message}` }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/wallet")
  revalidatePath("/dashboard/admin/financials")
  revalidatePath("/dashboard/admin/reconciliation")
  
  return { 
    success: true, 
    transaction: {
      id: transactionId,
      type: transaction.type,
      amount_cents: transaction.amount_cents,
      previousStatus: transaction.status,
      newStatus: "voided"
    }
  }
}

/**
 * Reverse a transaction (for refunds, chargebacks, admin corrections)
 * Creates an opposing transaction to maintain ledger balance
 * 
 * USE FOR: Real money that needs to be undone (refund, chargeback, correction)
 * This keeps ledger balanced: +100 deposit, -100 reversal = net 0
 */
export async function reverseTransaction(transactionId: string, reason: string) {
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

  // Get the original transaction
  const { data: transaction, error: txError } = await supabase
    .from("financial_transactions")
    .select("*")
    .eq("id", transactionId)
    .single()

  if (txError || !transaction) {
    return { error: "Transaction not found" }
  }

  if (transaction.status === "voided") {
    return { error: "Cannot reverse a voided transaction" }
  }

  if (transaction.type === "reversal") {
    return { error: "Cannot reverse a reversal transaction" }
  }

  // Check if already reversed
  const { data: existingReversal } = await supabase
    .from("financial_transactions")
    .select("id")
    .eq("reference_id", transactionId)
    .eq("type", "reversal")
    .single()

  if (existingReversal) {
    return { error: "This transaction has already been reversed" }
  }

  // Create reversal transaction (negative of original amount)
  const reversalAmount = -Math.abs(transaction.amount_cents)
  
  const { data: reversal, error: insertError } = await supabase
    .from("financial_transactions")
    .insert({
      user_id: transaction.user_id,
      amount_cents: reversalAmount,
      type: "reversal",
      status: "completed",
      description: `Reversal: ${reason} (original: ${transaction.description})`,
      reference_type: "reversal",
      reference_id: transactionId,
    })
    .select()
    .single()

  if (insertError) {
    return { error: `Failed to create reversal: ${insertError.message}` }
  }

  // Update wallet balance (subtract the original amount)
  if (transaction.user_id) {
    const { error: walletError } = await supabase
      .from("wallets")
      .update({ 
        balance_cents: supabase.rpc ? undefined : undefined, // Will use raw SQL below
        updated_at: new Date().toISOString()
      })
      .eq("user_id", transaction.user_id)

    // Use RPC or direct update for atomic balance change
    const { error: adjustError } = await createAdminClient().rpc("adjust_wallet_balance", {
      p_user_id: transaction.user_id,
      p_amount: reversalAmount,
    })
    if (adjustError) {
      // Fallback: manual update if the RPC is absent in this deployment.
      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance_cents")
        .eq("user_id", transaction.user_id)
        .single()
      if (wallet) {
        await supabase
          .from("wallets")
          .update({
            balance_cents: wallet.balance_cents + reversalAmount,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", transaction.user_id)
      }
    }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/wallet")
  revalidatePath("/dashboard/admin/financials")
  revalidatePath("/dashboard/admin/reconciliation")
  
  return { 
    success: true, 
    originalTransaction: {
      id: transactionId,
      type: transaction.type,
      amount_cents: transaction.amount_cents,
    },
    reversalTransaction: {
      id: reversal.id,
      type: "reversal",
      amount_cents: reversalAmount,
    }
  }
}

/**
 * Find orphaned deposits - transactions recorded as deposits
 * but wallet was never credited (webhook failures)
 */
export async function findOrphanedDeposits() {
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

  // Get all completed deposits
  const { data: deposits, error: depError } = await supabase
    .from("financial_transactions")
    .select(`
      id,
      user_id,
      amount_cents,
      type,
      status,
      description,
      stripe_session_id,
      created_at
    `)
    .eq("type", "deposit")
    .eq("status", "completed")
    .order("created_at", { ascending: false })

  if (depError) {
    return { error: `Failed to fetch deposits: ${depError.message}` }
  }

  // Get all wallets
  const { data: wallets, error: walletError } = await supabase
    .from("wallets")
    .select("user_id, balance_cents")

  if (walletError) {
    return { error: `Failed to fetch wallets: ${walletError.message}` }
  }

  // Get all transactions per user to calculate expected balance
  const { data: allTransactions, error: txError } = await supabase
    .from("financial_transactions")
    .select("user_id, amount_cents, type")
    .eq("status", "completed")

  if (txError) {
    return { error: `Failed to fetch transactions: ${txError.message}` }
  }

  // Calculate expected balance per user from transactions
  const expectedBalances: Record<string, number> = {}
  allTransactions?.forEach(tx => {
    if (tx.user_id) {
      expectedBalances[tx.user_id] = (expectedBalances[tx.user_id] || 0) + (tx.amount_cents || 0)
    }
  })

  // Build wallet balance map
  const walletBalances: Record<string, number> = {}
  wallets?.forEach(w => {
    walletBalances[w.user_id] = w.balance_cents
  })

  // Find users where wallet balance is LESS than expected (deposits didn't credit)
  const usersWithOrphanedDeposits = Object.keys(expectedBalances).filter(userId => {
    const expected = expectedBalances[userId] || 0
    const actual = walletBalances[userId] || 0
    return actual < expected
  })

  // Find deposits that might be orphaned (users with balance discrepancy)
  const potentialOrphans = deposits?.filter(d => 
    d.user_id && usersWithOrphanedDeposits.includes(d.user_id)
  ) || []

  return {
    success: true,
    orphanedDeposits: potentialOrphans,
    summary: {
      totalDeposits: deposits?.length || 0,
      potentialOrphans: potentialOrphans.length,
      usersAffected: usersWithOrphanedDeposits.length
    }
  }
}
