"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  RefreshCw,
  ExternalLink,
  Clock,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

interface Alert {
  id: string
  alert_type: string
  severity: "info" | "warning" | "critical"
  title: string
  message: string | null
  resource_type: string | null
  resource_id: string | null
  metadata: Record<string, unknown>
  delivery_status: string
  created_at: string
  acknowledged: boolean
}

interface AlertCounts {
  critical: number
  warning: number
  info: number
  total: number
}

interface RealtimeAlertsPanelProps {
  tenantId: string
}

const severityConfig = {
  critical: {
    icon: AlertTriangle,
    color: "text-red-600",
    bgColor: "bg-red-50 border-red-200",
    badgeVariant: "destructive" as const,
  },
  warning: {
    icon: AlertCircle,
    color: "text-amber-600",
    bgColor: "bg-amber-50 border-amber-200",
    badgeVariant: "secondary" as const,
  },
  info: {
    icon: Info,
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200",
    badgeVariant: "outline" as const,
  },
}

const alertTypeLabels: Record<string, string> = {
  dispute_created: "Dispute Created",
  dispute_lost: "Dispute Lost",
  high_fraud_score: "High Fraud Score",
  large_payout: "Large Payout",
  payout_failed: "Payout Failed",
  refund_requested: "Refund Requested",
  hold_triggered: "Hold Triggered",
  reconciliation_failed: "Reconciliation Failed",
  daily_summary: "Daily Summary",
}

