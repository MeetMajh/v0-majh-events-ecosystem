import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

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
    const { stripeSessionId, userId, amountCents, stripeCustomerEmail } = body

    if (!stripeSessionId || !userId || !amountCents) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Check if transaction already exists (idempotency)
    const { data: existing } = await supabase
      .from("financial_transactions")
      .select("id")
      .eq("stripe_session_id", stripeSessionId)
      .single()

    if (existing) {
      return NextResponse.json({ 
        error: "Transaction already exists for this Stripe session",
        existingId: existing.id 
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

    // Create the transaction record
    const { data: transaction, error: txError } = await supabase
      .from("financial_transactions")
      .insert({
        user_id: userId,
        amount_cents: amountCents,
        type: "deposit",
        status: "completed",
        description: `Recovered Stripe deposit (admin reconciliation)`,
        stripe_session_id: stripeSessionId,
      })
      .select()
      .single()

    if (txError) {
      return NextResponse.json({ error: `Failed to create transaction: ${txError.message}` }, { status: 500 })
    }

    // Update wallet balance
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance_cents")
      .eq("user_id", userId)
      .single()

    if (wallet) {
      await supabase
        .from("wallets")
        .update({ 
          balance_cents: wallet.balance_cents + amountCents,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId)
    } else {
      // Create wallet if doesn't exist
      await supabase
        .from("wallets")
        .insert({ 
          user_id: userId, 
          balance_cents: amountCents 
        })
    }

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        amount_cents: amountCents,
        user_id: userId,
        user_email: targetUser.email || stripeCustomerEmail,
      },
      message: `Successfully recovered $${(amountCents / 100).toFixed(2)} deposit for user`
    })

  } catch (error) {
    console.error("Reconciliation recover error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
