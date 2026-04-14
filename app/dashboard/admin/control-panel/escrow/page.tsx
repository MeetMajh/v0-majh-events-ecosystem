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
      created_at
    `)
    .order("created_at", { ascending: false })

  // Fetch tournament details separately
  const tournamentIds = [...new Set(escrows?.map(e => e.tournament_id).filter(Boolean) || [])]
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, title, start_time")
    .in("id", tournamentIds.length > 0 ? tournamentIds : [""])

  const tournamentsMap = new Map(tournaments?.map(t => [t.id, t]) || [])

  const enrichedEscrows = escrows?.map(e => ({
    ...e,
    tournaments: e.tournament_id ? tournamentsMap.get(e.tournament_id) || null : null,
  })) || []

  return <EscrowManager escrows={enrichedEscrows} />
}
