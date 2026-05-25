/**
 * T-204 Unified Authorization System - Shared Utilities
 * 
 * This module contains client-safe authorization utilities that can be used
 * in both server and client components. No server-only imports.
 * 
 * Role Hierarchy (highest to lowest):
 * 1. PLATFORM_OWNER - Full platform control
 * 2. PLATFORM_ADMIN - Platform-wide administration
 * 3. TENANT_OWNER - Full tenant control
 * 4. TENANT_SUPER_ADMIN - Tenant super administration
 * 5. TENANT_ADMIN - Tenant administration
 * 6. TENANT_MANAGER - Tenant management
 * 7. TENANT_STAFF - Tenant staff member
 * 8. organizer - Tournament organizer
 * 9. user - Regular user
 */

// T-204 Role Types
export type PlatformRole = "PLATFORM_OWNER" | "PLATFORM_ADMIN"
export type TenantRole = "TENANT_OWNER" | "TENANT_SUPER_ADMIN" | "TENANT_ADMIN" | "TENANT_MANAGER" | "TENANT_STAFF"
export type LegacyRole = "owner" | "manager" | "staff"
export type ProfileRole = "admin" | "organizer" | "user" | "staff"
export type UnifiedRole = PlatformRole | TenantRole | LegacyRole | ProfileRole

// Role hierarchy for permission checks
export const ROLE_HIERARCHY: Record<string, number> = {
  // Platform level (highest)
  "PLATFORM_OWNER": 100,
  "PLATFORM_ADMIN": 90,
  // Tenant level
  "TENANT_OWNER": 80,
  "TENANT_SUPER_ADMIN": 75,
  "TENANT_ADMIN": 70,
  "TENANT_MANAGER": 60,
  "TENANT_STAFF": 50,
  // Legacy roles (mapped to tenant equivalents)
  "owner": 80,
  "manager": 60,
  "staff": 50,
  // Profile roles
  "admin": 70,
  "organizer": 40,
  "user": 10,
}

// Role mapping for backward compatibility
export const ROLE_MAPPINGS: Record<string, string[]> = {
  // T-204 roles map to legacy permissions
  "PLATFORM_OWNER": ["owner", "manager", "staff", "admin", "organizer"],
  "PLATFORM_ADMIN": ["owner", "manager", "staff", "admin", "organizer"],
  "TENANT_OWNER": ["owner", "manager", "staff", "admin", "organizer"],
  "TENANT_SUPER_ADMIN": ["owner", "manager", "staff", "admin", "organizer"],
  "TENANT_ADMIN": ["manager", "staff", "admin", "organizer"],
  "TENANT_MANAGER": ["manager", "staff", "organizer"],
  "TENANT_STAFF": ["staff"],
  // Legacy roles stay as-is
  "owner": ["owner", "manager", "staff"],
  "manager": ["manager", "staff"],
  "staff": ["staff"],
  "admin": ["admin", "organizer"],
  "organizer": ["organizer"],
  "user": [],
}

export interface UserPermissions {
  userId: string
  email: string | null
  staffRole: string | null
  profileRole: string | null
  unifiedRole: string | null
  isPlatformLevel: boolean
  isTenantLevel: boolean
  isStaff: boolean
  isManager: boolean
  isOwner: boolean
  canOrganize: boolean
  canManageUsers: boolean
  canManageFinancials: boolean
  canAccessAdmin: boolean
  canAccessCarBardMV: boolean
  canManagePermissions: boolean
  canCreateBroadcasts: boolean
  hierarchyLevel: number
}

/**
 * Check if a role is platform-level
 */
export function isPlatformRole(role: string | null): boolean {
  return role === "PLATFORM_OWNER" || role === "PLATFORM_ADMIN"
}

/**
 * Check if a role is tenant-level
 */
export function isTenantRole(role: string | null): boolean {
  return role?.startsWith("TENANT_") || false
}

/**
 * Check if user has at least the minimum required role level
 */
export function hasMinimumRole(userRole: string | null, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole || "user"] || 0
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0
  return userLevel >= requiredLevel
}

/**
 * Get display name for a role
 */
export function getRoleDisplayName(role: string | null): string {
  if (!role) return "User"
  
  const displayNames: Record<string, string> = {
    "PLATFORM_OWNER": "Platform Owner",
    "PLATFORM_ADMIN": "Platform Admin",
    "TENANT_OWNER": "Organization Owner",
    "TENANT_SUPER_ADMIN": "Super Admin",
    "TENANT_ADMIN": "Admin",
    "TENANT_MANAGER": "Manager",
    "TENANT_STAFF": "Staff",
    "owner": "Owner",
    "manager": "Manager",
    "staff": "Staff",
    "admin": "Admin",
    "organizer": "Organizer",
    "user": "User",
  }
  
  return displayNames[role] || role
}

/**
 * Get role badge color class
 */
