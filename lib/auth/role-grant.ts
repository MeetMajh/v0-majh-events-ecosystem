"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { requireStaffAction } from "@/lib/auth/require-staff"
import { revalidatePath } from "next/cache"

// ═══════════════════════════════════════════════════════════════════════════════
// Role Taxonomy
// ═══════════════════════════════════════════════════════════════════════════════

// Platform-scoped roles (apply across all tenants)
export const PLATFORM_ROLES = ["platform_owner", "platform_admin"] as const
export type PlatformRole = (typeof PLATFORM_ROLES)[number]

// Tenant-scoped roles (apply within a single tenant)
export const TENANT_ROLES = [
  "tenant_owner",
  "tenant_admin",
  "tenant_manager",
  "admin",
  "manager",
  "organizer",
  "staff",
] as const
export type TenantRole = (typeof TENANT_ROLES)[number]

// All assignable roles
export type AssignableRole = PlatformRole | TenantRole

// Role hierarchy for trust ordering (high → low)
export const ROLE_HIERARCHY: AssignableRole[] = [
  "platform_owner",
  "platform_admin",
  "tenant_owner",
  "tenant_admin",
  "tenant_manager",
  "admin",
  "manager",
  "organizer",
  "staff",
]

// Maps our unified role names to the constrained role values in each legacy table.
// This is a transitional bridge — after the architectural cleanup, these mappings disappear.
function mapToTenantMembershipsRole(role: AssignableRole): string {
  // tenant_memberships.role CHECK constraint allows: owner | admin | member | viewer
  // We map our richer taxonomy down to this 4-value vocabulary
  if (role === "tenant_owner" || role === "platform_owner") return "owner"
  if (
    role === "tenant_admin" ||
    role === "tenant_manager" ||
    role === "platform_admin"
  )
    return "admin"
  if (role === "admin" || role === "manager" || role === "organizer") return "admin"
  if (role === "staff") return "member"
  return "member"
}

function mapToStaffRolesRole(role: AssignableRole): string {
  // staff_roles.role is more permissive; we use the canonical lowercase name
  // EXCEPT for platform-level which uses the uppercase legacy form
  if (role === "platform_owner") return "PLATFORM_OWNER"
  if (role === "platform_admin") return "PLATFORM_ADMIN"
  if (role === "tenant_owner") return "TENANT_OWNER"
  if (role === "tenant_admin") return "TENANT_SUPER_ADMIN"
  if (role === "tenant_manager") return "TENANT_MANAGER"
  return role  // admin | manager | organizer | staff — lowercase as-is
}

function mapToProfilesRole(role: AssignableRole): string {
  // profiles.role is the display field. Mirrors staff_roles for platform-level,
  // shows the lowercase role for tenant-level.
  if (role === "platform_owner") return "PLATFORM_OWNER"
  if (role === "platform_admin") return "PLATFORM_ADMIN"
  return role
}

// ═══════════════════════════════════════════════════════════════════════════════
// Snapshot helper — captures all role-table state for a user
// ═══════════════════════════════════════════════════════════════════════════════

