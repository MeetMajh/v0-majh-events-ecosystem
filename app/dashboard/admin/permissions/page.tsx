import { redirect } from "next/navigation"
import { getUserPermissions, getAssignableRoles, getRoleDisplayName, getRoleBadgeColor } from "@/lib/authorization"
import { createClient } from "@/lib/supabase/server"
import { PermissionManagerClient } from "./permission-manager-client"

export const metadata = {
  title: "Permission Manager | MAJH Events",
  description: "Manage user roles and permissions",
}

export default async function PermissionManagerPage() {
  const permissions = await getUserPermissions()
  
  if (!permissions || !permissions.canManagePermissions) {
    redirect("/dashboard")
  }

  const supabase = await createClient()
  
  // Get all users with their current roles
  const { data: profiles } = await supabase
    .from("profiles")
    .select(`
      id,
      first_name,
      last_name,
      email,
      role,
      is_organizer,
      created_at
    `)
    .order("created_at", { ascending: false })
    .limit(100)

  // Get staff roles separately
  const { data: staffRoles } = await supabase
    .from("staff_roles")
    .select("user_id, role")

  // Create a map of user_id to staff role
  const staffRoleMap = new Map(
    staffRoles?.map(sr => [sr.user_id, sr.role]) ?? []
  )

  // Combine profile and staff role data
  const users = profiles?.map(profile => ({
    id: profile.id,
    firstName: profile.first_name,
    lastName: profile.last_name,
    email: profile.email,
    profileRole: profile.role,
    staffRole: staffRoleMap.get(profile.id) || null,
    isOrganizer: profile.is_organizer,
    createdAt: profile.created_at,
  })) ?? []

  // Get assignable roles for current user
  const assignableRoles = getAssignableRoles(permissions.unifiedRole)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Permission Manager</h1>
        <p className="text-muted-foreground">
          Manage user roles and grant permissions to team members
        </p>
      </div>

      <PermissionManagerClient
        users={users}
        assignableRoles={assignableRoles}
        currentUserRole={permissions.unifiedRole}
        currentUserId={permissions.userId}
      />
    </div>
  )
}
