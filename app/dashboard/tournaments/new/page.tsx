import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { CreateTournamentForm } from "@/components/tournaments/create-tournament-form"
import { getGames } from "@/lib/esports-actions"

export const metadata = { title: "Create Tournament | Dashboard" }

export default async function CreateTournamentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  // Check authorization - staff role OR profile role
  const { data: staffRole } = await supabase
    .from("organization_members")
    .select("role:role_key")
    .eq("user_id", user.id)
    .single()

  const { data: profile } = await supabase
    .from("profiles")
    .select("role:role_key")
    .eq("id", user.id)
    .single()

  const staffAllowed = staffRole && ["owner", "manager", "organizer", "TENANT_OWNER", "TENANT_SUPER_ADMIN", "TENANT_MANAGER", "DEPARTMENT_MANAGER", "PLATFORM_OWNER"].includes(staffRole.role)
  const profileAllowed = profile && ["admin", "organizer", "owner", "TENANT_ADMIN", "DEPARTMENT_ADMIN", "TENANT_OWNER", "TENANT_SUPER_ADMIN", "PLATFORM_OWNER"].includes(profile.role ?? "")
  const canOrganize = staffAllowed || profileAllowed

  if (!canOrganize) {
    redirect("/dashboard/tournaments")
  }

  const games = await getGames()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create Tournament</h1>
        <p className="text-muted-foreground">
          Set up a new esports tournament with custom rules and formats
        </p>
      </div>

      <CreateTournamentForm games={games} userId={user.id} />
    </div>
  )
}
