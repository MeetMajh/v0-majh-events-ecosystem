import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { RoleRequestsList } from "@/components/dashboard/role-requests-list"

export const metadata = { title: "Role Requests" }

export default async function RoleRequestsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  // Check if user is admin or owner
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "owner"].includes(profile.role)) {
    redirect("/dashboard")
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Role Requests</h2>
        <p className="text-muted-foreground">Review and manage user role change requests</p>
      </div>

      <RoleRequestsList />
    </div>
  )
}
