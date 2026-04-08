import { NextResponse } from "next/server"
import { processMatchesForHighlights } from "@/lib/highlight-detection"

export const runtime = "nodejs"
export const maxDuration = 120
export const dynamic = "force-dynamic"

// This endpoint can be called by a cron job to process matches for highlights
// Set up a Vercel Cron or external scheduler to call this every hour

export async function POST(req: Request) {
  // Optional: Add secret key verification for cron jobs
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  try {
    const { limit = 10 } = await req.json().catch(() => ({}))
    
    const result = await processMatchesForHighlights(limit)
    
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Highlights API] Processing error:", error)
    return NextResponse.json(
      { error: "Highlight processing failed" },
      { status: 500 }
    )
  }
}

// Also allow GET for easy testing
export async function GET(req: Request) {
  return POST(req)
}
