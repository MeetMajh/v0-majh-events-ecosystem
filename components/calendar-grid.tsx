"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

type CalendarEvent = {
  id: string
  title: string
  description: string | null
  type: string
  start_date: string
  end_date: string | null
  location: string | null
  is_all_day: boolean
  color: string | null
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const TYPE_COLORS: Record<string, string> = {
  tournament: "bg-primary/10 text-primary border-primary/30",
  community: "bg-chart-3/10 text-chart-3 border-chart-3/30",
  stream: "bg-destructive/10 text-destructive border-destructive/30",
  special: "bg-accent/10 text-accent border-accent/30",
  other: "bg-muted text-muted-foreground",
}

export function CalendarGrid({ events }: { events: CalendarEvent[] }) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(currentDate)

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const date = new Date(event.start_date)
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(event)
    }
    return map
  }, [events])

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const today = new Date()
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  return (
    <div>
      {/* Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={prevMonth} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-bold text-foreground">{monthLabel}</h2>
        <Button variant="ghost" size="icon" onClick={nextMonth} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Grid */}
      <div className="overflow-hidden rounded-xl border border-border">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {DAYS.map((day) => (
            <div key={day} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            const dateKey = day ? `${year}-${month}-${day}` : ""
            const dayEvents = day ? eventsByDate.get(dateKey) ?? [] : []

            return (
              <div
                key={idx}
                className={cn(
                  "min-h-[80px] border-b border-r border-border/50 p-1.5 md:min-h-[100px]",
                  !day && "bg-muted/10"
                )}
              >
                {day && (
                  <>
                    <span className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                      isToday(day) ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    )}>
                      {day}
                    </span>
                    <div className="mt-0.5 flex flex-col gap-0.5">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className={cn(
                            "truncate rounded px-1 py-0.5 text-[10px] font-medium",
                            TYPE_COLORS[event.type] ?? TYPE_COLORS.other
                          )}
                          title={event.title}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="px-1 text-[10px] text-muted-foreground">
                          +{dayEvents.length - 2} more
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Upcoming list */}
      <div className="mt-8">
        <h3 className="mb-4 text-lg font-bold text-foreground">Upcoming Events</h3>
        {events.length === 0 ? (
          <p className="text-muted-foreground">No events scheduled yet.</p>
        ) : (
          <div className="grid gap-3">
            {events
              .filter((e) => new Date(e.start_date) >= new Date())
              .slice(0, 10)
              .map((event) => (
                <div key={event.id} className="flex items-start gap-4 rounded-lg border border-border bg-card px-4 py-3">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(event.start_date))}
                    </p>
                    <p className="text-lg font-bold text-primary">
                      {new Date(event.start_date).getDate()}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge className={cn("text-[10px]", TYPE_COLORS[event.type] ?? TYPE_COLORS.other)}>
                        {event.type}
                      </Badge>
                    </div>
                    <p className="font-medium text-foreground">{event.title}</p>
                    {event.description && <p className="text-xs text-muted-foreground line-clamp-1">{event.description}</p>}
                    {event.location && <p className="text-[10px] text-muted-foreground mt-0.5">{event.location}</p>}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
