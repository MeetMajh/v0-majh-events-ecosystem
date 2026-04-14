import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { WithdrawalsManager } from "@/components/control-panel/withdrawals-manager"

export default async function WithdrawalsPage() {
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

  // Fetch withdrawal requests
  const { data: withdrawals } = await supabase
    .from("financial_transactions")
    .select(`
      id,
      user_id,
      amount_cents,
      status,
      description,
      stripe_session_id,
      created_at,
      profiles:user_id (
        display_name,
        email
      )
    `)
    .eq("type", "withdrawal")
    .order("created_at", { ascending: false })
    .limit(100)

  return <WithdrawalsManager withdrawals={withdrawals || []} />
}
