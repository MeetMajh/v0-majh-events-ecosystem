import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardSidebar, type SidebarPermissions } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { MobileNav, MobileNavSpacer } from "@/components/esports/mobile-nav"
import { Toaster } from "sonner"
import { getUserPermissions } from "@/lib/authorization"

export const metadata = { title: "Dashboard" }

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Get user profile and permissions using the unified authorization system
  const [{ data: profile }, permissions] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    getUserPermissions(),
  ])

  const displayName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name || ""}`.trim()
    : user.email?.split("@")[0] || "User"

  // Build sidebar permissions from unified permissions
  const sidebarPermissions: SidebarPermissions = {
    isStaff: permissions?.isStaff ?? false,
    isManager: permissions?.isManager ?? false,
    isOwner: permissions?.isOwner ?? false,
    canOrganize: permissions?.canOrganize ?? false,
    canManageUsers: permissions?.canManageUsers ?? false,
    canManageFinancials: permissions?.canManageFinancials ?? false,
    canAccessAdmin: permissions?.canAccessAdmin ?? false,
    canAccessCarBardMV: permissions?.canAccessCarBardMV ?? false,
    canManagePermissions: permissions?.canManagePermissions ?? false,
    canCreateBroadcasts: permissions?.canCreateBroadcasts ?? false,
    isPlatformLevel: permissions?.isPlatformLevel ?? false,
    isTenantLevel: permissions?.isTenantLevel ?? false,
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar
        displayName={displayName}
        email={user.email || ""}
        userRole={permissions?.unifiedRole ?? null}
        permissions={sidebarPermissions}
      />
      <div className="flex flex-1 flex-col">
        <DashboardHeader displayName={displayName} />
        <main className="flex-1 p-6 pb-20 md:pb-6">{children}</main>
        <MobileNavSpacer />
      </div>
      <MobileNav />
      <Toaster position="top-right" richColors />
    </div>
  )
}
