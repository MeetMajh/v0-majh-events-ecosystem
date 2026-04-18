import { NextRequest, NextResponse } from "next/server"
import {
  createClip,
  generateHighlightClip,
  getTrendingClips,
  getAllClips,
} from "@/lib/streaming-actions"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tournamentId = searchParams.get("tournamentId")
  const matchId = searchParams.get("matchId")
  const featured = searchParams.get("featured") === "true"
  const trending = searchParams.get("trending") === "true"
  const limit = parseInt(searchParams.get("limit") || "20")

  try {
    if (trending) {
      const result = await getTrendingClips(limit, tournamentId || undefined)
      return NextResponse.json(result)
    }

    const result = await getAllClips({
      tournamentId: tournamentId || undefined,
      matchId: matchId || undefined,
      featured: featured || undefined,
      limit,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error("Get clips error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    if (action === "autoHighlight") {
      const {
        broadcastSessionId,
        highlightType,
        startTimeSeconds,
        durationSeconds,
        highlightScore,
        title,
      } = data

      if (!broadcastSessionId || !highlightType || startTimeSeconds === undefined) {
        return NextResponse.json(
          { error: "Broadcast session ID, highlight type, and start time required" },
          { status: 400 }
        )
      }

      const result = await generateHighlightClip({
        broadcastSessionId,
        highlightType,
        startTimeSeconds,
        durationSeconds,
        highlightScore,
        title,
      })
      return NextResponse.json(result)
    }

    // Manual clip creation
    const {
      tenantId,
      title,
      videoUrl,
      durationSeconds,
      broadcastSessionId,
      roomId,
      matchId,
      tournamentId,
      clipType,
      startTimeSeconds,
      endTimeSeconds,
    } = data

    if (!title || !videoUrl || !durationSeconds) {
      return NextResponse.json(
        { error: "Title, video URL, and duration required" },
        { status: 400 }
      )
    }

    const result = await createClip({
      tenantId,
      title,
      videoUrl,
      durationSeconds,
      broadcastSessionId,
      roomId,
      matchId,
      tournamentId,
      clipType,
      startTimeSeconds,
      endTimeSeconds,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error("Create clip error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
