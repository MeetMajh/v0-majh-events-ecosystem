import { notFound } from "next/navigation"
import Link from "next/link"
import { Gamepad2, ChevronRight, Trophy, BarChart3 } from "lucide-react"
import { getGameBySlug, getTournaments, getLeaderboard } from "@/lib/esports-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TournamentCard } from "@/components/esports/tournament-card"
import { LeaderboardTable } from "@/components/esports/leaderboard-table"
import { GAME_CATEGORIES } from "@/lib/bracket-utils"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const game = await getGameBySlug(slug)
  if (!game) return { title: "Game Not Found" }
  return {
    title: `${game.name} | MAJH EVENTS`,
    description: `Tournaments, leaderboards, and competitions for ${game.name} at MAJH EVENTS.`,
  }
}

export default async function GameProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const game = await getGameBySlug(slug)
  if (!game) notFound()

  const [tournaments, leaderboard] = await Promise.all([
    getTournaments({ gameId: game.id }),
    getLeaderboard(slug),
  ])

  const activeTournaments = tournaments.filter((t) => t.status === "registration" || t.status === "in_progress")
  const pastTournaments = tournaments.filter((t) => t.status === "completed")

  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/esports" className="hover:text-foreground transition-colors">Esports</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{game.name}</span>
      </nav>

      {/* Game Header */}
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-xs">
            <Gamepad2 className="h-3 w-3" />
            {GAME_CATEGORIES[game.category] ?? game.category}
          </Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">{game.name}</h1>
        <p className="mt-2 text-muted-foreground">
          View all tournaments, rankings, and competitions for {game.name}.
        </p>
      </div>

      {/* Stats Row */}
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Tournaments</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{tournaments.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Active Now</p>
          <p className="mt-1 text-2xl font-bold text-chart-3">{activeTournaments.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Ranked Players</p>
          <p className="mt-1 text-2xl font-bold text-primary">{leaderboard.length}</p>
        </div>
      </div>

      {/* Active Tournaments */}
      {activeTournaments.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Active Tournaments</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeTournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t as any} />
            ))}
          </div>
        </section>
      )}

      {/* Leaderboard */}
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">{game.name} Rankings</h2>
          </div>
          <Link href="/esports/leaderboards" className="text-sm text-primary hover:underline">Full leaderboards</Link>
        </div>
        <LeaderboardTable entries={leaderboard as any} />
      </section>

      {/* Past Tournaments */}
      {pastTournaments.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-bold text-foreground">Completed Tournaments</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pastTournaments.slice(0, 6).map((t) => (
              <TournamentCard key={t.id} tournament={t as any} />
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-8 text-center">
        <h2 className="mb-2 text-lg font-semibold text-foreground">Want to compete in {game.name}?</h2>
        <p className="mb-4 text-sm text-muted-foreground">Sign up and register for the next tournament.</p>
        <Button asChild>
          <Link href="/esports/tournaments">Browse Tournaments</Link>
        </Button>
      </div>
    </div>
  )
}
