import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Monitor, Truck, ShieldCheck, CalendarDays } from "lucide-react"

export const metadata = { title: "Equipment Rentals" }

const FEATURES = [
  { icon: Monitor, title: "Gaming Consoles", description: "PS5, Xbox Series X, Nintendo Switch -- all available for rent" },
  { icon: Truck, title: "Delivery Available", description: "We deliver and set up equipment at your location" },
  { icon: ShieldCheck, title: "Insured Equipment", description: "All rental equipment is fully insured and maintained" },
  { icon: CalendarDays, title: "Flexible Duration", description: "Rent by the day, weekend, or week -- whatever you need" },
]

export default function RentalsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <div className="mb-12">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-chart-5/30 bg-chart-5/5 px-3 py-1 text-xs font-medium text-chart-5">
          <Monitor className="h-3 w-3" />
          Coming Soon
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">Equipment Rentals</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Rent gaming consoles, screens, audio equipment, and more for your events. Easy online booking with delivery and setup included.
        </p>
      </div>

      <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card p-6">
            <f.icon className="mb-3 h-8 w-8 text-chart-5" />
            <h3 className="mb-1 font-semibold text-foreground">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.description}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
        <h2 className="mb-2 text-xl font-semibold text-foreground">Rental catalog and booking coming soon</h2>
        <p className="mb-6 text-muted-foreground">Sign up and be the first to browse our equipment catalog.</p>
        <Button asChild>
          <Link href="/auth/sign-up">Get Early Access</Link>
        </Button>
      </div>
    </div>
  )
}
