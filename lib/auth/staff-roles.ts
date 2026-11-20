/*
  Pure helpers for the staff_roles role vocabulary.

  These live here rather than in lib/auth/role-grant.ts because that module
  carries "use server". Every function a "use server" module exports becomes
  a server action and must be async, so a synchronous helper there fails the
  build outright:

      ./lib/auth/role-grant.ts:134:17
      Server Actions must be async functions.

  Caught by `next build` on 2026-11-19, after a typecheck had passed clean --
  tsc does not know the "use server" rule, so only a build finds this. It
  would have broken the Vercel deploy.
*/

/*
  THE ONLY VALUES staff_roles.role ACCEPTS, since 2026-11-19 (D-011 item 1).

  Kept in sync with the staff_roles_role_check constraint in migration
  20261119_011. Widening one without the other breaks grants at runtime, so
  the constraint comment carries the same warning.

  WHY the lowercase values were removed. Policies across public and core test
  for lowercase role literals — 103 of them for 'owner', 84 for 'manager', 31
  for 'organizer', 26 for 'admin', 21 for 'staff'. The old CHECK permitted all
  of those while no row held any of them, so the policies were dormant purely
  because the strings did not exist in the table. Writing one would have
  activated them. The mapper below used to emit exactly those strings via its
  `return role` fallthrough.
*/
export const STAFF_ROLE_VALUES = [
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "TENANT_OWNER",
  "TENANT_SUPER_ADMIN",
  "TENANT_ADMIN",
  "TENANT_MANAGER",
  "TENANT_ORGANIZER",
  "TENANT_STAFF",
] as const

export type StaffRoleValue = (typeof STAFF_ROLE_VALUES)[number]

/*
  Normalise a role string from a legacy call site into a permitted value, or
  return null if it cannot be mapped WITHOUT GUESSING AT A PRIVILEGE LEVEL.

  Only the four unambiguous tenant-scoped names are translated. 'owner',
  'superadmin' and 'moderator' deliberately return null even though the old
  CHECK permitted them: choosing an uppercase equivalent for those would be a
  decision about how much authority to grant, not a spelling change, and the
  reviewers on D-011 were explicit that TENANT_MANAGER <-> manager is a
  semantic mapping rather than a case conversion. A caller that means
  TENANT_OWNER should say TENANT_OWNER.
*/
export function toStaffRoleValue(input: string | null | undefined): StaffRoleValue | null {
  if (!input) return null
  const raw = input.trim()
  if ((STAFF_ROLE_VALUES as readonly string[]).includes(raw)) {
    return raw as StaffRoleValue
  }
  switch (raw.toLowerCase()) {
    case "platform_owner":  return "PLATFORM_OWNER"
    case "platform_admin":  return "PLATFORM_ADMIN"
    case "tenant_owner":    return "TENANT_OWNER"
    case "tenant_admin":    return "TENANT_SUPER_ADMIN"
    case "tenant_manager":
    case "manager":         return "TENANT_MANAGER"
    case "admin":           return "TENANT_ADMIN"
    case "organizer":       return "TENANT_ORGANIZER"
    case "staff":           return "TENANT_STAFF"
    default:                return null
  }
}