async function captureRoleSnapshot(userId: string, serviceClient: any) {
  const [{ data: profile }, { data: staffRole }, { data: tenantMems }] =
    await Promise.all([
      serviceClient.from("profiles").select("role").eq("id", userId).single(),
      serviceClient
        .from("staff_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle(),
      serviceClient
        .from("tenant_memberships")
        .select("tenant_id, role")
        .eq("user_id", userId),
    ])

  return {
    profile_role: profile?.role ?? null,
    staff_roles_role: staffRole?.role ?? null,
    tenant_memberships: tenantMems ?? [],
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main action: grant a role
// ═══════════════════════════════════════════════════════════════════════════════

export interface GrantRoleInput {
  targetUserId: string
  role: AssignableRole | null  // null = revoke / set to player (implicit)
  tenantId?: string  // required if role is tenant-scoped
  reason: string
}

export interface GrantRoleResult {
  success: boolean
  error?: string
  auditId?: string
}

export async function grantRole(input: GrantRoleInput): Promise<GrantRoleResult> {
  // 1. Authorization: only manager-and-above can grant roles
  const { userId: actingUserId } = await requireStaffAction("manager")

  // 2. Input validation
  if (!input.targetUserId) {
    return { success: false, error: "Target user is required" }
  }
  if (!input.reason || input.reason.trim().length < 3) {
    return { success: false, error: "A reason for the change is required (3+ chars)" }
  }

  const isPlatformRole = input.role !== null && PLATFORM_ROLES.includes(input.role as PlatformRole)
  const isTenantRole = input.role !== null && TENANT_ROLES.includes(input.role as TenantRole)

  if (input.role !== null && !isPlatformRole && !isTenantRole) {
    return { success: false, error: `Unknown role: ${input.role}` }
  }

  if (isTenantRole && !input.tenantId) {
    return { success: false, error: "Tenant ID is required for tenant-scoped roles" }
  }

  // 3. Service client (bypasses RLS for atomic multi-table update)
  const serviceClient = await createServiceClient()

  // 4. Snapshot BEFORE the change
  const snapshotBefore = await captureRoleSnapshot(input.targetUserId, serviceClient)

  // 5. Apply role changes across all tables
  //    NOTE: this isn't a true SQL transaction, but each step is idempotent
  //    and we capture before/after snapshots so drift is recoverable
  try {
    if (input.role === null) {
      // REVOKE — remove from staff_roles AND tenant_memberships, set profile to user
      await serviceClient.from("staff_roles").delete().eq("user_id", input.targetUserId)
      if (input.tenantId) {
        await serviceClient
          .from("tenant_memberships")
          .delete()
          .eq("user_id", input.targetUserId)
          .eq("tenant_id", input.tenantId)
      }
      await serviceClient
        .from("profiles")
        .update({ role: "user" })
        .eq("id", input.targetUserId)
    } else if (isPlatformRole) {
      // PLATFORM ROLE — update staff_roles and profile. tenant_memberships unchanged.
      const staffRolesValue = mapToStaffRolesRole(input.role)
      const profilesValue = mapToProfilesRole(input.role)

      const { error: staffError } = await serviceClient
        .from("staff_roles")
        .upsert({ user_id: input.targetUserId, role: staffRolesValue }, { onConflict: "user_id" })

      if (staffError) throw new Error(`staff_roles: ${staffError.message}`)

      const { error: profileError } = await serviceClient
        .from("profiles")
        .update({ role: profilesValue })
        .eq("id", input.targetUserId)

      if (profileError) throw new Error(`profiles: ${profileError.message}`)
    } else if (isTenantRole) {
      // TENANT ROLE — update all three tables
      const tenantMembershipsValue = mapToTenantMembershipsRole(input.role)
      const staffRolesValue = mapToStaffRolesRole(input.role)
      const profilesValue = mapToProfilesRole(input.role)

      // tenant_memberships upsert
      const { error: tmError } = await serviceClient
        .from("tenant_memberships")
        .upsert(
          {
            user_id: input.targetUserId,
            tenant_id: input.tenantId,
            role: tenantMembershipsValue,
            accepted_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,user_id" }
        )

      if (tmError) throw new Error(`tenant_memberships: ${tmError.message}`)

      // staff_roles upsert
      const { error: srError } = await serviceClient
        .from("staff_roles")
        .upsert(
          { user_id: input.targetUserId, role: staffRolesValue },
          { onConflict: "user_id" }
        )

      if (srError) throw new Error(`staff_roles: ${srError.message}`)

      // profiles update
      const { error: pError } = await serviceClient
        .from("profiles")
        .update({ role: profilesValue })
        .eq("id", input.targetUserId)

      if (pError) throw new Error(`profiles: ${pError.message}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[grantRole] Failed to apply role change:", message)

    // Still log the failed attempt to audit
    await serviceClient.from("role_change_audit").insert({
      target_user_id: input.targetUserId,
      changed_by_user_id: actingUserId,
      scope: isPlatformRole ? "platform" : "tenant",
      tenant_id: isTenantRole ? input.tenantId : null,
      old_role: snapshotBefore.staff_roles_role,
      new_role: input.role,
      reason: `[FAILED] ${input.reason} — Error: ${message}`,
      snapshot_before: snapshotBefore,
      snapshot_after: { error: message },
    })

    return { success: false, error: message }
  }

  // 6. Snapshot AFTER and write to audit log
  const snapshotAfter = await captureRoleSnapshot(input.targetUserId, serviceClient)

  const { data: auditRow, error: auditError } = await serviceClient
    .from("role_change_audit")
    .insert({
      target_user_id: input.targetUserId,
      changed_by_user_id: actingUserId,
      scope: isPlatformRole ? "platform" : "tenant",
      tenant_id: isTenantRole ? input.tenantId : null,
      old_role: snapshotBefore.staff_roles_role,
      new_role: input.role,
      reason: input.reason,
      snapshot_before: snapshotBefore,
      snapshot_after: snapshotAfter,
    })
    .select("id")
    .single()

  if (auditError) {
    console.error("[grantRole] Audit write failed:", auditError.message)
    // Don't fail the whole operation — the role was set; we just couldn't audit.
    // This should be rare and triggers attention in logs.
  }

  // 7. Revalidate pages that show role info
  revalidatePath("/dashboard/admin/users")
  revalidatePath(`/dashboard/admin/users/${input.targetUserId}`)
  revalidatePath("/dashboard/admin/users/audit")
  revalidatePath("/dashboard/profile")

  return { success: true, auditId: auditRow?.id }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Read action: get audit log entries
// ═══════════════════════════════════════════════════════════════════════════════

export async function getRoleAuditLog(options?: {
  targetUserId?: string
  limit?: number
  offset?: number
}) {
  // Reads gated by manager-and-above (also enforced by RLS on the table)
  const { supabase } = await requireStaffAction("manager")

  let query = supabase
    .from("role_change_audit")
    .select(`
      id,
      target_user_id,
      changed_by_user_id,
      scope,
      tenant_id,
      old_role,
      new_role,
      reason,
      snapshot_before,
      snapshot_after,
      created_at
    `)
    .order("created_at", { ascending: false })

  if (options?.targetUserId) {
    query = query.eq("target_user_id", options.targetUserId)
  }

  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, error } = await query

  if (error) {
    return { entries: [], error: error.message }
  }

  return { entries: data ?? [], error: null }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Read action: get a user's current role state across all tables
// Used by the role-grant UI to show "where they are now"
// ═══════════════════════════════════════════════════════════════════════════════

export async function getUserRoleState(targetUserId: string) {
  const { supabase } = await requireStaffAction("manager")
  const serviceClient = await createServiceClient()

  const snapshot = await captureRoleSnapshot(targetUserId, serviceClient)

  const { data: user } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, role, created_at")
    .eq("id", targetUserId)
    .single()

  return {
    user,
    ...snapshot,
  }
}
