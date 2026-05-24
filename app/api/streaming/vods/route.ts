import { NextRequest, NextResponse } from "next/server"
import {
  getTournamentVODs,
  getAllVODs,
  addVODChapter,
} from "@/lib/streaming-actions"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tournamentId = searchParams.get("tournamentId")
  const featured = searchParams.get("featured") === "true"
  const limit = parseInt(searchParams.get("limit") || "50")

  try {
    if (tournamentId) {
      const result = await getTournamentVODs(tournamentId, limit)
      return NextResponse.json(result)
    }

    const result = await getAllVODs({
      featured: featured || undefined,
      limit,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error("Get VODs error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    if (action === "addChapter") {
      const { vodId, title, timestampSeconds, chapterType, description } = data

      if (!vodId || !title || timestampSeconds === undefined) {
        return NextResponse.json(
          { error: "VOD ID, title, and timestamp required" },
          { status: 400 }
        )
      }

      const result = await addVODChapter({
        vodId,
        title,
        timestampSeconds,
        chapterType,
        description,
      })
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("VOD API error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
