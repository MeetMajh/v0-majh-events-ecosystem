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

    const { payoutId, processAll } = await req.json()

    if (!payoutId && !processAll) {
      return NextResponse.json({ error: "Payout ID or processAll flag is required" }, { status: 400 })
    }

    let payoutsToProcess: { id: string; user_id: string; amount_cents: number; tournament_id: string }[] = []

    if (processAll) {
      // Get all pending payouts
      const { data: pendingPayouts, error } = await supabase
        .from("tournament_payouts")
        .select("id, user_id, amount_cents, tournament_id")
        .eq("status", "pending")
        .limit(100)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      payoutsToProcess = pendingPayouts || []
    } else {
      // Get single payout
      const { data: payout, error } = await supabase
        .from("tournament_payouts")
        .select("id, user_id, amount_cents, tournament_id")
        .eq("id", payoutId)
        .eq("status", "pending")
        .single()

      if (error || !payout) {
        return NextResponse.json({ error: "Payout not found or not pending" }, { status: 404 })
      }

      payoutsToProcess = [payout]
    }

    if (payoutsToProcess.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: "No pending payouts to process",
        processed: 0 
      })
    }

    let processedCount = 0
    let totalAmount = 0

    for (const payout of payoutsToProcess) {
      // Add prize to user's wallet
      const { error: walletError } = await supabase
        .from("wallets")
        .upsert({
          user_id: payout.user_id,
          balance_cents: payout.amount_cents,
        }, {
          onConflict: "user_id",
        })

      // If upsert doesn't work as expected, try RPC or direct increment
      if (walletError) {
        // Try incrementing existing wallet
        await supabase.rpc("increment_wallet_balance", {
          p_user_id: payout.user_id,
          p_amount: payout.amount_cents
        }).catch(() => {
          // Fallback: create a prize transaction instead
          supabase.from("financial_transactions").insert({
            user_id: payout.user_id,
            type: "prize",
            amount_cents: payout.amount_cents,
            status: "completed",
            description: `Tournament payout`,
            tournament_id: payout.tournament_id,
          })
        })
      }

      // Mark payout as completed
      await supabase
        .from("tournament_payouts")
        .update({ 
          status: "completed",
          paid_at: new Date().toISOString()
        })
        .eq("id", payout.id)

      // Create financial transaction record
      await supabase
        .from("financial_transactions")
        .insert({
          user_id: payout.user_id,
          type: "prize",
          amount_cents: payout.amount_cents,
          status: "completed",
          description: `Tournament prize payout`,
          tournament_id: payout.tournament_id,
        })

      processedCount++
      totalAmount += payout.amount_cents
    }

    // Log to audit trail
    await supabase
      .from("reconciliation_audit_log")
      .insert({
        action_type: "payout",
        target_type: "tournament_payouts",
        target_id: processAll ? "batch" : payoutId,
        performed_by: user.id,
        amount_cents: totalAmount,
        reason: processAll ? `Batch processing ${processedCount} payouts` : "Manual payout processing",
        status: "completed",
      })

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${processedCount} payout(s)`,
      processed: processedCount,
      totalAmount
    })

  } catch (error) {
    console.error("Payout processing error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
