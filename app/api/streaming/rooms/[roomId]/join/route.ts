import { NextRequest, NextResponse } from "next/server"
import { joinStreamRoom, updateStreamStatus } from "@/lib/streaming-actions"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const body = await request.json()
    const { slotNumber, role } = body

    const result = await joinStreamRoom(roomId, slotNumber, role)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Join stream room error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// Update stream status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const body = await request.json()
    const { streamKey, status, playbackUrl, latencyMs } = body

    if (!streamKey || !status) {
      return NextResponse.json(
        { error: "Stream key and status required" },
        { status: 400 }
      )
    }

    const result = await updateStreamStatus(streamKey, status, playbackUrl, latencyMs)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Update stream status error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
