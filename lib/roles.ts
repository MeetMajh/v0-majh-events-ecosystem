import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getUserPermissions } from "@/lib/authorization"

export type UserRole = "owner" | "manager" | "staff"
export type PlatformRole = "PLATFORM_OWNER" | "PLATFORM_ADMIN"
export type TenantRole = "TENANT_OWNER" | "TENANT_SUPER_ADMIN" | "TENANT_ADMIN" | "TENANT_MANAGER" | "TENANT_STAFF"
export type UnifiedRole = UserRole | PlatformRole | TenantRole

const ROLE_HIERARCHY: Record<string, number> = {
  "PLATFORM_OWNER": 100,
  "PLATFORM_ADMIN": 90,
  "TENANT_OWNER": 80,
  "TENANT_SUPER_ADMIN": 75,
  "TENANT_ADMIN": 70,
  "TENANT_MANAGER": 60,
  "TENANT_STAFF": 50,
  "owner": 80,
  "manager": 60,
  "staff": 50,
}

function mapToLegacyRole(role: string | null): UserRole | null {
  if (!role) return null
  const mappings: Record<string, UserRole> = {
    "PLATFORM_OWNER": "owner",
    "PLATFORM_ADMIN": "owner",
    "TENANT_OWNER": "owner",
    "TENANT_SUPER_ADMIN": "owner",
    "TENANT_ADMIN": "manager",
    "TENANT_MANAGER": "manager",
    "TENANT_STAFF": "staff",
    "owner": "owner",
    "manager": "manager",
    "staff": "staff",
  }
  return mappings[role] || null
}

export async function getUserRole(): Promise<UserRole | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  return mapToLegacyRole((data?.role as string | undefined) ?? null)
}

export async function getUnifiedRole(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  return data?.role ?? null
}

export async function requireRole(allowed: UserRole[]): Promise<{ role: UserRole; userId: string }> {
  const permissions = await getUserPermissions()

  if (!permissions) {
    redirect("/auth/login")
  }

  // Platform-level users (PLATFORM_OWNER, PLATFORM_ADMIN) always pass
  if (permissions.isPlatformLevel) {
    return { role: "owner", userId: permissions.userId }
  }

  // Otherwise map the unified role down to the legacy role
  const legacyRole = mapToLegacyRole(permissions.unifiedRole)

  if (!legacyRole || !allowed.includes(legacyRole)) {
    redirect("/dashboard")
  }

  return { role: legacyRole, userId: permissions.userId }
}

export function canManageMenu(role: UserRole | string) {
  if (typeof role === "string") {
    if (role.startsWith("PLATFORM_")) return true
    if (role === "TENANT_OWNER" || role === "TENANT_SUPER_ADMIN" || role === "TENANT_ADMIN") return true
  }
  return role === "owner" || role === "manager"
}

export function canManageStaff(role: UserRole | string) {
  if (typeof role === "string") {
    if (role.startsWith("PLATFORM_")) return true
    if (role === "TENANT_OWNER" || role === "TENANT_SUPER_ADMIN") return true
  }
  return role === "owner"
}

export function canManageInventory(role: UserRole | string) {
  if (typeof role === "string") {
    if (role.startsWith("PLATFORM_")) return true
    if (role === "TENANT_OWNER" || role === "TENANT_SUPER_ADMIN" || role === "TENANT_ADMIN") return true
  }
  return role === "owner" || role === "manager"
}

export function hasMinimumRoleLevel(userRole: string | null, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole || ""] || 0
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0
  return userLevel >= requiredLevel
}

export function isStaffRole(role: string | null): boolean {
  if (!role) return false
  return (
    role === "owner" ||
    role === "manager" ||
    role === "staff" ||
    role.startsWith("PLATFORM_") ||
    role.startsWith("TENANT_")
  )
}

export function isAdminRole(role: string | null): boolean {
  if (!role) return false
  return (
    role === "owner" ||
    role === "PLATFORM_OWNER" ||
    role === "PLATFORM_ADMIN" ||
    role === "TENANT_OWNER" ||
    role === "TENANT_SUPER_ADMIN" ||
    role === "TENANT_ADMIN"
  )
}
