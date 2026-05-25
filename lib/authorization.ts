/**
 * T-204 Unified Authorization System - Server Functions
 * 
 * This module contains server-only authorization functions that require
 * database access. For client-safe utilities, import from authorization-shared.ts
 */

import "server-only"
import { createClient } from "@/lib/supabase/server"
import {
  type UserPermissions,
  ROLE_HIERARCHY,
  ROLE_MAPPINGS,
  isPlatformRole,
  isTenantRole,
  computePermissionsFromRole,
} from "./authorization-shared"

// Re-export client-safe utilities for convenience
export {
  type PlatformRole,
  type TenantRole,
  type LegacyRole,
  type ProfileRole,
  type UnifiedRole,
  type UserPermissions,
  ROLE_HIERARCHY,
  ROLE_MAPPINGS,
  isPlatformRole,
  isTenantRole,
  hasMinimumRole,
  getRoleDisplayName,
  getRoleBadgeColor,
  getAssignableRoles,
  computePermissionsFromRole,
} from "./authorization-shared"

/**
 * Determine the unified role from multiple role sources
 */
function determineUnifiedRole(staffRole: string | null, profileRole: string | null): string | null {
  const staffLevel = ROLE_HIERARCHY[staffRole || ""] || 0
  const profileLevel = ROLE_HIERARCHY[profileRole || ""] || 0
  
  if (staffLevel >= profileLevel && staffRole) {
    return staffRole
  }
  if (profileLevel > staffLevel && profileRole) {
    return profileRole
  }
  return staffRole || profileRole || null
}

/**
 * Get user permissions from the database (SERVER ONLY)
 * This is the primary function for determining what a user can do
 */
export async function getUserPermissions(): Promise<UserPermissions | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  // Fetch both staff_roles and profile in parallel
  const [{ data: staffRoleData }, { data: profile }] = await Promise.all([
    supabase.from("staff_roles").select("role").eq("user_id", user.id).single(),
    supabase.from("profiles").select("role, is_organizer").eq("id", user.id).single(),
  ])

  const staffRole = staffRoleData?.role || null
  const profileRole = profile?.role || null
  const isOrganizerFlag = profile?.is_organizer || false

  // Determine unified role (highest privilege from all sources)
  const unifiedRole = determineUnifiedRole(staffRole, profileRole)
  
  // Compute permissions using shared utility
  const permissions = computePermissionsFromRole(unifiedRole, isOrganizerFlag)

  return {
    userId: user.id,
    email: user.email || null,
    staffRole,
    profileRole,
    unifiedRole,
    ...permissions,
  }
}
