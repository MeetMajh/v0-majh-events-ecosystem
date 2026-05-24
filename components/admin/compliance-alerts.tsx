"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Search, 
  Filter, 
  AlertTriangle,
  ShieldAlert,
  Eye,
  CheckCircle2,
  Loader2,
  User,
  DollarSign,
  Flag,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

type ComplianceAlert = {
  id: string
  user_id: string | null
  alert_type: string
  severity: "low" | "medium" | "high" | "critical"
  title: string
  description: string | null
  status: "open" | "investigating" | "resolved" | "dismissed"
  metadata: Record<string, any>
  created_at: string
  resolved_at: string | null
  resolution_notes: string | null
  profiles: {
    username: string
    display_name: string
    email: string
  } | null
}

const alertTypeIcons: Record<string, typeof AlertTriangle> = {
  unusual_activity: AlertTriangle,
  high_value_transaction: DollarSign,
  multiple_accounts: User,
  suspicious_behavior: Flag,
  kyc_mismatch: ShieldAlert,
}

const severityColors: Record<string, string> = {
  low: "bg-blue-500/10 text-blue-500",
  medium: "bg-yellow-500/10 text-yellow-600",
  high: "bg-orange-500/10 text-orange-500",
  critical: "bg-red-500/10 text-red-500",
}

const statusColors: Record<string, string> = {
  open: "destructive",
  investigating: "secondary",
  resolved: "default",
  dismissed: "outline",
}

export function ComplianceAlerts() {
  const [statusFilter, setStatusFilter] = useState<string>("open")
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedAlert, setSelectedAlert] = useState<ComplianceAlert | null>(null)
  const [showResolutionDialog, setShowResolutionDialog] = useState(false)
  const [resolutionAction, setResolutionAction] = useState<"resolved" | "dismissed">("resolved")
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [processing, setProcessing] = useState(false)
  const { toast } = useToast()

  const { data, error, mutate } = useSWR<{ alerts: ComplianceAlert[] }>(
    `/api/admin/compliance/alerts?status=${statusFilter}&severity=${severityFilter}&search=${searchQuery}`,
    fetcher,
    { refreshInterval: 30000 }
  )

  const alerts = data?.alerts || []
  const isLoading = !data && !error

  const handleResolve = async () => {
    if (!selectedAlert) return
    
    setProcessing(true)
    try {
      const response = await fetch("/api/admin/compliance/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertId: selectedAlert.id,
          action: resolutionAction,
          notes: resolutionNotes,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error)

      toast({
        title: resolutionAction === "resolved" ? "Alert Resolved" : "Alert Dismissed",
        description: "The compliance alert has been updated.",
      })

      setShowResolutionDialog(false)
      setSelectedAlert(null)
      setResolutionNotes("")
      mutate()
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update alert",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleStatusChange = async (alertId: string, newStatus: string) => {
    try {
      const response = await fetch("/api/admin/compliance/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId, status: newStatus }),
      })

      if (!response.ok) throw new Error("Failed to update status")

      toast({
        title: "Status Updated",
        description: `Alert status changed to ${newStatus}`,
      })
      mutate()
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update alert status",
        variant: "destructive",
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Compliance Alerts
            </CardTitle>
            <CardDescription>Monitor and resolve flagged activities</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="w-[150px] pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-center">
            <CheckCircle2 className="mb-4 h-12 w-12 text-green-500/50" />
            <h3 className="text-lg font-medium">All Clear</h3>
            <p className="text-sm text-muted-foreground">
              No compliance alerts match the selected filters
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const AlertIcon = alertTypeIcons[alert.alert_type] || AlertTriangle
              return (
                <div
                  key={alert.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${severityColors[alert.severity]}`}>
                      <AlertIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-medium">{alert.title}</h4>
                        <Badge className={severityColors[alert.severity]} variant="outline">
                          {alert.severity}
                        </Badge>
                        <Badge variant={statusColors[alert.status] as any}>
                          {alert.status}
                        </Badge>
                      </div>
                      {alert.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                          {alert.description}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {alert.profiles && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {alert.profiles.display_name || alert.profiles.username}
                          </span>
                        )}
                        <span>{new Date(alert.created_at).toLocaleDateString()}</span>
                        <span className="capitalize">{alert.alert_type.replace("_", " ")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.status === "open" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(alert.id, "investigating")}
                      >
                        Investigate
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedAlert(alert)
                        setShowResolutionDialog(true)
                      }}
                    >
                      <Eye className="mr-1 h-4 w-4" />
                      Details
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Resolution Dialog */}
      <Dialog open={showResolutionDialog} onOpenChange={setShowResolutionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Alert Details</DialogTitle>
            <DialogDescription>{selectedAlert?.title}</DialogDescription>
          </DialogHeader>

          {selectedAlert && (
            <div className="space-y-4">
              {/* Alert Info */}
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium capitalize">{selectedAlert.alert_type.replace("_", " ")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Severity</span>
                    <Badge className={severityColors[selectedAlert.severity]} variant="outline">
                      {selectedAlert.severity}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={statusColors[selectedAlert.status] as any}>
                      {selectedAlert.status}
                    </Badge>
                  </div>
                  {selectedAlert.profiles && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">User</span>
                      <span className="font-medium">
                        {selectedAlert.profiles.display_name || selectedAlert.profiles.username}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{new Date(selectedAlert.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedAlert.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1 text-sm">{selectedAlert.description}</p>
                </div>
              )}

              {/* Metadata */}
              {selectedAlert.metadata && Object.keys(selectedAlert.metadata).length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Additional Details</Label>
                  <pre className="mt-1 overflow-auto rounded-lg bg-muted p-3 text-xs">
                    {JSON.stringify(selectedAlert.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Resolution */}
              {selectedAlert.status !== "resolved" && selectedAlert.status !== "dismissed" && (
                <>
                  <div className="space-y-2">
                    <Label>Resolution Action</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={resolutionAction === "resolved" ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setResolutionAction("resolved")}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Resolve
                      </Button>
                      <Button
                        variant={resolutionAction === "dismissed" ? "secondary" : "outline"}
                        className="flex-1"
                        onClick={() => setResolutionAction("dismissed")}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="resolution-notes">Resolution Notes</Label>
                    <Textarea
                      id="resolution-notes"
                      placeholder="Add notes about the resolution..."
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* Already Resolved */}
              {selectedAlert.resolution_notes && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="text-sm font-medium text-green-700">Resolution Notes</p>
                  <p className="mt-1 text-sm text-green-600">{selectedAlert.resolution_notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolutionDialog(false)}>
              Close
            </Button>
            {selectedAlert?.status !== "resolved" && selectedAlert?.status !== "dismissed" && (
              <Button onClick={handleResolve} disabled={!resolutionNotes || processing}>
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {resolutionAction === "resolved" ? "Resolve Alert" : "Dismiss Alert"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
