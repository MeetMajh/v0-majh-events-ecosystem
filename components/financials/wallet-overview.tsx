"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Wallet, TrendingUp, Clock, DollarSign, ArrowUpRight } from "lucide-react"

interface WalletOverviewProps {
  wallet: {
    balance_cents: number
    pending_cents: number
    lifetime_earnings_cents: number
  } | null
  profile: {
    total_earnings_cents?: number
    kyc_verified?: boolean
  } | null
  organizerEarnings?: {
    totalEarnings: number
    pendingEarnings: number
    tournaments: number
  } | null
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

export function WalletOverview({ wallet, profile, organizerEarnings }: WalletOverviewProps) {
  const balance = wallet?.balance_cents ?? 0
  const pending = wallet?.pending_cents ?? 0
  const lifetime = wallet?.lifetime_earnings_cents ?? profile?.total_earnings_cents ?? 0

  return (
    <>
      {/* Available Balance */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
        <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Available Balance
          </CardTitle>
          <Wallet className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent className="relative">
          <div className="text-2xl font-bold text-foreground">{formatCurrency(balance)}</div>
          {balance > 0 ? (
            <Button variant="link" className="h-auto p-0 text-xs text-primary" asChild>
              <Link href="/dashboard/financials/withdraw">
                Withdraw
                <ArrowUpRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">No balance to withdraw</p>
          )}
        </CardContent>
      </Card>

      {/* Pending */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Pending
          </CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{formatCurrency(pending)}</div>
          <p className="text-xs text-muted-foreground">
            Awaiting processing
          </p>
        </CardContent>
      </Card>

      {/* Lifetime Earnings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Lifetime Earnings
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{formatCurrency(lifetime)}</div>
          <p className="text-xs text-muted-foreground">
            Total prize money won
          </p>
        </CardContent>
      </Card>

      {/* Organizer Earnings (if applicable) */}
      {organizerEarnings && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Organizer Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(organizerEarnings.totalEarnings)}
            </div>
            <p className="text-xs text-muted-foreground">
              From {organizerEarnings.tournaments} tournaments
              {organizerEarnings.pendingEarnings > 0 && (
                <> ({formatCurrency(organizerEarnings.pendingEarnings)} pending)</>
              )}
            </p>
          </CardContent>
        </Card>
      )}
    </>
  )
}
