"use client"

import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { 
  Loader2, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  FileText,
  DollarSign,
  Shield,
  UserCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface AuditLogEntry {
  id: string
  user_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  user_display_name: string | null
  user_email: string | null
  user_avatar_url: string | null
}

const fetcher = async ([, tenantId, filters]: [string, string, Record<string, unknown>]) => {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_audit_log", {
    p_tenant_id: tenantId,
    p_action_filter: filters.action || null,
    p_resource_type_filter: filters.resourceType || null,
    p_start_date: filters.startDate || null,
    p_end_date: filters.endDate || null,
    p_limit: 50,
    p_offset: (filters.page as number || 0) * 50,
  })
  if (error) throw error
  return data
}

const actionsFetcher = async ([, tenantId]: [string, string]) => {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_audit_log_actions", {
    p_tenant_id: tenantId,
  })
  if (error) throw error
  return data
}

const resourceTypesFetcher = async ([, tenantId]: [string, string]) => {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_audit_log_resource_types", {
    p_tenant_id: tenantId,
  })
  if (error) throw error
  return data
}

export function AdminAuditLog({ tenantId }: { tenantId: string }) {
  const [actionFilter, setActionFilter] = useState<string>("")
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(0)
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)

  const filters = {
    action: actionFilter || null,
    resourceType: resourceTypeFilter || null,
    startDate: dateRange.from?.toISOString() || null,
    endDate: dateRange.to?.toISOString() || null,
    page,
  }

  const { data, error, isLoading, mutate } = useSWR(
    ["audit_log", tenantId, filters],
    fetcher,
    { refreshInterval: 30000 }
  )

  const { data: actionsData } = useSWR(
    ["audit_log_actions", tenantId],
    actionsFetcher
  )

  const { data: resourceTypesData } = useSWR(
    ["audit_log_resource_types", tenantId],
    resourceTypesFetcher
  )

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getActionIcon = (action: string) => {
    if (action.includes("payout")) return <DollarSign className="h-4 w-4 text-emerald-500" />
    if (action.includes("dispute")) return <Shield className="h-4 w-4 text-amber-500" />
    if (action.includes("refund")) return <RefreshCw className="h-4 w-4 text-blue-500" />
    if (action.includes("approved") || action.includes("completed")) return <CheckCircle className="h-4 w-4 text-emerald-500" />
    if (action.includes("rejected") || action.includes("failed") || action.includes("error")) return <XCircle className="h-4 w-4 text-red-500" />
    if (action.includes("hold")) return <Clock className="h-4 w-4 text-amber-500" />
    if (action.includes("user") || action.includes("profile")) return <UserCheck className="h-4 w-4 text-blue-500" />
    if (action.includes("warning") || action.includes("alert")) return <AlertTriangle className="h-4 w-4 text-amber-500" />
    return <FileText className="h-4 w-4 text-muted-foreground" />
  }

  const getActionBadgeVariant = (action: string): "default" | "secondary" | "destructive" | "outline" => {
    if (action.includes("error") || action.includes("failed") || action.includes("rejected")) return "destructive"
    if (action.includes("approved") || action.includes("completed") || action.includes("released")) return "default"
    if (action.includes("hold") || action.includes("warning")) return "secondary"
    return "outline"
  }

  const formatActionName = (action: string) => {
    return action
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())
  }

  const logs = data?.logs || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / 50)
  const actions = actionsData?.actions || []
  const resourceTypes = resourceTypesData?.resource_types || []

  if (isLoading && !data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-destructive">Failed to load audit logs</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>
                {total} total entries
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => mutate()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search actions..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setActionFilter(e.target.value)
                  setPage(0)
                }}
                className="pl-9"
              />
            </div>
            
            <Select value={resourceTypeFilter} onValueChange={(v) => { setResourceTypeFilter(v === "all" ? "" : v); setPage(0) }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Resource Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {resourceTypes.map((type: string) => (
                  <SelectItem key={type} value={type}>{type.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !dateRange.from && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    "Date range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    setDateRange({ from: range?.from, to: range?.to })
                    setPage(0)
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            {(actionFilter || resourceTypeFilter || dateRange.from) && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setActionFilter("")
                  setResourceTypeFilter("")
                  setSearchQuery("")
                  setDateRange({ from: undefined, to: undefined })
                  setPage(0)
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          {/* Table */}
          {logs.length === 0 ? (
            <div className="py-8 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No audit logs found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead className="w-[100px]">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: AuditLogEntry) => (
                    <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(log.created_at)}
                      </TableCell>
                      <TableCell>
                        {log.user_id ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={log.user_avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {log.user_display_name?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{log.user_display_name || log.user_email || "Unknown"}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">System</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getActionIcon(log.action)}
                          <Badge variant={getActionBadgeVariant(log.action)} className="font-normal">
                            {formatActionName(log.action)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.resource_type && (
                          <span className="text-sm text-muted-foreground">
                            {log.resource_type.replace(/_/g, " ")}
                            {log.resource_id && (
                              <span className="font-mono text-xs ml-1">
                                #{log.resource_id.slice(0, 8)}
                              </span>
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedLog(log) }}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {page * 50 + 1} - {Math.min((page + 1) * 50, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLog && getActionIcon(selectedLog.action)}
              {selectedLog && formatActionName(selectedLog.action)}
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Timestamp</p>
                  <p className="font-medium">{new Date(selectedLog.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">User</p>
                  <p className="font-medium">{selectedLog.user_display_name || selectedLog.user_email || "System"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Resource Type</p>
                  <p className="font-medium">{selectedLog.resource_type?.replace(/_/g, " ") || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Resource ID</p>
                  <p className="font-mono text-xs">{selectedLog.resource_id || "-"}</p>
                </div>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Metadata</p>
                  <pre className="p-4 bg-muted rounded-lg text-xs overflow-auto max-h-[300px]">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
