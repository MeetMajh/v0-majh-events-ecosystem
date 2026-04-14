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
      created_at
    `)
    .eq("type", "withdrawal")
    .order("created_at", { ascending: false })
    .limit(100)

  // Fetch profiles separately
  const userIds = [...new Set(withdrawals?.map(w => w.user_id).filter(Boolean) || [])]
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .in("id", userIds.length > 0 ? userIds : [""])

  const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])

  const enrichedWithdrawals = withdrawals?.map(w => ({
    ...w,
    profiles: w.user_id ? profilesMap.get(w.user_id) || null : null,
  })) || []

  return <WithdrawalsManager withdrawals={enrichedWithdrawals} />
}
