import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"

/**
 * Validates cron job authentication.
 *
 * Vercel production crons send: x-vercel-cron: 1
 * Manual triggers send:         Authorization: Bearer <CRON_SECRET>
 *
 * TWO DEFECTS FIXED 2026-11-18.
 *
 * 1. `Bearer undefined` authorized.
 *
 *    The comparison was:
 *
 *        authHeader === `Bearer ${process.env.CRON_SECRET}`
 *
 *    When CRON_SECRET is unset, that template literal evaluates to the
 *    string "Bearer undefined" — so a request carrying exactly
 *    `Authorization: Bearer undefined` authenticated as a cron trigger.
 *    An unconfigured deployment was therefore MORE reachable than a
 *    configured one, which is the wrong way round. All seven /api/cron
 *    routes share this helper, so all seven shared the defect.
 *
 *    Now: a missing or blank secret means manual triggering is impossible,
 *    rather than trivially possible. Vercel's own header still works, so a
 *    deployment with no secret keeps running its schedule and only loses
 *    manual invocation.
 *
 * 2. The comparison short-circuited on the first differing byte.
 *
 *    String `===` returns as soon as it finds a mismatch, which leaks how
 *    much of a guess was correct. Compared with timingSafeEqual instead,
 *    over equal-length buffers.
 *
 * @returns null if authorized, NextResponse with 401 if unauthorized
 */
export function requireCronAuth(request: Request): NextResponse | null {
  // Vercel sets this on its own scheduled invocations and strips it from
  // inbound external requests.
  if (request.headers.get("x-vercel-cron") === "1") return null

  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")

  // No secret configured: manual triggering is closed, not open.
  if (!secret || secret.trim() === "") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const expected = Buffer.from(`Bearer ${secret}`)
  const presented = Buffer.from(authHeader)

  // timingSafeEqual throws on length mismatch, so check length first — the
  // length of a secret is not the part worth protecting.
  const ok =
    expected.length === presented.length && timingSafeEqual(expected, presented)

  return ok ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
