"use client"

import { useState, useMemo, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import {
  GripVertical,
  Shuffle,
  Trophy,
  TrendingUp,
  Clock,
  ArrowUpDown,
  Save,
  RotateCcw,
  Download,
  Upload,
} from "lucide-react"

interface Player {
  id: string
  displayName: string
  avatarUrl?: string | null
  rating?: number
  wins?: number
  losses?: number
  registeredAt?: string
}

interface SeedingToolProps {
  players: Player[]
  onSave: (seededPlayers: Array<{ playerId: string; seed: number }>) => Promise<void>
  tournamentName?: string
}

type SortMethod = "manual" | "rating" | "record" | "registration" | "random"

// ══════════════════════════════════════════════════════════════════════════════
// Sortable Player Item
// ══════════════════════════════════════════════════════════════════════════════

function SortablePlayer({
  player,
  seed,
  isHighlighted,
}: {
  player: Player
  seed: number
  isHighlighted?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const winRate = player.wins !== undefined && player.losses !== undefined
    ? player.wins + player.losses > 0
      ? Math.round((player.wins / (player.wins + player.losses)) * 100)
      : 0
    : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors",
        isDragging && "opacity-50 shadow-lg",
        isHighlighted && "border-primary bg-primary/5"
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Seed number */}
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
          seed === 1 && "bg-chart-3/20 text-chart-3",
          seed === 2 && "bg-muted text-muted-foreground",
          seed === 3 && "bg-orange-500/20 text-orange-600",
          seed > 3 && "bg-muted/50 text-muted-foreground"
        )}
      >
        {seed}
      </div>

      {/* Player info */}
      <Avatar className="h-8 w-8">
        <AvatarImage src={player.avatarUrl || undefined} />
        <AvatarFallback className="text-xs">
          {player.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{player.displayName}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {player.rating !== undefined && (
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {player.rating}
            </span>
          )}
          {player.wins !== undefined && player.losses !== undefined && (
            <span>
              {player.wins}W - {player.losses}L
              {winRate !== null && (
                <span className="ml-1 text-muted-foreground">({winRate}%)</span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Badges */}
      {seed <= 4 && (
        <Badge variant="outline" className="text-xs">
          Top Seed
        </Badge>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Seeding Tool
// ══════════════════════════════════════════════════════════════════════════════

export function SeedingTool({ players: initialPlayers, onSave, tournamentName }: SeedingToolProps) {
  const [players, setPlayers] = useState(initialPlayers)
  const [sortMethod, setSortMethod] = useState<SortMethod>("manual")
  const [isPending, startTransition] = useTransition()
  const [hasChanges, setHasChanges] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Sort players based on method
  const sortPlayers = (method: SortMethod) => {
    setSortMethod(method)
    setHasChanges(true)

    let sorted: Player[]
    switch (method) {
      case "rating":
        sorted = [...players].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        break
      case "record":
        sorted = [...players].sort((a, b) => {
          const aRate = a.wins !== undefined && a.losses !== undefined && (a.wins + a.losses) > 0
            ? a.wins / (a.wins + a.losses)
            : 0
          const bRate = b.wins !== undefined && b.losses !== undefined && (b.wins + b.losses) > 0
            ? b.wins / (b.wins + b.losses)
            : 0
          return bRate - aRate
        })
        break
      case "registration":
        sorted = [...players].sort((a, b) => {
          if (!a.registeredAt || !b.registeredAt) return 0
          return new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime()
        })
        break
      case "random":
        sorted = [...players].sort(() => Math.random() - 0.5)
        break
      default:
        return // Manual - keep current order
    }
    setPlayers(sorted)
  }

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setPlayers((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id)
        const newIndex = items.findIndex((i) => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
      setSortMethod("manual")
      setHasChanges(true)
    }
  }

  // Reset to original order
  const handleReset = () => {
    setPlayers(initialPlayers)
    setSortMethod("manual")
    setHasChanges(false)
  }

  // Save seeding
  const handleSave = () => {
    startTransition(async () => {
      await onSave(players.map((p, idx) => ({ playerId: p.id, seed: idx + 1 })))
      setHasChanges(false)
    })
  }

  // Export seeding
  const handleExport = () => {
    const data = players.map((p, idx) => ({
      seed: idx + 1,
      id: p.id,
      name: p.displayName,
      rating: p.rating,
      record: p.wins !== undefined ? `${p.wins}-${p.losses}` : undefined,
    }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `seeding-${tournamentName || "tournament"}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Stats
  const avgRating = useMemo(() => {
    const ratings = players.filter((p) => p.rating !== undefined).map((p) => p.rating!)
    return ratings.length > 0 ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null
  }, [players])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Tournament Seeding</h2>
          <p className="text-sm text-muted-foreground">
            Drag players to adjust seeding or use automatic sorting
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isPending || !hasChanges}>
            <Save className="mr-2 h-4 w-4" />
            {isPending ? "Saving..." : "Save Seeding"}
          </Button>
        </div>
      </div>

      {/* Sort controls */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="sort-method" className="text-sm whitespace-nowrap">
                Sort by:
              </Label>
              <Select value={sortMethod} onValueChange={(v) => sortPlayers(v as SortMethod)}>
                <SelectTrigger id="sort-method" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="rating">Rating (High to Low)</SelectItem>
                  <SelectItem value="record">Win Rate</SelectItem>
                  <SelectItem value="registration">Registration Order</SelectItem>
                  <SelectItem value="random">Random</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => sortPlayers("random")}
            >
              <Shuffle className="mr-2 h-4 w-4" />
              Randomize
            </Button>

            {/* Stats */}
            <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
              <span>{players.length} players</span>
              {avgRating && (
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  Avg rating: {avgRating}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Player list */}
      <div className="grid gap-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={players.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {players.map((player, index) => (
              <SortablePlayer
                key={player.id}
                player={player}
                seed={index + 1}
                isHighlighted={index < 4}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Bracket preview info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Seeding Preview</CardTitle>
          <CardDescription>How seeds will be placed in the bracket</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Top Left", seeds: [1, 8, 5, 4] },
              { label: "Bottom Left", seeds: [3, 6, 7, 2] },
              { label: "Top Right", seeds: [1, 4, 5, 8] },
              { label: "Bottom Right", seeds: [2, 7, 6, 3] },
            ].map((quadrant) => (
              <div key={quadrant.label} className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">{quadrant.label}</p>
                <div className="flex flex-wrap gap-1">
                  {quadrant.seeds.slice(0, Math.min(players.length, quadrant.seeds.length)).map((seed) => (
                    <Badge key={seed} variant="outline" className="text-xs">
                      #{seed}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Standard seeding places top seeds in opposite halves of the bracket so they meet in the finals.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
