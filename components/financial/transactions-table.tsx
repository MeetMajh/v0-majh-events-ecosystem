"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Search,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  FileText,
} from "lucide-react"
import { format } from "date-fns"

interface LedgerAccount {
  id: string
  account_type: string
  name: string
  reference_id: string | null
}

interface LedgerEntry {
  id: string
  account_id: string
  direction: "debit" | "credit"
  amount_cents: number
  created_at: string
  ledger_accounts: LedgerAccount
}

interface Transaction {
  id: string
  transaction_type: string
  description: string | null
  status: string
  reference_id: string | null
  reference_type: string | null
  idempotency_key: string | null
  created_at: string
  posted_at: string | null
  ledger_entries: LedgerEntry[]
}

interface TransactionsTableProps {
  transactions: Transaction[]
  userId: string
  tenantId: string
}

const TRANSACTION_TYPES = [
  { value: "all", label: "All Types" },
  { value: "deposit", label: "Deposit" },
  { value: "withdrawal", label: "Withdrawal" },
  { value: "escrow_lock", label: "Escrow Lock" },
  { value: "escrow_release", label: "Escrow Release" },
  { value: "payout", label: "Payout" },
  { value: "refund", label: "Refund" },
  { value: "reversal", label: "Reversal" },
]

export function TransactionsTable({ transactions, userId, tenantId }: TransactionsTableProps) {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const filteredTransactions = transactions.filter((tx) => {
    if (typeFilter !== "all" && tx.transaction_type !== typeFilter) return false
    if (statusFilter !== "all" && tx.status !== statusFilter) return false
    if (search) {
      const searchLower = search.toLowerCase()
      return (
        tx.id.toLowerCase().includes(searchLower) ||
        tx.transaction_type.toLowerCase().includes(searchLower) ||
        tx.description?.toLowerCase().includes(searchLower) ||
        tx.idempotency_key?.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  const getTransactionAmount = (tx: Transaction): { amount: number; isUserTx: boolean } => {
    const userEntry = tx.ledger_entries?.find(
      (entry) => entry.ledger_accounts?.reference_id === userId
    )
    if (userEntry) {
      return {
        amount: userEntry.direction === "credit" ? userEntry.amount_cents : -userEntry.amount_cents,
        isUserTx: true,
      }
    }
    // If not a user transaction, just show the total
    const totalAmount = tx.ledger_entries?.reduce((sum, entry) => {
      if (entry.direction === "debit") return sum + entry.amount_cents
      return sum
    }, 0) || 0
    return { amount: totalAmount, isUserTx: false }
  }

  const getTypeLabel = (type: string) => {
    return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  }

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const openDetails = (tx: Transaction) => {
    setSelectedTx(tx)
    setDetailsOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Transactions</h2>
        <p className="text-muted-foreground">Complete ledger-backed transaction history</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by ID, type, or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="posted">Posted</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reversed">Reversed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transaction History</CardTitle>
          <CardDescription>
            {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx) => {
                    const { amount, isUserTx } = getTransactionAmount(tx)
                    const isPositive = amount > 0
                    const isExpanded = expandedId === tx.id

                    return (
                      <>
                        <TableRow key={tx.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                                isPositive 
                                  ? "bg-emerald-500/10 text-emerald-500" 
                                  : "bg-red-500/10 text-red-500"
                              }`}>
                                {isPositive ? (
                                  <ArrowDownLeft className="h-4 w-4" />
                                ) : (
                                  <ArrowUpRight className="h-4 w-4" />
                                )}
                              </div>
                              <span className="font-medium">{getTypeLabel(tx.transaction_type)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-muted-foreground">
                            {tx.description || "-"}
                          </TableCell>
                          <TableCell>
                            <span className={isPositive ? "text-emerald-500" : "text-red-500"}>
                              {isPositive ? "+" : ""}{isUserTx ? `$${(Math.abs(amount) / 100).toFixed(2)}` : `$${(amount / 100).toFixed(2)}`}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={tx.status === "posted" ? "default" : tx.status === "reversed" ? "destructive" : "secondary"}>
                              {tx.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(tx.created_at), "MMM d, yyyy HH:mm")}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openDetails(tx)}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Ledger Entries */}
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={7} className="bg-muted/30 p-0">
                              <div className="p-4">
                                <p className="text-xs font-medium text-muted-foreground mb-2">Ledger Entries</p>
                                <div className="space-y-2">
                                  {tx.ledger_entries?.map((entry) => (
                                    <div
                                      key={entry.id}
                                      className="flex items-center justify-between rounded-md bg-background p-3 text-sm"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Badge variant={entry.direction === "credit" ? "default" : "outline"}>
                                          {entry.direction}
                                        </Badge>
                                        <span>{entry.ledger_accounts?.name || entry.ledger_accounts?.account_type}</span>
                                      </div>
                                      <span className="font-mono">
                                        ${(entry.amount_cents / 100).toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="mb-2 font-medium">No transactions found</p>
              <p className="text-sm text-muted-foreground">
                {search || typeFilter !== "all" || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Your transaction history will appear here"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              Complete information about this ledger transaction
            </DialogDescription>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Transaction ID</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs">{selectedTx.id.slice(0, 8)}...</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(selectedTx.id, "id")}
                    >
                      {copiedId === "id" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium">{getTypeLabel(selectedTx.transaction_type)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={selectedTx.status === "posted" ? "default" : "secondary"}>
                    {selectedTx.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p>{format(new Date(selectedTx.created_at), "MMM d, yyyy HH:mm:ss")}</p>
                </div>
                {selectedTx.idempotency_key && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Idempotency Key</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded">{selectedTx.idempotency_key}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(selectedTx.idempotency_key!, "idem")}
                      >
                        {copiedId === "idem" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Ledger Entries</p>
                <div className="space-y-2">
                  {selectedTx.ledger_entries?.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-md border p-3 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={entry.direction === "credit" ? "default" : "outline"}>
                          {entry.direction}
                        </Badge>
                        <span>{entry.ledger_accounts?.name}</span>
                      </div>
                      <span className="font-mono font-medium">
                        ${(entry.amount_cents / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
