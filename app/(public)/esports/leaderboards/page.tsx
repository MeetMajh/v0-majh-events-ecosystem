import { getLeaderboard, getGames, getSeasons } from "@/lib/esports-actions"
import { LeaderboardTabs } from "@/components/esports/leaderboard-tabs"
import { BarChart3, Trophy, TrendingUp, Users } from "lucide-react"

export const metadata = { 
  title: "Global Leaderboards | MAJH EVENTS",
  description: "See who sits at the top across all game categories. Track rankings, win rates, and tournament performances."
}

export default async function LeaderboardsPage() {
  const [globalLeaderboard, games, seasons] = await Promise.all([
    getLeaderboard(),
    getGames(),
    getSeasons(),
  ])
  
  // Calculate some global stats
  const totalPlayers = globalLeaderboard.length
  const totalMatches = globalLeaderboard.reduce((sum: number, e: any) => 
    sum + (e.total_wins || 0) + (e.total_losses || 0), 0)
  const totalTournaments = globalLeaderboard.reduce((sum: number, e: any) => 
    sum + (e.tournaments_played || 0), 0)

  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      {/* Hero Section */}
      <div className="mb-10">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <BarChart3 className="h-3 w-3" />
          Global Rankings
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Leaderboards
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Track the top competitors across all games. Rankings are updated after each tournament based on placements and performance.
        </p>
        
        {/* Quick Stats */}
        <div className="mt-6 flex flex-wrap gap-6">
          <div className="flex items-center gap-2 text-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <span className="font-bold text-foreground">{totalPlayers}</span>
              <span className="ml-1 text-muted-foreground">Ranked Players</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <span className="font-bold text-foreground">{totalMatches.toLocaleString()}</span>
              <span className="ml-1 text-muted-foreground">Matches Played</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10">
              <Trophy className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <span className="font-bold text-foreground">{totalTournaments}</span>
              <span className="ml-1 text-muted-foreground">Tournament Entries</span>
            </div>
          </div>
        </div>
      </div>

      <LeaderboardTabs
        initialEntries={globalLeaderboard as any}
        games={games}
        seasons={seasons}
      />
    </div>
  )
}
