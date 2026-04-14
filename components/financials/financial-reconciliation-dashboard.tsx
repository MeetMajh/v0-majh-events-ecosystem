"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Loader2, 
  ShieldCheck, 
  DollarSign,
  Database,
  Wallet,
  CreditCard,
  TrendingUp,
  AlertCircle,
  Trash2,
  FileX,
  Undo2
} from "lucide-react"
import { findWalletInconsistencies, recalculateAllWallets, voidTransaction, reverseTransaction, findOrphanedDeposits } from "@/lib/wallet-actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface SystemHealth {
  isHealthy: boolean
  stripeTotalCents: number
  dbTotalCents: number
  walletsTotalCents: number
  calculatedWalletsTotalCents: number
  stripeDbDelta: number
  walletDelta: number
  missingFromDbCount: number
  walletMismatchCount: number
}

interface DepositReconciliation {
  stripeId: string
  stripeAmount: number
  stripeDate: string
  stripeCustomerEmail: string | null
  userId: string | null
  dbRecordId: string | null
  dbAmount: number | null
  status: "matched" | "missing_db_record" | "amount_mismatch" | "dismissed"
}

interface WalletMismatch {
  userId: string
  walletBalance: number
  calculatedBalance: number
  delta: number
}

interface Escrow {
  tournamentId: string
  tournamentName: string
  fundedAmount: number
  participantCount: number
  status: string
}

interface OrphanedDeposit {
  id: string
  user_id: string
  amount_cents: number
  type: string
  status: string
  description: string
  stripe_session_id: string | null
  created_at: string
}

interface ReconciliationData {
  systemHealth: SystemHealth
  depositReconciliation: DepositReconciliation[]
  walletMismatches: WalletMismatch[]
  escrows: Escrow[]
  summary: {
    totalStripePayments: number
    totalDbRecords: number
    totalWallets: number
    activeEscrows: number
  }
}

