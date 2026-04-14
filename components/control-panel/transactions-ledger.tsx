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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Undo2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Transaction {
  id: string
  user_id: string
  type: string
  amount_cents: number
  status: string
  description: string | null
  stripe_session_id: string | null
  tournament_id: string | null
  environment: string | null
  is_test: boolean | null
  reversed_at: string | null
  reversal_reason: string | null
  created_at: string
  profiles: {
    display_name: string | null
    email: string | null
  } | null
}

export function TransactionsLedger({ transactions }: { transactions: Transaction[] }) {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [envFilter, setEnvFilter] = useState<string>("all")
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      deposit: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      withdrawal: "bg-red-500/20 text-red-400 border-red-500/30",
      entry_fee: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      prize: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      platform_fee: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      reversal: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      manual_credit: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    }
    return <Badge className={styles[type] || "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"}>{type.replace("_", " ")}</Badge>
  }

  const getStatusBadge = (status: string, reversed: boolean) => {
    if (reversed) {
      return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Reversed</Badge>
    }
    const styles: Record<string, string> = {
      completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      failed: "bg-red-500/20 text-red-400 border-red-500/30",
      voided: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
    }
    return <Badge className={styles[status] || "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"}>{status}</Badge>
  }

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch = 
      tx.id.toLowerCase().includes(search.toLowerCase()) ||
      tx.profiles?.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      tx.profiles?.email?.toLowerCase().includes(search.toLowerCase()) ||
      tx.description?.toLowerCase().includes(search.toLowerCase())
    
    const matchesType = typeFilter === "all" || tx.type === typeFilter
    const matchesStatus = statusFilter === "all" || tx.status === statusFilter
    const matchesEnv = envFilter === "all" || 
      (envFilter === "test" && tx.is_test) || 
      (envFilter === "live" && !tx.is_test)
    
    return matchesSearch && matchesType && matchesStatus && matchesEnv
  })

  const openDetails = (tx: Transaction) => {
    setSelectedTx(tx)
    setDetailsOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Search by ID, user, or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
              />
            </div>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px] bg-zinc-800 border-zinc-700 text-zinc-100">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="withdrawal">Withdrawal</SelectItem>
                <SelectItem value="entry_fee">Entry Fee</SelectItem>
                <SelectItem value="prize">Prize</SelectItem>
                <SelectItem value="platform_fee">Platform Fee</SelectItem>
                <SelectItem value="reversal">Reversal</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] bg-zinc-800 border-zinc-700 text-zinc-100">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="voided">Voided</SelectItem>
              </SelectContent>
            </Select>

            <Select value={envFilter} onValueChange={setEnvFilter}>
              <SelectTrigger className="w-[150px] bg-zinc-800 border-zinc-700 text-zinc-100">
                <SelectValue placeholder="Environment" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="all">All Environments</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="test">Test</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-zinc-100">Transaction Ledger</CardTitle>
              <CardDescription className="text-zinc-500">
                {filteredTransactions.length} transactions found
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Date</TableHead>
                  <TableHead className="text-zinc-400">User</TableHead>
                  <TableHead className="text-zinc-400">Type</TableHead>
                  <TableHead className="text-zinc-400 text-right">Amount</TableHead>
                  <TableHead className="text-zinc-400">Status</TableHead>
                  <TableHead className="text-zinc-400">Env</TableHead>
                  <TableHead className="text-zinc-400">Reference</TableHead>
                  <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => (
                  <TableRow 
                    key={tx.id} 
                    className={cn(
                      "border-zinc-800 hover:bg-zinc-800/50",
                      tx.reversed_at && "opacity-60"
                    )}
                  >
                    <TableCell className="text-zinc-300 text-sm">
                      {new Date(tx.created_at).toLocaleDateString()}
                      <span className="block text-xs text-zinc-500">
                        {new Date(tx.created_at).toLocaleTimeString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-zinc-100 text-sm font-medium">
                          {tx.profiles?.display_name || "Unknown"}
                        </p>
                        <p className="text-zinc-500 text-xs">{tx.profiles?.email || tx.user_id.slice(0, 8)}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(tx.type)}</TableCell>
                    <TableCell className={cn(
                      "text-right font-mono text-sm",
                      tx.type === "deposit" || tx.type === "prize" ? "text-emerald-400" :
                      tx.type === "withdrawal" || tx.type === "entry_fee" ? "text-red-400" :
                      "text-zinc-100"
                    )}>
                      {tx.type === "deposit" || tx.type === "prize" ? "+" : 
                       tx.type === "withdrawal" || tx.type === "entry_fee" ? "-" : ""}
                      {formatCurrency(Math.abs(tx.amount_cents))}
                    </TableCell>
                    <TableCell>{getStatusBadge(tx.status, !!tx.reversed_at)}</TableCell>
                    <TableCell>
                      {tx.is_test ? (
                        <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">TEST</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">LIVE</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-zinc-500 text-xs font-mono">
                      {tx.stripe_session_id ? tx.stripe_session_id.slice(0, 15) + "..." :
                       tx.tournament_id ? `T-${tx.tournament_id.slice(0, 8)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                          <DropdownMenuItem 
                            onClick={() => openDetails(tx)}
                            className="text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {tx.stripe_session_id && (
                            <DropdownMenuItem className="text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View in Stripe
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator className="bg-zinc-800" />
                          {!tx.reversed_at && tx.status === "completed" && (
                            <DropdownMenuItem className="text-orange-400 focus:bg-zinc-800 focus:text-orange-300">
                              <Undo2 className="h-4 w-4 mr-2" />
                              Reverse Transaction
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-zinc-500">
              Showing {filteredTransactions.length} of {transactions.length} transactions
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled className="border-zinc-700 bg-zinc-800 text-zinc-400">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700">
                1
              </Button>
              <Button variant="outline" size="sm" disabled className="border-zinc-700 bg-zinc-800 text-zinc-400">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Transaction Details</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Full transaction information and audit trail
            </DialogDescription>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-zinc-500">Transaction ID</p>
                  <p className="text-sm font-mono text-zinc-100">{selectedTx.id}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-500">Created At</p>
                  <p className="text-sm text-zinc-100">{new Date(selectedTx.created_at).toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-500">Type</p>
                  {getTypeBadge(selectedTx.type)}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-500">Status</p>
                  {getStatusBadge(selectedTx.status, !!selectedTx.reversed_at)}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-500">Amount</p>
                  <p className="text-xl font-bold text-zinc-100">{formatCurrency(selectedTx.amount_cents)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-500">Environment</p>
                  {selectedTx.is_test ? (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-400">TEST</Badge>
                  ) : (
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">LIVE</Badge>
                  )}
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <p className="text-sm text-zinc-500 mb-2">User</p>
                <div className="bg-zinc-800 rounded-lg p-3">
                  <p className="text-zinc-100">{selectedTx.profiles?.display_name || "Unknown User"}</p>
                  <p className="text-sm text-zinc-500">{selectedTx.profiles?.email || selectedTx.user_id}</p>
                </div>
              </div>

              {selectedTx.description && (
                <div className="border-t border-zinc-800 pt-4">
                  <p className="text-sm text-zinc-500 mb-2">Description</p>
                  <p className="text-zinc-100">{selectedTx.description}</p>
                </div>
              )}

              {selectedTx.stripe_session_id && (
                <div className="border-t border-zinc-800 pt-4">
                  <p className="text-sm text-zinc-500 mb-2">Stripe Session</p>
                  <p className="text-sm font-mono text-zinc-100">{selectedTx.stripe_session_id}</p>
                </div>
              )}

              {selectedTx.reversed_at && (
                <div className="border-t border-zinc-800 pt-4">
                  <p className="text-sm text-zinc-500 mb-2">Reversal Info</p>
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                    <p className="text-orange-400">Reversed on {new Date(selectedTx.reversed_at).toLocaleString()}</p>
                    {selectedTx.reversal_reason && (
                      <p className="text-sm text-zinc-400 mt-1">Reason: {selectedTx.reversal_reason}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
                <Button variant="outline" onClick={() => setDetailsOpen(false)} className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700">
                  Close
                </Button>
                {!selectedTx.reversed_at && selectedTx.status === "completed" && (
                  <Button variant="destructive">
                    <Undo2 className="h-4 w-4 mr-2" />
                    Reverse Transaction
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
