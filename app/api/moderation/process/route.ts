import { NextResponse } from "next/server"
import { moderatePendingMedia } from "@/lib/content-moderation"
import { requireCronAuth } from "@/lib/cron-auth"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

// This endpoint can be called by a cron job to process pending media
// Set up a Vercel Cron or external scheduler to call this every few minutes

export async function POST(req: Request) {
  /*
    FAIL-CLOSED 2026-11-18.

    This route is scheduled in vercel.json ("/api/moderation/process", daily)
    but it did not live under app/api/cron/, so it never adopted the shared
    requireCronAuth helper that the other seven scheduled routes use. Its own
    check was:

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) -> 401

    The leading `cronSecret &&` made the whole check conditional on the secret
    being configured. With CRON_SECRET unset, the guard was skipped and any
    caller could trigger media moderation — and since GET below delegates to
    POST, a plain browser request would do it. The comment above it read
    "Optional: Add secret key verification", which is how it stayed that way.

    Now it uses the same helper as every other scheduled route, which accepts
    Vercel's x-vercel-cron header or a timing-safe Bearer match and refuses
    everything else.
  */
  const unauthorized = requireCronAuth(req)
  if (unauthorized) return unauthorized
  
  try {
    const result = await moderatePendingMedia(10)
    
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Moderation API] Processing error:", error)
    return NextResponse.json(
      { error: "Moderation processing failed" },
      { status: 500 }
    )
  }
}

/*
  GET delegates to POST, so it is gated by the same requireCronAuth call.
  Kept because a scheduler may issue GET; it is no longer "easy testing".
*/
export async function GET(req: Request) {
  return POST(req)
}
