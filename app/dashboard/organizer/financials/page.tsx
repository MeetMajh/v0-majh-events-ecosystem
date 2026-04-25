import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { OrganizerFinancialDashboard } from "@/components/organizer/financial-dashboard"

export const metadata = {
  title: "Organizer Financials | Dashboard",
  description: "View your tournament earnings, fees, and payout status",
}

export default async function OrganizerFinancialsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  // Check if user is an organizer
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role, tenant_id")
    .eq("user_id", user.id)
    .single()

  const isOrganizer = staffRole && ["owner", "manager", "organizer"].includes(staffRole.role)

  if (!isOrganizer) {
    redirect("/dashboard")
  }

  // Fetch organizer dashboard data via RPC
  const { data: dashboardData, error: dashboardError } = await supabase.rpc(
    "get_organizer_dashboard",
    { p_organizer_id: user.id }
  )

  // Fetch liability summary
  const { data: liabilityData } = await supabase.rpc(
    "get_organizer_liability_summary",
    { p_organizer_id: user.id }
  )

  // Fetch payout requests for this user
  const { data: payoutRequests } = await supabase
    .from("payout_requests")
    .select(`
      id,
      tournament_id,
      amount_cents,
      net_amount_cents,
      status,
      placement,
      is_on_hold,
      hold_reason,
      stripe_transfer_id,
      processed_at,
      created_at,
      tournaments(name, slug)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  // Fetch profile for Stripe Connect status
  const { data: profile } = await supabase
    .from("profiles")
    .select(`
      stripe_connect_account_id,
      stripe_connect_status,
      stripe_connect_payouts_enabled,
      kyc_verified
    `)
    .eq("id", user.id)
    .single()

  // Fetch recent disputes involving this organizer
  const { data: disputes } = await supabase
    .from("disputes")
    .select(`
      id,
      stripe_dispute_id,
      amount_cents,
      reason,
      status,
      organizer_liability_cents,
      liability_collected,
      created_at
    `)
    .eq("organizer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10)

  return (
    <OrganizerFinancialDashboard
      dashboardData={dashboardData}
      liabilityData={liabilityData}
      payoutRequests={payoutRequests ?? []}
      disputes={disputes ?? []}
      profile={profile}
      dashboardError={dashboardError?.message}
    />
  )
}
