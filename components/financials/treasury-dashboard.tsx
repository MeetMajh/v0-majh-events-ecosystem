"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, ComposedChart, Bar
} from "recharts"
import { 
  Wallet, TrendingUp, TrendingDown, Shield, AlertTriangle, 
  RefreshCw, Settings, Activity, DollarSign, Clock
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface TreasuryDashboardProps {
  tenantId: string
}

export function TreasuryDashboard({ tenantId }: TreasuryDashboardProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchTreasuryData()
  }, [tenantId])

  const fetchTreasuryData = async () => {
    try {
      const { data: result, error } = await supabase.rpc("get_treasury_dashboard", {
        p_tenant_id: tenantId
      })
      if (error) throw error
      setData(result)
    } catch (error) {
      console.error("Error fetching treasury data:", error)
    } finally {
      setLoading(false)
    }
  }

  const captureSnapshot = async () => {
    setRefreshing(true)
    try {
      await supabase.rpc("capture_treasury_snapshot", { p_tenant_id: tenantId })
      await supabase.rpc("check_treasury_rules", { p_tenant_id: tenantId })
      await fetchTreasuryData()
    } catch (error) {
      console.error("Error capturing snapshot:", error)
    } finally {
      setRefreshing(false)
    }
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(cents / 100)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Loading treasury data...</p>
        </CardContent>
      </Card>
    )
  }

  const current = data?.current || {}
  const history = data?.history || []
  const rules = data?.rules || []
  const recentActions = data?.recent_actions || []

  const chartData = history.map((h: any) => ({
    date: new Date(h.snapshot_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    escrow: h.platform_escrow_cents / 100,
    reserve: h.platform_reserve_cents / 100,
    pending: h.pending_payouts_cents / 100,
    held: h.held_payouts_cents / 100,
    net: h.net_position_cents / 100,
    liquidity: h.liquidity_ratio
  })).reverse()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Treasury Dashboard</h2>
          <p className="text-muted-foreground">Real-time financial position and automated controls</p>
        </div>
        <Button onClick={captureSnapshot} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Capture Snapshot
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Wallet className="h-4 w-4" />
              <span className="text-sm">Escrow Balance</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(current.platform_escrow_cents || 0)}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Shield className="h-4 w-4" />
              <span className="text-sm">Reserve Balance</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(current.platform_reserve_cents || 0)}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Pending Payouts</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(current.pending_payouts_cents || 0)}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-sm">Liquidity Ratio</span>
            </div>
            <p className={`text-2xl font-bold ${
              (current.liquidity_ratio || 0) >= 2 ? "text-green-600" :
              (current.liquidity_ratio || 0) >= 1 ? "text-amber-600" : "text-red-600"
            }`}>
              {(current.liquidity_ratio || 0).toFixed(2)}x
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Net Position Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Net Financial Position</p>
              <p className={`text-4xl font-bold ${
                (current.net_position_cents || 0) >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                {formatCurrency(current.net_position_cents || 0)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                = Escrow + Reserve - Pending Payouts - Held Payouts
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Active Advances Outstanding</p>
              <p className="text-2xl font-semibold">{formatCurrency(current.active_advances_cents || 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="charts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="charts">Balance Charts</TabsTrigger>
          <TabsTrigger value="rules">Automation Rules</TabsTrigger>
          <TabsTrigger value="actions">Recent Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="charts" className="space-y-4">
          {/* Balance Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Balance History (30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `$${v / 1000}k`} />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                      contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="escrow" name="Escrow" fill="hsl(var(--primary))" fillOpacity={0.3} stroke="hsl(var(--primary))" />
                    <Area type="monotone" dataKey="reserve" name="Reserve" fill="hsl(142 76% 36%)" fillOpacity={0.3} stroke="hsl(142 76% 36%)" />
                    <Line type="monotone" dataKey="pending" name="Pending Payouts" stroke="hsl(38 92% 50%)" strokeWidth={2} />
                    <Line type="monotone" dataKey="net" name="Net Position" stroke="hsl(262 83% 58%)" strokeWidth={2} strokeDasharray="5 5" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">No historical data available yet</p>
              )}
            </CardContent>
          </Card>

          {/* Liquidity Ratio */}
          <Card>
            <CardHeader>
              <CardTitle>Liquidity Ratio Trend</CardTitle>
              <CardDescription>Assets / Liabilities ratio - target is 2.0x or higher</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis domain={[0, "auto"]} className="text-xs" tickFormatter={(v) => `${v}x`} />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(2)}x`, "Liquidity"]}
                      contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="liquidity" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))" }}
                    />
                    {/* Target line */}
                    <Line 
                      type="monotone" 
                      dataKey={() => 2} 
                      stroke="hsl(142 76% 36%)" 
                      strokeDasharray="5 5" 
                      strokeWidth={1}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">No historical data available yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>Treasury Automation Rules</CardTitle>
              <CardDescription>Configure automatic actions based on financial thresholds</CardDescription>
            </CardHeader>
            <CardContent>
              {rules.length > 0 ? (
                <div className="space-y-4">
                  {rules.map((rule: any) => (
                    <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Switch checked={rule.is_enabled} />
                        <div>
                          <p className="font-medium">{rule.rule_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {rule.rule_type}: {rule.threshold_value} {rule.threshold_unit}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={
                          rule.action_type === "hold_payouts" ? "destructive" :
                          rule.action_type === "alert" ? "secondary" : "default"
                        }>
                          {rule.action_type}
                        </Badge>
                        {rule.last_triggered_at && (
                          <span className="text-xs text-muted-foreground">
                            Last triggered {formatDistanceToNow(new Date(rule.last_triggered_at))} ago
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No treasury rules configured</p>
                  <p className="text-sm text-muted-foreground">Set up rules to automate treasury management</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <CardTitle>Recent Treasury Actions</CardTitle>
              <CardDescription>Actions triggered by rules or manual intervention</CardDescription>
            </CardHeader>
            <CardContent>
              {recentActions.length > 0 ? (
                <div className="space-y-3">
                  {recentActions.map((action: any) => (
                    <div key={action.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          action.status === "completed" ? "bg-green-500" :
                          action.status === "failed" ? "bg-red-500" :
                          action.status === "pending" ? "bg-amber-500" : "bg-gray-500"
                        }`} />
                        <div>
                          <p className="font-medium">{action.action_type}</p>
                          <p className="text-sm text-muted-foreground">
                            {action.rule_name ? `Triggered by: ${action.rule_name}` : `Triggered by: ${action.triggered_by}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">{action.status}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(action.created_at))} ago
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No recent actions</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