export function getRoleBadgeColor(role: string | null): string {
  if (!role) return "bg-muted text-muted-foreground"
  
  if (isPlatformRole(role)) {
    return "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
  }
  if (role === "TENANT_OWNER" || role === "owner") {
    return "bg-purple-500/20 text-purple-400"
  }
  if (role === "TENANT_SUPER_ADMIN" || role === "TENANT_ADMIN" || role === "admin") {
    return "bg-blue-500/20 text-blue-400"
  }
  if (role === "TENANT_MANAGER" || role === "manager") {
    return "bg-green-500/20 text-green-400"
  }
  if (role === "TENANT_STAFF" || role === "staff") {
    return "bg-cyan-500/20 text-cyan-400"
  }
  if (role === "organizer") {
    return "bg-yellow-500/20 text-yellow-400"
  }
  return "bg-muted text-muted-foreground"
}

/**
 * Get available roles that a user can assign to others
 */
export function getAssignableRoles(userRole: string | null): string[] {
  if (userRole === "PLATFORM_OWNER") {
    return [
      "PLATFORM_ADMIN",
      "TENANT_OWNER",
      "TENANT_SUPER_ADMIN",
      "TENANT_ADMIN",
      "TENANT_MANAGER",
      "TENANT_STAFF",
      "organizer",
      "user",
    ]
  }
  
  if (userRole === "PLATFORM_ADMIN") {
    return [
      "TENANT_OWNER",
      "TENANT_SUPER_ADMIN",
      "TENANT_ADMIN",
      "TENANT_MANAGER",
      "TENANT_STAFF",
      "organizer",
      "user",
    ]
  }
  
  if (userRole === "TENANT_OWNER" || userRole === "owner") {
    return [
      "TENANT_SUPER_ADMIN",
      "TENANT_ADMIN",
      "TENANT_MANAGER",
      "TENANT_STAFF",
      "organizer",
      "user",
    ]
  }
  
  if (userRole === "TENANT_SUPER_ADMIN") {
    return [
      "TENANT_ADMIN",
      "TENANT_MANAGER",
      "TENANT_STAFF",
      "organizer",
      "user",
    ]
  }
  
  if (userRole === "TENANT_ADMIN" || userRole === "manager" || userRole === "admin") {
    return [
      "TENANT_MANAGER",
      "TENANT_STAFF",
      "organizer",
      "user",
    ]
  }
  
  if (userRole === "TENANT_MANAGER") {
    return [
      "TENANT_STAFF",
      "organizer",
      "user",
    ]
  }
  
  return []
}

/**
 * Compute permissions from role (client-safe version)
 */
export function computePermissionsFromRole(role: string | null, isOrganizerFlag = false): Omit<UserPermissions, 'userId' | 'email' | 'staffRole' | 'profileRole' | 'unifiedRole'> {
  const hierarchyLevel = ROLE_HIERARCHY[role || "user"] || 0
  const mappings = ROLE_MAPPINGS[role || ""] || []
  
  const checkIsStaff = (): boolean => {
    if (!role) return false
    return mappings.includes("staff") || 
           role === "staff" || 
           role === "TENANT_STAFF" ||
           isPlatformRole(role) ||
           isTenantRole(role)
  }

  const checkIsManager = (): boolean => {
    if (!role) return false
    return mappings.includes("manager") || 
           role === "manager" || 
           role === "TENANT_MANAGER" ||
           role === "TENANT_ADMIN" ||
           role === "TENANT_SUPER_ADMIN" ||
           role === "TENANT_OWNER" ||
           isPlatformRole(role)
  }

  const checkIsOwner = (): boolean => {
    if (!role) return false
    return mappings.includes("owner") || 
           role === "owner" || 
           role === "TENANT_OWNER" ||
           isPlatformRole(role)
  }

  const isStaff = checkIsStaff()
  const isManager = checkIsManager()
  const isOwner = checkIsOwner()

  return {
    isPlatformLevel: isPlatformRole(role),
    isTenantLevel: isTenantRole(role),
    isStaff,
    isManager,
    isOwner,
    canOrganize: isOrganizerFlag || mappings.includes("organizer") || role === "organizer" || isStaff,
    canManageUsers: isManager,
    canManageFinancials: isPlatformRole(role) || role === "TENANT_OWNER" || role === "TENANT_SUPER_ADMIN" || role === "owner",
    canAccessAdmin: isStaff,
    canAccessCarBardMV: isStaff,
    canManagePermissions: isPlatformRole(role) || role === "TENANT_OWNER" || role === "TENANT_SUPER_ADMIN" || role === "owner",
    canCreateBroadcasts: isPlatformRole(role) || 
      role === "TENANT_OWNER" || 
      role === "TENANT_SUPER_ADMIN" || 
      role === "TENANT_ADMIN" || 
      role === "TENANT_MANAGER" || 
      role === "owner" || 
      role === "manager" || 
      role === "admin" || 
      role === "organizer",
    hierarchyLevel,
  }
}
