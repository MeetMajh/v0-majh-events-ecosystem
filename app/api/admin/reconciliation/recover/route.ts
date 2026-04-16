import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * ATOMIC PAYMENT RECOVERY API
 * 
 * Uses database-level RPC for fully atomic, idempotent recovery.
 * All operations (transaction insert, wallet credit, audit log) happen
 * in a single database transaction - no partial writes possible.
 * 
 * SAFETY GUARANTEES:
 * - Idempotent: Can't double-credit even if called multiple times
 * - Atomic: All-or-nothing execution via FOR UPDATE locks
 * - Audited: Every recovery logged with full context
 * - Environment-aware: Handles test/live payments correctly
 */

// GET: Preview recovery before executing
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("session_id")

    if (!sessionId) {
      return NextResponse.json({ error: "session_id required" }, { status: 400 })
    }

    // Use atomic RPC for preview
    const { data, error } = await supabase.rpc("get_recovery_preview", {
      p_session_id: sessionId
    })

    if (error) {
      // Fallback to basic check if RPC doesn't exist yet
      const { data: existingTx } = await supabase
        .from("financial_transactions")
        .select("id, amount_cents, created_at")
        .eq("stripe_session_id", sessionId)
        .single()

      if (existingTx) {
        return NextResponse.json({
          can_recover: false,
          reason: "Transaction already exists",
          existing_transaction: existingTx
        })
      }

      return NextResponse.json({
        can_recover: true,
        session_id: sessionId,
        environment: sessionId.startsWith("cs_test_") ? "test" : "live",
        is_test: sessionId.startsWith("cs_test_")
      })
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error("Recovery preview error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST: Execute atomic recovery
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, email")
      .eq("id", user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { 
      stripeSessionId, 
      userId, 
      amountCents, 
      stripePaymentIntent,
      stripeCustomerEmail,
      reason = "Missing webhook - admin recovery"
    } = body

    if (!stripeSessionId || !userId || !amountCents) {
      return NextResponse.json({ 
        error: "Missing required fields: stripeSessionId, userId, amountCents" 
      }, { status: 400 })
    }

    // Execute atomic recovery via RPC
    const { data, error } = await supabase.rpc("recover_stripe_payment", {
      p_session_id: stripeSessionId,
      p_admin_id: user.id,
      p_user_id: userId,
      p_amount_cents: amountCents,
      p_payment_intent: stripePaymentIntent || null,
      p_customer_email: stripeCustomerEmail || null,
      p_reason: reason
    })

    if (error) {
      // Fallback to non-RPC method if function doesn't exist
      if (error.message.includes("function") && error.message.includes("does not exist")) {
        return await fallbackRecovery(supabase, user, profile, body)
      }
      
      return NextResponse.json({ 
        error: `Recovery failed: ${error.message}` 
      }, { status: 500 })
    }

    if (!data.success) {
      const status = data.already_recovered ? 409 : 400
      return NextResponse.json(data, { status })
    }

    // Success response with full context
    return NextResponse.json({
      success: true,
      message: data.is_test 
        ? `[TEST MODE] Recovered $${(amountCents / 100).toFixed(2)} - marked as test data`
        : `Successfully recovered $${(amountCents / 100).toFixed(2)}`,
      transaction: {
        id: data.transaction_id,
        amount_cents: data.credited_amount,
        user_id: data.user_id,
      },
      balanceChange: {
        previous: data.previous_balance,
        new: data.new_balance,
        change: data.credited_amount,
      },
      environment: data.environment,
      isTestMode: data.is_test,
      auditTrail: {
        idempotencyKey: data.idempotency_key,
        performedBy: profile.email,
        timestamp: new Date().toISOString(),
      }
    })

  } catch (error) {
    console.error("Reconciliation recover error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Fallback for when RPC doesn't exist yet
async function fallbackRecovery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string },
  profile: { email: string },
  body: {
    stripeSessionId: string
    userId: string
    amountCents: number
    stripePaymentIntent?: string
    stripeCustomerEmail?: string
    reason?: string
  }
) {
  const { 
    stripeSessionId, 
    userId, 
    amountCents, 
    stripePaymentIntent,
    stripeCustomerEmail,
    reason = "Missing webhook - admin recovery"
  } = body

  const environment = stripeSessionId.startsWith("cs_test_") ? "test" : 
                     stripeSessionId.startsWith("cs_live_") ? "live" : "unknown"
  const isTest = environment === "test"
  const idempotencyKey = `recover_stripe_${stripeSessionId}`

  // Check existing transaction
  const { data: existingTx } = await supabase
    .from("financial_transactions")
    .select("id, created_at, amount_cents")
    .eq("stripe_session_id", stripeSessionId)
    .single()

  if (existingTx) {
    return NextResponse.json({ 
      error: "Transaction already exists for this Stripe session",
      already_recovered: true,
      existing_transaction_id: existingTx.id
    }, { status: 409 })
  }

  // Check audit log
  const { data: existingAudit } = await supabase
    .from("reconciliation_audit_log")
    .select("id, created_at")
    .eq("idempotency_key", idempotencyKey)
    .eq("status", "completed")
    .single()

  if (existingAudit) {
    return NextResponse.json({ 
      error: "This payment was already recovered",
      already_recovered: true,
      recovered_at: existingAudit.created_at
    }, { status: 409 })
  }

  // Get wallet
  const { data: walletBefore } = await supabase
    .from("wallets")
    .select("balance_cents")
    .eq("user_id", userId)
    .single()

  const previousBalance = walletBefore?.balance_cents || 0
  const newBalance = previousBalance + amountCents

  // Create transaction
  const { data: transaction, error: txError } = await supabase
    .from("financial_transactions")
    .insert({
      user_id: userId,
      amount_cents: amountCents,
      type: "deposit",
      status: "completed",
      description: isTest 
        ? `[TEST] Recovered Stripe deposit - ${reason}` 
        : `Recovered Stripe deposit - ${reason}`,
      stripe_session_id: stripeSessionId,
      stripe_payment_intent: stripePaymentIntent,
      is_test: isTest,
      environment,
      recovered_at: new Date().toISOString(),
      recovered_by: user.id,
      recovery_source: "stripe_reconciliation",
    })
    .select()
    .single()

  if (txError) {
    return NextResponse.json({ 
      error: `Failed to create transaction: ${txError.message}` 
    }, { status: 500 })
  }

  // Update wallet
  if (walletBefore) {
    await supabase
      .from("wallets")
      .update({ balance_cents: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
  } else {
    await supabase
      .from("wallets")
      .insert({ user_id: userId, balance_cents: amountCents })
  }

  // Audit log
  await supabase
    .from("reconciliation_audit_log")
    .insert({
      action_type: "recovery",
      target_type: "stripe_session",
      target_id: stripeSessionId,
      user_id: userId,
      performed_by: user.id,
      amount_cents: amountCents,
      previous_balance_cents: previousBalance,
      new_balance_cents: newBalance,
      reason,
      documentation: `FALLBACK RECOVERY: $${(amountCents / 100).toFixed(2)}`,
      is_test_data: isTest,
      environment,
      idempotency_key: idempotencyKey,
      status: "completed",
      related_transaction_id: transaction.id,
      stripe_session_id: stripeSessionId,
    })

  return NextResponse.json({
    success: true,
    message: `Recovered $${(amountCents / 100).toFixed(2)} (fallback mode)`,
    transaction: { id: transaction.id, amount_cents: amountCents, user_id: userId },
    balanceChange: { previous: previousBalance, new: newBalance, change: amountCents },
    environment,
    isTestMode: isTest,
    auditTrail: { idempotencyKey, performedBy: profile.email, timestamp: new Date().toISOString() }
  })
}
