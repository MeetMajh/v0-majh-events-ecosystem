import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { IMAGES } from "@/lib/images"
import { Gamepad2, Trophy, Monitor, Zap } from "lucide-react"

export const metadata = { title: "Esports" }

const FEATURES = [
  { icon: Trophy, title: "Tournaments", description: "Register and compete in organized gaming and TCG tournaments with real prizes" },
  { icon: Monitor, title: "Livestreaming", description: "Stream your gameplay and watch other competitors live on our platform" },
  { icon: Gamepad2, title: "Leaderboards", description: "Track your ranking across console games and trading card games" },
  { icon: Zap, title: "Rewards", description: "Earn points from competition and redeem them across the MAJH ecosystem" },
]

export default function EsportsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <div className="relative mb-12 overflow-hidden rounded-2xl border border-border">
        <div className="relative aspect-[21/9]">
          <Image src={IMAGES.events.outdoor} alt="MAJH EVENTS outdoor gaming tournament" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-transparent" />
        </div>
        <div className="absolute inset-0 flex flex-col justify-center p-8 md:p-12">
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Gamepad2 className="h-3 w-3" />
            Console + TCG Gaming
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">Esports Arena</h1>
          <p className="mt-3 max-w-lg text-muted-foreground">
            The competitive gaming hub of MAJH EVENTS. Console tournaments, Yu-Gi-Oh! leagues, livestreaming, and a full rewards system.
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
          <Image src={IMAGES.events.tcgProducts} alt="Yu-Gi-Oh! trading card game products at MAJH EVENTS" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
          <div className="absolute bottom-4 left-4">
            <span className="font-semibold text-foreground">Trading Card Games</span>
            <p className="text-sm text-muted-foreground">Yu-Gi-Oh!, Pokemon, and more</p>
          </div>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border">
          <Image src={IMAGES.events.gamingSetup} alt="Multi-screen console gaming at MAJH EVENTS" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
          <div className="absolute bottom-4 left-4">
            <span className="font-semibold text-foreground">Console Gaming</span>
            <p className="text-sm text-muted-foreground">PS5, Xbox, Switch, and fighting games</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-primary/30 bg-card/50 p-12 text-center">
        <h2 className="mb-2 text-xl font-semibold text-foreground">Tournament registration launching soon</h2>
        <p className="mb-6 text-muted-foreground">Create an account now to be first in line when we go live.</p>
        <Button asChild>
          <Link href="/auth/sign-up">Join the Waitlist</Link>
        </Button>
      </div>
    </div>
  )
}
