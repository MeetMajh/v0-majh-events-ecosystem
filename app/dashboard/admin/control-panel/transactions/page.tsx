import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { TransactionsLedger } from "@/components/control-panel/transactions-ledger"

export default async function TransactionsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Check admin/staff access
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["owner", "manager"])
    .single()

  if (!staffRole) redirect("/dashboard")

  // Fetch transactions
  const { data: transactions } = await supabase
    .from("financial_transactions")
    .select(`
      id,
      user_id,
      type,
      amount_cents,
      status,
      description,
      stripe_session_id,
      tournament_id,
      environment,
      is_test,
      reversed_at,
      reversal_reason,
      created_at
    `)
    .order("created_at", { ascending: false })
    .limit(100)

  // Fetch profiles separately
  const userIds = [...new Set(transactions?.map(t => t.user_id).filter(Boolean) || [])]
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .in("id", userIds.length > 0 ? userIds : [""])

  const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])

  const enrichedTransactions = transactions?.map(tx => ({
    ...tx,
    profiles: tx.user_id ? profilesMap.get(tx.user_id) || null : null,
  })) || []

  return <TransactionsLedger transactions={enrichedTransactions} />
}
