import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

type SimulationType = 
  | "wallet_corruption" 
  | "missing_payment" 
  | "lockdown_trigger" 
  | "risk_spike"
  | "escrow_mismatch"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  // Check admin access
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

  // Check chaos mode is enabled
  const { data: chaosControl } = await supabase
    .from("system_controls")
    .select("is_enabled")
    .eq("control_type", "chaos_mode_enabled")
    .single()

  if (!chaosControl?.is_enabled) {
    return NextResponse.json({ 
      error: "Chaos mode not enabled. Enable it first in System Controls." 
    }, { status: 400 })
  }

  const { type, params } = await request.json() as { 
    type: SimulationType
    params?: Record<string, unknown>
  }

  try {
    let result: Record<string, unknown>

    switch (type) {
      case "wallet_corruption": {
        // Temporarily corrupt a wallet balance
        const { data: wallet } = await supabase
          .from("wallets")
          .select("user_id, balance_cents")
          .limit(1)
          .single()

        if (!wallet) {
          return NextResponse.json({ error: "No wallets found" }, { status: 400 })
        }

        const corruptionAmount = (params?.amount as number) || 9999
        const originalBalance = wallet.balance_cents

        // Inject corruption
        await supabase
          .from("wallets")
          .update({ balance_cents: wallet.balance_cents + corruptionAmount })
          .eq("user_id", wallet.user_id)

        // Log to audit
        await supabase.from("reconciliation_audit_log").insert({
          action_type: "chaos_simulation",
          target_type: "wallet",
          target_id: wallet.user_id,
          performed_by: user.id,
          reason: `Chaos simulation: wallet corruption (+${corruptionAmount} cents)`,
          status: "active",
          amount_cents: corruptionAmount,
          previous_balance_cents: originalBalance,
          new_balance_cents: wallet.balance_cents + corruptionAmount,
        })

        result = {
          simulation: "wallet_corruption",
          wallet_id: wallet.user_id,
          original_balance: originalBalance,
          corrupted_balance: wallet.balance_cents + corruptionAmount,
          corruption_amount: corruptionAmount,
          note: "Run reconciliation to detect. Revert manually or via recovery."
        }
        break
      }

      case "missing_payment": {
        // Create a fake Stripe payment record that doesn't exist in DB
        const fakeSessionId = `cs_test_chaos_${Date.now()}`
        const amount = (params?.amount as number) || 5000

        // Log to system alerts
        await supabase.from("system_alerts").insert({
          alert_type: "integrity_failure",
          severity: "warning",
          source: "chaos_simulation",
          message: `Simulated missing payment: ${fakeSessionId}`,
          details: {
            chaos_test: true,
            session_id: fakeSessionId,
            amount_cents: amount,
            simulated_at: new Date().toISOString(),
          }
        })

        result = {
          simulation: "missing_payment",
          fake_session_id: fakeSessionId,
          amount_cents: amount,
          note: "Alert created. In real scenario, reconciliation would detect Stripe payment missing from DB."
        }
        break
      }

      case "lockdown_trigger": {
        // Trigger emergency lockdown
        const { data: lockdownResult } = await supabase.rpc("trigger_emergency_lockdown", {
          p_admin_id: user.id,
          p_reason: "Chaos simulation - testing lockdown enforcement"
        })

        result = {
          simulation: "lockdown_trigger",
          lockdown_active: true,
          result: lockdownResult,
          note: "System is now in lockdown. All financial operations blocked. Lift via System Controls."
        }
        break
      }

      case "risk_spike": {
        // Create multiple suspicious transactions
        const numTransactions = (params?.count as number) || 5
        const amountPerTx = (params?.amount as number) || -50000

        const transactions = Array(numTransactions).fill(null).map(() => ({
          user_id: user.id,
          type: "withdrawal",
          amount_cents: amountPerTx,
          status: "completed",
          description: "[CHAOS TEST] Simulated high-value withdrawal",
          environment: "test",
          is_test: true,
          created_at: new Date().toISOString(),
        }))

        await supabase.from("financial_transactions").insert(transactions)

        // Run risk check
        const { data: riskResult } = await supabase.rpc("check_risk_flags", {
          p_user_id: user.id
        })

        result = {
          simulation: "risk_spike",
          transactions_created: numTransactions,
          amount_per_transaction: amountPerTx,
          total_amount: numTransactions * amountPerTx,
          risk_flags: riskResult,
          note: "Risk patterns injected. Check risk detection dashboard."
        }
        break
      }

      case "escrow_mismatch": {
        // Create a test escrow with mismatched amounts
        const { data: tournament } = await supabase
          .from("tournaments")
          .select("id")
          .limit(1)
          .single()

        if (!tournament) {
          return NextResponse.json({ error: "No tournaments found" }, { status: 400 })
        }

        // Insert mismatched escrow
        const { data: escrow } = await supabase
          .from("escrow_accounts")
          .insert({
            tournament_id: tournament.id,
            status: "funded",
            funded_amount_cents: 10000,
            expected_amount_cents: 15000, // Intentional mismatch
            is_test: true,
          })
          .select()
          .single()

        result = {
          simulation: "escrow_mismatch",
          escrow_id: escrow?.id,
          funded: 10000,
          expected: 15000,
          mismatch: 5000,
          note: "Escrow created with intentional underfunding. Check escrow reconciliation."
        }
        break
      }

      default:
        return NextResponse.json({ error: "Unknown simulation type" }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      ...result,
      executed_by: user.id,
      executed_at: new Date().toISOString(),
    })

  } catch (error) {
    return NextResponse.json({ 
      error: "Simulation failed", 
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

// GET - list available simulations
export async function GET() {
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

  // Check if chaos mode is enabled
  const { data: chaosControl } = await supabase
    .from("system_controls")
    .select("is_enabled")
    .eq("control_type", "chaos_mode_enabled")
    .single()

  return NextResponse.json({
    chaos_enabled: chaosControl?.is_enabled || false,
    available_simulations: [
      {
        type: "wallet_corruption",
        name: "Wallet Corruption",
        description: "Inject balance corruption into a wallet to test reconciliation detection",
        params: { amount: { type: "number", default: 9999, description: "Amount to add (cents)" } }
      },
      {
        type: "missing_payment",
        name: "Missing Payment",
        description: "Simulate a Stripe payment that's missing from the database",
        params: { amount: { type: "number", default: 5000, description: "Payment amount (cents)" } }
      },
      {
        type: "lockdown_trigger",
        name: "Emergency Lockdown",
        description: "Trigger system-wide emergency lockdown",
        params: {}
      },
      {
        type: "risk_spike",
        name: "Risk Spike",
        description: "Create multiple suspicious transactions to trigger risk flags",
        params: { 
          count: { type: "number", default: 5, description: "Number of transactions" },
          amount: { type: "number", default: -50000, description: "Amount per transaction (cents)" }
        }
      },
      {
        type: "escrow_mismatch",
        name: "Escrow Mismatch",
        description: "Create an escrow with intentional underfunding",
        params: {}
      }
    ]
  })
}
