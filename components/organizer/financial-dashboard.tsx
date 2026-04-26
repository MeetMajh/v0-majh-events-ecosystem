"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Ban,
  Wallet,
  Trophy,
  ArrowUpRight,
  Shield,
  ExternalLink,
} from "lucide-react"
import Link from "next/link"

interface OrganizerDashboardData {
  organizer_id: string
  totals: {
    gross_volume_cents: number
    fees_paid_cents: number
    net_earned_cents: number
    payouts_received_cents: number
    refunds_issued_cents: number
    tournament_count: number
  }
  disputes: {
    active_count: number
    lost_count: number
  }
  tournaments: Array<{
    tournament_id: string
    tournament_name: string
    status: string
    gross_entries_cents: number
    platform_fees_cents: number
    escrow_balance_cents: number
    payouts_executed_cents: number
    entry_count: number
    refund_count: number
  }>
  generated_at: string
}

interface LiabilityData {
  organizer_id: string
  total_disputes: number
  lost_disputes: number
  total_liability_cents: number
  collected_cents: number
  outstanding_cents: number
  generated_at: string
}

interface PayoutRequest {
  id: string
  tournament_id: string
  amount_cents: number
  net_amount_cents: number | null
  status: string
  placement: number | null
  is_on_hold: boolean
  hold_reason: string | null
  stripe_transfer_id: string | null
  processed_at: string | null
  created_at: string
  tournaments: { name: string; slug: string } | null
}

interface Dispute {
  id: string
  stripe_dispute_id: string
  amount_cents: number
  reason: string
  status: string
  organizer_liability_cents: number
  liability_collected: boolean
  created_at: string
}

interface Profile {
  stripe_connect_account_id: string | null
  stripe_connect_status: string | null
  stripe_connect_payouts_enabled: boolean
  kyc_verified: boolean
}

interface Props {
  dashboardData: OrganizerDashboardData | null
  liabilityData: LiabilityData | null
  payoutRequests: PayoutRequest[]
  disputes: Dispute[]
  profile: Profile | null
  dashboardError?: string
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getStatusBadge(status: string) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    pending: { variant: "secondary", icon: <Clock className="mr-1 h-3 w-3" /> },
    approved: { variant: "default", icon: <CheckCircle2 className="mr-1 h-3 w-3" /> },
    eligible: { variant: "default", icon: <CheckCircle2 className="mr-1 h-3 w-3" /> },
    processing: { variant: "secondary", icon: <Clock className="mr-1 h-3 w-3 animate-spin" /> },
    completed: { variant: "default", icon: <CheckCircle2 className="mr-1 h-3 w-3" /> },
    failed: { variant: "destructive", icon: <XCircle className="mr-1 h-3 w-3" /> },
    blocked: { variant: "destructive", icon: <Ban className="mr-1 h-3 w-3" /> },
  }

  const config = variants[status] || { variant: "outline" as const, icon: null }

  return (
    <Badge variant={config.variant} className="flex w-fit items-center">
      {config.icon}
      {status}
    </Badge>
  )
}

function getDisputeStatusBadge(status: string) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    needs_response: "destructive",
    under_review: "secondary",
    won: "default",
    lost: "destructive",
  }

  return <Badge variant={variants[status] || "outline"}>{status.replace("_", " ")}</Badge>
}

