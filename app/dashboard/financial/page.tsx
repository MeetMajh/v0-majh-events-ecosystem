import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { WalletDashboard } from "@/components/financial/wallet-dashboard"

export const metadata = {
  title: "Wallet | Financial Dashboard | MAJH Events",
  description: "View your wallet balance and recent activity",
}

export default async function FinancialWalletPage() {
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

  // Get ledger wallet balance
  const { data: walletBalance } = await supabase
    .from("ledger_balances")
    .select("*")
    .eq("tenant_id", membership.tenant_id)
    .eq("account_type", "user_wallet")
    .eq("reference_id", user.id)
    .single()

  // Get pending withdrawals
  const { data: pendingWithdrawals } = await supabase
    .from("ledger_balances")
    .select("balance_cents")
    .eq("tenant_id", membership.tenant_id)
    .eq("account_type", "pending_withdrawals")
    .single()

  // Get escrow balance
  const { data: escrowBalances } = await supabase
    .from("ledger_balances")
    .select("balance_cents")
    .eq("tenant_id", membership.tenant_id)
    .eq("account_type", "escrow")

  const totalEscrow = escrowBalances?.reduce((sum, e) => sum + Number(e.balance_cents || 0), 0) || 0

  // Get recent ledger transactions
  const { data: recentTransactions } = await supabase
    .from("ledger_transactions")
    .select(`
      id,
      transaction_type,
      description,
      status,
      created_at,
      posted_at,
      ledger_entries (
        id,
        account_id,
        direction,
        amount_cents,
        ledger_accounts (
          account_type,
          name,
          reference_id
        )
      )
    `)
    .eq("tenant_id", membership.tenant_id)
    .order("created_at", { ascending: false })
    .limit(10)

  // Filter to transactions involving this user's wallet
  const userTransactions = recentTransactions?.filter(tx => 
    tx.ledger_entries?.some((entry: any) => 
      entry.ledger_accounts?.reference_id === user.id
    )
  ) || []

  return (
    <WalletDashboard
      balanceCents={Number(walletBalance?.balance_cents || 0)}
      pendingCents={Number(pendingWithdrawals?.balance_cents || 0)}
      escrowCents={totalEscrow}
      transactions={userTransactions}
      userId={user.id}
      tenantId={membership.tenant_id}
    />
  )
}