export function RealtimeAlertsPanel({ tenantId }: RealtimeAlertsPanelProps) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [counts, setCounts] = useState<AlertCounts>({
    critical: 0,
    warning: 0,
    info: 0,
    total: 0,
  })
  const [loading, setLoading] = useState(true)
  const [acknowledging, setAcknowledging] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "info">(
    "all"
  )

  const supabase = createClient()

  const fetchAlerts = useCallback(async () => {
    if (!tenantId) return

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc("get_active_alerts", {
        p_tenant_id: tenantId,
        p_severity: filter === "all" ? null : filter,
        p_limit: 50,
      })

      if (error) throw error

      setAlerts(data?.alerts || [])
      setCounts(
        data?.counts || { critical: 0, warning: 0, info: 0, total: 0 }
      )
    } catch (err) {
      console.error("Error fetching alerts:", err)
    } finally {
      setLoading(false)
    }
  }, [tenantId, filter, supabase])

  useEffect(() => {
    fetchAlerts()

    // Set up real-time subscription
    const channel = supabase
      .channel("alert_history_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alert_history",
        },
        (payload) => {
          // Add new alert to the top of the list
          const newAlert = payload.new as Alert
          setAlerts((prev) => [newAlert, ...prev].slice(0, 50))
          setCounts((prev) => ({
            ...prev,
            [newAlert.severity]: prev[newAlert.severity] + 1,
            total: prev.total + 1,
          }))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAlerts, supabase])

  const acknowledgeAlert = async (alertId: string) => {
    setAcknowledging(alertId)
    try {
      const { error } = await supabase.rpc("acknowledge_alert", {
        p_alert_id: alertId,
      })

      if (error) throw error

      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
      )
      setCounts((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
      }))
    } catch (err) {
      console.error("Error acknowledging alert:", err)
    } finally {
      setAcknowledging(null)
    }
  }

  const acknowledgeAll = async () => {
    try {
      const { error } = await supabase.rpc("acknowledge_all_alerts", {
        p_tenant_id: tenantId,
        p_severity: filter === "all" ? null : filter,
      })

      if (error) throw error

      fetchAlerts()
    } catch (err) {
      console.error("Error acknowledging all alerts:", err)
    }
  }

  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged)
  const acknowledgedAlerts = alerts.filter((a) => a.acknowledged)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className="h-5 w-5" />
              {counts.total > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-600 text-[10px] font-bold text-white flex items-center justify-center">
                  {counts.total > 9 ? "9+" : counts.total}
                </span>
              )}
            </div>
            <div>
              <CardTitle>Real-Time Alerts</CardTitle>
              <CardDescription>
                Live financial alerts and notifications
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAlerts}
              disabled={loading}
            >
              <RefreshCw
                className={cn("h-4 w-4 mr-1", loading && "animate-spin")}
              />
              Refresh
            </Button>
            {unacknowledgedAlerts.length > 0 && (
              <Button variant="outline" size="sm" onClick={acknowledgeAll}>
                <CheckCheck className="h-4 w-4 mr-1" />
                Ack All
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Severity Counts */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            className="justify-start"
          >
            <Bell className="h-4 w-4 mr-2" />
            All ({counts.total})
          </Button>
          <Button
            variant={filter === "critical" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("critical")}
            className="justify-start text-red-600"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Critical ({counts.critical})
          </Button>
          <Button
            variant={filter === "warning" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("warning")}
            className="justify-start text-amber-600"
          >
            <AlertCircle className="h-4 w-4 mr-2" />
            Warning ({counts.warning})
          </Button>
          <Button
            variant={filter === "info" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("info")}
            className="justify-start text-blue-600"
          >
            <Info className="h-4 w-4 mr-2" />
            Info ({counts.info})
          </Button>
        </div>

        {/* Alert List */}
        <ScrollArea className="h-[500px]">
          {loading && alerts.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              Loading alerts...
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <BellOff className="h-8 w-8 mb-2" />
              <p>No alerts to display</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Unacknowledged Alerts */}
              {unacknowledgedAlerts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Active ({unacknowledgedAlerts.length})
                  </h4>
                  {unacknowledgedAlerts.map((alert) => {
                    const config = severityConfig[alert.severity]
                    const Icon = config.icon

                    return (
                      <div
                        key={alert.id}
                        className={cn(
                          "p-3 rounded-lg border transition-colors",
                          config.bgColor
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <Icon className={cn("h-5 w-5 mt-0.5", config.color)} />
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{alert.title}</span>
                                <Badge variant={config.badgeVariant} className="text-xs">
                                  {alert.severity}
                                </Badge>
                              </div>
                              {alert.message && (
                                <p className="text-sm text-muted-foreground">
                                  {alert.message}
                                </p>
                              )}
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(alert.created_at), {
                                    addSuffix: true,
                                  })}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {alertTypeLabels[alert.alert_type] || alert.alert_type}
                                </Badge>
                                {alert.resource_type && (
                                  <span className="flex items-center gap-1">
                                    <ExternalLink className="h-3 w-3" />
                                    {alert.resource_type}
                                  </span>
                                )}
                              </div>
                              {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                                <div className="mt-2 p-2 bg-background/50 rounded text-xs font-mono">
                                  {alert.metadata.amount_cents && (
                                    <span className="mr-3">
                                      Amount: ${(Number(alert.metadata.amount_cents) / 100).toFixed(2)}
                                    </span>
                                  )}
                                  {alert.metadata.fraud_score && (
                                    <span className="mr-3">
                                      Fraud Score: {String(alert.metadata.fraud_score)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => acknowledgeAlert(alert.id)}
                            disabled={acknowledging === alert.id}
                          >
                            {acknowledging === alert.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Acknowledged Alerts */}
              {acknowledgedAlerts.length > 0 && (
                <div className="space-y-2 opacity-60">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Acknowledged ({acknowledgedAlerts.length})
                  </h4>
                  {acknowledgedAlerts.map((alert) => {
                    const config = severityConfig[alert.severity]
                    const Icon = config.icon

                    return (
                      <div
                        key={alert.id}
                        className="p-3 rounded-lg border bg-muted/30"
                      >
                        <div className="flex items-start gap-3">
                          <Icon className={cn("h-5 w-5 mt-0.5", config.color)} />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium line-through">
                                {alert.title}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                Acknowledged
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>
                                {formatDistanceToNow(new Date(alert.created_at), {
                                  addSuffix: true,
                                })}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {alertTypeLabels[alert.alert_type] || alert.alert_type}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
