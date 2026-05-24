"use client"

import { useState } from "react"
import { GameFilter } from "@/components/esports/game-filter"
import { TournamentCard } from "@/components/esports/tournament-card"

type Game = { id: string; name: string; slug: string; category: string }
type Tournament = {
  id: string
  name: string
  slug: string
  format: string
  status: string
  entry_fee_cents: number
  max_participants: number | null
  start_date: string | null
  games: { name: string; slug: string; category: string } | null
  tournament_participants: { count: number }[]
}

export function EsportsHubClient({
  games,
  tournaments,
}: {
  games: Game[]
  tournaments: Tournament[]
}) {
  const [selectedCategory, setSelectedCategory] = useState("all")

  const filtered = selectedCategory === "all"
    ? tournaments
    : tournaments.filter((t) => t.games?.category === selectedCategory)

  return (
    <div className="flex flex-col gap-4">
      <GameFilter games={games} selectedCategory={selectedCategory} onSelect={setSelectedCategory} />
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
          <p className="text-sm text-muted-foreground">No tournaments in this category right now.</p>
        </div>
      )}
    </div>
  )
}
