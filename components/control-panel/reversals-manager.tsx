"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Undo2,
  Plus,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Wallet,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface Transaction {
  id: string
  user_id: string
  type: string
  amount_cents: number
  status: string
  description: string | null
  created_at: string
  reversal_of?: string
  reversal_reason?: string
  profiles: {
    display_name: string | null
    email: string | null
  } | null
}

interface ReversalsManagerProps {
  reversals: Transaction[]
  reversibleTransactions: Transaction[]
}

export function ReversalsManager({ reversals, reversibleTransactions }: ReversalsManagerProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [reversalType, setReversalType] = useState<"wallet" | "stripe" | "adjustment">("wallet")
  const [reason, setReason] = useState("")
  const [customReason, setCustomReason] = useState("")
  const [processing, setProcessing] = useState(false)

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  const filteredTransactions = reversibleTransactions.filter((tx) => {
    const searchLower = search.toLowerCase()
    return (
      tx.id.toLowerCase().includes(searchLower) ||
      tx.profiles?.display_name?.toLowerCase().includes(searchLower) ||
      tx.profiles?.email?.toLowerCase().includes(searchLower) ||
      tx.description?.toLowerCase().includes(searchLower)
    )
  })

  const handleSelectTransaction = (tx: Transaction) => {
    setSelectedTx(tx)
    setReason("")
    setCustomReason("")
  }

  const handleProceedToConfirm = () => {
    if (!selectedTx || (!reason && !customReason)) return
    setConfirmOpen(true)
  }

  const handleReversal = async () => {
    if (!selectedTx) return
    
    setProcessing(true)
    try {
      const response = await fetch("/api/admin/transactions/reverse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: selectedTx.id,
          reason: reason === "other" ? customReason : reason,
          type: reversalType,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Transaction Reversed",
          description: `Successfully reversed ${formatCurrency(selectedTx.amount_cents)}`,
        })
        setModalOpen(false)
        setConfirmOpen(false)
        setSelectedTx(null)
        router.refresh()
      } else {
        toast({
          title: "Reversal Failed",
          description: result.error || "An error occurred",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to process reversal",
        variant: "destructive",
      })
    }
    setProcessing(false)
  }

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      deposit: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      prize: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      manual_credit: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
      reversal: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    }
    return <Badge className={styles[type] || "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"}>{type.replace("_", " ")}</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Header with New Reversal Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Reversals</h2>
          <p className="text-zinc-500">Manage transaction reversals and refunds</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="bg-orange-600 hover:bg-orange-700 text-white">
          <Plus className="h-4 w-4 mr-2" />
          New Reversal
        </Button>
      </div>

      {/* Reversal History */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-zinc-100">Reversal History</CardTitle>
          <CardDescription className="text-zinc-500">
            All processed reversals and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reversals.length > 0 ? (
            <div className="rounded-lg border border-zinc-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Date</TableHead>
                    <TableHead className="text-zinc-400">Original Transaction</TableHead>
                    <TableHead className="text-zinc-400">User</TableHead>
                    <TableHead className="text-zinc-400 text-right">Amount</TableHead>
                    <TableHead className="text-zinc-400">Reason</TableHead>
                    <TableHead className="text-zinc-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reversals.map((r) => (
                    <TableRow key={r.id} className="border-zinc-800 hover:bg-zinc-800/50">
                      <TableCell className="text-zinc-300 text-sm">
                        {new Date(r.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-500">
                        {r.reversal_of?.slice(0, 12)}...
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-zinc-100 text-sm">{r.profiles?.display_name || "Unknown"}</p>
                          <p className="text-zinc-500 text-xs">{r.profiles?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-orange-400">
                        -{formatCurrency(Math.abs(r.amount_cents))}
                      </TableCell>
                      <TableCell className="text-zinc-400 text-sm max-w-[200px] truncate">
                        {r.reversal_reason || r.description}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          Completed
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Undo2 className="h-12 w-12 mb-4" />
              <p>No reversals processed yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Reversal Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">New Reversal</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Select a transaction to reverse and provide a reason
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Search & Select Transaction */}
            <div className="space-y-3">
              <Label className="text-zinc-300">Select Transaction</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  placeholder="Search by ID, user, or description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-zinc-800 border-zinc-700 text-zinc-100"
                />
              </div>
              
              <div className="max-h-[200px] overflow-y-auto rounded-lg border border-zinc-800">
                {filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => handleSelectTransaction(tx)}
                    className={cn(
                      "flex items-center justify-between p-3 cursor-pointer border-b border-zinc-800 last:border-0",
                      selectedTx?.id === tx.id ? "bg-orange-500/10" : "hover:bg-zinc-800"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        selectedTx?.id === tx.id ? "bg-orange-400" : "bg-transparent"
                      )} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-zinc-100">{tx.profiles?.display_name || "Unknown"}</p>
                          {getTypeBadge(tx.type)}
                        </div>
                        <p className="text-xs text-zinc-500">{tx.profiles?.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-emerald-400">
                        {formatCurrency(tx.amount_cents)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedTx && (
              <>
                {/* Selected Transaction Preview */}
                <div className="bg-zinc-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-400">Selected Transaction</p>
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                      To Be Reversed
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-zinc-500">User</p>
                      <p className="text-zinc-100">{selectedTx.profiles?.display_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Amount</p>
                      <p className="text-xl font-bold text-zinc-100">{formatCurrency(selectedTx.amount_cents)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Type</p>
                      {getTypeBadge(selectedTx.type)}
                    </div>
                  </div>
                </div>

                {/* Reversal Type */}
                <div className="space-y-3">
                  <Label className="text-zinc-300">Reversal Type</Label>
                  <Select value={reversalType} onValueChange={(v: "wallet" | "stripe" | "adjustment") => setReversalType(v)}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="wallet">Refund to Wallet</SelectItem>
                      <SelectItem value="stripe">Stripe Refund</SelectItem>
                      <SelectItem value="adjustment">Balance Adjustment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Reason */}
                <div className="space-y-3">
                  <Label className="text-zinc-300">Reason</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                      <SelectValue placeholder="Select reason..." />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="duplicate_charge">Duplicate Charge</SelectItem>
                      <SelectItem value="customer_request">Customer Request</SelectItem>
                      <SelectItem value="fraud">Fraud Prevention</SelectItem>
                      <SelectItem value="system_error">System Error</SelectItem>
                      <SelectItem value="tournament_cancelled">Tournament Cancelled</SelectItem>
                      <SelectItem value="other">Other (specify below)</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {reason === "other" && (
                    <Textarea
                      placeholder="Enter custom reason..."
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      className="bg-zinc-800 border-zinc-700 text-zinc-100"
                    />
                  )}
                </div>

                {/* Impact Preview */}
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                  <p className="text-sm font-medium text-zinc-300 mb-3">Reversal Impact Preview</p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 text-center">
                      <Wallet className="h-8 w-8 mx-auto text-zinc-400 mb-2" />
                      <p className="text-xs text-zinc-500">Current Balance</p>
                      <p className="text-lg font-mono text-zinc-100">$X,XXX.XX</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-orange-400" />
                    <div className="flex-1 text-center">
                      <Wallet className="h-8 w-8 mx-auto text-orange-400 mb-2" />
                      <p className="text-xs text-zinc-500">After Reversal</p>
                      <p className="text-lg font-mono text-orange-400">
                        -{formatCurrency(selectedTx.amount_cents)}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setModalOpen(false)}
              className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleProceedToConfirm}
              disabled={!selectedTx || (!reason && !customReason)}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              Review Reversal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-400" />
              Confirm Reversal
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              This action cannot be undone
            </DialogDescription>
          </DialogHeader>

          {selectedTx && (
            <div className="space-y-4">
              <Alert className="border-orange-500/30 bg-orange-500/10">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
                <AlertDescription className="text-orange-300">
                  You are about to reverse <strong>{formatCurrency(selectedTx.amount_cents)}</strong> from{" "}
                  <strong>{selectedTx.profiles?.display_name}</strong>&apos;s wallet.
                </AlertDescription>
              </Alert>

              <div className="bg-zinc-800 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Transaction ID</span>
                  <span className="font-mono text-zinc-300">{selectedTx.id.slice(0, 16)}...</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Amount</span>
                  <span className="font-mono text-orange-400">-{formatCurrency(selectedTx.amount_cents)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Reason</span>
                  <span className="text-zinc-300">{reason === "other" ? customReason : reason}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Type</span>
                  <span className="text-zinc-300">{reversalType}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setConfirmOpen(false)}
              disabled={processing}
              className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReversal}
              disabled={processing}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Reversal
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
