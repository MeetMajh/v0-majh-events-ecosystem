import { createClient, createAdminClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { TournamentController } from "@/components/tournaments/tournament-controller"
import { getTournamentPhases, getTournamentStandings, getCurrentRound } from "@/lib/tournament-controller-actions"
import { getTournamentRegistrations } from "@/lib/tournament-controller-actions"
import { getPaymentSummary } from "@/lib/tournament-payment-actions"

export const metadata = { title: "Tournament Controller | Dashboard" }

// Debug component to check database directly
async function DebugRegistrations({ tournamentId }: { tournamentId: string }) {
  const supabase = createAdminClient()
  
  // Query 1: Raw registrations
  const { data: rawRegs, error: rawError } = await supabase
    .from("tournament_registrations")
    .select("*")
    .eq("tournament_id", tournamentId)
  
  // Query 2: Check profiles table
  const playerIds = rawRegs?.map(r => r.player_id).filter(Boolean) || []
  const { data: profiles, error: profileError } = playerIds.length > 0 
    ? await supabase.from("profiles").select("*").in("id", playerIds)
    : { data: [], error: null }

  return (
    <div className="space-y-4 text-sm font-mono bg-card p-4 rounded-lg">
      <div>
        <h3 className="font-bold text-yellow-500">Raw Registrations Query:</h3>
        <p>Error: {rawError?.message || "none"}</p>
        <p>Count: {rawRegs?.length || 0}</p>
        <pre className="bg-muted p-2 rounded overflow-auto max-h-40">
          {JSON.stringify(rawRegs, null, 2)}
        </pre>
      </div>
      <div>
        <h3 className="font-bold text-yellow-500">Profiles Query:</h3>
        <p>Player IDs: {playerIds.join(", ") || "none"}</p>
        <p>Error: {profileError?.message || "none"}</p>
        <p>Count: {profiles?.length || 0}</p>
        <pre className="bg-muted p-2 rounded overflow-auto max-h-40">
          {JSON.stringify(profiles, null, 2)}
        </pre>
      </div>
    </div>
  )
}

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
  const [phases, registrations, currentRound, paymentSummary] = await Promise.all([
    getTournamentPhases(tournament.id),
    getTournamentRegistrations(tournament.id),
    getCurrentRound(tournament.id),
    getPaymentSummary(tournament.id),
  ])

  // Get standings for current phase if exists
  const currentPhase = phases.find(p => p.is_current) || phases[0]
  const standings = currentPhase 
    ? await getTournamentStandings(tournament.id, currentPhase.id)
    : []

  // DEBUG: Show registration data directly on the page
  if (registrations.length === 0) {
    return (
      <div className="p-8 space-y-4">
        <h1 className="text-2xl font-bold text-red-500">DEBUG: No registrations returned</h1>
        <p>Tournament ID: {tournament.id}</p>
        <p>Tournament Name: {tournament.name}</p>
        <p>Checking database directly...</p>
        <DebugRegistrations tournamentId={tournament.id} />
      </div>
    )
  }

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
