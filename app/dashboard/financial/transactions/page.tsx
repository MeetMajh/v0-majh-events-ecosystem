import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { TransactionsTable } from "@/components/financial/transactions-table"

export const metadata = {
  title: "Transactions | Financial Dashboard | MAJH Events",
  description: "View your complete transaction history",
}

export default async function TransactionsPage() {
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

  // Get all ledger transactions for this tenant
  const { data: transactions } = await supabase
    .from("ledger_transactions")
    .select(`
      id,
      transaction_type,
      description,
      status,
      reference_id,
      reference_type,
      idempotency_key,
      created_at,
      posted_at,
      ledger_entries (
        id,
        account_id,
        direction,
        amount_cents,
        created_at,
        ledger_accounts (
          id,
          account_type,
          name,
          reference_id
        )
      )
    `)
    .eq("tenant_id", membership.tenant_id)
    .order("created_at", { ascending: false })
    .limit(100)

  return (
    <TransactionsTable 
      transactions={transactions || []} 
      userId={user.id}
      tenantId={membership.tenant_id}
    />
  )
}
