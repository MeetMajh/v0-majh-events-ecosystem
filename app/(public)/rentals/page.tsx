import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { IMAGES } from "@/lib/images"
import { Monitor, Truck, ShieldCheck, CalendarDays } from "lucide-react"

export const metadata = { title: "Equipment Rentals" }

const FEATURES = [
  { icon: Monitor, title: "Gaming Consoles", description: "PS5, Xbox Series X, Nintendo Switch -- all available for rent with controllers" },
  { icon: Truck, title: "Delivery & Setup", description: "We deliver and set up complete gaming stations at your location" },
  { icon: ShieldCheck, title: "Full Support", description: "Technical support and equipment insurance included with every rental" },
  { icon: CalendarDays, title: "Flexible Duration", description: "Rent by the day, weekend, or week -- whatever your event needs" },
]

export default function RentalsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <div className="relative mb-12 overflow-hidden rounded-2xl border border-border">
        <div className="relative aspect-[21/9]">
          <Image src={IMAGES.events.consoleStation} alt="Console gaming stations available for rent" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-transparent" />
        </div>
        <div className="absolute inset-0 flex flex-col justify-center p-8 md:p-12">
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Monitor className="h-3 w-3" />
            Rent Equipment
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">Equipment Rentals</h1>
          <p className="mt-3 max-w-lg text-muted-foreground">
            Rent gaming consoles, screens, audio equipment, and full gaming setups for your events. Easy online booking with delivery and setup.
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

      <div className="rounded-xl border border-dashed border-primary/30 bg-card/50 p-12 text-center">
        <h2 className="mb-2 text-xl font-semibold text-foreground">Rental catalog and booking coming soon</h2>
        <p className="mb-6 text-muted-foreground">Sign up and be the first to browse our equipment catalog.</p>
        <Button asChild>
          <Link href="/auth/sign-up">Get Early Access</Link>
        </Button>
      </div>
    </div>
  )
}
