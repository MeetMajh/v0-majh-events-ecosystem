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
  FileX
} from "lucide-react"
import { findWalletInconsistencies, recalculateAllWallets, voidTransaction, findOrphanedDeposits } from "@/lib/wallet-actions"
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
  status: "matched" | "missing_db_record" | "amount_mismatch"
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
  const [selectedTransaction, setSelectedTransaction] = useState<OrphanedDeposit | null>(null)
  const [voidReason, setVoidReason] = useState("")

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
    const result = await voidTransaction(selectedTransaction.id, voidReason)
    
    if (result.success) {
      // Remove from list and refresh data
      setOrphanedDeposits(prev => prev.filter(d => d.id !== selectedTransaction.id))
      await fetchReconciliationData()
    }
    
    setVoidingId(null)
    setVoidDialogOpen(false)
    setSelectedTransaction(null)
    setVoidReason("")
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
              <Alert className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>When to void transactions:</strong> Use this when a deposit was recorded in the database 
                  (e.g., from a test Stripe webhook) but the payment never actually went through or was from test mode. 
                  Voiding marks the transaction as invalid so it is excluded from balance calculations.
                </AlertDescription>
              </Alert>

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
                        <TableHead>Action</TableHead>
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
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => openVoidDialog(deposit)}
                              disabled={voidingId === deposit.id}
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
    </div>
  )
}
