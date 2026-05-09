import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Gift, Gamepad2, CalendarCheck, Monitor, Play, Upload, Trophy, Clock, ChevronRight } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow } from "date-fns"

export default async function DashboardOverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const [{ data: profile }, { data: myTournaments }, { data: wallet }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single(),
    supabase
      .from("tournament_participants")
      .select(`
        id,
        status,
        payment_status,
        registered_at,
        tournaments(
          id,
          name,
          slug,
          status,
          start_date,
          entry_fee_cents,
          games(name, slug)
        )
      `)
      .eq("user_id", user.id)
      .in("status", ["registered", "checked_in"])
      .order("registered_at", { ascending: false })
      .limit(5),
    supabase
      .from("wallets")
      .select("balance_cents")
      .eq("user_id", user.id)
      .single()
  ])

  const firstName = profile?.first_name || "there"
  const points = profile?.points_balance ?? 0

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h2>
        <p className="text-muted-foreground">Your MAJH EVENTS command center</p>
      </div>

      {/* Wallet & Points Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Wallet Balance */}
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Wallet Balance</p>
              <p className="mt-1 text-4xl font-bold text-green-500">
                ${((wallet?.balance_cents ?? 0) / 100).toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Use for tournament entry fees</p>
            </div>
            <Link href="/dashboard/wallet" className="rounded-lg bg-green-500/10 p-2 transition-colors hover:bg-green-500/20">
              <ChevronRight className="h-6 w-6 text-green-500" />
            </Link>
          </div>
        </div>

        {/* Points Balance */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Points Balance</p>
              <p className="mt-1 text-4xl font-bold text-primary">{points.toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">Earn from tournaments & events</p>
            </div>
            <Gift className="h-10 w-10 text-primary/50" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-foreground">Quick Actions</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickActionCard
            icon={Gamepad2}
            title="Esports"
            description="Browse tournaments and compete"
            href="/esports"
          />
          <QuickActionCard
            icon={Play}
            title="Clips"
            description="Watch and share gaming highlights"
            href="/clips"
          />
          <QuickActionCard
            icon={Upload}
            title="Upload Media"
            description="Share your best gaming moments"
            href="/create"
          />
          <QuickActionCard
            icon={CalendarCheck}
            title="CARBARDMV"
            description="Explore the gaming lounge"
            href="/carbardmv"
          />
        </div>
      </div>

      {/* My Tournaments */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">My Tournaments</h3>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/esports/tournaments" className="flex items-center gap-1">
              Browse All <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        
        {myTournaments && myTournaments.length > 0 ? (
          <div className="space-y-3">
            {myTournaments.map((participant: any) => (
              <Link
                key={participant.id}
                href={`/esports/tournaments/${participant.tournaments?.slug}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Trophy className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{participant.tournaments?.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {participant.tournaments?.games?.name && (
                        <span>{participant.tournaments.games.name}</span>
                      )}
                      {participant.tournaments?.start_date && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(participant.tournaments.start_date), { addSuffix: true })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {participant.paid && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600">
                      Paid
                    </Badge>
                  )}
                  <Badge 
                    className={
                      participant.tournaments?.status === "in_progress" 
                        ? "bg-green-500/10 text-green-600" 
                        : participant.tournaments?.status === "registration"
                          ? "bg-blue-500/10 text-blue-600"
                          : "bg-muted text-muted-foreground"
                    }
                  >
                    {participant.tournaments?.status === "in_progress" ? "Live" : participant.tournaments?.status?.replace("_", " ")}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Trophy className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="mb-2 font-medium text-foreground">No tournaments yet</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Register for a tournament to compete and earn points
            </p>
            <Button asChild>
              <Link href="/esports/tournaments">Browse Tournaments</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function QuickActionCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: React.ElementType
  title: string
  description: string
  href: string
}) {
  return (
    <Link 
      href={href}
      className="flex items-start gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-card/80"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1">
        <h4 className="font-medium text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  )
}
