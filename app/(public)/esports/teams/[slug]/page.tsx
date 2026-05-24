import { notFound } from "next/navigation"
import Link from "next/link"
import { getTeamBySlug } from "@/lib/esports-actions"
import { createClient } from "@/lib/supabase/server"
import { Users, Crown, Shield, User } from "lucide-react"
import { TeamActions } from "@/components/esports/team-actions"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const team = await getTeamBySlug(slug)
  if (!team) return { title: "Team Not Found" }
  return { title: `${team.name} | MAJH EVENTS` }
}

const ROLE_ICONS: Record<string, typeof Crown> = {
  captain: Crown,
  officer: Shield,
  member: User,
}

export default async function TeamDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const team = await getTeamBySlug(slug)
  if (!team) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const isMember = team.members.some((m: any) => m.profiles?.id === user?.id)
  const isCaptain = team.captain_id === user?.id

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <Link href="/esports/teams" className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground transition-colors">
        &larr; All Teams
      </Link>

      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-2xl font-bold text-accent">
            {team.tag ?? team.name[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{team.name}</h1>
            {team.tag && <p className="text-sm text-muted-foreground">[{team.tag}]</p>}
            {team.description && <p className="mt-1 text-sm text-muted-foreground">{team.description}</p>}
          </div>
        </div>

        <TeamActions 
          teamId={team.id} 
          isMember={isMember} 
          isCaptain={isCaptain} 
          isLoggedIn={!!user}
        />
      </div>

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
          <Users className="h-5 w-5 text-primary" />
          Members ({team.members.length})
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {team.members.map((m: any) => {
            const RoleIcon = ROLE_ICONS[m.role] ?? User
            return (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                <Link href={`/esports/players/${m.profiles?.id}`} className="group flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {m.profiles?.display_name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {m.profiles?.display_name ?? "Unknown"}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground capitalize">
                      <RoleIcon className="h-3 w-3" />
                      {m.role}
                    </div>
                  </div>
                </Link>
                {isCaptain && m.profiles?.id !== user?.id && (
                  <TeamActions 
                    teamId={team.id} 
                    memberId={m.profiles?.id}
                    memberName={m.profiles?.display_name}
                    isMember={true}
                    isCaptain={true}
                    isLoggedIn={true}
                    showRemoveOnly
                  />
                )}
              </div>
            )
          })}
        </div>
      </section>

      {isCaptain && (
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-bold text-foreground">Captain Actions</h2>
          <TeamActions 
            teamId={team.id}
            isMember={true}
            isCaptain={true}
            isLoggedIn={true}
            showInviteForm
          />
        </section>
      )}
    </div>
  )
}
