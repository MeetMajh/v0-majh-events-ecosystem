import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { WalletOverview } from "@/components/financials/wallet-overview"
import { RecentTransactions } from "@/components/financials/recent-transactions"
import { PendingWinnings } from "@/components/financials/pending-winnings"
import { ConnectAccountStatus } from "@/components/financials/connect-account-status"
import { FinancialAlerts } from "@/components/financials/financial-alerts"

export const metadata = { title: "Wallet & Earnings | Dashboard" }

export default async function FinancialsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect("/auth/login")

  // Get wallet data
  const { data: wallet } = await supabase
    .from("user_wallets")
    .select("*")
    .eq("user_id", user.id)
    .single()

  // Get recent transactions
  const { data: transactions } = await supabase
    .from("wallet_transactions")
    .select("*, tournaments(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10)

  // Get pending payouts
  const { data: pendingPayouts } = await supabase
    .from("player_payouts")
    .select(`
      *,
      tournaments(id, name, slug, sponsor_name)
    `)
    .eq("user_id", user.id)
    .in("status", ["pending", "awaiting_details", "processing"])
    .order("created_at", { ascending: false })

  // Get profile for connect status
  const { data: profile } = await supabase
    .from("profiles")
    .select(`
      stripe_connect_account_id,
      stripe_connect_status,
      stripe_connect_payouts_enabled,
      kyc_verified,
      total_earnings_cents,
      preferred_payout_method
    `)
    .eq("id", user.id)
    .single()

  // Get financial alerts
  const { data: alerts } = await supabase
    .from("financial_alerts")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_dismissed", false)
    .order("created_at", { ascending: false })
    .limit(5)

  // Get staff role for organizer features
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  const isOrganizer = staffRole && ["owner", "manager", "organizer"].includes(staffRole.role)

  // Get organizer earnings if applicable
  let organizerEarnings = null
  if (isOrganizer) {
    const { data: tournaments } = await supabase
      .from("tournaments")
      .select(`
        id,
        name,
        tournament_type,
        status,
        tournament_payments(amount_cents, platform_fee_cents, status)
      `)
      .eq("created_by", user.id)
      .in("tournament_type", ["paid", "sponsored"])

    if (tournaments?.length) {
      let totalEarnings = 0
      let pendingEarnings = 0

      tournaments.forEach((t) => {
        const payments = (t.tournament_payments as any[]) ?? []
        const successfulPayments = payments.filter((p) => p.status === "succeeded")
        const collected = successfulPayments.reduce((sum, p) => sum + p.amount_cents, 0)
        const fees = successfulPayments.reduce((sum, p) => sum + (p.platform_fee_cents ?? 0), 0)
        const net = collected - fees

        if (t.status === "completed") {
          totalEarnings += net
        } else {
          pendingEarnings += net
        }
      })

      organizerEarnings = { totalEarnings, pendingEarnings, tournaments: tournaments.length }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Wallet & Earnings</h1>
        <p className="text-muted-foreground">Manage your tournament winnings and payouts</p>
      </div>

      {/* Financial Alerts */}
      {alerts && alerts.length > 0 && (
        <FinancialAlerts alerts={alerts} />
      )}

      {/* Main Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <WalletOverview 
          wallet={wallet}
          profile={profile}
          organizerEarnings={organizerEarnings}
        />
      </div>

      {/* Pending Winnings */}
      {pendingPayouts && pendingPayouts.length > 0 && (
        <PendingWinnings payouts={pendingPayouts} />
      )}

      {/* Stripe Connect Status for Organizers */}
      {isOrganizer && (
        <ConnectAccountStatus profile={profile} />
      )}

      {/* Recent Transactions */}
      <RecentTransactions transactions={transactions ?? []} />
    </div>
  )
}
