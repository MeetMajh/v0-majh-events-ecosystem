import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PartyPopper, Truck, Users, CalendarCheck } from "lucide-react"

export const metadata = { title: "CARBARDMV Events" }

const FEATURES = [
  { icon: Truck, title: "Mobile Entertainment Hub", description: "We bring the full experience to your venue -- gaming, bar, and entertainment" },
  { icon: CalendarCheck, title: "Event Booking", description: "Corporate events, private parties, festivals -- book with a few clicks" },
  { icon: Users, title: "Full-Service Catering", description: "Bartenders, catering staff, and event coordinators included" },
  { icon: PartyPopper, title: "Custom Packages", description: "Build your own event package with the services you need" },
]

export default function EventsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <div className="mb-12">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-chart-3/30 bg-chart-3/5 px-3 py-1 text-xs font-medium text-chart-3">
          <PartyPopper className="h-3 w-3" />
          Coming Soon
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">CARBARDMV Events</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          The mobile entertainment hub that brings the MAJH experience to you. Full-service event booking with bartenders, gaming stations, catering, and staff scheduling.
        </p>
      </div>

      <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card p-6">
            <f.icon className="mb-3 h-8 w-8 text-chart-3" />
            <h3 className="mb-1 font-semibold text-foreground">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.description}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
        <h2 className="mb-2 text-xl font-semibold text-foreground">Event booking platform launching soon</h2>
        <p className="mb-6 text-muted-foreground">Be the first to book your next event with CARBARDMV.</p>
        <Button asChild>
          <Link href="/auth/sign-up">Reserve Your Spot</Link>
        </Button>
      </div>
    </div>
  )
}
