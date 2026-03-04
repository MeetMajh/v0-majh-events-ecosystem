import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Gamepad2, Trophy, Monitor, Zap } from "lucide-react"

export const metadata = { title: "Esports" }

const FEATURES = [
  { icon: Trophy, title: "Tournaments", description: "Register and compete in organized gaming tournaments with real prizes" },
  { icon: Monitor, title: "Livestreaming", description: "Stream your gameplay and watch other competitors live" },
  { icon: Gamepad2, title: "Leaderboards", description: "Track your ranking across games and climb to the top" },
  { icon: Zap, title: "Rewards", description: "Earn points from competition and redeem them across the MAJH ecosystem" },
]

export default function EsportsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <div className="mb-12">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-chart-1/30 bg-chart-1/5 px-3 py-1 text-xs font-medium text-chart-1">
          <Gamepad2 className="h-3 w-3" />
          Coming Soon
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">Esports Arena</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          The competitive gaming hub of MAJH EVENTS. Tournaments, leaderboards, livestreaming, and a full rewards system -- all in one place.
        </p>
      </div>

      <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card p-6">
            <f.icon className="mb-3 h-8 w-8 text-chart-1" />
            <h3 className="mb-1 font-semibold text-foreground">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.description}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
        <h2 className="mb-2 text-xl font-semibold text-foreground">Tournament registration launching soon</h2>
        <p className="mb-6 text-muted-foreground">Create an account now to be first in line when we go live.</p>
        <Button asChild>
          <Link href="/auth/sign-up">Join the Waitlist</Link>
        </Button>
      </div>
    </div>
  )
}
