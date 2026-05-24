"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Wallet, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Lock, 
  Plus,
  TrendingUp,
  Clock,
  ChevronRight,
  Eye,
  EyeOff
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { AddFundsDialog } from "./add-funds-dialog"

interface LedgerEntry {
  id: string
  account_id: string
  direction: "debit" | "credit"
  amount_cents: number
  ledger_accounts: {
    account_type: string
    name: string
    reference_id: string | null
  }
}

interface Transaction {
  id: string
  transaction_type: string
  description: string | null
  status: string
  created_at: string
  posted_at: string | null
  ledger_entries: LedgerEntry[]
}

interface WalletDashboardProps {
  balanceCents: number
  pendingCents: number
  escrowCents: number
  transactions: Transaction[]
  userId: string
  tenantId: string
}

export function WalletDashboard({
  balanceCents,
  pendingCents,
  escrowCents,
  transactions,
  userId,
  tenantId,
}: WalletDashboardProps) {
  const [showBalance, setShowBalance] = useState(true)
  const [addFundsOpen, setAddFundsOpen] = useState(false)

  const availableBalance = balanceCents
  const totalBalance = balanceCents + pendingCents + escrowCents

  const formatAmount = (cents: number) => {
    if (!showBalance) return "••••••"
    return `$${(cents / 100).toFixed(2)}`
  }

  const getTransactionAmount = (tx: Transaction): number => {
    // Find the entry for the user's wallet
    const walletEntry = tx.ledger_entries?.find(
      (entry) => entry.ledger_accounts?.reference_id === userId
    )
    if (!walletEntry) return 0
    // Credit to wallet = positive (money in), Debit = negative (money out)
    return walletEntry.direction === "credit" 
      ? walletEntry.amount_cents 
      : -walletEntry.amount_cents
  }

  const getTransactionLabel = (type: string) => {
    const labels: Record<string, string> = {
      deposit: "Deposit",
      withdrawal: "Withdrawal",
      escrow_lock: "Entry Fee",
      escrow_release: "Winnings",
      payout: "Payout",
      refund: "Refund",
      reversal: "Reversal",
      adjustment: "Adjustment",
    }
    return labels[type] || type.replace(/_/g, " ")
  }

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Main Balance Card */}
        <Card className="md:col-span-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardDescription className="text-foreground/60">Available Balance</CardDescription>
              <div className="flex items-center gap-3 mt-1">
                <CardTitle className="text-4xl font-bold text-primary">
                  {formatAmount(availableBalance)}
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setShowBalance(!showBalance)}
                >
                  {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Wallet className="h-10 w-10 text-primary/40" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 mt-4">
              <Button onClick={() => setAddFundsOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Funds
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/financial/payouts" className="gap-2">
                  <ArrowUpRight className="h-4 w-4" />
                  Withdraw
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Side Stats */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className="text-lg font-semibold">{formatAmount(pendingCents)}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-500/40" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">In Escrow</p>
                  <p className="text-lg font-semibold">{formatAmount(escrowCents)}</p>
                </div>
                <Lock className="h-8 w-8 text-blue-500/40" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <CardDescription>Your latest ledger transactions</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/financial/transactions" className="gap-1">
              View All
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((tx) => {
                const amount = getTransactionAmount(tx)
                const isPositive = amount > 0

                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        isPositive 
                          ? "bg-emerald-500/10 text-emerald-500" 
                          : "bg-red-500/10 text-red-500"
                      }`}>
                        {isPositive ? (
                          <ArrowDownLeft className="h-5 w-5" />
                        ) : (
                          <ArrowUpRight className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{getTransactionLabel(tx.transaction_type)}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.description || tx.transaction_type}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        isPositive ? "text-emerald-500" : "text-red-500"
                      }`}>
                        {isPositive ? "+" : ""}{showBalance ? `$${(Math.abs(amount) / 100).toFixed(2)}` : "••••"}
                      </p>
                      <div className="flex items-center gap-2 justify-end">
                        <Badge variant={tx.status === "posted" ? "default" : "secondary"} className="text-xs">
                          {tx.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <TrendingUp className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="mb-2 font-medium">No transactions yet</p>
              <p className="text-sm text-muted-foreground">
                Add funds to your wallet to get started
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AddFundsDialog 
        open={addFundsOpen} 
        onOpenChange={setAddFundsOpen}
        tenantId={tenantId}
      />
    </div>
  )
}
