import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * GET /api/admin/financial-health
 * 
 * Returns comprehensive financial health metrics for the platform.
 * Used by the investor-grade dashboard to show system status.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Verify admin access
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

    // Try to use the RPC function first (if available)
    const { data: rpcHealth, error: rpcError } = await supabase.rpc("get_financial_health")
    
    if (!rpcError && rpcHealth) {
      return NextResponse.json({
        success: true,
        health: rpcHealth
      })
    }

    // Fallback: Calculate manually if RPC not available
    
    // 1. Total wallet balances (live only)
    const { data: wallets } = await supabase
      .from("wallets")
      .select("balance_cents")
    
    const walletTotal = wallets?.reduce((sum, w) => sum + (w.balance_cents || 0), 0) || 0

    // 2. Transaction-derived totals (live, completed)
    const { data: transactions } = await supabase
      .from("financial_transactions")
      .select("amount_cents, type, is_test")
      .eq("status", "completed")
    
    const liveTransactions = transactions?.filter(t => !t.is_test) || []
    const transactionTotal = liveTransactions.reduce((sum, t) => sum + (t.amount_cents || 0), 0)
    
    // Breakdown by type
    const deposits = liveTransactions.filter(t => t.type === "deposit").reduce((sum, t) => sum + t.amount_cents, 0)
    const entryFees = liveTransactions.filter(t => t.type === "entry_fee").reduce((sum, t) => sum + Math.abs(t.amount_cents), 0)
    const prizes = liveTransactions.filter(t => t.type === "prize").reduce((sum, t) => sum + t.amount_cents, 0)
    const withdrawals = liveTransactions.filter(t => t.type === "withdrawal").reduce((sum, t) => sum + Math.abs(t.amount_cents), 0)

    // 3. Escrow totals
    const { data: escrows } = await supabase
      .from("escrow_accounts")
      .select("funded_amount_cents, is_test, status")
      .not("status", "in", "(released,dismissed)")
    
    const liveEscrows = escrows?.filter(e => !e.is_test) || []
    const testEscrows = escrows?.filter(e => e.is_test) || []
    const escrowTotal = liveEscrows.reduce((sum, e) => sum + (e.funded_amount_cents || 0), 0)
    const testEscrowTotal = testEscrows.reduce((sum, e) => sum + (e.funded_amount_cents || 0), 0)

    // 4. Failed/pending transactions (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { data: failedTx, count: failedCount } = await supabase
      .from("financial_transactions")
      .select("id", { count: "exact" })
      .eq("status", "failed")
      .gte("created_at", thirtyDaysAgo.toISOString())

    const { data: pendingTx, count: pendingCount } = await supabase
      .from("financial_transactions")
      .select("id", { count: "exact" })
      .eq("status", "pending")

    // 5. Wallet mismatches (users where wallet != sum of transactions)
    // Simplified check - just compare totals
    const delta = walletTotal - transactionTotal

    // 6. Orphaned Stripe payments
    const { count: orphanedStripe } = await supabase
      .from("financial_transactions")
      .select("id", { count: "exact" })
      .not("stripe_session_id", "is", null)
      .eq("status", "pending")

    // 7. Calculate health score
    const issues = []
    if (Math.abs(delta) > 100) issues.push("wallet_mismatch")
    if ((failedCount || 0) > 0) issues.push("failed_transactions")
    if ((orphanedStripe || 0) > 0) issues.push("orphaned_payments")
    if (testEscrowTotal > 0) issues.push("test_escrow_present")

    const healthScore = Math.max(0, 100 - (issues.length * 10) - Math.min(30, Math.abs(delta) / 100))
    const isHealthy = issues.length === 0 && Math.abs(delta) < 100

    return NextResponse.json({
      success: true,
      health: {
        healthy: isHealthy,
        score: Math.round(healthScore),
        issues,
        
        // Core metrics
        walletTotal,
        transactionTotal,
        escrowTotal,
        delta,
        
        // Breakdown
        deposits,
        entryFees,
        prizes,
        withdrawals,
        
        // Test data (separate)
        testEscrowTotal,
        
        // Alerts
        failedCount: failedCount || 0,
        pendingCount: pendingCount || 0,
        orphanedStripe: orphanedStripe || 0,
        
        checkedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error("Financial health check error:", error)
    return NextResponse.json({ 
      success: false, 
      error: "Failed to check financial health" 
    }, { status: 500 })
  }
}
