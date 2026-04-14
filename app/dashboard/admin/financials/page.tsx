"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  DollarSign, 
  TrendingUp, 
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Shield,
} from "lucide-react"
import { AdminPayoutQueue } from "@/components/financials/admin-payout-queue"
import { EscrowOverview } from "@/components/financials/escrow-overview"
import { PlatformRevenue } from "@/components/financials/platform-revenue"
import { AdminWalletCredit } from "@/components/financials/admin-wallet-credit"

export default async function AdminFinancialsPage() {
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

  // Fetch financial metrics from actual data tables
  const [
    { data: deposits },
    { data: entryFees },
    { data: pendingWithdrawals },
    { data: activeEscrows },
    { data: recentTransactions },
  ] = await Promise.all([
    // Total deposits this month (revenue in)
    supabase
      .from("financial_transactions")
      .select("amount_cents")
      .eq("type", "deposit")
      .eq("status", "completed")
      .gte("created_at", monthStart),
    // Total entry fees this month (platform revenue)
    supabase
      .from("financial_transactions")
      .select("amount_cents")
      .eq("type", "entry_fee")
      .eq("status", "completed")
      .gte("created_at", monthStart),
    // Pending withdrawals
    supabase
      .from("financial_transactions")
      .select("id, amount_cents")
      .eq("type", "withdrawal")
      .eq("status", "pending"),
    // Active escrows
    supabase
      .from("escrow_accounts")
      .select("id, funded_amount_cents, status")
      .neq("status", "released"),
    // Recent transactions
    supabase
      .from("financial_transactions")
      .select(`
        id,
        type,
        amount_cents,
        status,
        description,
        created_at
      `)
      .order("created_at", { ascending: false })
      .limit(10),
  ])

  // Calculate totals - entry fees are stored as negative, so we use Math.abs
  const totalDepositsAmount = deposits?.reduce((sum, d) => sum + Math.abs(d.amount_cents || 0), 0) || 0
  const totalEntryFeesAmount = entryFees?.reduce((sum, f) => sum + Math.abs(f.amount_cents || 0), 0) || 0
  const pendingWithdrawalsAmount = pendingWithdrawals?.reduce((sum, w) => sum + Math.abs(w.amount_cents || 0), 0) || 0
  const activeEscrowsAmount = activeEscrows?.reduce((sum, e) => sum + (e.funded_amount_cents || 0), 0) || 0
  
  // Platform fee is 5% of entry fees
  const platformFeesAmount = Math.round(totalEntryFeesAmount * 0.05)

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Financial Overview</h1>
          <p className="text-sm text-muted-foreground">
            Monitor platform revenue, payouts, and escrow accounts
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Deposits</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalDepositsAmount)}</div>
            <p className="flex items-center text-xs text-muted-foreground">
              {deposits?.length || 0} deposits this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entry Fees</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalEntryFeesAmount)}</div>
            <p className="text-xs text-muted-foreground">
              Platform fee: {formatCurrency(platformFeesAmount)} (5%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Withdrawals</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(pendingWithdrawalsAmount)}</div>
            <p className="text-xs text-muted-foreground">
              {pendingWithdrawals?.length || 0} withdrawals awaiting processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Escrow</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(activeEscrowsAmount)}</div>
            <p className="text-xs text-muted-foreground">
              {activeEscrows?.length || 0} tournaments in escrow
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Views */}
      <Tabs defaultValue="payouts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payouts" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Payout Queue
          </TabsTrigger>
          <TabsTrigger value="escrow" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Escrow Accounts
          </TabsTrigger>
          <TabsTrigger value="revenue" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="wallet-credit" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Manual Credit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payouts" className="space-y-4">
          <AdminPayoutQueue />
        </TabsContent>

        <TabsContent value="escrow" className="space-y-4">
          <EscrowOverview />
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <PlatformRevenue />
        </TabsContent>

        <TabsContent value="wallet-credit" className="space-y-4">
          <AdminWalletCredit />
        </TabsContent>
      </Tabs>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Latest financial activity across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          {recentTransactions && recentTransactions.length > 0 ? (
            <div className="space-y-4">
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
                      tx.type === "payment" ? "bg-emerald-100 text-emerald-600" :
                      tx.type === "payout" ? "bg-blue-100 text-blue-600" :
                      tx.type === "refund" ? "bg-red-100 text-red-600" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {tx.type === "payment" ? <ArrowDownRight className="h-4 w-4" /> :
                       tx.type === "payout" ? <ArrowUpRight className="h-4 w-4" /> :
                       <DollarSign className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground capitalize">{tx.type}</p>
                      <p className="text-xs text-muted-foreground">{tx.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${
                      tx.type === "payment" ? "text-emerald-600" : 
                      tx.type === "refund" ? "text-red-600" : 
                      "text-foreground"
                    }`}>
                      {tx.type === "payment" ? "+" : tx.type === "refund" ? "-" : ""}
                      {formatCurrency(tx.amount_cents)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">No recent transactions</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
