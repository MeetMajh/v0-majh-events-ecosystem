import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { IMAGES } from "@/lib/images"
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
      <div className="relative mb-12 overflow-hidden rounded-2xl border border-border">
        <div className="relative aspect-[21/9]">
          <Image src={IMAGES.events.outdoor} alt="MAJH EVENTS outdoor mobile entertainment event" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-transparent" />
        </div>
        <div className="absolute inset-0 flex flex-col justify-center p-8 md:p-12">
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <PartyPopper className="h-3 w-3" />
            Mobile Events
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">CARBARDMV Events</h1>
          <p className="mt-3 max-w-lg text-muted-foreground">
            The mobile entertainment hub that brings the MAJH experience to you. Full-service event booking with bartenders, gaming stations, catering, and staff.
          </p>
        </div>
      </div>

      <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
            <f.icon className="mb-3 h-8 w-8 text-primary" />
            <h3 className="mb-1 font-semibold text-foreground">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.description}</p>
          </div>
        ))}
      </div>

      <div className="mb-12 grid gap-4 sm:grid-cols-2">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border">
          <Image src={IMAGES.events.tournamentNight} alt="Tournament night at MAJH EVENTS" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
          <div className="absolute bottom-4 left-4">
            <span className="font-semibold text-foreground">Private Functions</span>
            <p className="text-sm text-muted-foreground">Game nights, tournaments, and more</p>
          </div>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border">
          <Image src={IMAGES.events.team} alt="MAJH EVENTS team in branded purple shirts" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
          <div className="absolute bottom-4 left-4">
            <span className="font-semibold text-foreground">Professional Staff</span>
            <p className="text-sm text-muted-foreground">Trained team for every event</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-primary/30 bg-card/50 p-12 text-center">
        <h2 className="mb-2 text-xl font-semibold text-foreground">Event booking platform launching soon</h2>
        <p className="mb-6 text-muted-foreground">Be the first to book your next event with CARBARDMV.</p>
        <Button asChild>
          <Link href="/auth/sign-up">Reserve Your Spot</Link>
        </Button>
      </div>
    </div>
  )
}
