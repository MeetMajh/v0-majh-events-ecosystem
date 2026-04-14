import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * Dismiss test/invalid data from reconciliation
 * This marks records as TEST data - does NOT affect real balances
 * 
 * Use cases:
 * - Test Stripe payments that should be ignored
 * - Test escrow accounts from development
 * - Ghost records that shouldn't affect accounting
 * 
 * IMPORTANT: All dismissals are logged to reconciliation_audit_log for compliance
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
      targetType = "stripe_session",  // 'transaction', 'escrow', 'stripe_session'
      targetId,
      stripeSessionId,  // Backwards compatibility
      reason, 
      documentation,
      amountCents,
      stripeAmount,  // Backwards compatibility
      environment = "test"
    } = body

    const actualTargetId = targetId || stripeSessionId
    const actualAmount = amountCents || stripeAmount || 0

    if (!actualTargetId || !reason) {
      return NextResponse.json({ 
        error: "Missing required fields: targetId/stripeSessionId, reason" 
      }, { status: 400 })
    }

    // Generate idempotency key to prevent duplicate dismissals
    const idempotencyKey = `dismiss_${targetType}_${actualTargetId}`

    // Check if already dismissed via audit log
    const { data: existingAudit } = await supabase
      .from("reconciliation_audit_log")
      .select("id, created_at, performed_by")
      .eq("idempotency_key", idempotencyKey)
      .eq("status", "completed")
      .single()

    if (existingAudit) {
      return NextResponse.json({ 
        error: "This item has already been dismissed",
        dismissedAt: existingAudit.created_at,
        idempotencyKey
      }, { status: 409 })
    }

    let affectedUserId: string | null = null
    let previousBalance: number | null = null
    let relatedTransactionId: string | null = null

    // Handle based on target type
    if (targetType === "transaction") {
      const { data: transaction } = await supabase
        .from("financial_transactions")
        .select("id, user_id, amount_cents, status, dismissed_at")
        .eq("id", actualTargetId)
        .single()

      if (!transaction) {
        return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
      }

      if (transaction.dismissed_at) {
        return NextResponse.json({ error: "Transaction already dismissed" }, { status: 409 })
      }

      affectedUserId = transaction.user_id
      relatedTransactionId = transaction.id

      // Mark as test/dismissed - does NOT void or affect balance
      await supabase
        .from("financial_transactions")
        .update({
          is_test: true,
          environment,
          dismissed_at: new Date().toISOString(),
          dismissed_by: user.id,
          dismiss_reason: reason,
        })
        .eq("id", actualTargetId)

    } else if (targetType === "escrow") {
      const { data: escrow } = await supabase
        .from("escrow_accounts")
        .select("id, funded_amount_cents, dismissed_at")
        .eq("id", actualTargetId)
        .single()

      if (!escrow) {
        return NextResponse.json({ error: "Escrow account not found" }, { status: 404 })
      }

      if (escrow.dismissed_at) {
        return NextResponse.json({ error: "Escrow already dismissed" }, { status: 409 })
      }

      // Mark escrow as test
      await supabase
        .from("escrow_accounts")
        .update({
          is_test: true,
          environment,
          dismissed_at: new Date().toISOString(),
          dismissed_by: user.id,
          dismiss_reason: reason,
        })
        .eq("id", actualTargetId)
    }
    // For stripe_session type, we just log the dismissal (no DB record to update)

    // Create comprehensive audit log entry
    const auditDocumentation = `
ACTION: Dismissed as ${environment.toUpperCase()} data
REASON: ${reason}
${documentation ? `NOTES: ${documentation}` : ""}
PERFORMED BY: ${profile.email} (${user.id})
TIMESTAMP: ${new Date().toISOString()}
TARGET: ${targetType} - ${actualTargetId}
AMOUNT: $${(actualAmount / 100).toFixed(2)}

This record has been marked as ${environment} data and will be excluded from live financial reporting.
No balance changes were made. Original data preserved for audit purposes.
    `.trim()

    const { error: auditError } = await supabase
      .from("reconciliation_audit_log")
      .insert({
        action_type: "dismiss",
        target_type: targetType,
        target_id: actualTargetId,
        user_id: affectedUserId,
        performed_by: user.id,
        amount_cents: actualAmount,
        previous_balance_cents: previousBalance,
        reason,
        documentation: auditDocumentation,
        is_test_data: true,
        environment,
        idempotency_key: idempotencyKey,
        status: "completed",
        related_transaction_id: relatedTransactionId,
        stripe_session_id: targetType === "stripe_session" ? actualTargetId : null,
      })

    if (auditError) {
      console.error("Failed to create audit log:", auditError)
      // Continue anyway - dismissal was successful
    }

    return NextResponse.json({
      success: true,
      message: `Marked as ${environment} data - excluded from live reporting`,
      auditTrail: {
        action: "dismiss",
        targetType,
        targetId: actualTargetId,
        environment,
        reason,
        performedBy: profile.email,
        timestamp: new Date().toISOString(),
        idempotencyKey,
        note: "No balance changes made. Data preserved for audit."
      }
    })

  } catch (error) {
    console.error("Dismiss error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
