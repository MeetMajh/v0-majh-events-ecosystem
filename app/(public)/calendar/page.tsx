import { getCalendarEvents } from "@/lib/content-actions"
import { CalendarGrid } from "@/components/calendar-grid"
import { CalendarDays } from "lucide-react"

export const metadata = { title: "Event Calendar | MAJH EVENTS" }

export default async function CalendarPage() {
  const events = await getCalendarEvents()

  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <CalendarDays className="h-3 w-3" />
          Schedule
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Event Calendar</h1>
        <p className="mt-2 text-muted-foreground">Upcoming tournaments, events, and community meetups.</p>
      </div>

      <CalendarGrid events={events} />
    </div>
  )
}
