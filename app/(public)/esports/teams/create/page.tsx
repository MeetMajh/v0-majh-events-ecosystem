import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CreateTeamForm } from "@/components/esports/create-team-form"

export const metadata = { title: "Create Team | MAJH EVENTS" }

export default async function CreateTeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="mb-2 text-2xl font-bold text-foreground">Create a Team</h1>
      <p className="mb-8 text-muted-foreground">Form a team to compete in team tournaments together.</p>
      <CreateTeamForm />
    </div>
  )
}
