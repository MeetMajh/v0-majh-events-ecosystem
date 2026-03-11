import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Trophy, Users, Calendar, DollarSign, Settings } from "lucide-react"
import { format } from "date-fns"

export const metadata = { title: "My Tournaments | Dashboard" }

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-blue-500/10 text-blue-600",
  registration: "bg-blue-500/10 text-blue-600",
  registration_closed: "bg-yellow-500/10 text-yellow-600",
  in_progress: "bg-green-500/10 text-green-600",
  complete: "bg-muted text-muted-foreground",
  cancelled: "bg-red-500/10 text-red-600",
}

export default async function TournamentsDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  // Check if user can organize tournaments
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  const canOrganize = staffRole && ["owner", "manager", "organizer"].includes(staffRole.role)

  // Get tournaments user has created or has TO access to
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select(`
      *,
      games(name, slug, icon_url),
      tournament_registrations(count)
    `)
    .or(`created_by.eq.${user.id}`)
    .order("created_at", { ascending: false })

  // Get stats
  const activeTournaments = tournaments?.filter(t => 
    ["registration", "in_progress"].includes(t.status)
  ).length ?? 0

  const totalParticipants = tournaments?.reduce((sum, t) => 
    sum + (t.tournament_registrations?.[0]?.count ?? 0), 0
  ) ?? 0

  const totalRevenue = tournaments?.reduce((sum, t) => {
    const count = t.tournament_registrations?.[0]?.count ?? 0
    return sum + (count * (t.entry_fee_cents ?? 0))
  }, 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Tournaments</h1>
          <p className="text-muted-foreground">
            Create and manage your esports tournaments
          </p>
        </div>
        {canOrganize && (
          <Button asChild>
            <Link href="/dashboard/tournaments/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Tournament
            </Link>
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-lg bg-primary/10 p-3">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{tournaments?.length ?? 0}</p>
              <p className="text-sm text-muted-foreground">Total Tournaments</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-lg bg-green-500/10 p-3">
              <Calendar className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeTournaments}</p>
              <p className="text-sm text-muted-foreground">Active Now</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-lg bg-blue-500/10 p-3">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalParticipants}</p>
              <p className="text-sm text-muted-foreground">Total Players</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-lg bg-yellow-500/10 p-3">
              <DollarSign className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">${(totalRevenue / 100).toFixed(0)}</p>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tournaments List */}
      {!tournaments || tournaments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trophy className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold">No tournaments yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Create your first tournament to get started
            </p>
            {canOrganize && (
              <Button asChild>
                <Link href="/dashboard/tournaments/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Tournament
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tournaments.map((tournament) => (
            <Card key={tournament.id} className="overflow-hidden">
              <div className="flex items-start justify-between p-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{tournament.name}</h3>
                    <Badge className={STATUS_COLORS[tournament.status] ?? "bg-muted"}>
                      {tournament.status.replace("_", " ")}
                    </Badge>
                    {tournament.games && (
                      <Badge variant="outline">{tournament.games.name}</Badge>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-6 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {tournament.tournament_registrations?.[0]?.count ?? 0}
                      {tournament.max_participants && ` / ${tournament.max_participants}`} players
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {tournament.start_date 
                        ? format(new Date(tournament.start_date), "MMM d, yyyy")
                        : "No date set"}
                    </span>
                    {tournament.entry_fee_cents > 0 && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        ${(tournament.entry_fee_cents / 100).toFixed(2)} entry
                      </span>
                    )}
                    <span className="capitalize">{tournament.format?.replace("_", " ")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/esports/tournaments/${tournament.slug}`}>
                      View
                    </Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link href={`/dashboard/tournaments/${tournament.id}`}>
                      <Settings className="mr-2 h-4 w-4" />
                      Manage
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
