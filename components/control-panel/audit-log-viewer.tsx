"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Search,
  ScrollText,
  ChevronDown,
  ChevronRight,
  Undo2,
  Trash2,
  RefreshCw,
  Shield,
  Wallet,
  Download,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AuditLog {
  id: string
  action_type: string
  target_type: string
  target_id: string
  user_id: string | null
  performed_by: string | null
  amount_cents: number | null
  previous_balance_cents: number | null
  new_balance_cents: number | null
  reason: string | null
  documentation: string | null
  is_test_data: boolean | null
  environment: string | null
  status: string
  created_at: string
  profiles: {
    display_name: string | null
    email: string | null
  } | null
  admin: {
    display_name: string | null
    email: string | null
  } | null
}

export function AuditLogViewer({ logs }: { logs: AuditLog[] }) {
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  const getActionBadge = (action: string) => {
    const styles: Record<string, { class: string; icon: React.ReactNode }> = {
      reversal: { 
        class: "bg-orange-500/20 text-orange-400 border-orange-500/30", 
        icon: <Undo2 className="h-3 w-3 mr-1" /> 
      },
      void: { 
        class: "bg-red-500/20 text-red-400 border-red-500/30", 
        icon: <Trash2 className="h-3 w-3 mr-1" /> 
      },
      recover: { 
        class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", 
        icon: <RefreshCw className="h-3 w-3 mr-1" /> 
      },
      payout: { 
        class: "bg-purple-500/20 text-purple-400 border-purple-500/30", 
        icon: <Wallet className="h-3 w-3 mr-1" /> 
      },
      escrow_release: { 
        class: "bg-blue-500/20 text-blue-400 border-blue-500/30", 
        icon: <Shield className="h-3 w-3 mr-1" /> 
      },
      dismiss: {
        class: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
        icon: <Trash2 className="h-3 w-3 mr-1" />
      },
    }
    const style = styles[action] || { class: "bg-zinc-500/20 text-zinc-400", icon: null }
    return (
      <Badge className={cn("flex items-center", style.class)}>
        {style.icon}
        {action.replace("_", " ")}
      </Badge>
    )
  }

  const getTargetBadge = (target: string) => {
    const styles: Record<string, string> = {
      transaction: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      escrow: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      wallet: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    }
    return <Badge className={styles[target] || "bg-zinc-500/20 text-zinc-400"}>{target}</Badge>
  }

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      log.target_id.toLowerCase().includes(search.toLowerCase()) ||
      log.reason?.toLowerCase().includes(search.toLowerCase()) ||
      log.profiles?.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.admin?.display_name?.toLowerCase().includes(search.toLowerCase())
    
    const matchesAction = actionFilter === "all" || log.action_type === actionFilter
    
    return matchesSearch && matchesAction
  })

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Search audit logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-zinc-800 border-zinc-700 text-zinc-100"
              />
            </div>
            
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px] bg-zinc-800 border-zinc-700 text-zinc-100">
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="reversal">Reversal</SelectItem>
                <SelectItem value="void">Void</SelectItem>
                <SelectItem value="recover">Recover</SelectItem>
                <SelectItem value="payout">Payout</SelectItem>
                <SelectItem value="escrow_release">Escrow Release</SelectItem>
                <SelectItem value="dismiss">Dismiss</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-zinc-100">Audit Trail</CardTitle>
          <CardDescription className="text-zinc-500">
            {filteredLogs.length} audit records - Immutable financial action history
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLogs.length > 0 ? (
            <div className="rounded-lg border border-zinc-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="text-zinc-400">Timestamp</TableHead>
                    <TableHead className="text-zinc-400">Action</TableHead>
                    <TableHead className="text-zinc-400">Target</TableHead>
                    <TableHead className="text-zinc-400">User</TableHead>
                    <TableHead className="text-zinc-400">Amount Change</TableHead>
                    <TableHead className="text-zinc-400">Performed By</TableHead>
                    <TableHead className="text-zinc-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <Collapsible key={log.id} asChild>
                      <>
                        <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                          <TableCell>
                            <CollapsibleTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6"
                                onClick={() => toggleRow(log.id)}
                              >
                                {expandedRows.has(log.id) ? (
                                  <ChevronDown className="h-4 w-4 text-zinc-400" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-zinc-400" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                          <TableCell className="text-zinc-300 text-sm">
                            {new Date(log.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>{getActionBadge(log.action_type)}</TableCell>
                          <TableCell>{getTargetBadge(log.target_type)}</TableCell>
                          <TableCell>
                            <span className="text-zinc-100 text-sm">
                              {log.profiles?.display_name || "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {log.amount_cents ? (
                              <div className="text-sm">
                                <span className="text-zinc-500">
                                  {log.previous_balance_cents !== null 
                                    ? formatCurrency(log.previous_balance_cents) 
                                    : "—"}
                                </span>
                                <span className="text-zinc-500 mx-1">→</span>
                                <span className={cn(
                                  "font-mono",
                                  (log.new_balance_cents ?? 0) < (log.previous_balance_cents ?? 0)
                                    ? "text-red-400"
                                    : "text-emerald-400"
                                )}>
                                  {log.new_balance_cents !== null 
                                    ? formatCurrency(log.new_balance_cents) 
                                    : "—"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-zinc-500">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-zinc-400 text-sm">
                              {log.admin?.display_name || "System"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn(
                              log.status === "completed" 
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : log.status === "failed"
                                ? "bg-red-500/20 text-red-400 border-red-500/30"
                                : "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"
                            )}>
                              {log.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow className="border-zinc-800 bg-zinc-800/30">
                            <TableCell colSpan={8} className="py-4">
                              <div className="grid grid-cols-2 gap-4 px-4">
                                <div>
                                  <p className="text-xs text-zinc-500 mb-1">Target ID</p>
                                  <p className="text-sm font-mono text-zinc-300">{log.target_id}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-zinc-500 mb-1">Environment</p>
                                  <Badge variant="outline" className={cn(
                                    log.is_test_data 
                                      ? "border-amber-500/30 text-amber-400"
                                      : "border-emerald-500/30 text-emerald-400"
                                  )}>
                                    {log.is_test_data ? "TEST" : "LIVE"}
                                  </Badge>
                                </div>
                                {log.reason && (
                                  <div className="col-span-2">
                                    <p className="text-xs text-zinc-500 mb-1">Reason</p>
                                    <p className="text-sm text-zinc-300">{log.reason}</p>
                                  </div>
                                )}
                                {log.documentation && (
                                  <div className="col-span-2">
                                    <p className="text-xs text-zinc-500 mb-1">Documentation</p>
                                    <p className="text-sm text-zinc-400">{log.documentation}</p>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <ScrollText className="h-12 w-12 mb-4" />
              <p>No audit records found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
