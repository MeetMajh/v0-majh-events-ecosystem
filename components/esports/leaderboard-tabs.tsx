"use client"

import { useState, useTransition } from "react"
import { LeaderboardTable } from "@/components/esports/leaderboard-table"
import { cn } from "@/lib/utils"
import { getLeaderboard } from "@/lib/esports-actions"
import { Loader2, Trophy, Gamepad2, Calendar, ChevronDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

type Game = { id: string; name: string; slug: string; category: string; icon_url?: string }
type Season = { value: string; label: string; isCurrent?: boolean }

export function LeaderboardTabs({
  games,
  initialEntries,
  seasons = [{ value: "all-time", label: "All Time" }],
}: {
  games: Game[]
  initialEntries: any[]
  seasons?: Season[]
}) {
  const [activeGame, setActiveGame] = useState<string>("global")
  const [activeSeason, setActiveSeason] = useState<string>("all-time")
  const [entries, setEntries] = useState<any[]>(initialEntries)
  const [pending, startTransition] = useTransition()

  const handleSelect = (gameSlug: string, season?: string) => {
    setActiveGame(gameSlug)
    if (season) setActiveSeason(season)
    startTransition(async () => {
      const data = await getLeaderboard(
        gameSlug === "global" ? undefined : gameSlug, 
        season || activeSeason
      )
      setEntries(data as any)
    })
  }
  
  const handleSeasonChange = (season: string) => {
    setActiveSeason(season)
    handleSelect(activeGame, season)
  }
  
  const currentSeasonLabel = seasons.find(s => s.value === activeSeason)?.label || "All Time"

  // Stats summary
  const totalPlayers = entries.length
  const totalMatches = entries.reduce((sum, e) => sum + e.total_wins + e.total_losses, 0)
  const totalTournaments = entries.reduce((sum, e) => sum + e.tournaments_played, 0)

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalPlayers}</p>
              <p className="text-xs text-muted-foreground">Ranked Players</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <Gamepad2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalMatches.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Matches</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Trophy className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalTournaments}</p>
              <p className="text-xs text-muted-foreground">Tournament Entries</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Game Filter */}
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => handleSelect("global")}
            className={cn(
              "shrink-0 rounded-lg border px-4 py-2 text-sm font-medium transition-all",
              activeGame === "global"
                ? "border-primary bg-primary text-primary-foreground shadow-md"
                : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
            )}
          >
            <span className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              All Games
            </span>
          </button>
          {games.map((game) => (
            <button
              key={game.id}
              onClick={() => handleSelect(game.slug)}
              className={cn(
                "shrink-0 rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                activeGame === game.slug
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                <Gamepad2 className="h-4 w-4" />
                {game.name}
              </span>
            </button>
          ))}
        </div>
        
        {/* Season Selector */}
        {seasons.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" />
                {currentSeasonLabel}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {seasons.map((season) => (
                <DropdownMenuItem
                  key={season.value}
                  onClick={() => handleSeasonChange(season.value)}
                  className={cn(
                    activeSeason === season.value && "bg-primary/10 text-primary"
                  )}
                >
                  <span className="flex items-center gap-2">
                    {season.label}
                    {season.isCurrent && (
                      <span className="ml-auto rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Current
                      </span>
                    )}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Leaderboard Table */}
      {pending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <LeaderboardTable 
          entries={entries} 
          showGame={activeGame === "global"} 
        />
      )}
    </div>
  )
}
