"use client"

import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, DollarSign, TrendingUp, AlertTriangle, Shield, Clock, Wallet, Ban, Scale } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

const fetcher = async () => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  
  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single()
  if (!profile?.tenant_id) throw new Error("No tenant")
  
  const { data, error } = await supabase.rpc("get_admin_financial_kpis", {
    p_tenant_id: profile.tenant_id,
  })
  
  if (error) throw error
  return data
}

export function AdminFinancialKpis() {
  const { data, error, isLoading } = useSWR("admin-financial-kpis", fetcher, { refreshInterval: 60000 })

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(cents / 100)
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="col-span-full">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-destructive">Failed to load financial KPIs</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* GMV */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gross Volume (GMV)</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(data.gmv_cents || 0)}</div>
          <p className="text-xs text-muted-foreground">Total payment volume this period</p>
        </CardContent>
      </Card>

      {/* Platform Revenue */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Platform Revenue</CardTitle>
          <TrendingUp className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600">{formatCurrency(data.platform_revenue_cents || 0)}</div>
          <p className="text-xs text-muted-foreground">
            Net: {formatCurrency(data.net_revenue_cents || 0)}
          </p>
        </CardContent>
      </Card>

      {/* Refunds */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Refunds</CardTitle>
          <Ban className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">{formatCurrency(data.refunds_cents || 0)}</div>
          <p className="text-xs text-muted-foreground">Total refunds issued</p>
        </CardContent>
      </Card>

      {/* Dispute Losses */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Dispute Losses</CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{formatCurrency(data.dispute_losses_cents || 0)}</div>
          <p className="text-xs text-muted-foreground">Lost chargebacks</p>
        </CardContent>
      </Card>

      {/* Escrow Balance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Escrow Balance</CardTitle>
          <Shield className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{formatCurrency(data.escrow_balance_cents || 0)}</div>
          <p className="text-xs text-muted-foreground">Funds held in escrow</p>
        </CardContent>
      </Card>

      {/* Pending Payouts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
          <Wallet className="h-4 w-4 text-purple-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">{formatCurrency(data.pending_payouts?.amount_cents || 0)}</div>
          <p className="text-xs text-muted-foreground">{data.pending_payouts?.count || 0} payouts queued</p>
        </CardContent>
      </Card>

      {/* Active Holds */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Holds</CardTitle>
          <Clock className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">{formatCurrency(data.active_holds?.amount_cents || 0)}</div>
          <p className="text-xs text-muted-foreground">{data.active_holds?.count || 0} payouts on hold</p>
        </CardContent>
      </Card>

      {/* Disputes at Risk */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Disputes at Risk</CardTitle>
          <Scale className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{formatCurrency(data.disputes_at_risk?.amount_cents || 0)}</div>
          <p className="text-xs text-muted-foreground">{data.disputes_at_risk?.count || 0} active disputes</p>
        </CardContent>
      </Card>
    </div>
  )
}
