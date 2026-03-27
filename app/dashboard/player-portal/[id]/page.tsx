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

  // Check if user has participated via matches (player1_id or player2_id)
  // Uses same query pattern as My Events page (which works)
  const { data: userMatches } = await supabase
    .from("tournament_matches")
    .select("id")
    .eq("tournament_id", tournamentId)
    .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
    .limit(1)

  // Also check registration
  const { data: registration } = await supabase
    .from("tournament_registrations")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("player_id", user.id)
    .single()

  // User must have either matches OR registration
  if (!userMatches?.length && !registration) {
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
