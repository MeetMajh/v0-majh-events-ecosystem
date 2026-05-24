import { NextRequest, NextResponse } from "next/server"
import {
  getLiveEvents,
  getUpcomingEvents,
  updateViewerCount,
  getAllLiveStreams,
} from "@/lib/streaming-actions"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category") as 'tournament' | 'practice' | 'community' | 'educational' | 'entertainment' | null
  const tenantId = searchParams.get("tenantId")
  const upcoming = searchParams.get("upcoming") === "true"
  const all = searchParams.get("all") === "true"
  const limit = parseInt(searchParams.get("limit") || "20")

  try {
    if (upcoming) {
      const result = await getUpcomingEvents(limit)
      return NextResponse.json(result)
    }

    if (all) {
      // Get all live content (rooms, broadcasts, events)
      const result = await getAllLiveStreams()
      return NextResponse.json(result)
    }

    const result = await getLiveEvents(category || undefined, tenantId || undefined, limit)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Get live events error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    if (action === "updateViewers") {
      const { targetType, targetId, delta } = data

      if (!targetType || !targetId || delta === undefined) {
        return NextResponse.json(
          { error: "Target type, target ID, and delta required" },
          { status: 400 }
        )
      }

      const result = await updateViewerCount(targetType, targetId, delta)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Live events API error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
