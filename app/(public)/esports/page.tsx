import Link from "next/link"
import Image from "next/image"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { IMAGES } from "@/lib/images"
import { Gamepad2, Trophy, BarChart3, Users, ArrowRight, Zap } from "lucide-react"
import { getGames, getTournaments, getLeaderboard } from "@/lib/esports-actions"
import { TournamentCard } from "@/components/esports/tournament-card"
import { EsportsHubClient } from "@/components/esports/esports-hub-client"

export const metadata = {
  title: "Esports Arena | MAJH EVENTS",
  description: "Compete in console, TCG, PC, tabletop and sports tournaments.",
}

const FEATURES = [
  { icon: Trophy, title: "Tournaments", description: "Multi-format brackets from single elimination to compass draws", href: "/esports/tournaments" },
  { icon: BarChart3, title: "Leaderboards", description: "Track your global ranking across all games and categories", href: "/esports/leaderboards" },
  { icon: Users, title: "Teams", description: "Form or join a team and compete together in organized play", href: "/esports/teams" },
  { icon: Zap, title: "Rewards", description: "Earn points from competition and redeem across the MAJH ecosystem", href: "/dashboard/rewards" },
]

export default async function EsportsPage() {
  const [games, tournaments, leaderboard] = await Promise.all([
    getGames(),
    getTournaments({ limit: 12 }),
    getLeaderboard(),
  ])

  const liveTournaments = tournaments.filter((t) => t.status === "in_progress")
  const openTournaments = tournaments.filter((t) => t.status === "registration")
  const topPlayers = leaderboard.slice(0, 5)

  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      {/* Hero */}
      <div className="relative mb-12 overflow-hidden rounded-2xl border border-border">
        <div className="relative aspect-[21/9]">
          <Image src={IMAGES.events.outdoor} alt="MAJH EVENTS esports tournament" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-transparent" />
        </div>
        <div className="absolute inset-0 flex flex-col justify-center p-8 md:p-12">
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Gamepad2 className="h-3 w-3" />
            {liveTournaments.length > 0
              ? `${liveTournaments.length} Tournament${liveTournaments.length > 1 ? "s" : ""} Live Now`
              : "Console + TCG + PC Gaming"}
          </div>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            Esports Arena
          </h1>
          <p className="mt-3 max-w-lg text-pretty text-muted-foreground">
            The competitive gaming hub of MAJH EVENTS. Multi-game tournaments across 7 bracket formats, live leaderboards, team play, and real prizes.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild><Link href="/esports/tournaments">Browse Tournaments</Link></Button>
            <Button variant="outline" asChild><Link href="/esports/leaderboards">Leaderboards</Link></Button>
          </div>
        </div>
      </div>

      {/* Feature cards */}
      <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <Link key={f.title} href={f.href} className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
            <f.icon className="mb-3 h-8 w-8 text-primary" />
            <h3 className="mb-1 font-semibold text-foreground group-hover:text-primary transition-colors">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.description}</p>
          </Link>
        ))}
      </div>

      {/* Live Tournaments */}
      {liveTournaments.length > 0 && (
        <section className="mb-12">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-sm font-semibold text-destructive">
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
              Live Now
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {liveTournaments.map((t) => (<TournamentCard key={t.id} tournament={t} />))}
          </div>
        </section>
      )}

      {/* Open Registration */}
      <section className="mb-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Open Registration</h2>
          <Link href="/esports/tournaments?status=registration" className="flex items-center gap-1 text-sm text-primary hover:underline">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {openTournaments.length > 0 ? (
          <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted" />}>
            <EsportsHubClient games={games} tournaments={openTournaments} />
          </Suspense>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
            <p className="text-muted-foreground">No tournaments open for registration right now. Check back soon.</p>
          </div>
        )}
      </section>

      {/* Leaderboard preview + Images */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Top Ranked Players</h2>
            <Link href="/esports/leaderboards" className="flex items-center gap-1 text-sm text-primary hover:underline">
              Full leaderboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {topPlayers.length > 0 ? (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">#</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Player</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Game</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {topPlayers.map((entry: Record<string, unknown>, i: number) => (
                    <tr key={entry.id as string} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-primary">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {(entry.profiles as Record<string, string> | null)?.display_name ?? "Unknown"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {(entry.games as Record<string, string> | null)?.name ?? ""}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-primary">{entry.ranking_points as number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
              <p className="text-muted-foreground">Leaderboards will populate after tournaments complete.</p>
            </div>
          )}
        </section>

        <div className="flex flex-col gap-4">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border">
            <Image src={IMAGES.events.tcgProducts} alt="Trading card games at MAJH EVENTS" fill className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
            <div className="absolute bottom-4 left-4">
              <span className="font-semibold text-foreground">Trading Card Games</span>
              <p className="text-sm text-muted-foreground">{"Yu-Gi-Oh!, Pokemon, MTG and more"}</p>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border">
            <Image src={IMAGES.events.gamingSetup} alt="Console gaming at MAJH EVENTS" fill className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
            <div className="absolute bottom-4 left-4">
              <span className="font-semibold text-foreground">Console Gaming</span>
              <p className="text-sm text-muted-foreground">PS5, Xbox, Switch, and fighting games</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
