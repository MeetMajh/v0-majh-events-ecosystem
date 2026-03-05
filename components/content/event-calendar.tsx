"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, List, Grid3X3 } from "lucide-react"
import { formatDate, formatDateTime } from "@/lib/format"

type CalendarEvent = {
  id: string
  title: string
  description: string | null
  type: string
  tournament_id: string | null
  start_date: string
  end_date: string | null
  location: string | null
  is_all_day: boolean
  color: string | null
  tournaments: { name: string; slug: string } | null
}

const TYPE_STYLES: Record<string, { label: string; className: string }> = {
  tournament: { label: "Tournament", className: "bg-primary/10 text-primary border-primary/30" },
  community: { label: "Community", className: "bg-chart-3/10 text-chart-3 border-chart-3/30" },
  special: { label: "Special", className: "bg-accent/10 text-accent border-accent/30" },
  stream: { label: "Stream", className: "bg-destructive/10 text-destructive border-destructive/30" },
}

export function EventCalendar({ events }: { events: CalendarEvent[] }) {
  const [view, setView] = useState<"list" | "calendar">("list")
  const [typeFilter, setTypeFilter] = useState("all")

  const filtered = typeFilter === "all"
    ? events
    : events.filter((e) => e.type === typeFilter)

  // Group by month
  const grouped = filtered.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    const month = new Date(event.start_date).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    if (!acc[month]) acc[month] = []
    acc[month].push(event)
    return acc
  }, {})

  return (
    <div>
      {/* Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTypeFilter("all")}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              typeFilter === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/30"
            )}
          >
            All Events
          </button>
          {Object.entries(TYPE_STYLES).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                typeFilter === key ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/30"
              )}
            >
              {val.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
          <button
            onClick={() => setView("list")}
            className={cn(
              "rounded-md px-2 py-1",
              view === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView("calendar")}
            className={cn(
              "rounded-md px-2 py-1",
              view === "calendar" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* List View */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No events found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {Object.entries(grouped).map(([month, monthEvents]) => (
            <div key={month}>
              <h2 className="mb-4 text-lg font-bold text-foreground">{month}</h2>
              <div className="flex flex-col gap-3">
                {monthEvents.map((event) => {
                  const typeStyle = TYPE_STYLES[event.type] ?? TYPE_STYLES.community
                  return (
                    <div
                      key={event.id}
                      className="flex gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30"
                    >
                      {/* Date Column */}
                      <div className="flex w-14 flex-shrink-0 flex-col items-center rounded-lg bg-muted/50 py-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {new Date(event.start_date).toLocaleDateString("en-US", { month: "short" })}
                        </span>
                        <span className="text-xl font-bold text-foreground">
                          {new Date(event.start_date).getDate()}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge className={`text-[10px] ${typeStyle.className}`}>
                            {typeStyle.label}
                          </Badge>
                          {event.is_all_day ? (
                            <span className="text-[10px] text-muted-foreground">All Day</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              {formatDateTime(event.start_date)}
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-foreground">
                          {event.tournaments ? (
                            <Link href={`/esports/tournaments/${event.tournaments.slug}`} className="hover:text-primary transition-colors">
                              {event.title}
                            </Link>
                          ) : (
                            event.title
                          )}
                        </h3>
                        {event.description && (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{event.description}</p>
                        )}
                        {event.location && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {event.location}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
