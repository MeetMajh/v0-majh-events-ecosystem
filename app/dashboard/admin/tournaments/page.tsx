import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Trophy, Users, Calendar, Clock, AlertTriangle, CheckCircle, 
  XCircle, Play, Pause, TrendingUp, DollarSign, Gamepad2,
  BarChart3, Eye, Settings, ExternalLink
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { formatCents } from "@/lib/format"

export const metadata = {
  title: "Tournament Admin | MAJH EVENTS",
  description: "Site-wide tournament management and oversight",
}

async function checkAdminAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: role } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (!role || !["owner", "manager"].includes(role.role)) {
    redirect("/dashboard")
  }
  return user
}

export default async function TournamentAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  await checkAdminAccess()
  const params = await searchParams
  const filter = params.filter || "all"
  
  const supabase = await createClient()
  
  // Fetch tournaments with stats
  let tournamentsQuery = supabase
    .from("tournaments")
    .select(`
      id, name, slug, status, format, start_date, end_date, 
      entry_fee_cents, max_participants, created_at,
      games(name, slug),
      profiles!tournaments_organizer_id_fkey(id, first_name, last_name, avatar_url),
      tournament_registrations(count)
    `)
    .order("created_at", { ascending: false })
    .limit(50)
  
  if (filter !== "all") {
    tournamentsQuery = tournamentsQuery.eq("status", filter)
  }
  
  const { data: tournaments } = await tournamentsQuery
  
  // Get aggregate stats
  const [
    { count: totalTournaments },
    { count: liveTournaments },
    { count: upcomingTournaments },
    { data: recentRegistrations },
    { data: disputedMatches },
  ] = await Promise.all([
    supabase.from("tournaments").select("*", { count: "exact", head: true }),
    supabase.from("tournaments").select("*", { count: "exact", head: true }).eq("status", "in_progress"),
    supabase.from("tournaments").select("*", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("tournament_registrations").select("id").gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from("tournament_matches").select("id, tournament_id").eq("status", "disputed"),
  ])

  // Calculate total revenue
  const { data: paidRegistrations } = await supabase
    .from("tournament_registrations")
    .select("paid_amount_cents")
    .eq("payment_status", "paid")
  
  const totalRevenue = paidRegistrations?.reduce((sum, r) => sum + (r.paid_amount_cents || 0), 0) || 0

  const stats = [
    { 
      label: "Total Tournaments", 
      value: totalTournaments ?? 0, 
      icon: Trophy, 
      color: "bg-primary/10 text-primary" 
    },
    { 
      label: "Live Now", 
      value: liveTournaments ?? 0, 
      icon: Play, 
      color: "bg-green-500/10 text-green-600" 
    },
    { 
      label: "Upcoming", 
      value: upcomingTournaments ?? 0, 
      icon: Calendar, 
      color: "bg-blue-500/10 text-blue-600" 
    },
    { 
      label: "Weekly Signups", 
      value: recentRegistrations?.length ?? 0, 
      icon: TrendingUp, 
      color: "bg-purple-500/10 text-purple-600" 
    },
    { 
      label: "Total Revenue", 
      value: formatCents(totalRevenue), 
      icon: DollarSign, 
      color: "bg-amber-500/10 text-amber-600" 
    },
    { 
      label: "Disputes", 
      value: disputedMatches?.length ?? 0, 
      icon: AlertTriangle, 
      color: disputedMatches && disputedMatches.length > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground" 
    },
  ]

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    published: "bg-blue-500/20 text-blue-600 border-blue-500/30",
    registration_open: "bg-green-500/20 text-green-600 border-green-500/30",
    registration_closed: "bg-amber-500/20 text-amber-600 border-amber-500/30",
    check_in: "bg-purple-500/20 text-purple-600 border-purple-500/30",
    in_progress: "bg-primary/20 text-primary border-primary/30",
    completed: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/20 text-destructive border-destructive/30",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tournament Admin</h1>
          <p className="text-sm text-muted-foreground">
            Site-wide tournament oversight and management
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border bg-card">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color.split(" ")[0]}`}>
                <stat.icon className={`h-5 w-5 ${stat.color.split(" ")[1]}`} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Disputes Alert */}
      {disputedMatches && disputedMatches.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  {disputedMatches.length} Match Dispute{disputedMatches.length !== 1 ? "s" : ""} Pending
                </p>
                <p className="text-sm text-muted-foreground">
                  Tournaments with disputes need TO attention
                </p>
              </div>
            </div>
            <Button variant="destructive" size="sm" asChild>
              <Link href="/dashboard/admin/tournaments?filter=in_progress">
                View Live Tournaments
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { value: "all", label: "All" },
          { value: "in_progress", label: "Live" },
          { value: "published", label: "Upcoming" },
          { value: "draft", label: "Drafts" },
          { value: "completed", label: "Completed" },
          { value: "cancelled", label: "Cancelled" },
        ].map((tab) => (
          <Link
            key={tab.value}
            href={`/dashboard/admin/tournaments?filter=${tab.value}`}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              filter === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Tournaments Table */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Tournaments</CardTitle>
          <CardDescription>
            {filter === "all" ? "All tournaments" : `Showing ${filter.replace("_", " ")} tournaments`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!tournaments || tournaments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Trophy className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-muted-foreground">No tournaments found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tournaments.map((tournament: any) => {
                const registrationCount = tournament.tournament_registrations?.[0]?.count ?? 0
                const organizer = tournament.profiles
                const hasDisputes = disputedMatches?.some(m => m.tournament_id === tournament.id)
                
                return (
                  <div
                    key={tournament.id}
                    className="flex items-center gap-4 rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted/20"
                  >
                    {/* Status & Game */}
                    <div className="hidden sm:flex flex-col items-center gap-1 w-20">
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] ${statusColors[tournament.status] || ""}`}
                      >
                        {tournament.status === "in_progress" ? "LIVE" : tournament.status.replace("_", " ").toUpperCase()}
                      </Badge>
                      {tournament.games && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                          {tournament.games.name}
                        </span>
                      )}
                    </div>
                    
                    {/* Tournament Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link 
                          href={`/dashboard/tournaments/${tournament.id}`}
                          className="font-medium text-foreground hover:text-primary transition-colors truncate"
                        >
                          {tournament.name}
                        </Link>
                        {hasDisputes && (
                          <Badge variant="destructive" className="text-[10px]">
                            DISPUTE
                          </Badge>
                        )}
                        {tournament.status === "in_progress" && (
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {registrationCount}{tournament.max_participants ? `/${tournament.max_participants}` : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {tournament.start_date 
                            ? format(new Date(tournament.start_date), "MMM d, yyyy")
                            : "TBD"
                          }
                        </span>
                        {tournament.entry_fee_cents > 0 && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {formatCents(tournament.entry_fee_cents)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Organizer */}
                    <div className="hidden md:flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={organizer?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {organizer?.first_name?.[0]}{organizer?.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                        {organizer?.first_name} {organizer?.last_name}
                      </span>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/esports/tournaments/${tournament.slug}`} target="_blank">
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/dashboard/tournaments/${tournament.id}`}>
                          <Settings className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
