import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getUserPermissions } from "@/lib/authorization"
import { STAFF_TIERS } from "@/lib/auth/require-staff"

/**
 * Guard for API route handlers. The sibling of requireStaff(), with route
 * semantics instead of page semantics.
 *
 * requireStaff() calls redirect(), which in a route handler produces a 307 to
 * an HTML page. A fetch() from a client component follows it and gets markup
 * where it expected JSON, so the caller sees a parse error rather than "you
 * are not allowed". Routes must answer with a status code.
 *
 * This replaces a twelve-line block that was repeated in eighteen routes and
 * five pages:
 *
 *     const { data: staffRole } = await supabase
 *       .from("staff_roles").select("role").eq("user_id", user.id)
 *       .in("role", ["owner", "manager"]).single()
 *     if (!staffRole) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
 *
 * That literal is why the platform owner was locked out of his own platform.
 * staff_roles.role holds PLATFORM_OWNER, which is in neither "owner" nor
 * "manager", so .single() found no row and every one of those routes answered
 * 403. Sixth sighting of the uppercase/lowercase vocabulary drift, and the
 * most expensive: it included approving payouts and releasing escrow.
 *
 * The tier list is NOT restated here. It is imported from require-staff.ts, so
 * a page and a route can never disagree about who is admitted — the failure
 * this whole class of bug is made of.
 *
 * Usage:
 *
 *     const guard = await requireStaffRoute("manager")
 *     if (!guard.ok) return guard.response
 *     const { supabase, userId, role } = guard
 *
 * Tiers, per core.role_tiers:
 *   "owner"   account authority, including financial WRITES.
 *             PLATFORM_OWNER / PLATFORM_ADMIN / TENANT_OWNER /
 *             TENANT_SUPER_ADMIN. Use for anything that moves money.
 *   "manager" operational and technical authority. Financial READS.
 *   "staff"   assigned tasks.
 */

export type StaffTier = "staff" | "organizer" | "manager" | "owner"

type Granted = {
  ok: true
  userId: string
  role: string
  supabase: Awaited<ReturnType<typeof createClient>>
}
type Refused = { ok: false; response: NextResponse }

export async function requireStaffRoute(
  minimumTier: StaffTier = "staff"
): Promise<Granted | Refused> {
  const supabase = await createClient()
  const permissions = await getUserPermissions()

  if (!permissions) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  // Platform-level always passes, exactly as requireStaff() does.
  if (permissions.isPlatformLevel) {
    return {
      ok: true,
      userId: permissions.userId,
      role: permissions.unifiedRole ?? "owner",
      supabase,
    }
  }

  const role = permissions.unifiedRole ?? ""

  if (!STAFF_TIERS[minimumTier].includes(role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return { ok: true, userId: permissions.userId, role, supabase }
}
