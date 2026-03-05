"use client"

import { useState } from "react"
import { TournamentCard } from "@/components/esports/tournament-card"
import { GameFilter } from "@/components/esports/game-filter"
import { cn } from "@/lib/utils"

type Game = { id: string; name: string; slug: string; category: string }
type Tournament = Parameters<typeof TournamentCard>[0]["tournament"]

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "registration", label: "Open" },
  { key: "in_progress", label: "Live" },
  { key: "completed", label: "Completed" },
]

export function TournamentsFilter({
  tournaments,
  games,
}: {
  tournaments: Tournament[]
  games: Game[]
}) {
  const [category, setCategory] = useState("all")
  const [status, setStatus] = useState("all")

  // Get game IDs in selected category
  const categoryGameIds = category === "all"
    ? null
    : games.filter((g) => g.category === category).map((g) => g.id)

  const filtered = tournaments.filter((t) => {
    if (status !== "all" && t.status !== status) return false
    if (categoryGameIds && t.games && !categoryGameIds.includes((t as any).game_id)) {
      // Filter by category via game slug match
      if (!categoryGameIds.length) return true
      const gameCategory = games.find((g) => g.slug === t.games?.slug)?.category
      if (gameCategory && gameCategory !== category) return false
    }
    return true
  })

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4">
        <GameFilter games={games} selectedCategory={category} onSelect={setCategory} />
        <div className="flex gap-2">
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf.key}
              onClick={() => setStatus(sf.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                status === sf.key
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:border-accent/30"
              )}
            >
              {sf.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No tournaments found matching your filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      )}
    </div>
  )
}
