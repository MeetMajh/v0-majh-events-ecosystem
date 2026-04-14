import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { WithdrawForm } from "@/components/financials/withdraw-form"

export const metadata = { title: "Withdraw Funds | Dashboard" }

export default async function WithdrawPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect("/auth/login")

  // Get wallet data
  const { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", user.id)
    .single()

  // Get payout methods
  const { data: payoutMethods } = await supabase
    .from("payout_methods")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_verified", true)
    .order("is_primary", { ascending: false })

  // Get profile for Stripe Connect
  const { data: profile } = await supabase
    .from("profiles")
    .select(`
      stripe_connect_account_id,
      stripe_connect_status,
      stripe_connect_payouts_enabled,
      kyc_verified
    `)
    .eq("id", user.id)
    .single()

  // Get recent withdrawals for history
  const { data: recentWithdrawals } = await supabase
    .from("financial_transactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("type", "withdrawal")
    .order("created_at", { ascending: false })
    .limit(5)

  const availableBalance = wallet?.balance_cents ?? 0
  const hasStripeConnect = profile?.stripe_connect_payouts_enabled ?? false
  const kycVerified = profile?.kyc_verified ?? false

  return (
    <WithdrawForm 
      availableBalance={availableBalance}
      payoutMethods={payoutMethods ?? []}
      hasStripeConnect={hasStripeConnect}
      kycVerified={kycVerified}
      recentWithdrawals={recentWithdrawals ?? []}
    />
  )
}
