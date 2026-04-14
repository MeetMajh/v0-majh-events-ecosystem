import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { EscrowManager } from "@/components/control-panel/escrow-manager"

export default async function EscrowPage() {
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

  // Fetch escrow accounts
  const { data: escrows } = await supabase
    .from("escrow_accounts")
    .select(`
      id,
      tournament_id,
      funded_amount_cents,
      target_amount_cents,
      participant_count,
      status,
      is_test,
      created_at,
      tournaments (
        title,
        start_time
      )
    `)
    .order("created_at", { ascending: false })

  return <EscrowManager escrows={escrows || []} />
}
