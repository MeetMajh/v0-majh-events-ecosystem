import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getPersonalizedFeed, getFollowingFeed, getTrendingFeed } from "@/lib/ml-ranking-service"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const feedType = searchParams.get("type") || "foryou"
  const limit = parseInt(searchParams.get("limit") || "20")
  const offset = parseInt(searchParams.get("offset") || "0")
  const gameId = searchParams.get("game") || undefined
  const contentType = searchParams.get("contentType") || undefined

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  try {
    let feed: any[] = []

    switch (feedType) {
      case "foryou":
        feed = await getPersonalizedFeed(user?.id || null, {
          limit,
          offset,
          gameFilter: gameId,
          contentType,
          explorationRate: 0.2,
        })
        break

      case "following":
        if (!user) {
          return NextResponse.json(
            { error: "Must be logged in to view following feed" },
            { status: 401 }
          )
        }
        feed = await getFollowingFeed(user.id, limit)
        break

      case "trending":
        feed = await getTrendingFeed({ gameId, limit })
        break

      default:
        return NextResponse.json(
          { error: "Invalid feed type" },
          { status: 400 }
        )
    }

    return NextResponse.json({
      feed,
      pagination: {
        limit,
        offset,
        hasMore: feed.length === limit,
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
