"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RefreshCw, AlertTriangle, CheckCircle, Search, Loader2, ShieldCheck } from "lucide-react"
import { findWalletInconsistencies, recalculateAllWallets } from "@/lib/wallet-actions"

interface Inconsistency {
  userId: string
  email: string
  walletBalance: number
  transactionSum: number
  difference: number
}

interface ReconciliationResult {
  success?: boolean
  error?: string
  fixed?: number
  total?: number
  details?: Array<{
    userId: string
    previousBalance: number
    newBalance: number
    adjustment: number
  }>
}

export function WalletReconciliation() {
  const [loading, setLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [inconsistencies, setInconsistencies] = useState<Inconsistency[] | null>(null)
  const [reconcileResult, setReconcileResult] = useState<ReconciliationResult | null>(null)

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  async function handleFindInconsistencies() {
    setSearchLoading(true)
    setInconsistencies(null)
    
    const result = await findWalletInconsistencies()
    
    if (result.success) {
      setInconsistencies(result.inconsistencies || [])
    } else {
      setInconsistencies([])
    }
    
    setSearchLoading(false)
  }

  async function handleRecalculateAll() {
    setLoading(true)
    setReconcileResult(null)
    
    const result = await recalculateAllWallets()
    setReconcileResult(result)
    
    // Refresh inconsistencies after reconciliation
    if (result.success) {
      await handleFindInconsistencies()
    }
    
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Wallet Reconciliation
            </CardTitle>
            <CardDescription>
              Audit wallet balances against transaction history and fix inconsistencies
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={handleFindInconsistencies}
            disabled={searchLoading}
          >
            {searchLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Find Inconsistencies
              </>
            )}
          </Button>
          
          <Button
            variant="destructive"
            onClick={handleRecalculateAll}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Recalculating...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Recalculate All Wallets
              </>
            )}
          </Button>
        </div>

        {/* Reconciliation Result */}
        {reconcileResult && (
          <Alert variant={reconcileResult.success ? "default" : "destructive"}>
            {reconcileResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertDescription>
              {reconcileResult.success ? (
                <div>
                  <p className="font-medium">
                    Reconciliation complete: {reconcileResult.fixed} of {reconcileResult.total} wallets adjusted
                  </p>
                  {reconcileResult.details && reconcileResult.details.length > 0 && (
                    <ul className="mt-2 text-sm space-y-1">
                      {reconcileResult.details.slice(0, 5).map((d, i) => (
                        <li key={i}>
                          User {d.userId.slice(0, 8)}...: {formatCurrency(d.previousBalance)} → {formatCurrency(d.newBalance)} 
                          ({d.adjustment >= 0 ? "+" : ""}{formatCurrency(d.adjustment)})
                        </li>
                      ))}
                      {reconcileResult.details.length > 5 && (
                        <li className="text-muted-foreground">
                          ...and {reconcileResult.details.length - 5} more
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              ) : (
                reconcileResult.error
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Inconsistencies Table */}
        {inconsistencies !== null && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">Audit Results</h3>
              {inconsistencies.length === 0 ? (
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  All wallets balanced
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {inconsistencies.length} inconsistencies found
                </Badge>
              )}
            </div>

            {inconsistencies.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">Wallet Balance</TableHead>
                      <TableHead className="text-right">Transaction Sum</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inconsistencies.map((item) => (
                      <TableRow key={item.userId}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{item.email}</p>
                            <p className="text-xs text-muted-foreground">{item.userId.slice(0, 8)}...</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(item.walletBalance)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(item.transactionSum)}
                        </TableCell>
                        <TableCell className={`text-right font-mono font-medium ${
                          item.difference > 0 ? "text-emerald-600" : "text-red-600"
                        }`}>
                          {item.difference >= 0 ? "+" : ""}{formatCurrency(item.difference)}
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

            {inconsistencies.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
                <p>All wallet balances match their transaction history.</p>
                <p className="text-sm">No reconciliation needed.</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
