import Link from "next/link"
import Image from "next/image"
import { IMAGES } from "@/lib/images"
import { Gamepad2, UtensilsCrossed, PartyPopper, Monitor, ArrowRight } from "lucide-react"

const SERVICES = [
  {
    title: "Esports",
    description: "Console gaming, TCG tournaments, leaderboards, and livestreaming. Compete, earn points, and climb the ranks.",
    icon: Gamepad2,
    href: "/esports",
    image: IMAGES.brand.gamingLounge,
  },
  {
    title: "Bar / Cafe",
    description: "Craft cocktails, food, and drinks while you game. Order online, earn loyalty points on every purchase.",
    icon: UtensilsCrossed,
    href: "/bar-cafe",
    image: "/images/bar-cafe-banner.jpeg",
  },
  {
    title: "CARBARDMV Events",
    description: "Our mobile entertainment hub brings the party to you. Full-service events with bartenders, gaming, and catering.",
    icon: PartyPopper,
    href: "/events",
    image: IMAGES.events.outdoor,
  },
  {
    title: "Equipment Rentals",
    description: "Rent consoles, screens, audio gear, and full gaming setups for your own events. Delivery and setup included.",
    icon: Monitor,
    href: "/rentals",
    image: IMAGES.events.consoleStation,
  },
]

export function ServiceCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {SERVICES.map((service, index) => (
        <Link
          key={service.href}
          href={service.href}
          className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/40"
        >
          <div className="relative aspect-[16/10] overflow-hidden">
            <Image
              src={service.image}
              alt={service.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              priority={index < 2}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
            <div className="absolute bottom-3 left-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/90 text-primary-foreground">
              <service.icon className="h-5 w-5" />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2 p-5">
            <h3 className="text-lg font-semibold text-foreground">{service.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{service.description}</p>
          </div>
          <div className="flex items-center gap-1 px-5 pb-4 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Explore <ArrowRight className="h-3 w-3" />
          </div>
        </Link>
      ))}
    </div>
  )
}
