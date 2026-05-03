import { NextResponse } from "next/server"

/**
 * Validates cron job authentication.
 * 
 * Vercel production crons send: x-vercel-cron: 1
 * Manual triggers send: Authorization: Bearer <CRON_SECRET>
 * 
 * @returns null if authorized, NextResponse with 401 if unauthorized
 */
export function requireCronAuth(request: Request): NextResponse | null {
  const isVercelCron = request.headers.get("x-vercel-cron") === "1"
  const authHeader = request.headers.get("authorization")
  const isManualTrigger = authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (isVercelCron || isManualTrigger) {
    return null // Authorized
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
