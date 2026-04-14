import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
})

export async function GET() {
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

  try {
    // Get date range (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    // 1. Fetch recent Stripe checkout sessions (wallet deposits)
    const stripeSessions = await stripe.checkout.sessions.list({
      limit: 100,
      created: { gte: Math.floor(thirtyDaysAgo.getTime() / 1000) },
      expand: ["data.line_items"],
    })
    
    // Filter to wallet deposits only
    const stripeDeposits = stripeSessions.data.filter(
      session => session.metadata?.type === "wallet_deposit" && session.payment_status === "paid"
    )
    
    // 2. Fetch DB transactions (deposits)
    const { data: dbDeposits } = await supabase
      .from("financial_transactions")
      .select("id, user_id, amount_cents, stripe_session_id, stripe_payment_intent, stripe_event_id, created_at")
      .eq("type", "deposit")
      .eq("status", "completed")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false })
    
    // 3. Fetch all wallets with balances
    const { data: wallets } = await supabase
      .from("wallets")
      .select("user_id, balance_cents")
    
    // 4. Fetch all completed transactions for wallet integrity (exclude voided)
    const { data: allTransactions } = await supabase
      .from("financial_transactions")
      .select("user_id, amount_cents")
      .eq("status", "completed")
      .neq("status", "voided")
    
    // 5. Fetch escrow accounts (include test mode flags)
    const { data: escrows } = await supabase
      .from("escrow_accounts")
      .select("tournament_id, funded_amount_cents, status, is_test, environment, tournaments(title)")
      .neq("status", "released")
    
    // 6. Fetch tournament participants for escrow validation
    const { data: participants } = await supabase
      .from("tournament_participants")
      .select("tournament_id, entry_fee_paid")
    
    // Calculate metrics
    const totalStripeDeposits = stripeDeposits.reduce(
      (sum, s) => sum + (s.amount_total || 0), 0
    )
    
    const totalDbDeposits = dbDeposits?.reduce(
      (sum, d) => sum + (d.amount_cents || 0), 0
    ) || 0
    
    const totalWalletBalances = wallets?.reduce(
      (sum, w) => sum + (w.balance_cents || 0), 0
    ) || 0
    
    // Calculate expected wallet balances from transactions
    const txSums: Record<string, number> = {}
    allTransactions?.forEach(tx => {
      if (tx.user_id) {
        txSums[tx.user_id] = (txSums[tx.user_id] || 0) + (tx.amount_cents || 0)
      }
    })
    
    const totalCalculatedWallets = Object.values(txSums).reduce((sum, v) => sum + v, 0)
    
    // Find dismissed payments (voided deposit records with the stripe_session_id)
    const { data: dismissedPayments } = await supabase
      .from("financial_transactions")
      .select("stripe_session_id")
      .eq("status", "voided")
      .eq("type", "deposit")
      .not("stripe_session_id", "is", null)
    
    const dismissedSessionIds = new Set(dismissedPayments?.map(d => d.stripe_session_id) || [])
    
    // Find mismatches
    
    // A. Stripe payments missing from DB (exclude dismissed)
    const dbSessionIds = new Set(dbDeposits?.map(d => d.stripe_session_id) || [])
    const missingFromDb = stripeDeposits.filter(s => 
      !dbSessionIds.has(s.id) && !dismissedSessionIds.has(s.id)
    )
    
    // B. Wallet balance mismatches
    const walletMismatches = wallets?.filter(w => {
      const calculated = txSums[w.user_id] || 0
      return w.balance_cents !== calculated
    }).map(w => ({
      userId: w.user_id,
      walletBalance: w.balance_cents,
      calculatedBalance: txSums[w.user_id] || 0,
      delta: (txSums[w.user_id] || 0) - w.balance_cents
    })) || []
    
    // C. Escrow integrity
    const participantsByTournament: Record<string, number> = {}
    participants?.forEach(p => {
      if (p.entry_fee_paid) {
        participantsByTournament[p.tournament_id] = (participantsByTournament[p.tournament_id] || 0) + 1
      }
    })
    
    // Build reconciliation report
    const depositReconciliation = stripeDeposits.map(stripe => {
      const dbRecord = dbDeposits?.find(d => d.stripe_session_id === stripe.id)
      const isDismissed = dismissedSessionIds.has(stripe.id)
      
      let status: "matched" | "missing_db_record" | "amount_mismatch" | "dismissed" = "missing_db_record"
      if (isDismissed) {
        status = "dismissed"
      } else if (dbRecord) {
        status = dbRecord.amount_cents === stripe.amount_total ? "matched" : "amount_mismatch"
      }
      
      return {
        stripeId: stripe.id,
        stripeAmount: stripe.amount_total,
        stripeDate: new Date(stripe.created * 1000).toISOString(),
        stripeCustomerEmail: stripe.customer_email || stripe.customer_details?.email,
        stripePaymentIntent: stripe.payment_intent,
        userId: stripe.metadata?.user_id || null, // Pre-populated from checkout metadata
        dbRecordId: dbRecord?.id || null,
        dbAmount: dbRecord?.amount_cents || null,
        status
      }
    })
    
    // System health
    const systemHealth = {
      isHealthy: missingFromDb.length === 0 && walletMismatches.length === 0,
      stripeTotalCents: totalStripeDeposits,
      dbTotalCents: totalDbDeposits,
      walletsTotalCents: totalWalletBalances,
      calculatedWalletsTotalCents: totalCalculatedWallets,
      stripeDbDelta: totalStripeDeposits - totalDbDeposits,
      walletDelta: totalWalletBalances - totalCalculatedWallets,
      missingFromDbCount: missingFromDb.length,
      walletMismatchCount: walletMismatches.length,
    }
    
    return NextResponse.json({
      systemHealth,
      depositReconciliation,
      walletMismatches,
      escrows: escrows?.map(e => ({
        tournamentId: e.tournament_id,
        tournamentName: (e.tournaments as { title: string } | null)?.title || "Unknown",
        fundedAmount: e.funded_amount_cents,
        participantCount: participantsByTournament[e.tournament_id] || 0,
        status: e.status,
        // Detect test mode - check is_test column or infer from environment
        isTestMode: e.is_test || e.environment === "test" || false,
        environment: e.environment || (e.is_test ? "test" : "live")
      })) || [],
      summary: {
        totalStripePayments: stripeDeposits.length,
        totalDbRecords: dbDeposits?.length || 0,
        totalWallets: wallets?.length || 0,
        activeEscrows: escrows?.length || 0,
      }
    })
  } catch (error) {
    console.error("[Reconciliation API] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch reconciliation data" },
      { status: 500 }
    )
  }
}
