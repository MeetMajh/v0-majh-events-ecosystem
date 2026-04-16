"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Clock,
  ArrowUpCircle,
  Loader2,
  RefreshCw,
  Shield,
  FileText,
  User,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SystemAlert {
  id: string
  alert_type: string
  severity: "critical" | "warning" | "info"
  source: string
  message: string
  details: Record<string, unknown>
  created_at: string
  acknowledged_at: string | null
  acknowledged_by: string | null
  resolution_notes: string | null
}

interface AlertCounts {
  critical: number
  warning: number
  info: number
  total: number
}

export default function IncidentsPage() {
  const [alerts, setAlerts] = useState<SystemAlert[]>([])
  const [counts, setCounts] = useState<AlertCounts>({ critical: 0, warning: 0, info: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState("active")
  const [selectedAlert, setSelectedAlert] = useState<SystemAlert | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [notes, setNotes] = useState("")
  const supabase = createClient()

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/incidents?status=${activeTab}`)
      const data = await res.json()
      if (res.ok) {
        setAlerts(data.alerts || [])
        setCounts(data.counts || { critical: 0, warning: 0, info: 0, total: 0 })
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeTab])

  useEffect(() => {
    fetchAlerts()

    // Real-time subscription
    const channel = supabase
      .channel("incidents-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_alerts" }, fetchAlerts)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchAlerts])

  const handleAction = async (action: "acknowledge" | "escalate" | "create_incident") => {
    if (!selectedAlert) return
    setActionLoading(true)

    try {
      const res = await fetch("/api/admin/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertId: selectedAlert.id,
          action,
          notes: notes || undefined
        })
      })

      if (res.ok) {
        setSelectedAlert(null)
        setNotes("")
        await fetchAlerts()
      }
    } catch {
      // Error handling
    } finally {
      setActionLoading(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchAlerts()
  }

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case "critical":
        return {
          icon: AlertCircle,
          color: "text-red-400",
          bg: "bg-red-500/10",
          border: "border-red-500/30",
          badge: "bg-red-500/20 text-red-400 border-red-500/30"
        }
      case "warning":
        return {
          icon: AlertTriangle,
          color: "text-amber-400",
          bg: "bg-amber-500/10",
          border: "border-amber-500/30",
          badge: "bg-amber-500/20 text-amber-400 border-amber-500/30"
        }
      default:
        return {
          icon: Info,
          color: "text-blue-400",
          bg: "bg-blue-500/10",
          border: "border-blue-500/30",
          badge: "bg-blue-500/20 text-blue-400 border-blue-500/30"
        }
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString()
  }

  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Incident Response</h1>
          <p className="text-zinc-400 mt-1">
            Monitor, acknowledge, and respond to system alerts
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={refreshing}
          className="border-zinc-700 bg-zinc-800"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Alert Counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400">{counts.critical}</p>
                <p className="text-xs text-zinc-500">Critical</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-400">{counts.warning}</p>
                <p className="text-xs text-zinc-500">Warning</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Info className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-400">{counts.info}</p>
                <p className="text-xs text-zinc-500">Info</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-700">
                <Bell className="h-5 w-5 text-zinc-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-100">{counts.total}</p>
                <p className="text-xs text-zinc-500">Total Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts List */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-400" />
            System Alerts
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Real-time alerts from integrity monitoring, reconciliation, and risk detection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-zinc-800 border-zinc-700">
              <TabsTrigger value="active" className="data-[state=active]:bg-zinc-700">
                Active
                {counts.total > 0 && (
                  <Badge className="ml-2 bg-red-500/20 text-red-400 border-0">{counts.total}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="acknowledged" className="data-[state=active]:bg-zinc-700">
                Acknowledged
              </TabsTrigger>
              <TabsTrigger value="all" className="data-[state=active]:bg-zinc-700">
                All
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {alerts.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {alerts.map((alert) => {
                      const config = getSeverityConfig(alert.severity)
                      const Icon = config.icon

                      return (
                        <div
                          key={alert.id}
                          className={cn(
                            "p-4 rounded-lg border cursor-pointer transition-colors hover:bg-zinc-800/50",
                            config.border,
                            config.bg
                          )}
                          onClick={() => setSelectedAlert(alert)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <Icon className={cn("h-5 w-5 mt-0.5", config.color)} />
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={config.badge}>
                                    {alert.severity.toUpperCase()}
                                  </Badge>
                                  <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                                    {alert.alert_type.replace(/_/g, " ")}
                                  </Badge>
                                  {alert.acknowledged_at && (
                                    <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Resolved
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-zinc-200">{alert.message}</p>
                                <div className="flex items-center gap-4 text-xs text-zinc-500">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {getTimeAgo(alert.created_at)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    Source: {alert.source}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {!alert.acknowledged_at && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-zinc-700 text-zinc-400 hover:text-zinc-100"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedAlert(alert)
                                }}
                              >
                                Respond
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <CheckCircle className="h-12 w-12 mb-3 text-emerald-400/50" />
                  <p className="text-zinc-400">No {activeTab} alerts</p>
                  <p className="text-sm">All systems operating normally</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Alert Detail Dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={() => { setSelectedAlert(null); setNotes("") }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
          {selectedAlert && (
            <>
              <DialogHeader>
                <DialogTitle className="text-zinc-100 flex items-center gap-2">
                  {(() => {
                    const config = getSeverityConfig(selectedAlert.severity)
                    const Icon = config.icon
                    return <Icon className={cn("h-5 w-5", config.color)} />
                  })()}
                  Alert Details
                </DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Review and respond to this system alert
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Alert Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Type</p>
                    <Badge variant="outline" className="border-zinc-700">
                      {selectedAlert.alert_type.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Severity</p>
                    <Badge className={getSeverityConfig(selectedAlert.severity).badge}>
                      {selectedAlert.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Source</p>
                    <p className="text-sm text-zinc-200">{selectedAlert.source}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Created</p>
                    <p className="text-sm text-zinc-200">{formatDate(selectedAlert.created_at)}</p>
                  </div>
                </div>

                {/* Message */}
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Message</p>
                  <p className="text-sm text-zinc-200 p-3 rounded-lg bg-zinc-800 border border-zinc-700">
                    {selectedAlert.message}
                  </p>
                </div>

                {/* Details */}
                {selectedAlert.details && Object.keys(selectedAlert.details).length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Details</p>
                    <pre className="text-xs text-zinc-400 p-3 rounded-lg bg-zinc-800 border border-zinc-700 overflow-auto max-h-32">
                      {JSON.stringify(selectedAlert.details, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Resolution Status */}
                {selectedAlert.acknowledged_at && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                      <span className="text-sm font-medium text-emerald-400">Resolved</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Acknowledged at {formatDate(selectedAlert.acknowledged_at)}
                    </p>
                    {selectedAlert.resolution_notes && (
                      <p className="text-sm text-zinc-300 mt-2">{selectedAlert.resolution_notes}</p>
                    )}
                  </div>
                )}

                {/* Response Actions */}
                {!selectedAlert.acknowledged_at && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">Resolution Notes (optional)</p>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add notes about how this was resolved..."
                        className="bg-zinc-800 border-zinc-700 text-zinc-100"
                      />
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                {!selectedAlert.acknowledged_at ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handleAction("escalate")}
                      disabled={actionLoading || selectedAlert.severity === "critical"}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <ArrowUpCircle className="h-4 w-4 mr-2" />
                      Escalate
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleAction("create_incident")}
                      disabled={actionLoading}
                      className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Create Incident
                    </Button>
                    <Button
                      onClick={() => handleAction("acknowledge")}
                      disabled={actionLoading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Acknowledge
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setSelectedAlert(null)}
                    className="border-zinc-700"
                  >
                    Close
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
