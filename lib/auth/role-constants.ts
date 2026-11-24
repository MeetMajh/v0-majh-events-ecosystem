/*
  Role taxonomy — plain module, deliberately NOT "use server".

  These live here rather than in role-grant.ts because Next.js requires that
  a "use server" file export ONLY async functions. Exporting an array from
  one is a build error:

    A "use server" file can only export async functions, found object.

  It aborts page-data collection, so it fails the whole build rather than
  one route. That is why every production deployment failed from 2026-11-17
  onward while `tsc` stayed clean at 237: next.config.mjs sets
  typescript.ignoreBuildErrors, and this is not a type error.

  Only the plain data moved. The role mappers and snapshot helpers stay in
  role-grant.ts, because they are implementation of the server actions and
  depend on imports that belong there.
*/

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
