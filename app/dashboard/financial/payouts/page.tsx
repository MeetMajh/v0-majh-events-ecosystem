import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PayoutsManager } from "@/components/financial/payouts-manager"

export const metadata = {
  title: "Payouts | Financial Dashboard | MAJH Events",
  description: "Request withdrawals and manage payouts",
}

export default async function PayoutsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  // Get user's tenant membership
  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .single()

  if (!membership) {
    redirect("/dashboard/onboarding")
  }

  // Get wallet balance from ledger
  const { data: walletBalance } = await supabase
    .from("ledger_balances")
    .select("balance_cents")
    .eq("tenant_id", membership.tenant_id)
    .eq("account_type", "user_wallet")
    .eq("reference_id", user.id)
    .single()

  // Get pending withdrawals
  const { data: pendingWithdrawals } = await supabase
    .from("ledger_transactions")
    .select(`
      id,
      transaction_type,
      description,
      status,
      created_at,
      ledger_entries (
        amount_cents,
        direction,
        ledger_accounts (
          account_type,
          reference_id
        )
      )
    `)
    .eq("tenant_id", membership.tenant_id)
    .eq("transaction_type", "withdrawal")
    .order("created_at", { ascending: false })
    .limit(20)

  // Get payout methods
  const { data: payoutMethods } = await supabase
    .from("payment_methods")
    .select("*")
    .eq("tenant_id", membership.tenant_id)
    .order("is_default", { ascending: false })

  return (
    <PayoutsManager
      availableBalanceCents={Number(walletBalance?.balance_cents || 0)}
      withdrawals={pendingWithdrawals || []}
      payoutMethods={payoutMethods || []}
      userId={user.id}
      tenantId={membership.tenant_id}
    />
  )
}
