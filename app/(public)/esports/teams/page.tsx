import Link from "next/link"
import { getTeams } from "@/lib/esports-actions"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, Shield } from "lucide-react"

export const metadata = { title: "Teams | MAJH EVENTS" }

export default async function TeamsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const teams = await getTeams()

  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Users className="h-3 w-3" />
            Compete Together
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Teams</h1>
          <p className="mt-2 text-muted-foreground">Find or create a team to compete in team tournaments.</p>
        </div>
        {user && (
          <Button asChild>
            <Link href="/esports/teams/create">Create Team</Link>
          </Button>
        )}
      </div>

      {teams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="mb-1 font-medium text-foreground">No teams yet</p>
          <p className="text-sm text-muted-foreground">Be the first to create a team.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team: any) => (
            <Link key={team.id} href={`/esports/teams/${team.slug}`} className="group">
              <Card className="border-border bg-card transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-base font-bold text-accent">
                      {team.tag ?? team.name[0]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{team.name}</h3>
                      {team.tag && <p className="text-xs text-muted-foreground">[{team.tag}]</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {team.team_members?.[0]?.count ?? 0} members
                    </span>
                    <span className="flex items-center gap-1">
                      <Shield className="h-3.5 w-3.5" />
                      Captain: {team.profiles?.display_name ?? "Unknown"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
