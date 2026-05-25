import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

/**
 * Requires the request to come from an authenticated admin user.
 * Returns either { user } on success or a NextResponse on failure
 * that the route handler should return immediately.
 *
 * Admin status is determined by either:
 *   1. Email matching ADMIN_EMAILS env var (comma-separated), OR
 *   2. A row in the public.admins table with the user's id
 */
export async function requireAdmin() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — safe to ignore
          }
        },
      },
    }
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized — sign in required" },
        { status: 401 }
      ),
    }
  }

  // Path 1: env-var allowlist
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (allowlist.length > 0 && user.email) {
    if (allowlist.includes(user.email.toLowerCase())) {
      return { user }
    }
  }

  // Path 2: admins table lookup
  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (adminRow) {
    return { user }
  }

  return {
    error: NextResponse.json(
      { error: "Forbidden — admin access required" },
      { status: 403 }
    ),
  }
}
