"use client"

import { cn } from "@/lib/utils"
import { GAME_CATEGORIES } from "@/lib/bracket-utils"

type Game = { id: string; name: string; slug: string; category: string }

export function GameFilter({
  games,
  selectedCategory,
  onSelect,
}: {
  games: Game[]
  selectedCategory: string
  onSelect: (cat: string) => void
}) {
  const categories = ["all", ...Object.keys(GAME_CATEGORIES)]

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            selectedCategory === cat
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
          )}
        >
          {cat === "all" ? "All Games" : GAME_CATEGORIES[cat] ?? cat}
          {cat !== "all" && (
            <span className="ml-1 text-[10px] opacity-60">
              ({games.filter((g) => g.category === cat).length})
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
