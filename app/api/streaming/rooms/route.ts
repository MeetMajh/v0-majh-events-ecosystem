import { NextRequest, NextResponse } from "next/server"
import {
  createStreamRoom,
  getStreamRoom,
  getTournamentStreamRooms,
  getLiveStreamRooms,
} from "@/lib/streaming-actions"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const roomCode = searchParams.get("code")
  const tournamentId = searchParams.get("tournamentId")
  const live = searchParams.get("live")
  const tenantId = searchParams.get("tenantId")

  try {
    if (roomCode) {
      const result = await getStreamRoom(roomCode)
      return NextResponse.json(result)
    }

    if (tournamentId) {
      const result = await getTournamentStreamRooms(tournamentId)
      return NextResponse.json(result)
    }

    if (live === "true") {
      const result = await getLiveStreamRooms(tenantId || undefined)
      return NextResponse.json(result)
    }

    // Default: get all live rooms
    const result = await getLiveStreamRooms()
    return NextResponse.json(result)
  } catch (error) {
    console.error("Stream rooms API error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, tenantId, tournamentId, matchId, tableNumber, roomType } = body

    if (!name) {
      return NextResponse.json({ error: "Room name required" }, { status: 400 })
    }

    const result = await createStreamRoom({
      name,
      tenantId,
      tournamentId,
      matchId,
      tableNumber,
      roomType,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Create stream room error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
