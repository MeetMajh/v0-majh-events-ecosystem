import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { TournamentController } from "@/components/tournaments/tournament-controller"
import { getTournamentPhases, getTournamentStandings, getCurrentRound } from "@/lib/tournament-controller-actions"
import { getTournamentRegistrations } from "@/lib/tournament-controller-actions"
import { getPaymentSummary } from "@/lib/tournament-payment-actions"

export const metadata = { title: "Tournament Controller | Dashboard" }

export default async function TournamentControllerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  // Get tournament details
  const { data: tournament } = await supabase
    .from("tournaments")
    .select(`
      *,
      games(id, name, slug, category, icon_url)
    `)
    .eq("id", id)
    .single()

  if (!tournament) notFound()

  // Authorization check
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  const isStaff = staffRole && ["owner", "manager", "organizer"].includes(staffRole.role)
  const isCreator = tournament.created_by === user.id

  if (!isStaff && !isCreator) {
    redirect("/dashboard/tournaments")
  }

  // Fetch all tournament data in parallel
  console.log("[v0] Fetching data for tournament:", tournament.id)
  const [phases, registrations, currentRound, paymentSummary] = await Promise.all([
    getTournamentPhases(tournament.id),
    getTournamentRegistrations(tournament.id),
    getCurrentRound(tournament.id),
    getPaymentSummary(tournament.id),
  ])
  console.log("[v0] Registrations received in page:", registrations.length)

  // Get standings for current phase if exists
  const currentPhase = phases.find(p => p.is_current) || phases[0]
  const standings = currentPhase 
    ? await getTournamentStandings(tournament.id, currentPhase.id)
    : []

  return (
    <TournamentController
      tournament={tournament}
      phases={phases}
      registrations={registrations}
      currentRound={currentRound}
      standings={standings}
      paymentSummary={paymentSummary}
      isStaff={isStaff}
    />
  )
}
