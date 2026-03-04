import Link from "next/link"
import { Button } from "@/components/ui/button"
import { UtensilsCrossed, CreditCard, Gift, Clock } from "lucide-react"

export const metadata = { title: "Bar / Cafe" }

const FEATURES = [
  { icon: UtensilsCrossed, title: "Full Menu", description: "Craft drinks, coffee, snacks, and meals -- all curated for gamers" },
  { icon: CreditCard, title: "Online Ordering", description: "Order ahead for pickup or dine-in with card, Afterpay, or cash" },
  { icon: Gift, title: "Loyalty Rewards", description: "Earn points on every purchase, redeemable for discounts and freebies" },
  { icon: Clock, title: "Happy Hours", description: "Special pricing during tournament events and gaming sessions" },
]

export default function BarCafePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <div className="mb-12">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-chart-2/30 bg-chart-2/5 px-3 py-1 text-xs font-medium text-chart-2">
          <UtensilsCrossed className="h-3 w-3" />
          Coming Soon
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">Bar / Cafe</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Fuel your gaming sessions with our curated menu. Drinks, bites, and a loyalty rewards system that integrates across the entire MAJH ecosystem.
        </p>
      </div>

      <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card p-6">
            <f.icon className="mb-3 h-8 w-8 text-chart-2" />
            <h3 className="mb-1 font-semibold text-foreground">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.description}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
        <h2 className="mb-2 text-xl font-semibold text-foreground">Online menu and ordering coming soon</h2>
        <p className="mb-6 text-muted-foreground">Sign up to get notified when online ordering goes live.</p>
        <Button asChild>
          <Link href="/auth/sign-up">Get Notified</Link>
        </Button>
      </div>
    </div>
  )
}
