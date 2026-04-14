import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check admin/staff access
    const { data: staffRole } = await supabase
      .from("staff_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["owner", "manager"])
      .single()

    if (!staffRole) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { withdrawalId, reason } = await req.json()

    if (!withdrawalId) {
      return NextResponse.json({ error: "Withdrawal ID is required" }, { status: 400 })
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 })
    }

    // Get the withdrawal
    const { data: withdrawal, error: fetchError } = await supabase
      .from("financial_transactions")
      .select("*")
      .eq("id", withdrawalId)
      .eq("type", "withdrawal")
      .eq("status", "pending")
      .single()

    if (fetchError || !withdrawal) {
      return NextResponse.json({ error: "Withdrawal not found or not pending" }, { status: 404 })
    }

    // Mark as failed/rejected
    const { error: updateError } = await supabase
      .from("financial_transactions")
      .update({ 
        status: "failed",
        description: `Rejected: ${reason.trim()}`
      })
      .eq("id", withdrawalId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Return funds to wallet (withdrawal amounts are negative)
    const amountToReturn = Math.abs(withdrawal.amount_cents)
    
    const { error: walletError } = await supabase.rpc("adjust_wallet_balance", {
      p_user_id: withdrawal.user_id,
      p_amount_cents: amountToReturn,
      p_reason: `Withdrawal rejected: ${reason.trim()}`
    })

    // If RPC doesn't exist, do direct update
    if (walletError) {
      await supabase
        .from("wallets")
        .update({ 
          balance_cents: supabase.rpc("add_cents", { 
            current: supabase.sql`balance_cents`, 
            add: amountToReturn 
          })
        })
        .eq("user_id", withdrawal.user_id)
    }

    // Log to audit trail
    await supabase
      .from("reconciliation_audit_log")
      .insert({
        action_type: "withdrawal_rejected",
        target_type: "transaction",
        target_id: withdrawalId,
        user_id: withdrawal.user_id,
        performed_by: user.id,
        amount_cents: withdrawal.amount_cents,
        reason: reason.trim(),
        status: "completed",
      })

    return NextResponse.json({
      success: true,
      message: "Withdrawal rejected and funds returned to wallet"
    })

  } catch (error) {
    console.error("Withdrawal rejection error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
