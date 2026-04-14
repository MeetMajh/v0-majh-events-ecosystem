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
      created_at,
      profiles:user_id (
        display_name,
        email
      )
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
      created_at,
      profiles:user_id (
        display_name,
        email
      )
    `)
    .eq("status", "completed")
    .is("reversed_at", null)
    .in("type", ["deposit", "prize", "manual_credit"])
    .order("created_at", { ascending: false })
    .limit(100)

  return (
    <ReversalsManager 
      reversals={reversals || []} 
      reversibleTransactions={reversibleTransactions || []}
    />
  )
}
