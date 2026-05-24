import { NextResponse } from "next/server"
import { moderatePendingMedia } from "@/lib/content-moderation"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

// This endpoint can be called by a cron job to process pending media
// Set up a Vercel Cron or external scheduler to call this every few minutes

export async function POST(req: Request) {
  // Optional: Add secret key verification for cron jobs
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
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

// Also allow GET for easy testing
export async function GET(req: Request) {
  return POST(req)
}
