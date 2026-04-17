import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { amount_cents, payout_method_id, tenant_id } = body

    if (!amount_cents || amount_cents < 1000) {
      return NextResponse.json({ error: "Minimum withdrawal is $10.00" }, { status: 400 })
    }

    // Verify user is member of tenant
    const { data: membership } = await supabase
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Not authorized for this tenant" }, { status: 403 })
    }

    // Check available balance from ledger
    const { data: walletBalance } = await supabase
      .from("ledger_balances")
      .select("balance_cents")
      .eq("tenant_id", tenant_id)
      .eq("account_type", "user_wallet")
      .eq("reference_id", user.id)
      .single()

    const availableBalance = Number(walletBalance?.balance_cents || 0)

    if (amount_cents > availableBalance) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })
    }

    // Generate idempotency key
    const idempotencyKey = `withdrawal_${user.id}_${Date.now()}`

    // Call the ledger withdrawal function
    const { data: result, error } = await supabase.rpc("ledger_withdrawal", {
      p_tenant_id: tenant_id,
      p_user_id: user.id,
      p_amount_cents: amount_cents,
      p_payout_method_id: payout_method_id || null,
      p_idempotency_key: idempotencyKey,
    })

    if (error) {
      console.error("Ledger withdrawal error:", error)
      return NextResponse.json({ error: error.message || "Withdrawal failed" }, { status: 500 })
    }

    if (!result?.success) {
      return NextResponse.json({ error: result?.error || "Withdrawal failed" }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      transaction_id: result.transaction_id,
      message: "Withdrawal request submitted. Processing typically takes 1-3 business days.",
    })
  } catch (error) {
    console.error("Failed to process withdrawal:", error)
    return NextResponse.json({ error: "Failed to process withdrawal" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's tenant
    const { data: membership } = await supabase
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "No tenant found" }, { status: 404 })
    }

    // Get withdrawal history from ledger transactions
    const { data: withdrawals, error } = await supabase
      .from("ledger_transactions")
      .select(`
        id,
        transaction_type,
        description,
        status,
        created_at,
        ledger_entries (
          amount_cents,
          direction,
          ledger_accounts (
            account_type,
            reference_id
          )
        )
      `)
      .eq("tenant_id", membership.tenant_id)
      .eq("transaction_type", "withdrawal")
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) throw error

    return NextResponse.json({ withdrawals })
  } catch (error) {
    console.error("Failed to get withdrawals:", error)
    return NextResponse.json({ error: "Failed to get withdrawals" }, { status: 500 })
  }
}
