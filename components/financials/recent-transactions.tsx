"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowDownLeft, ArrowUpRight, History, RefreshCcw, Trophy, Minus } from "lucide-react"

interface Transaction {
  id: string
  amount_cents: number
  balance_after_cents: number
  transaction_type: string
  status: string
  description?: string
  created_at: string
  tournaments?: {
    name: string
  } | null
}

interface RecentTransactionsProps {
  transactions: Transaction[]
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function getTransactionIcon(type: string, amount: number) {
  if (amount > 0) {
    if (type === "prize_win") {
      return <Trophy className="h-4 w-4 text-amber-500" />
    }
    return <ArrowDownLeft className="h-4 w-4 text-green-500" />
  }
  if (type === "withdrawal") {
    return <ArrowUpRight className="h-4 w-4 text-red-500" />
  }
  if (type === "refund_issued") {
    return <RefreshCcw className="h-4 w-4 text-blue-500" />
  }
  return <Minus className="h-4 w-4 text-muted-foreground" />
}

function getTransactionLabel(type: string) {
  const labels: Record<string, string> = {
    prize_win: "Prize Winnings",
    entry_fee_collected: "Entry Fee Collected",
    withdrawal: "Withdrawal",
    refund_received: "Refund Received",
    refund_issued: "Refund Issued",
    platform_fee: "Platform Fee",
    deposit: "Deposit",
    adjustment: "Adjustment",
    payout_reversal: "Payout Reversal",
  }
  return labels[type] || type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge variant="outline" className="text-green-600 border-green-600">Completed</Badge>
    case "pending":
      return <Badge variant="outline" className="text-amber-600 border-amber-600">Pending</Badge>
    case "failed":
      return <Badge variant="outline" className="text-red-600 border-red-600">Failed</Badge>
    case "reversed":
      return <Badge variant="outline" className="text-gray-600 border-gray-600">Reversed</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  if (!transactions.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            Transaction History
          </CardTitle>
          <CardDescription>
            Your recent wallet activity will appear here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <History className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No transactions yet</p>
            <p className="text-sm text-muted-foreground/70">
              Win a tournament to see your first transaction!
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          Transaction History
        </CardTitle>
        <CardDescription>
          Your recent wallet activity
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaction</TableHead>
              <TableHead>Tournament</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getTransactionIcon(transaction.transaction_type, transaction.amount_cents)}
                    <div>
                      <p className="font-medium">
                        {getTransactionLabel(transaction.transaction_type)}
                      </p>
                      {transaction.description && (
                        <p className="text-xs text-muted-foreground">
                          {transaction.description}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {transaction.tournaments?.name || "—"}
                </TableCell>
                <TableCell>
                  {getStatusBadge(transaction.status)}
                </TableCell>
                <TableCell className="text-right">
                  <span className={transaction.amount_cents >= 0 ? "text-green-600" : "text-red-600"}>
                    {transaction.amount_cents >= 0 ? "+" : ""}
                    {formatCurrency(transaction.amount_cents)}
                  </span>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(transaction.balance_after_cents)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(transaction.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
