import { redirect } from "next/navigation"
import { getUserPermissions } from "@/lib/authorization"

/**
 * Guard for staff-level pages. Pass minimum required tier.
 * 
 *   await requireStaff("staff")     // staff, manager, owner, all platform/tenant roles
 *   await requireStaff("manager")   // manager, owner, platform/tenant admin+
 *   await requireStaff("owner")     // owner, platform/tenant owner only
 *   await requireStaff("organizer") // organizer + manager + owner + platform/tenant
 */
export async function requireStaff(
  minimumTier: "staff" | "organizer" | "manager" | "owner" = "staff"
): Promise<{ role: string; userId: string }> {
  const permissions = await getUserPermissions()
  if (!permissions) redirect("/auth/login")

  // Platform-level (PLATFORM_OWNER, PLATFORM_ADMIN) always passes
  if (permissions.isPlatformLevel) {
    return { role: permissions.unifiedRole ?? "owner", userId: permissions.userId }
  }

  const role = permissions.unifiedRole ?? ""

  const TIERS: Record<string, string[]> = {
    owner: [
      "owner",
      "TENANT_OWNER", "TENANT_SUPER_ADMIN",
    ],
    manager: [
      "owner", "manager",
      "TENANT_OWNER", "TENANT_SUPER_ADMIN", "TENANT_ADMIN", "TENANT_MANAGER",
    ],
    organizer: [
      "owner", "manager", "organizer",
      "TENANT_OWNER", "TENANT_SUPER_ADMIN", "TENANT_ADMIN", "TENANT_MANAGER",
    ],
    staff: [
      "owner", "manager", "staff",
      "TENANT_OWNER", "TENANT_SUPER_ADMIN", "TENANT_ADMIN", "TENANT_MANAGER", "TENANT_STAFF",
    ],
  }

  if (!TIERS[minimumTier].includes(role)) {
    redirect("/dashboard")
  }

  return { role, userId: permissions.userId }
}

import { createClient } from "@/lib/supabase/server"

/**
 * Guard for server actions. Same tier semantics as requireStaff,
 * but also returns a Supabase client and the user's ID so the
 * action can use them directly.
 *
 *   const { supabase, userId } = await requireStaffAction("staff")
 */
export async function requireStaffAction(
  minimumTier: "staff" | "organizer" | "manager" | "owner" = "staff"
) {
  const { role, userId } = await requireStaff(minimumTier)
  const supabase = await createClient()
  return { supabase, userId, role }
}
