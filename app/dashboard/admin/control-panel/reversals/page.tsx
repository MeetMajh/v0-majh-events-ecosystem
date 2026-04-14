import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ReversalsManager } from "@/components/control-panel/reversals-manager"

export default async function ReversalsPage() {
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

  // Fetch reversals
  const { data: reversals } = await supabase
    .from("financial_transactions")
    .select(`
      id,
      user_id,
      type,
      amount_cents,
      status,
      description,
      reversal_of,
      reversal_reason,
      created_at
    `)
    .eq("type", "reversal")
    .order("created_at", { ascending: false })
    .limit(50)

  // Fetch reversible transactions (completed, not reversed)
  const { data: reversibleTransactions } = await supabase
    .from("financial_transactions")
    .select(`
      id,
      user_id,
      type,
      amount_cents,
      status,
      description,
      created_at
    `)
    .eq("status", "completed")
    .is("reversed_at", null)
    .in("type", ["deposit", "prize", "manual_credit"])
    .order("created_at", { ascending: false })
    .limit(100)

  // Fetch all relevant user profiles
  const allUserIds = [...new Set([
    ...(reversals?.map(r => r.user_id).filter(Boolean) || []),
    ...(reversibleTransactions?.map(t => t.user_id).filter(Boolean) || [])
  ])]

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .in("id", allUserIds.length > 0 ? allUserIds : [""])

  const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])

  const enrichedReversals = reversals?.map(r => ({
    ...r,
    profiles: r.user_id ? profilesMap.get(r.user_id) || null : null,
  })) || []

  const enrichedReversible = reversibleTransactions?.map(t => ({
    ...t,
    profiles: t.user_id ? profilesMap.get(t.user_id) || null : null,
  })) || []

  return (
    <ReversalsManager 
      reversals={enrichedReversals} 
      reversibleTransactions={enrichedReversible}
    />
  )
}
