import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export type UserRole = "owner" | "manager" | "staff"

export async function getUserRole(): Promise<UserRole | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  return (data?.role as UserRole) ?? null
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

  const role = data?.role as UserRole | undefined
  if (!role || !allowed.includes(role)) {
    redirect("/dashboard")
  }

  return { role, userId: user.id }
}

export function canManageMenu(role: UserRole) {
  return role === "owner" || role === "manager"
}

export function canManageStaff(role: UserRole) {
  return role === "owner"
}

export function canManageInventory(role: UserRole) {
  return role === "owner" || role === "manager"
}
