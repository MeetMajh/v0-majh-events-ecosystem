import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getUnifiedFeed, trackFeedInteraction } from "@/lib/unified-feed-service"

/**
 * GET /api/feed/unified
 * Returns unified feed combining clips, live matches, VODs, and ads
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  
  // Pagination
  const limit = parseInt(searchParams.get("limit") || "20")
  const offset = parseInt(searchParams.get("offset") || "0")
  
  // Filters
  const gameFilter = searchParams.get("game") || undefined
  const sessionId = searchParams.get("sessionId") || undefined
  
  // Options
  const includeAds = searchParams.get("ads") !== "false"
  const boostLive = searchParams.get("boostLive") !== "false"
  const boostGames = searchParams.get("boostGames")?.split(",").filter(Boolean) || []
  const avoidGames = searchParams.get("avoidGames")?.split(",").filter(Boolean) || []

  // Get user if authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  try {
    console.log("[v0] Unified feed API called with limit:", limit, "offset:", offset)
    
    const result = await getUnifiedFeed({
      limit,
      offset,
      gameFilter,
      userId: user?.id || null,
      sessionId,
      includeAds,
      adFrequency: 5,
      boostLive,
      boostGames,
      avoidGames,
    })

    console.log("[v0] Unified feed returned:", result.items?.length, "items")
    return NextResponse.json(result)
  } catch (error) {
    console.error("[v0] Unified feed API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch feed" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/feed/unified
 * Track interaction with feed item
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { itemType, itemId, action, sessionId, watchDurationSeconds, watchPercentage, positionInFeed } = body

    if (!itemType || !itemId || !action || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Get user if authenticated
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await trackFeedInteraction(itemType, itemId, action, {
      userId: user?.id || null,
      sessionId,
      watchDurationSeconds,
      watchPercentage,
      positionInFeed,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Track interaction error:", error)
    return NextResponse.json(
      { error: "Failed to track interaction" },
      { status: 500 }
    )
  }
}
