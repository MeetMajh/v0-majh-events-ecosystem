"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Shield,
  AlertTriangle,
} from "lucide-react"
import { AdminPayoutQueue } from "@/components/financials/admin-payout-queue"
import { EscrowOverview } from "@/components/financials/escrow-overview"
import { PlatformRevenue } from "@/components/financials/platform-revenue"

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

  // Fetch financial metrics
  const [
    { data: totalPayments },
    { data: pendingPayouts },
    { data: activeEscrows },
    { data: platformFees },
    { data: recentTransactions },
    { data: alerts },
  ] = await Promise.all([
    // Total payments this month
    supabase
      .from("tournament_payments")
      .select("amount_cents")
      .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      .eq("status", "succeeded"),
    // Pending payouts
    supabase
      .from("player_payouts")
      .select("id, gross_amount_cents")
      .eq("status", "pending"),
    // Active escrows
    supabase
      .from("escrow_accounts")
      .select("id, funded_amount_cents")
      .in("status", ["funded", "partially_released"]),
    // Platform fees collected this month
    supabase
      .from("tournament_payments")
      .select("platform_fee_cents")
      .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      .eq("status", "succeeded"),
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
    // Urgent alerts
    supabase
      .from("financial_alerts")
      .select("id, alert_type, severity, title")
      .eq("is_read", false)
      .in("severity", ["error", "warning"])
      .limit(5),
  ])

  const totalPaymentsAmount = totalPayments?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0
  const pendingPayoutsAmount = pendingPayouts?.reduce((sum, p) => sum + (p.gross_amount_cents || 0), 0) || 0
  const activeEscrowsAmount = activeEscrows?.reduce((sum, e) => sum + (e.funded_amount_cents || 0), 0) || 0
  const platformFeesAmount = platformFees?.reduce((sum, f) => sum + (f.platform_fee_cents || 0), 0) || 0

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
        {alerts && alerts.length > 0 && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {alerts.length} Alert{alerts.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPaymentsAmount)}</div>
            <p className="flex items-center text-xs text-muted-foreground">
              <ArrowUpRight className="mr-1 h-3 w-3 text-emerald-500" />
              <span className="text-emerald-500">+12.5%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Fees</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(platformFeesAmount)}</div>
            <p className="text-xs text-muted-foreground">
              5% of total transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(pendingPayoutsAmount)}</div>
            <p className="text-xs text-muted-foreground">
              {pendingPayouts?.length || 0} payouts awaiting processing
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
