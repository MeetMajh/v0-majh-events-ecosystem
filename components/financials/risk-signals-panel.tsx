"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  AlertTriangle, 
  Shield, 
  TrendingUp, 
  Clock, 
  User,
  CheckCircle,
  XCircle,
  RefreshCw
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface RiskSignal {
  id: string
  user_id: string
  signal_type: string
  severity: "low" | "medium" | "high" | "critical"
  score_impact: number
  metadata: Record<string, unknown>
  resolved: boolean
  created_at: string
  user_display_name?: string
  user_email?: string
}

interface RiskSignalsStats {
  total: number
  critical: number
  high: number
  medium: number
  low: number
}

interface RiskSignalsPanelProps {
  tenantId: string
}

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  rapid_withdrawal: "Rapid Withdrawal",
  unusual_amount: "Unusual Amount",
  new_account_high_value: "New Account High Value",
  dispute_pattern: "Dispute Pattern",
  refund_pattern: "Refund Pattern",
  velocity_spike: "Velocity Spike",
  geographic_anomaly: "Geographic Anomaly",
  device_anomaly: "Device Anomaly",
  time_anomaly: "Time Anomaly",
  behavior_change: "Behavior Change",
  linked_account_risk: "Linked Account Risk"
}

const SEVERITY_CONFIG = {
  critical: { color: "bg-red-500", textColor: "text-red-700", icon: XCircle },
  high: { color: "bg-orange-500", textColor: "text-orange-700", icon: AlertTriangle },
  medium: { color: "bg-yellow-500", textColor: "text-yellow-700", icon: Clock },
  low: { color: "bg-blue-500", textColor: "text-blue-700", icon: Shield }
}

export function RiskSignalsPanel({ tenantId }: RiskSignalsPanelProps) {
  const [signals, setSignals] = useState<RiskSignal[]>([])
  const [stats, setStats] = useState<RiskSignalsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [showResolved, setShowResolved] = useState(false)
  const [resolving, setResolving] = useState<string | null>(null)
  
  const supabase = createClient()

  const loadSignals = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc("get_risk_signals", {
        p_tenant_id: tenantId,
        p_severity: severityFilter === "all" ? null : severityFilter,
        p_resolved: showResolved,
        p_limit: 50
      })

      if (error) throw error

      setSignals(data?.signals || [])
      setStats(data?.stats || null)
    } catch (err) {
      console.error("Failed to load risk signals:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tenantId) {
      loadSignals()
    }
  }, [tenantId, severityFilter, showResolved])

  const resolveSignal = async (signalId: string) => {
    setResolving(signalId)
    try {
      const { error } = await supabase
        .from("risk_signals")
        .update({ 
          resolved: true, 
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq("id", signalId)

      if (error) throw error
      await loadSignals()
    } catch (err) {
      console.error("Failed to resolve signal:", err)
    } finally {
      setResolving(null)
    }
  }

  if (loading && !signals.length) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Risk Signals
            </CardTitle>
            <CardDescription>
              Predictive risk detection and anomaly alerts
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadSignals}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-5 gap-2 mt-4">
            <div className="text-center p-2 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center p-2 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
              <div className="text-xs text-red-600">Critical</div>
            </div>
            <div className="text-center p-2 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{stats.high}</div>
              <div className="text-xs text-orange-600">High</div>
            </div>
            <div className="text-center p-2 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{stats.medium}</div>
              <div className="text-xs text-yellow-600">Medium</div>
            </div>
            <div className="text-center p-2 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.low}</div>
              <div className="text-xs text-blue-600">Low</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 mt-4">
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Switch 
              id="show-resolved" 
              checked={showResolved}
              onCheckedChange={setShowResolved}
            />
            <Label htmlFor="show-resolved" className="text-sm">
              Show Resolved
            </Label>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {signals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No risk signals detected</p>
          </div>
        ) : (
          <div className="space-y-3">
            {signals.map((signal) => {
              const config = SEVERITY_CONFIG[signal.severity]
              const Icon = config.icon

              return (
                <div
                  key={signal.id}
                  className={`p-4 rounded-lg border ${
                    signal.resolved ? "bg-muted/50 opacity-75" : "bg-background"
                  } ${signal.severity === "critical" && !signal.resolved ? "border-red-300 bg-red-50/50" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${config.color} bg-opacity-20`}>
                        <Icon className={`h-4 w-4 ${config.textColor}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {SIGNAL_TYPE_LABELS[signal.signal_type] || signal.signal_type}
                          </span>
                          <Badge variant={signal.severity === "critical" ? "destructive" : "secondary"}>
                            {signal.severity}
                          </Badge>
                          <Badge variant="outline">
                            +{signal.score_impact} risk
                          </Badge>
                          {signal.resolved && (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Resolved
                            </Badge>
                          )}
                        </div>
                        
                        {signal.user_display_name && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                            <User className="h-3 w-3" />
                            {signal.user_display_name}
                            {signal.user_email && (
                              <span className="text-xs">({signal.user_email})</span>
                            )}
                          </div>
                        )}

                        {signal.metadata && Object.keys(signal.metadata).length > 0 && (
                          <div className="mt-2 text-xs bg-muted p-2 rounded font-mono">
                            {Object.entries(signal.metadata).map(([key, value]) => (
                              <div key={key}>
                                <span className="text-muted-foreground">{key}:</span>{" "}
                                {typeof value === "number" && key.includes("cents")
                                  ? `$${(value / 100).toFixed(2)}`
                                  : String(value)}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground mt-2">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {formatDistanceToNow(new Date(signal.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>

                    {!signal.resolved && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveSignal(signal.id)}
                        disabled={resolving === signal.id}
                      >
                        {resolving === signal.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Resolve
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