export function OrganizerFinancialDashboard({
  dashboardData,
  liabilityData,
  payoutRequests,
  disputes,
  profile,
  dashboardError,
}: Props) {
  const totals = dashboardData?.totals ?? {
    gross_volume_cents: 0,
    fees_paid_cents: 0,
    net_earned_cents: 0,
    payouts_received_cents: 0,
    refunds_issued_cents: 0,
    tournament_count: 0,
  }

  const disputeStats = dashboardData?.disputes ?? { active_count: 0, lost_count: 0 }
  const tournaments = dashboardData?.tournaments ?? []
  const liability = liabilityData ?? {
    outstanding_cents: 0,
    total_liability_cents: 0,
    collected_cents: 0,
    lost_disputes: 0,
  }

  const pendingPayouts = payoutRequests.filter((p) => ["pending", "approved", "eligible"].includes(p.status))
  const heldPayouts = payoutRequests.filter((p) => p.is_on_hold)
  const completedPayouts = payoutRequests.filter((p) => p.status === "completed")

  const connectNotSetup = !profile?.stripe_connect_account_id
  const connectNotEnabled = profile?.stripe_connect_account_id && !profile?.stripe_connect_payouts_enabled

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Organizer Financials</h1>
          <p className="text-sm text-muted-foreground">
            Track your tournament earnings, fees, and payout status
          </p>
        </div>
        {completedPayouts.length > 0 && (
          <Button variant="outline" asChild>
            <Link href="/dashboard/financials/payout-methods">
              <Wallet className="mr-2 h-4 w-4" />
              Payout Settings
            </Link>
          </Button>
        )}
      </div>

      {/* Alerts */}
      {connectNotSetup && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Stripe Connect Not Setup</AlertTitle>
          <AlertDescription>
            You need to set up Stripe Connect to receive payouts.{" "}
            <Link href="/dashboard/financials/payout-methods" className="underline">
              Set up now
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {connectNotEnabled && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Stripe Connect Pending</AlertTitle>
          <AlertDescription>
            Your Stripe Connect account is being verified. Payouts will be enabled once verification is complete.
          </AlertDescription>
        </Alert>
      )}

      {disputeStats.active_count > 0 && (
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertTitle>Active Disputes</AlertTitle>
          <AlertDescription>
            You have {disputeStats.active_count} active dispute{disputeStats.active_count > 1 ? "s" : ""}.
            Some payouts may be held until disputes are resolved.
          </AlertDescription>
        </Alert>
      )}

      {liability.outstanding_cents > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Outstanding Liability</AlertTitle>
          <AlertDescription>
            You have {formatCurrency(liability.outstanding_cents)} in outstanding liability from lost disputes.
            This may be deducted from future payouts.
          </AlertDescription>
        </Alert>
      )}

      {heldPayouts.length > 0 && (
        <Alert>
          <Ban className="h-4 w-4" />
          <AlertTitle>Payouts On Hold</AlertTitle>
          <AlertDescription>
            {heldPayouts.length} payout{heldPayouts.length > 1 ? "s are" : " is"} currently on hold.
            {heldPayouts[0]?.hold_reason && ` Reason: ${heldPayouts[0].hold_reason}`}
          </AlertDescription>
        </Alert>
      )}

      {dashboardError && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>{dashboardError}</AlertDescription>
        </Alert>
      )}

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.gross_volume_cents)}</div>
            <p className="text-xs text-muted-foreground">
              From {totals.tournament_count} tournament{totals.tournament_count !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Fees</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{formatCurrency(totals.fees_paid_cents)}</div>
            <p className="text-xs text-muted-foreground">
              {totals.gross_volume_cents > 0
                ? `${((totals.fees_paid_cents / totals.gross_volume_cents) * 100).toFixed(1)}% of gross`
                : "No fees yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Earnings</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totals.net_earned_cents)}</div>
            <p className="text-xs text-muted-foreground">After platform fees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Out</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.payouts_received_cents)}</div>
            <p className="text-xs text-muted-foreground">
              {completedPayouts.length} payout{completedPayouts.length !== 1 ? "s" : ""} completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="payouts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payouts">
            Payouts
            {pendingPayouts.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingPayouts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
          <TabsTrigger value="disputes">
            Disputes
            {disputeStats.active_count > 0 && (
              <Badge variant="destructive" className="ml-2">
                {disputeStats.active_count}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Payouts Tab */}
        <TabsContent value="payouts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payout Requests</CardTitle>
              <CardDescription>
                Track the status of your tournament winnings and payouts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {payoutRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Trophy className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No payout requests yet</p>
                  <p className="text-sm text-muted-foreground">
                    Complete tournaments to earn payouts
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tournament</TableHead>
                      <TableHead>Placement</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payoutRequests.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell>
                          {payout.tournaments ? (
                            <Link
                              href={`/tournaments/${payout.tournaments.slug}`}
                              className="flex items-center hover:underline"
                            >
                              {payout.tournaments.name}
                              <ArrowUpRight className="ml-1 h-3 w-3" />
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">Unknown</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {payout.placement ? (
                            <Badge variant="outline">#{payout.placement}</Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(payout.net_amount_cents ?? payout.amount_cents)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {getStatusBadge(payout.status)}
                            {payout.is_on_hold && (
                              <span className="text-xs text-destructive">
                                On hold: {payout.hold_reason || "Under review"}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {payout.processed_at
                            ? formatDate(payout.processed_at)
                            : formatDate(payout.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tournaments Tab */}
        <TabsContent value="tournaments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tournament Breakdown</CardTitle>
              <CardDescription>
                Revenue and fees for each of your tournaments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tournaments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Trophy className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No tournament data yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tournament</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Entries</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Fees</TableHead>
                      <TableHead>Net</TableHead>
                      <TableHead>Escrow</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tournaments.map((t) => (
                      <TableRow key={t.tournament_id}>
                        <TableCell className="font-medium">{t.tournament_name}</TableCell>
                        <TableCell>
                          <Badge variant={t.status === "completed" ? "default" : "secondary"}>
                            {t.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{t.entry_count}</TableCell>
                        <TableCell>{formatCurrency(t.gross_entries_cents)}</TableCell>
                        <TableCell className="text-amber-600">
                          {formatCurrency(t.platform_fees_cents)}
                        </TableCell>
                        <TableCell className="font-medium text-emerald-600">
                          {formatCurrency(t.gross_entries_cents - t.platform_fees_cents)}
                        </TableCell>
                        <TableCell>
                          {t.escrow_balance_cents > 0 ? (
                            <span className="text-blue-600">
                              {formatCurrency(t.escrow_balance_cents)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Disputes Tab */}
        <TabsContent value="disputes" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active Disputes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {disputeStats.active_count}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Lost Disputes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{disputeStats.lost_count}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Outstanding Liability</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {formatCurrency(liability.outstanding_cents)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Dispute History</CardTitle>
              <CardDescription>
                Disputes filed against transactions on your tournaments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {disputes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Shield className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No disputes</p>
                  <p className="text-sm text-muted-foreground">Keep up the good work!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dispute ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Liability</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disputes.map((dispute) => (
                      <TableRow key={dispute.id}>
                        <TableCell>
                          <code className="text-xs">{dispute.stripe_dispute_id.slice(0, 15)}...</code>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(dispute.amount_cents)}
                        </TableCell>
                        <TableCell>{dispute.reason || "-"}</TableCell>
                        <TableCell>{getDisputeStatusBadge(dispute.status)}</TableCell>
                        <TableCell>
                          {dispute.organizer_liability_cents > 0 ? (
                            <span className={dispute.liability_collected ? "text-muted-foreground" : "text-destructive"}>
                              {formatCurrency(dispute.organizer_liability_cents)}
                              {dispute.liability_collected && " (collected)"}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(dispute.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
