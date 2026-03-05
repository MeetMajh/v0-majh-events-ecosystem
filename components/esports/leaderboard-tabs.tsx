"use client"

import { useState, useTransition } from "react"
import { LeaderboardTable } from "@/components/esports/leaderboard-table"
import { cn } from "@/lib/utils"
import { getLeaderboard } from "@/lib/esports-actions"
import { Loader2 } from "lucide-react"

type Game = { id: string; name: string; slug: string; category: string }

export function LeaderboardTabs({
  games,
  initialEntries,
}: {
  games: Game[]
  initialEntries: any[]
}) {
  const [activeGame, setActiveGame] = useState<string>("global")
  const [entries, setEntries] = useState<any[]>(initialEntries)
  const [pending, startTransition] = useTransition()

  const handleSelect = (gameSlug: string) => {
    setActiveGame(gameSlug)
    startTransition(async () => {
      const data = await getLeaderboard(gameSlug === "global" ? undefined : gameSlug)
      setEntries(data as any)
    })
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => handleSelect("global")}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            activeGame === "global"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:border-primary/30"
          )}
        >
          Global
        </button>
        {games.map((game) => (
          <button
            key={game.id}
            onClick={() => handleSelect(game.slug)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              activeGame === game.slug
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary/30"
            )}
          >
            {game.name}
          </button>
        ))}
      </div>

      {pending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <LeaderboardTable entries={entries} showGame={activeGame === "global"} />
      )}
    </div>
  )
}
