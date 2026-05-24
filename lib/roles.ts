import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export type UserRole = 
  "owner" | "manager" | "staff" | "admin" | "user" |
  "PLATFORM_OWNER" | 
  "TENANT_OWNER" | 
  "TENANT_SUPER_ADMIN" | 
  "TENANT_ADMIN" | 
  "TENANT_MANAGER" | 
  "TENANT_BILLING" | 
  "TENANT_MEMBER" |
  "DEPARTMENT_ADMIN" | 
  "DEPARTMENT_MANAGER" | 
  "DEPARTMENT_STAFF" |
  "LOCATION_MANAGER" | 
  "LOCATION_STAFF"

export async function getUserRole(): Promise<UserRole | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("organization_members")
    .select("role_key")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .single()

  return (data?.role_key as UserRole) ?? null
}

const LEGACY_MAP: Record<string, string[]> = {
  "owner": ["owner", "TENANT_OWNER", "TENANT_SUPER_ADMIN", "PLATFORM_OWNER"],
  "admin": ["admin", "TENANT_ADMIN", "DEPARTMENT_ADMIN"],
  "manager": ["manager", "TENANT_MANAGER", "DEPARTMENT_MANAGER", "LOCATION_MANAGER"],
  "staff": ["staff", "DEPARTMENT_STAFF", "LOCATION_STAFF"],
  "user": ["user", "TENANT_MEMBER"]
}

export async function requireRole(allowed: UserRole[]): Promise<{ role: UserRole; userId: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data } = await supabase
    .from("organization_members")
    .select("role_key")
    .eq("user_id", user.id)
    .eq("is_active", true)

  const roles = (data || []).map(r => r.role_key as UserRole)
  
  if (roles.length === 0) {
    redirect("/dashboard")
  }

  const allowedSet = new Set<string>()
  for (const role of allowed) {
    allowedSet.add(role)
    if (LEGACY_MAP[role]) {
      LEGACY_MAP[role].forEach(r => allowedSet.add(r))
    }
  }

  const hasAccess = roles.some(role => allowedSet.has(role))

  if (!hasAccess) {
    redirect("/dashboard")
  }

  return { role: roles[0], userId: user.id }
}

export function canManageMenu(role: UserRole) {
  return ["owner", "TENANT_OWNER", "TENANT_SUPER_ADMIN", "manager", "TENANT_MANAGER", "DEPARTMENT_MANAGER"].includes(role)
}

export function canManageStaff(role: UserRole) {
  return ["owner", "TENANT_OWNER", "TENANT_SUPER_ADMIN"].includes(role)
}

export function canManageInventory(role: UserRole) {
  return ["owner", "TENANT_OWNER", "TENANT_SUPER_ADMIN", "manager", "TENANT_MANAGER", "DEPARTMENT_MANAGER"].includes(role)
}
