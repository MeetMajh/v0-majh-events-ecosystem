import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { IMAGES } from "@/lib/images"
import { UtensilsCrossed, CreditCard, Gift, Clock } from "lucide-react"

export const metadata = { title: "Bar / Cafe" }

const FEATURES = [
  { icon: UtensilsCrossed, title: "Full Menu", description: "Craft cocktails, coffee, snacks, and meals curated for gamers and guests" },
  { icon: CreditCard, title: "Online Ordering", description: "Order ahead for pickup or dine-in with card, Afterpay, or cash" },
  { icon: Gift, title: "Loyalty Rewards", description: "Earn points on every purchase, redeemable for discounts and freebies" },
  { icon: Clock, title: "Games Night Specials", description: "Special pricing during tournament events and gaming sessions" },
]

export default function BarCafePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <div className="relative mb-12 overflow-hidden rounded-2xl border border-border">
        <div className="relative aspect-[21/9]">
          <Image src={IMAGES.events.barGaming} alt="Cocktails and FIFA gaming at MAJH EVENTS bar" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-transparent" />
        </div>
        <div className="absolute inset-0 flex flex-col justify-center p-8 md:p-12">
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <UtensilsCrossed className="h-3 w-3" />
            Food & Drinks
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">Bar / Cafe</h1>
          <p className="mt-3 max-w-lg text-muted-foreground">
            Fuel your gaming sessions with craft cocktails, food, and drinks. Every purchase earns you loyalty points across the MAJH ecosystem.
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
        <h2 className="mb-2 text-xl font-semibold text-foreground">Online menu and ordering coming soon</h2>
        <p className="mb-6 text-muted-foreground">Sign up to get notified when online ordering goes live.</p>
        <Button asChild>
          <Link href="/auth/sign-up">Get Notified</Link>
        </Button>
      </div>
    </div>
  )
}
