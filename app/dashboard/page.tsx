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

  const [{ data: profile }, { data: myRegistrations }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single(),
    supabase
      .from("tournament_registrations")
      .select(`
        id,
        status,
        payment_status,
        created_at,
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
      .eq("player_id", user.id)
      .in("status", ["registered", "checked_in", "pending"])
      .order("created_at", { ascending: false })
      .limit(5)
  ])

  const firstName = profile?.first_name || "there"
  const points = profile?.points_balance ?? 0

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h2>
        <p className="text-muted-foreground">Your MAJH EVENTS command center</p>
      </div>

      {/* Points Card */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Your Points Balance</p>
            <p className="mt-1 text-4xl font-bold text-primary">{points.toLocaleString()}</p>
            <p className="mt-1 text-xs text-muted-foreground">Earn points from tournaments, purchases, and events</p>
          </div>
          <Gift className="h-10 w-10 text-primary/50" />
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
          <QuickActionCard
            icon={Monitor}
            title="My Media"
            description="Manage your uploaded content"
            href="/dashboard/my-media"
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
        
        {myRegistrations && myRegistrations.length > 0 ? (
          <div className="space-y-3">
            {myRegistrations.map((reg: any) => (
              <Link
                key={reg.id}
                href={`/esports/tournaments/${reg.tournaments?.slug}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Trophy className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{reg.tournaments?.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {reg.tournaments?.games?.name && (
                        <span>{reg.tournaments.games.name}</span>
                      )}
                      {reg.tournaments?.start_date && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(reg.tournaments.start_date), { addSuffix: true })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {reg.payment_status === "pending" && (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">
                      Payment Pending
                    </Badge>
                  )}
                  <Badge 
                    className={
                      reg.tournaments?.status === "in_progress" 
                        ? "bg-green-500/10 text-green-600" 
                        : reg.tournaments?.status === "registration"
                          ? "bg-blue-500/10 text-blue-600"
                          : "bg-muted text-muted-foreground"
                    }
                  >
                    {reg.tournaments?.status === "in_progress" ? "Live" : reg.tournaments?.status?.replace("_", " ")}
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
