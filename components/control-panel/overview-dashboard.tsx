"use client"

import Link from "next/link"
import { useFinancialRealtime } from "@/hooks/use-financial-realtime"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Shield,
  ArrowDownToLine,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  RefreshCw,
} from "lucide-react"
import { KPICard } from "./kpi-card"
import { FinancialChart } from "./financial-chart"
import { cn } from "@/lib/utils"

interface Transaction {
  id: string
  type: string
  amount_cents: number
  status: string
  description: string
  created_at: string
  environment: string
}

interface OverviewMetrics {
  totalDeposits: number
  liveDeposits: number
  testDeposits: number
  depositTrend: number
  walletTotal: number
  walletCount: number
  liveEscrowTotal: number
  testEscrowTotal: number
  escrowCount: number
  payoutTotal: number
  pendingWithdrawalsTotal: number
  pendingWithdrawalsCount: number
  platformFeesTotal: number
  recentTransactions: Transaction[]
}

export function OverviewDashboard({ metrics }: { metrics: OverviewMetrics }) {
  // Subscribe to real-time financial updates
  const { refresh } = useFinancialRealtime()

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100)
  }

  const formatCurrencyFull = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "deposit": return "text-emerald-400"
      case "withdrawal": return "text-red-400"
      case "entry_fee": return "text-blue-400"
      case "prize": return "text-purple-400"
      case "platform_fee": return "text-amber-400"
      case "reversal": return "text-orange-400"
      default: return "text-zinc-400"
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Completed</Badge>
      case "pending":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Pending</Badge>
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Failed</Badge>
      default:
        return <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KPICard
          title="Total Deposits"
          value={formatCurrency(metrics.totalDeposits)}
          subtitle="This month"
          trend={metrics.depositTrend}
          icon={DollarSign}
          variant="success"
        />
        <KPICard
          title="Wallet Balances"
          value={formatCurrency(metrics.walletTotal)}
          subtitle={`${metrics.walletCount} wallets`}
          icon={Wallet}
          variant="default"
        />
        <KPICard
          title="Active Escrow"
          value={formatCurrency(metrics.liveEscrowTotal)}
          subtitle={`${metrics.escrowCount} tournaments`}
          icon={Shield}
          variant="info"
        />
        <KPICard
          title="Total Payouts"
          value={formatCurrency(metrics.payoutTotal)}
          subtitle="All time"
          icon={ArrowUpRight}
          variant="default"
        />
        <KPICard
          title="Platform Revenue"
          value={formatCurrency(metrics.platformFeesTotal)}
          subtitle="This month"
          icon={TrendingUp}
          variant="purple"
        />
        <KPICard
          title="Pending Withdrawals"
          value={formatCurrency(metrics.pendingWithdrawalsTotal)}
          subtitle={`${metrics.pendingWithdrawalsCount} requests`}
          icon={Clock}
          variant={metrics.pendingWithdrawalsCount > 0 ? "warning" : "default"}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-zinc-100">Deposits Over Time</CardTitle>
              <CardDescription className="text-zinc-500">Daily deposit volume</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={refresh} className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <FinancialChart type="deposits" />
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-zinc-100">Balance Distribution</CardTitle>
              <CardDescription className="text-zinc-500">Wallet vs Escrow vs Stripe</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <FinancialChart type="distribution" metrics={metrics} />
          </CardContent>
        </Card>
      </div>

      {/* Live vs Test Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-emerald-400">Live Environment</CardTitle>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">PRODUCTION</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-zinc-500">Deposits</p>
                <p className="text-2xl font-bold text-emerald-400">{formatCurrency(metrics.liveDeposits)}</p>
              </div>
              <div>
                <p className="text-sm text-zinc-500">Escrow</p>
                <p className="text-2xl font-bold text-emerald-400">{formatCurrency(metrics.liveEscrowTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-amber-400">Test Environment</CardTitle>
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">SANDBOX</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-zinc-500">Deposits</p>
                <p className="text-2xl font-bold text-amber-400">{formatCurrency(metrics.testDeposits)}</p>
              </div>
              <div>
                <p className="text-sm text-zinc-500">Escrow</p>
                <p className="text-2xl font-bold text-amber-400">{formatCurrency(metrics.testEscrowTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-zinc-100">Recent Transactions</CardTitle>
              <CardDescription className="text-zinc-500">Latest financial activity</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700">
              <Link href="/dashboard/admin/control-panel/transactions">View All</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {metrics.recentTransactions.length > 0 ? (
            <div className="space-y-3">
              {metrics.recentTransactions.map((tx) => (
                <div 
                  key={tx.id} 
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      tx.type === "deposit" ? "bg-emerald-500/20" :
                      tx.type === "withdrawal" ? "bg-red-500/20" :
                      tx.type === "entry_fee" ? "bg-blue-500/20" :
                      tx.type === "prize" ? "bg-purple-500/20" :
                      "bg-zinc-700"
                    )}>
                      {tx.type === "deposit" ? <ArrowDownRight className={cn("h-5 w-5", getTypeColor(tx.type))} /> :
                       tx.type === "withdrawal" ? <ArrowUpRight className={cn("h-5 w-5", getTypeColor(tx.type))} /> :
                       <Activity className={cn("h-5 w-5", getTypeColor(tx.type))} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-zinc-100 capitalize">{tx.type.replace("_", " ")}</p>
                        {tx.environment === "test" && (
                          <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">TEST</Badge>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">{tx.description || "No description"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {getStatusBadge(tx.status)}
                    <div className="text-right">
                      <p className={cn(
                        "text-sm font-medium",
                        tx.type === "deposit" ? "text-emerald-400" :
                        tx.type === "withdrawal" || tx.type === "entry_fee" ? "text-red-400" :
                        "text-zinc-100"
                      )}>
                        {tx.type === "deposit" ? "+" : tx.type === "withdrawal" || tx.type === "entry_fee" ? "-" : ""}
                        {formatCurrencyFull(Math.abs(tx.amount_cents))}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
              <Activity className="h-12 w-12 mb-3" />
              <p>No recent transactions</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
