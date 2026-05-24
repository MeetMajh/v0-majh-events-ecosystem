import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getPersonalizedFeed, getFollowingFeed, getTrendingFeed } from "@/lib/ml-ranking-service"
import { getSmartFeed, isUserColdStart } from "@/lib/cold-start-service"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const feedType = searchParams.get("type") || "foryou"
  const limit = parseInt(searchParams.get("limit") || "20")
  const offset = parseInt(searchParams.get("offset") || "0")
  const gameId = searchParams.get("game") || undefined
  const contentType = searchParams.get("contentType") || undefined
  
  // Session parameters for real-time adaptation
  const boostGames = searchParams.get("boostGames")?.split(",").filter(Boolean) || []
  const avoidGames = searchParams.get("avoidGames")?.split(",").filter(Boolean) || []
  const explorationRate = parseFloat(searchParams.get("exploration") || "0.2")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  try {
    let feed: any[] = []
    let strategy = "ml_ranked"
    let isColdStart = false

    switch (feedType) {
      case "foryou":
        // Use smart feed which handles cold start vs ML automatically
        const smartResult = await getSmartFeed(user?.id || null, {
          limit,
          gameFilter: gameId,
          feedType: "foryou",
        })
        feed = smartResult.feed
        strategy = smartResult.strategy
        isColdStart = smartResult.isColdStart
        break

      case "following":
        if (!user) {
          return NextResponse.json(
            { error: "Must be logged in to view following feed" },
            { status: 401 }
          )
        }
        feed = await getFollowingFeed(user.id, limit)
        strategy = "following"
        break

      case "trending":
        feed = await getTrendingFeed({ gameId, limit })
        strategy = "trending"
        break

      default:
        return NextResponse.json(
          { error: "Invalid feed type" },
          { status: 400 }
        )
    }

    // Apply session-based filtering if parameters provided
    if (avoidGames.length > 0) {
      feed = feed.filter(item => !avoidGames.includes(item.game_id))
    }
    
    if (boostGames.length > 0) {
      // Move boosted game content to top positions
      const boosted = feed.filter(item => boostGames.includes(item.game_id))
      const rest = feed.filter(item => !boostGames.includes(item.game_id))
      feed = [...boosted.slice(0, Math.floor(limit * 0.4)), ...rest]
    }

    return NextResponse.json({
      feed: feed.slice(offset, offset + limit),
      pagination: {
        limit,
        offset,
        hasMore: feed.length > offset + limit,
      },
      meta: {
        strategy,
        isColdStart,
        explorationRate,
      },
    })
  } catch (error) {
    console.error("Feed API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch feed" },
      { status: 500 }
    )
  }
}
