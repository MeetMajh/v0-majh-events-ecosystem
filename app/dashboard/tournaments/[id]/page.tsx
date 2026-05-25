import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { TournamentController } from "@/components/tournaments/tournament-controller"
import { getTournamentPhases, getTournamentStandings, getCurrentRound, getAllTournamentRounds } from "@/lib/tournament-controller-actions"
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

  // Fetch all tournament data in parallel with error handling
  let phases: Awaited<ReturnType<typeof getTournamentPhases>> = []
  let registrations: Awaited<ReturnType<typeof getTournamentRegistrations>> = []
  let currentRound: Awaited<ReturnType<typeof getCurrentRound>> = null
  let paymentSummary: Awaited<ReturnType<typeof getPaymentSummary>> = {
    totalRegistrations: 0,
    paidCount: 0,
    pendingCount: 0,
    refundedCount: 0,
    totalCollected: 0,
    totalRefunded: 0,
    netRevenue: 0,
  }
  let standings: Awaited<ReturnType<typeof getTournamentStandings>> = []
  let allRounds: Awaited<ReturnType<typeof getAllTournamentRounds>> = []

  try {
    const [phasesResult, registrationsResult, currentRoundResult, paymentSummaryResult, allRoundsResult] = await Promise.all([
      getTournamentPhases(tournament.id).catch(() => []),
      getTournamentRegistrations(tournament.id).catch(() => []),
      getCurrentRound(tournament.id).catch(() => null),
      getPaymentSummary(tournament.id).catch(() => null),
      getAllTournamentRounds(tournament.id).catch(() => []),
    ])
    
    phases = phasesResult ?? []
    registrations = registrationsResult ?? []
    currentRound = currentRoundResult
    allRounds = allRoundsResult ?? []
    paymentSummary = paymentSummaryResult ?? {
      totalRegistrations: 0,
      paidCount: 0,
      pendingCount: 0,
      refundedCount: 0,
      totalCollected: 0,
      totalRefunded: 0,
      netRevenue: 0,
    }

    // Get standings for current phase if exists
    const currentPhase = phases.find(p => p.is_current) || phases[0]
    if (currentPhase) {
      standings = await getTournamentStandings(tournament.id, currentPhase.id).catch(() => [])
    }
  } catch (error) {
    console.error("[v0] Error fetching tournament data:", error)
  }

  return (
    <TournamentController
      tournament={tournament}
      phases={phases}
      registrations={registrations}
      currentRound={currentRound}
      allRounds={allRounds}
      standings={standings}
      paymentSummary={paymentSummary}
      isStaff={isStaff}
    />
  )
}
