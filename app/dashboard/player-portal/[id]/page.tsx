import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { PlayerController } from "@/components/player/player-controller"
import { getPlayerTournamentData } from "@/lib/player-actions"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("name")
    .eq("id", id)
    .single()

  return {
    title: tournament ? `${tournament.name} - Player Controller | MAJH Events` : "Player Controller | MAJH Events",
    description: "Manage your tournament participation",
  }
}

export default async function PlayerControllerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tournamentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get tournament details
  const { data: tournament } = await supabase
    .from("tournaments")
    .select(`
      *,
      games (name, icon_url)
    `)
    .eq("id", tournamentId)
    .single()

  if (!tournament) {
    notFound()
  }

  // Get the player_id for this user in this tournament from tournament_registrations
  const { data: registrationRecord } = await supabase
    .from("tournament_registrations")
    .select("player_id")
    .eq("player_id", user.id)
    .eq("tournament_id", tournamentId)
    .single()

  const playerId = registrationRecord?.player_id || user.id

  // Check if user has participated via matches using player_id
  let userMatches: any[] = []
  if (playerId) {
    const { data } = await supabase
      .from("tournament_matches")
      .select("id")
      .eq("tournament_id", tournamentId)
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
      .limit(1)
    userMatches = data || []
  }

  // Check participation via tournament_participants (using user_id)
  const { data: registration } = await supabase
    .from("tournament_participants")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("user_id", user.id)
    .single()

  // User must have either matches OR registration
  if (!userMatches.length && !registration) {
    redirect("/dashboard/player-portal?error=not_registered")
  }

  // Create a virtual registration if none exists but user has matches
  const effectiveRegistration = registration || {
    id: `match-based-${user.id}-${tournamentId}`,
    tournament_id: tournamentId,
    player_id: user.id,
    status: "participated",
    created_at: new Date().toISOString()
  }

  // Get all player-specific tournament data
  const playerData = await getPlayerTournamentData(tournamentId)

  if ("error" in playerData) {
    redirect("/dashboard/player-portal?error=data_fetch_failed")
  }

  return (
    <PlayerController
      tournament={tournament}
      registration={effectiveRegistration}
      userId={user.id}
      playerId={playerId}
      currentPhase={playerData.currentPhase}
      currentRound={playerData.currentRound}
      currentMatch={playerData.currentMatch}
      myMatches={playerData.myMatches}
      decklist={playerData.decklist}
      standings={playerData.standings}
      announcements={playerData.announcements}
      myTickets={playerData.myTickets}
      allRounds={playerData.allRounds ?? []}
    />
  )
}
