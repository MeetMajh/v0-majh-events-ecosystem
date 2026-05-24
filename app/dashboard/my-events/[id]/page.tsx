import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getPlayerTournamentData, getPlayerTournamentRounds } from "@/lib/player-actions"
import { PlayerController } from "@/components/player/player-controller"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getPlayerTournamentData(id)
  
  if ("error" in result) {
    return { title: "Tournament Not Found | MAJH Events" }
  }
  
  return {
    title: `${result.tournament.name} - Player Controller | MAJH Events`,
    description: `Manage your participation in ${result.tournament.name}`,
  }
}

export default async function PlayerControllerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/login?redirect=/dashboard/my-events/${id}`)
  }

  const [tournamentData, allRounds] = await Promise.all([
    getPlayerTournamentData(id),
    getPlayerTournamentRounds(id),
  ])

  if ("error" in tournamentData) {
    if (tournamentData.error === "Not registered for this tournament") {
      redirect("/dashboard/my-events")
    }
    notFound()
  }

  return (
    <PlayerController
      tournament={tournamentData.tournament}
      registration={tournamentData.registration}
      currentPhase={tournamentData.currentPhase}
      currentRound={tournamentData.currentRound}
      currentMatch={tournamentData.currentMatch}
      myMatches={tournamentData.myMatches}
      decklist={tournamentData.decklist}
      standings={tournamentData.standings}
      announcements={tournamentData.announcements}
      myTickets={tournamentData.myTickets}
      allRounds={allRounds}
      userId={tournamentData.userId}
    />
  )
}
