import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

// Legacy role types (kept for backward compatibility)
export type UserRole = "owner" | "manager" | "staff"

// T-204 Role types
export type PlatformRole = "PLATFORM_OWNER" | "PLATFORM_ADMIN"
export type TenantRole = "TENANT_OWNER" | "TENANT_SUPER_ADMIN" | "TENANT_ADMIN" | "TENANT_MANAGER" | "TENANT_STAFF"

// Combined role type
export type UnifiedRole = UserRole | PlatformRole | TenantRole

// Role hierarchy mapping
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

// Map T-204 roles to legacy roles for backward compatibility
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

  const rawRole = data?.role as string | undefined
  
  // Map T-204 roles to legacy roles for backward compatibility
  return mapToLegacyRole(rawRole ?? null)
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  const rawRole = data?.role as string | undefined
  const role = mapToLegacyRole(rawRole ?? null)
  
  // Also check if the raw role is a T-204 role that should be allowed
  const isT204Allowed = rawRole && (
    // Platform-level roles always have access
    rawRole.startsWith("PLATFORM_") ||
    // Tenant owner/super admin always have access
    rawRole === "TENANT_OWNER" ||
    rawRole === "TENANT_SUPER_ADMIN" ||
    // Check mapped role
    (role && allowed.includes(role))
  )
  
  if (!role && !isT204Allowed) {
    redirect("/dashboard")
  }
  
  if (role && !allowed.includes(role) && !isT204Allowed) {
    redirect("/dashboard")
  }

  return { role: role || "owner", userId: user.id }
}

export function canManageMenu(role: UserRole | string) {
  if (typeof role === "string") {
    // Check T-204 roles
    if (role.startsWith("PLATFORM_")) return true
    if (role === "TENANT_OWNER" || role === "TENANT_SUPER_ADMIN" || role === "TENANT_ADMIN") return true
  }
  return role === "owner" || role === "manager"
}

export function canManageStaff(role: UserRole | string) {
  if (typeof role === "string") {
    // Check T-204 roles
    if (role.startsWith("PLATFORM_")) return true
    if (role === "TENANT_OWNER" || role === "TENANT_SUPER_ADMIN") return true
  }
  return role === "owner"
}

export function canManageInventory(role: UserRole | string) {
  if (typeof role === "string") {
    // Check T-204 roles
    if (role.startsWith("PLATFORM_")) return true
    if (role === "TENANT_OWNER" || role === "TENANT_SUPER_ADMIN" || role === "TENANT_ADMIN") return true
  }
  return role === "owner" || role === "manager"
}

// New helper to check if a role has at least the minimum required level
export function hasMinimumRoleLevel(userRole: string | null, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole || ""] || 0
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0
  return userLevel >= requiredLevel
}

// Check if role is a staff-level role
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

// Check if role is an admin-level role
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
