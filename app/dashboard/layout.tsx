import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"

export const metadata = { title: "Dashboard" }

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const [{ data: profile }, { data: staffRole }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("staff_roles").select("role").eq("user_id", user.id).single(),
  ])

  const displayName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name || ""}`.trim()
    : user.email?.split("@")[0] || "User"

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar
        displayName={displayName}
        email={user.email || ""}
        userRole={staffRole?.role ?? null}
      />
      <div className="flex flex-1 flex-col">
        <DashboardHeader displayName={displayName} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
