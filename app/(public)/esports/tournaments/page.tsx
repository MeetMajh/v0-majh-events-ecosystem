import { getTournaments, getGames } from "@/lib/esports-actions"
import { TournamentCard } from "@/components/esports/tournament-card"
import { TournamentsFilter } from "@/components/esports/tournaments-filter"
import { Trophy } from "lucide-react"

export const metadata = { title: "Tournaments | MAJH EVENTS" }

export default async function TournamentsPage() {
  const [tournaments, games] = await Promise.all([
    getTournaments(),
    getGames(),
  ])

  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Trophy className="h-3 w-3" />
          Compete
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Tournaments</h1>
        <p className="mt-2 text-muted-foreground">Browse and register for upcoming tournaments across all game categories.</p>
      </div>

      <TournamentsFilter tournaments={tournaments as any} games={games} />
    </div>
  )
}
