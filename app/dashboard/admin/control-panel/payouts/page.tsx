import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PayoutsManager } from "@/components/control-panel/payouts-manager"

export default async function PayoutsPage() {
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

  // Fetch tournament payouts
  const { data: payouts } = await supabase
    .from("tournament_payouts")
    .select(`
      id,
      tournament_id,
      user_id,
      position,
      amount_cents,
      status,
      paid_at,
      created_at,
      tournaments (
        title
      ),
      profiles:user_id (
        display_name,
        email
      )
    `)
    .order("created_at", { ascending: false })
    .limit(100)

  return <PayoutsManager payouts={payouts || []} />
}
