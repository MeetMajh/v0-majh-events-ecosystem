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

  // Check if user is registered for this tournament
  const { data: registration } = await supabase
    .from("tournament_registrations")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("player_id", user.id)
    .single()

  if (!registration) {
    redirect("/dashboard/player-portal?error=not_registered")
  }

  // Get all player-specific tournament data
  const playerData = await getPlayerTournamentData(tournamentId)

  if ("error" in playerData) {
    redirect("/dashboard/player-portal?error=data_fetch_failed")
  }

  return (
    <PlayerController
      tournament={tournament}
      registration={registration}
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
