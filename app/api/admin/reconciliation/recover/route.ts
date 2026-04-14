import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * Recover a missing Stripe payment that was not recorded in the database
 * 
 * ACCOUNTING IMPACT:
 * - LIVE payments: Creates transaction + credits wallet (affects real balances)
 * - TEST payments: Creates transaction marked as test (no real balance impact in reporting)
 * 
 * IDEMPOTENCY:
 * - Checks stripe_session_id in transactions table
 * - Checks idempotency_key in reconciliation_audit_log
 * - Prevents duplicate credits even if called multiple times
 * 
 * AUDIT TRAIL:
 * - Full documentation of why recovery was performed
 * - Previous and new balance recorded
 * - Admin who performed action logged
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if admin
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
      stripeCustomerEmail,
      documentation = "",
      reason = "Missing webhook - admin recovery"
    } = body

    if (!stripeSessionId || !userId || !amountCents) {
      return NextResponse.json({ 
        error: "Missing required fields: stripeSessionId, userId, amountCents" 
      }, { status: 400 })
    }

    // Determine environment from Stripe session ID prefix
    const environment = stripeSessionId.startsWith("cs_test_") ? "test" : 
                       stripeSessionId.startsWith("cs_live_") ? "live" : "unknown"
    const isTest = environment === "test"

    // IDEMPOTENCY CHECK 1: Check if transaction already exists
    const { data: existingTx } = await supabase
      .from("financial_transactions")
      .select("id, created_at, amount_cents")
      .eq("stripe_session_id", stripeSessionId)
      .single()

    if (existingTx) {
      return NextResponse.json({ 
        error: "Transaction already exists for this Stripe session",
        existingTransaction: {
          id: existingTx.id,
          createdAt: existingTx.created_at,
          amountCents: existingTx.amount_cents
        },
        alreadyRecovered: true
      }, { status: 409 })
    }

    // IDEMPOTENCY CHECK 2: Check reconciliation audit log
    const idempotencyKey = `recover_stripe_${stripeSessionId}`
    const { data: existingAudit } = await supabase
      .from("reconciliation_audit_log")
      .select("id, created_at, performed_by")
      .eq("idempotency_key", idempotencyKey)
      .eq("status", "completed")
      .single()

    if (existingAudit) {
      return NextResponse.json({ 
        error: "This Stripe session was already recovered",
        recoveredAt: existingAudit.created_at,
        alreadyRecovered: true
      }, { status: 409 })
    }

    // IDEMPOTENCY CHECK 3: Check if dismissed (shouldn't recover dismissed items)
    const { data: dismissedAudit } = await supabase
      .from("reconciliation_audit_log")
      .select("id, created_at, reason")
      .eq("idempotency_key", `dismiss_stripe_session_${stripeSessionId}`)
      .eq("status", "completed")
      .single()

    if (dismissedAudit) {
      return NextResponse.json({ 
        error: "This Stripe session was dismissed and cannot be recovered",
        dismissedAt: dismissedAudit.created_at,
        dismissReason: dismissedAudit.reason
      }, { status: 409 })
    }

    // Verify user exists
    const { data: targetUser } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("id", userId)
      .single()

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get current wallet balance for audit trail
    const { data: walletBefore } = await supabase
      .from("wallets")
      .select("balance_cents")
      .eq("user_id", userId)
      .single()

    const previousBalance = walletBefore?.balance_cents || 0

    // Create the transaction record with full tracking
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
        is_test: isTest,
        environment: environment,
        recovered_at: new Date().toISOString(),
        recovered_by: user.id,
        recovery_source: "stripe_reconciliation",
      })
      .select()
      .single()

    if (txError) {
      // Log failed attempt
      await supabase
        .from("reconciliation_audit_log")
        .insert({
          action_type: "recovery",
          target_type: "stripe_session",
          target_id: stripeSessionId,
          user_id: userId,
          performed_by: user.id,
          amount_cents: amountCents,
          reason,
          documentation: `FAILED: ${txError.message}`,
          is_test_data: isTest,
          environment,
          idempotency_key: idempotencyKey,
          status: "failed",
          error_message: txError.message,
          stripe_session_id: stripeSessionId,
        })

      return NextResponse.json({ 
        error: `Failed to create transaction: ${txError.message}` 
      }, { status: 500 })
    }

    // Update wallet balance
    const newBalance = previousBalance + amountCents
    
    if (walletBefore) {
      await supabase
        .from("wallets")
        .update({ 
          balance_cents: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId)
    } else {
      await supabase
        .from("wallets")
        .insert({ 
          user_id: userId, 
          balance_cents: amountCents 
        })
    }

    // Create comprehensive audit documentation
    const auditDocumentation = `
ACTION: Recovered missing Stripe payment
ENVIRONMENT: ${environment.toUpperCase()}${isTest ? " (TEST - no real money)" : " (LIVE - real funds)"}

STRIPE SESSION: ${stripeSessionId}
CUSTOMER EMAIL: ${stripeCustomerEmail || "N/A"}
CREDITED USER: ${targetUser.email} (${userId})

FINANCIAL IMPACT:
- Amount: $${(amountCents / 100).toFixed(2)}
- Previous Balance: $${(previousBalance / 100).toFixed(2)}
- New Balance: $${(newBalance / 100).toFixed(2)}
- Net Change: +$${(amountCents / 100).toFixed(2)}

REASON: ${reason}
${documentation ? `\nADDITIONAL NOTES: ${documentation}` : ""}

PERFORMED BY: ${profile.email}
TIMESTAMP: ${new Date().toISOString()}

This recovery was performed because the original Stripe webhook failed to record 
the payment in the database. The payment was verified in Stripe and credited 
to the user's wallet.
    `.trim()

    // Log successful recovery to audit
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
        documentation: auditDocumentation,
        is_test_data: isTest,
        environment,
        idempotency_key: idempotencyKey,
        status: "completed",
        related_transaction_id: transaction.id,
        stripe_session_id: stripeSessionId,
      })

    return NextResponse.json({
      success: true,
      isTestMode: isTest,
      environment: environment,
      transaction: {
        id: transaction.id,
        amount_cents: amountCents,
        user_id: userId,
        user_email: targetUser.email || stripeCustomerEmail,
      },
      balanceChange: {
        previous: previousBalance,
        new: newBalance,
        change: amountCents,
      },
      auditTrail: {
        idempotencyKey,
        performedBy: profile.email,
        timestamp: new Date().toISOString(),
      },
      message: isTest 
        ? `[TEST MODE] Recovered $${(amountCents / 100).toFixed(2)} - marked as test data, no real financial impact`
        : `Successfully recovered $${(amountCents / 100).toFixed(2)} for ${targetUser.email}`
    })

  } catch (error) {
    console.error("Reconciliation recover error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
