import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * Dismiss a Stripe payment from reconciliation
 * Used for test payments, invalid charges, or payments that shouldn't be recovered
 * Creates a record in a dismissed_stripe_payments table for audit trail
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
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { stripeSessionId, reason, stripeAmount } = body

    if (!stripeSessionId || !reason) {
      return NextResponse.json({ error: "Missing required fields: stripeSessionId, reason" }, { status: 400 })
    }

    // Check if already dismissed
    const { data: existing } = await supabase
      .from("dismissed_stripe_payments")
      .select("id")
      .eq("stripe_session_id", stripeSessionId)
      .single()

    if (existing) {
      return NextResponse.json({ 
        error: "This payment has already been dismissed",
        existingId: existing.id 
      }, { status: 409 })
    }

    // Create dismissed record
    const { data: dismissedRecord, error: insertError } = await supabase
      .from("dismissed_stripe_payments")
      .insert({
        stripe_session_id: stripeSessionId,
        amount_cents: stripeAmount || 0,
        reason,
        dismissed_by: user.id,
        dismissed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      // Table might not exist, create a simpler fallback - record in financial_transactions as voided
      const { error: fallbackError } = await supabase
        .from("financial_transactions")
        .insert({
          user_id: user.id, // Admin who dismissed it
          amount_cents: 0, // No actual amount credited
          type: "deposit",
          status: "voided",
          description: `Dismissed Stripe payment: ${reason}`,
          stripe_session_id: stripeSessionId,
          void_reason: reason,
          voided_by: user.id,
          voided_at: new Date().toISOString(),
        })

      if (fallbackError) {
        return NextResponse.json({ 
          error: `Failed to dismiss payment: ${fallbackError.message}` 
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        method: "fallback_voided_record",
        message: `Payment dismissed: ${reason}`
      })
    }

    return NextResponse.json({
      success: true,
      dismissedId: dismissedRecord.id,
      message: `Payment dismissed: ${reason}`
    })

  } catch (error) {
    console.error("Dismiss payment error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
