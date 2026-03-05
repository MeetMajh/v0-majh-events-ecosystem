import { getLeaderboard, getGames } from "@/lib/esports-actions"
import { LeaderboardTable } from "@/components/esports/leaderboard-table"
import { LeaderboardTabs } from "@/components/esports/leaderboard-tabs"
import { BarChart3 } from "lucide-react"

export const metadata = { title: "Leaderboards | MAJH EVENTS" }

export default async function LeaderboardsPage() {
  const [globalLeaderboard, games] = await Promise.all([
    getLeaderboard(),
    getGames(),
  ])

  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <BarChart3 className="h-3 w-3" />
          Rankings
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Leaderboards</h1>
        <p className="mt-2 text-muted-foreground">See who sits at the top across all game categories.</p>
      </div>

      <LeaderboardTabs
        initialEntries={globalLeaderboard as any}
        games={games}
      />
    </div>
  )
}
