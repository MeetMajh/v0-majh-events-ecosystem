import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { OverviewDashboard } from "@/components/control-panel/overview-dashboard"

export default async function ControlPanelOverviewPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Check admin/staff access
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["owner", "manager"])
    .single()

  if (!staffRole) redirect("/dashboard")

  // Get first day of current month
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const prevMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString()

  // Fetch comprehensive financial data
  const [
    { data: deposits },
    { data: prevDeposits },
    { data: wallets },
    { data: escrows },
    { data: payouts },
    { data: pendingWithdrawals },
    { data: platformFees },
    { data: recentTransactions },
  ] = await Promise.all([
    // Current month deposits
    supabase
      .from("financial_transactions")
      .select("amount_cents, environment")
      .eq("type", "deposit")
      .eq("status", "completed")
      .gte("created_at", monthStart),
    // Previous month deposits (for trend)
    supabase
      .from("financial_transactions")
      .select("amount_cents")
      .eq("type", "deposit")
      .eq("status", "completed")
      .gte("created_at", prevMonthStart)
      .lt("created_at", monthStart),
    // Total wallet balances
    supabase
      .from("wallets")
      .select("balance_cents"),
    // Active escrows
    supabase
      .from("escrow_accounts")
      .select("funded_amount_cents, status, is_test")
      .neq("status", "released"),
    // Total payouts
    supabase
      .from("tournament_payouts")
      .select("amount_cents")
      .eq("status", "completed"),
    // Pending withdrawals
    supabase
      .from("financial_transactions")
      .select("id, amount_cents")
      .eq("type", "withdrawal")
      .eq("status", "pending"),
    // Platform fees
    supabase
      .from("financial_transactions")
      .select("amount_cents")
      .eq("type", "platform_fee")
      .eq("status", "completed")
      .gte("created_at", monthStart),
    // Recent transactions
    supabase
      .from("financial_transactions")
      .select("id, type, amount_cents, status, description, created_at, environment")
      .order("created_at", { ascending: false })
      .limit(10),
  ])

  // Calculate totals
  const liveDeposits = deposits?.filter(d => d.environment === "live").reduce((sum, d) => sum + Math.abs(d.amount_cents || 0), 0) || 0
  const testDeposits = deposits?.filter(d => d.environment === "test").reduce((sum, d) => sum + Math.abs(d.amount_cents || 0), 0) || 0
  const totalDeposits = deposits?.reduce((sum, d) => sum + Math.abs(d.amount_cents || 0), 0) || 0
  const prevTotalDeposits = prevDeposits?.reduce((sum, d) => sum + Math.abs(d.amount_cents || 0), 0) || 0
  const depositTrend = prevTotalDeposits > 0 ? ((totalDeposits - prevTotalDeposits) / prevTotalDeposits) * 100 : 0

  const walletTotal = wallets?.reduce((sum, w) => sum + (w.balance_cents || 0), 0) || 0
  const liveEscrowTotal = escrows?.filter(e => !e.is_test).reduce((sum, e) => sum + (e.funded_amount_cents || 0), 0) || 0
  const testEscrowTotal = escrows?.filter(e => e.is_test).reduce((sum, e) => sum + (e.funded_amount_cents || 0), 0) || 0
  const payoutTotal = payouts?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0
  const pendingWithdrawalsTotal = pendingWithdrawals?.reduce((sum, w) => sum + Math.abs(w.amount_cents || 0), 0) || 0
  const platformFeesTotal = platformFees?.reduce((sum, f) => sum + (f.amount_cents || 0), 0) || 0

  const metrics = {
    totalDeposits,
    liveDeposits,
    testDeposits,
    depositTrend,
    walletTotal,
    walletCount: wallets?.length || 0,
    liveEscrowTotal,
    testEscrowTotal,
    escrowCount: escrows?.length || 0,
    payoutTotal,
    pendingWithdrawalsTotal,
    pendingWithdrawalsCount: pendingWithdrawals?.length || 0,
    platformFeesTotal,
    recentTransactions: recentTransactions || [],
  }

  return <OverviewDashboard metrics={metrics} />
}