export function FinancialReconciliationDashboard() {
  const [data, setData] = useState<ReconciliationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reconcileLoading, setReconcileLoading] = useState(false)
  const [orphanedDeposits, setOrphanedDeposits] = useState<OrphanedDeposit[]>([])
  const [loadingOrphans, setLoadingOrphans] = useState(false)
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [voidDialogOpen, setVoidDialogOpen] = useState(false)
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<OrphanedDeposit | null>(null)
  const [voidReason, setVoidReason] = useState("")
  const [reverseReason, setReverseReason] = useState("")
  const [reversingId, setReversingId] = useState<string | null>(null)
  const [stripeWarningOpen, setStripeWarningOpen] = useState(false)
  const [forceVoid, setForceVoid] = useState(false)
  const [recoveringId, setRecoveringId] = useState<string | null>(null)
  const [dismissingId, setDismissingId] = useState<string | null>(null)
  const [recoverDialogOpen, setRecoverDialogOpen] = useState(false)
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false)
  const [selectedStripeItem, setSelectedStripeItem] = useState<DepositReconciliation | null>(null)
  const [dismissReason, setDismissReason] = useState("")

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  async function fetchReconciliationData() {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch("/api/admin/reconciliation")
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch reconciliation data")
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  async function handleReconcileAll() {
    setReconcileLoading(true)
    await recalculateAllWallets()
    await fetchReconciliationData()
    setReconcileLoading(false)
  }

  async function fetchOrphanedDeposits() {
    setLoadingOrphans(true)
    const result = await findOrphanedDeposits()
    if (result.success && result.orphanedDeposits) {
      setOrphanedDeposits(result.orphanedDeposits)
    }
    setLoadingOrphans(false)
  }

  function openVoidDialog(transaction: OrphanedDeposit) {
    setSelectedTransaction(transaction)
    setVoidReason("")
    setVoidDialogOpen(true)
  }

  async function handleVoidTransaction() {
    if (!selectedTransaction || !voidReason.trim()) return
    
    setVoidingId(selectedTransaction.id)
    const result = await voidTransaction(selectedTransaction.id, voidReason, forceVoid)
    
    // Check if Stripe warning
    if (result.hasStripeLink && !forceVoid) {
      setVoidingId(null)
      setVoidDialogOpen(false)
      setStripeWarningOpen(true)
      return
    }
    
    if (result.success) {
      // Remove from list and refresh data
      setOrphanedDeposits(prev => prev.filter(d => d.id !== selectedTransaction.id))
      await fetchReconciliationData()
    }
    
    setVoidingId(null)
    setVoidDialogOpen(false)
    setStripeWarningOpen(false)
    setSelectedTransaction(null)
    setVoidReason("")
    setForceVoid(false)
  }

  function openReverseDialog(transaction: OrphanedDeposit) {
    setSelectedTransaction(transaction)
    setReverseReason("")
    setReverseDialogOpen(true)
  }

  async function handleReverseTransaction() {
    if (!selectedTransaction || !reverseReason.trim()) return
    
    setReversingId(selectedTransaction.id)
    const result = await reverseTransaction(selectedTransaction.id, reverseReason)
    
    if (result.success) {
      // Remove from list and refresh data
      setOrphanedDeposits(prev => prev.filter(d => d.id !== selectedTransaction.id))
      await fetchReconciliationData()
    }
    
    setReversingId(null)
    setReverseDialogOpen(false)
    setSelectedTransaction(null)
    setReverseReason("")
  }

  async function handleRecoverStripePayment(item: DepositReconciliation) {
    // For missing DB records, we need user info to create the transaction
    // Open dialog to collect user ID or look it up
    setSelectedStripeItem(item)
    setRecoverDialogOpen(true)
  }

  function openDismissDialog(item: DepositReconciliation) {
    setSelectedStripeItem(item)
    setDismissReason("")
    setDismissDialogOpen(true)
  }

  async function handleDismissStripePayment() {
    if (!selectedStripeItem || !dismissReason.trim()) return
    
    setDismissingId(selectedStripeItem.stripeId)
    
    try {
      const response = await fetch("/api/admin/reconciliation/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stripeSessionId: selectedStripeItem.stripeId,
          stripeAmount: selectedStripeItem.stripeAmount,
          reason: dismissReason,
        }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        await fetchReconciliationData()
      } else {
        setError(result.error || "Failed to dismiss payment")
      }
    } catch (err) {
      setError("Failed to dismiss payment")
    }
    
    setDismissingId(null)
    setDismissDialogOpen(false)
    setSelectedStripeItem(null)
    setDismissReason("")
  }

  async function confirmRecoverStripePayment(userId: string) {
    if (!selectedStripeItem || !userId) return
    
    setRecoveringId(selectedStripeItem.stripeId)
    
    try {
      const response = await fetch("/api/admin/reconciliation/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stripeSessionId: selectedStripeItem.stripeId,
          userId,
          amountCents: selectedStripeItem.stripeAmount,
          stripeCustomerEmail: selectedStripeItem.stripeCustomerEmail,
        }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        await fetchReconciliationData()
      } else {
        setError(result.error || "Failed to recover payment")
      }
    } catch (err) {
      setError("Failed to recover payment")
    }
    
    setRecoveringId(null)
    setRecoverDialogOpen(false)
    setSelectedStripeItem(null)
  }

  useEffect(() => {
    fetchReconciliationData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading reconciliation data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  const { systemHealth, depositReconciliation, walletMismatches, escrows, summary } = data

  return (
    <div className="space-y-6">
      {/* System Health Status */}
      <Card className={systemHealth.isHealthy ? "border-emerald-500" : "border-red-500"}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {systemHealth.isHealthy ? (
                <div className="p-2 rounded-full bg-emerald-100">
                  <ShieldCheck className="h-6 w-6 text-emerald-600" />
                </div>
              ) : (
                <div className="p-2 rounded-full bg-red-100">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
              )}
              <div>
                <CardTitle className="text-xl">
                  {systemHealth.isHealthy ? "System Healthy" : "Mismatch Detected"}
                </CardTitle>
                <CardDescription>
                  {systemHealth.isHealthy 
                    ? "All financial records are in sync"
                    : `${systemHealth.missingFromDbCount + systemHealth.walletMismatchCount} issues found`
                  }
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchReconciliationData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {!systemHealth.isHealthy && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleReconcileAll}
                  disabled={reconcileLoading}
                >
                  {reconcileLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Fix All Wallets
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stripe Deposits</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(systemHealth.stripeTotalCents)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.totalStripePayments} payments (30 days)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">DB Records</CardTitle>
            <Database className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(systemHealth.dbTotalCents)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.totalDbRecords} transactions recorded
            </p>
            {systemHealth.stripeDbDelta !== 0 && (
              <p className="text-xs text-red-500 mt-1">
                Δ {formatCurrency(systemHealth.stripeDbDelta)} from Stripe
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wallet Balances</CardTitle>
            <Wallet className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(systemHealth.walletsTotalCents)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.totalWallets} active wallets
            </p>
            {systemHealth.walletDelta !== 0 && (
              <p className="text-xs text-red-500 mt-1">
                Δ {formatCurrency(systemHealth.walletDelta)} drift
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Issues Found</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              systemHealth.missingFromDbCount + systemHealth.walletMismatchCount > 0 
                ? "text-red-600" 
                : "text-emerald-600"
            }`}>
              {systemHealth.missingFromDbCount + systemHealth.walletMismatchCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {systemHealth.missingFromDbCount} missing, {systemHealth.walletMismatchCount} mismatched
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="deposits" className="space-y-4">
        <TabsList>
          <TabsTrigger value="deposits" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Stripe ↔ DB
            {systemHealth.missingFromDbCount > 0 && (
              <Badge variant="destructive" className="ml-1">{systemHealth.missingFromDbCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="wallets" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Wallet Integrity
            {systemHealth.walletMismatchCount > 0 && (
              <Badge variant="destructive" className="ml-1">{systemHealth.walletMismatchCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="escrow" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Escrow
          </TabsTrigger>
          <TabsTrigger value="corrections" className="flex items-center gap-2">
            <FileX className="h-4 w-4" />
            Transaction Corrections
          </TabsTrigger>
        </TabsList>

        {/* Stripe ↔ DB Reconciliation */}
        <TabsContent value="deposits">
          <Card>
            <CardHeader>
              <CardTitle>Stripe Payment Reconciliation</CardTitle>
              <CardDescription>
                Comparing Stripe checkout sessions with database records (last 30 days)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {depositReconciliation.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
                  <p>No Stripe payments in the last 30 days.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Stripe ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Stripe Amount</TableHead>
                        <TableHead className="text-right">DB Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {depositReconciliation.map((item) => (
                        <TableRow key={item.stripeId}>
                          <TableCell className="text-sm">
                            {formatDate(item.stripeDate)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {item.stripeId.slice(0, 20)}...
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.stripeCustomerEmail || "N/A"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(item.stripeAmount || 0)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.dbAmount !== null ? formatCurrency(item.dbAmount) : "—"}
                          </TableCell>
                          <TableCell>
                            {item.status === "matched" && (
                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                                <CheckCircle className="mr-1 h-3 w-3" /> Matched
                              </Badge>
                            )}
                            {item.status === "missing_db_record" && (
                              <Badge variant="destructive">
                                <AlertTriangle className="mr-1 h-3 w-3" /> Missing DB
                              </Badge>
                            )}
                            {item.status === "amount_mismatch" && (
                              <Badge variant="outline" className="text-amber-600 border-amber-300">
                                <AlertTriangle className="mr-1 h-3 w-3" /> Amount Mismatch
                              </Badge>
                            )}
                            {item.status === "dismissed" && (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                                <Trash2 className="mr-1 h-3 w-3" /> Dismissed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.status === "missing_db_record" && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRecoverStripePayment(item)}
                                  disabled={recoveringId === item.stripeId || dismissingId === item.stripeId}
                                  title="Create DB record and credit wallet"
                                >
                                  {recoveringId === item.stripeId ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Database className="h-4 w-4 mr-1" />
                                      Recover
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground hover:text-red-600"
                                  onClick={() => openDismissDialog(item)}
                                  disabled={recoveringId === item.stripeId || dismissingId === item.stripeId}
                                  title="Mark as invalid/test payment"
                                >
                                  {dismissingId === item.stripeId ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Trash2 className="h-4 w-4 mr-1" />
                                      Dismiss
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                            {item.status === "matched" && (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                            {item.status === "dismissed" && (
                              <span className="text-muted-foreground text-sm">Dismissed</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Wallet Integrity */}
        <TabsContent value="wallets">
          <Card>
            <CardHeader>
              <CardTitle>Wallet Balance Integrity</CardTitle>
              <CardDescription>
                Comparing wallet.balance_cents against sum(financial_transactions)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {walletMismatches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
                  <p>All wallet balances match their transaction history.</p>
                  <p className="text-sm">No reconciliation needed.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User ID</TableHead>
                        <TableHead className="text-right">Wallet Balance</TableHead>
                        <TableHead className="text-right">Calculated</TableHead>
                        <TableHead className="text-right">Delta</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {walletMismatches.map((item) => (
                        <TableRow key={item.userId}>
                          <TableCell className="font-mono text-xs">
                            {item.userId.slice(0, 12)}...
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(item.walletBalance)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(item.calculatedBalance)}
                          </TableCell>
                          <TableCell className={`text-right font-mono font-medium ${
                            item.delta > 0 ? "text-emerald-600" : "text-red-600"
                          }`}>
                            {item.delta >= 0 ? "+" : ""}{formatCurrency(item.delta)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              Needs Fix
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Escrow */}
        <TabsContent value="escrow">
          <Card>
            <CardHeader>
              <CardTitle>Active Escrow Accounts</CardTitle>
              <CardDescription>
                Tournament funds held in escrow
              </CardDescription>
            </CardHeader>
            <CardContent>
              {escrows.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p>No active escrow accounts.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tournament</TableHead>
                        <TableHead className="text-right">Funded Amount</TableHead>
                        <TableHead className="text-right">Participants</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {escrows.map((item) => (
                        <TableRow key={item.tournamentId}>
                          <TableCell className="font-medium">
                            {item.tournamentName}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(item.fundedAmount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.participantCount}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {item.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transaction Corrections */}
        <TabsContent value="corrections">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Transaction Corrections</CardTitle>
                  <CardDescription>
                    Void erroneous deposit transactions that were recorded but never credited to wallets
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  onClick={fetchOrphanedDeposits}
                  disabled={loadingOrphans}
                >
                  {loadingOrphans ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Scan for Issues
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 mb-4 md:grid-cols-2">
                <Alert>
                  <Trash2 className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Void (Invalid):</strong> Use when transaction never happened (test webhook, ghost record). 
                    Marks as invalid and excludes from calculations.
                  </AlertDescription>
                </Alert>
                <Alert>
                  <Undo2 className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Reverse (Refund):</strong> Use when real money needs to be undone (refund, chargeback). 
                    Creates opposite entry to keep ledger balanced.
                  </AlertDescription>
                </Alert>
              </div>

              {orphanedDeposits.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
                  <p>No orphaned deposits found.</p>
                  <p className="text-sm mt-1">Click &quot;Scan for Issues&quot; to check for problematic transactions.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Stripe Session</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orphanedDeposits.map((deposit) => (
                        <TableRow key={deposit.id}>
                          <TableCell className="text-sm">
                            {formatDate(deposit.created_at)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {deposit.id.slice(0, 12)}...
                          </TableCell>
                          <TableCell className="text-sm">
                            {deposit.description}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(deposit.amount_cents)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {deposit.stripe_session_id 
                              ? `${deposit.stripe_session_id.slice(0, 15)}...` 
                              : "N/A"
                            }
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => openVoidDialog(deposit)}
                                disabled={voidingId === deposit.id || reversingId === deposit.id}
                              >
                                {voidingId === deposit.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Void
                                  </>
                                )}
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => openReverseDialog(deposit)}
                                disabled={voidingId === deposit.id || reversingId === deposit.id}
                              >
                                {reversingId === deposit.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Undo2 className="h-4 w-4 mr-1" />
                                    Reverse
                                  </>
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Void Confirmation Dialog */}
      <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void Transaction</DialogTitle>
            <DialogDescription>
              This will mark the transaction as voided and exclude it from all balance calculations.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-mono font-medium">
                    {formatCurrency(selectedTransaction.amount_cents)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date:</span>
                  <span>{formatDate(selectedTransaction.created_at)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Description:</span>
                  <span className="truncate ml-2">{selectedTransaction.description}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="voidReason">Reason for voiding (required)</Label>
                <Input
                  id="voidReason"
                  placeholder="e.g., Test mode transaction, webhook failure, duplicate entry"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleVoidTransaction}
              disabled={!voidReason.trim() || voidingId !== null}
            >
              {voidingId ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Void Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stripe Warning Dialog */}
      <Dialog open={stripeWarningOpen} onOpenChange={setStripeWarningOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Stripe Transaction Detected
            </DialogTitle>
            <DialogDescription>
              This transaction is linked to a real Stripe payment. Voiding it may cause reconciliation issues.
            </DialogDescription>
          </DialogHeader>
          
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Recommended:</strong> Use REVERSE instead of VOID for real money transactions. 
              Reversing creates an opposing entry to maintain ledger balance.
            </AlertDescription>
          </Alert>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => {
              setStripeWarningOpen(false)
              setSelectedTransaction(null)
            }}>
              Cancel
            </Button>
            <Button 
              variant="default"
              onClick={() => {
                setStripeWarningOpen(false)
                if (selectedTransaction) openReverseDialog(selectedTransaction)
              }}
            >
              <Undo2 className="h-4 w-4 mr-2" />
              Reverse Instead
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                setForceVoid(true)
                setStripeWarningOpen(false)
                setVoidDialogOpen(true)
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Force Void Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reverse Transaction Dialog */}
      <Dialog open={reverseDialogOpen} onOpenChange={setReverseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse Transaction</DialogTitle>
            <DialogDescription>
              This will create an opposing transaction to undo the original amount. 
              The ledger will remain balanced (+{formatCurrency(selectedTransaction?.amount_cents || 0)} original, -{formatCurrency(selectedTransaction?.amount_cents || 0)} reversal = net $0).
            </DialogDescription>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Original Amount:</span>
                  <span className="font-mono font-medium text-emerald-600">
                    +{formatCurrency(selectedTransaction.amount_cents)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Reversal Amount:</span>
                  <span className="font-mono font-medium text-red-600">
                    -{formatCurrency(selectedTransaction.amount_cents)}
                  </span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-muted-foreground">Net Effect:</span>
                  <span className="font-mono font-medium">$0.00</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reverseReason">Reason for reversal (required)</Label>
                <Input
                  id="reverseReason"
                  placeholder="e.g., Customer refund, Chargeback, Admin correction"
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReverseDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReverseTransaction}
              disabled={!reverseReason.trim() || reversingId !== null}
            >
              {reversingId ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Undo2 className="h-4 w-4 mr-2" />
              )}
              Reverse Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recover Stripe Payment Dialog */}
      <RecoverStripePaymentDialog
        open={recoverDialogOpen}
        onOpenChange={setRecoverDialogOpen}
        stripeItem={selectedStripeItem}
        onConfirm={confirmRecoverStripePayment}
        formatCurrency={formatCurrency}
        recovering={recoveringId !== null}
      />

      {/* Dismiss Stripe Payment Dialog */}
      <Dialog open={dismissDialogOpen} onOpenChange={setDismissDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Dismiss Stripe Payment
            </DialogTitle>
            <DialogDescription>
              Mark this payment as invalid/test so it won&apos;t appear in reconciliation. 
              No funds will be credited.
            </DialogDescription>
          </DialogHeader>
          
          {selectedStripeItem && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Stripe ID:</span>
                  <span className="font-mono text-xs">{selectedStripeItem.stripeId.slice(0, 25)}...</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-mono font-medium">
                    {formatCurrency(selectedStripeItem.stripeAmount || 0)}
                  </span>
                </div>
              </div>

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This payment will be marked as dismissed. The user will NOT receive funds. 
                  Only use this for test payments or invalid charges.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="dismissReason">Reason for dismissal (required)</Label>
                <Input
                  id="dismissReason"
                  placeholder="e.g., Test payment, Invalid charge, Duplicate"
                  value={dismissReason}
                  onChange={(e) => setDismissReason(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDismissDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDismissStripePayment}
              disabled={!dismissReason.trim() || dismissingId !== null}
            >
              {dismissingId ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Dismiss Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Separate component for recover dialog to manage its own state
function RecoverStripePaymentDialog({
  open,
  onOpenChange,
  stripeItem,
  onConfirm,
  formatCurrency,
  recovering,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  stripeItem: DepositReconciliation | null
  onConfirm: (userId: string) => void
  formatCurrency: (cents: number) => string
  recovering: boolean
}) {
  const [userId, setUserId] = useState("")
  const [lookupEmail, setLookupEmail] = useState("")
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupResult, setLookupResult] = useState<{ id: string; email: string } | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setUserId("")
      setLookupEmail("")
      setLookupResult(null)
      setLookupError(null)
    } else if (stripeItem) {
      // Auto-populate userId if available in Stripe metadata
      if (stripeItem.userId) {
        setUserId(stripeItem.userId)
      }
      // Auto-populate email for lookup
      if (stripeItem.stripeCustomerEmail) {
        setLookupEmail(stripeItem.stripeCustomerEmail)
      }
    }
  }, [open, stripeItem])

  async function lookupUserByEmail() {
    if (!lookupEmail.trim()) return
    
    setLookingUp(true)
    setLookupError(null)
    setLookupResult(null)
    
    try {
      const response = await fetch(`/api/admin/users/lookup?email=${encodeURIComponent(lookupEmail)}`)
      const result = await response.json()
      
      if (result.success && result.user) {
        setLookupResult(result.user)
        setUserId(result.user.id)
      } else {
        setLookupError(result.error || "User not found")
      }
    } catch {
      setLookupError("Failed to lookup user")
    }
    
    setLookingUp(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recover Missing Stripe Payment</DialogTitle>
          <DialogDescription>
            Create a database record for this Stripe payment that was not recorded due to a webhook failure.
          </DialogDescription>
        </DialogHeader>
        
        {stripeItem && (
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Stripe ID:</span>
                <span className="font-mono text-xs">{stripeItem.stripeId.slice(0, 25)}...</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-mono font-medium text-emerald-600">
                  {formatCurrency(stripeItem.stripeAmount || 0)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Customer Email:</span>
                <span>{stripeItem.stripeCustomerEmail || "N/A"}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Lookup User by Email</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="user@example.com"
                    value={lookupEmail}
                    onChange={(e) => setLookupEmail(e.target.value)}
                  />
                  <Button 
                    variant="outline" 
                    onClick={lookupUserByEmail}
                    disabled={lookingUp || !lookupEmail.trim()}
                  >
                    {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lookup"}
                  </Button>
                </div>
              </div>

              {lookupResult && (
                <Alert>
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <AlertDescription>
                    Found user: <strong>{lookupResult.email}</strong>
                    <br />
                    <span className="font-mono text-xs">{lookupResult.id}</span>
                  </AlertDescription>
                </Alert>
              )}

              {lookupError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{lookupError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="userId">User ID (required)</Label>
                <Input
                  id="userId"
                  placeholder="UUID of the user to credit"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => onConfirm(userId)}
            disabled={!userId.trim() || recovering}
          >
            {recovering ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Database className="h-4 w-4 mr-2" />
            )}
            Recover Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
