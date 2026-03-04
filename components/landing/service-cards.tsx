import Link from "next/link"
import { Gamepad2, UtensilsCrossed, PartyPopper, Monitor, ArrowRight } from "lucide-react"

const SERVICES = [
  {
    title: "Esports",
    description:
      "Compete in tournaments, climb leaderboards, earn rewards, and livestream your gameplay. Full competitive gaming platform.",
    icon: Gamepad2,
    href: "/esports",
    accent: "bg-chart-1/10 text-chart-1",
  },
  {
    title: "Bar / Cafe",
    description:
      "Enjoy craft drinks and bites while you game. Order online, earn points on every purchase, and discover our menu.",
    icon: UtensilsCrossed,
    href: "/bar-cafe",
    accent: "bg-chart-2/10 text-chart-2",
  },
  {
    title: "CARBARDMV Events",
    description:
      "Our mobile entertainment hub brings the party to you. Book full-service events with bartenders, gaming stations, and catering.",
    icon: PartyPopper,
    href: "/events",
    accent: "bg-chart-3/10 text-chart-3",
  },
  {
    title: "Equipment Rentals",
    description:
      "Rent gaming consoles, screens, audio gear, and entertainment equipment for your own events. Easy booking, delivery available.",
    icon: Monitor,
    href: "/rentals",
    accent: "bg-chart-5/10 text-chart-5",
  },
]

export function ServiceCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {SERVICES.map((service) => (
        <Link
          key={service.href}
          href={service.href}
          className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:bg-card/80"
        >
          <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${service.accent}`}>
            <service.icon className="h-6 w-6" />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <h3 className="text-lg font-semibold text-foreground">{service.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{service.description}</p>
          </div>
          <div className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Explore <ArrowRight className="h-3 w-3" />
          </div>
        </Link>
      ))}
    </div>
  )
}
