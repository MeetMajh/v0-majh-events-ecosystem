import { NextRequest, NextResponse } from "next/server"
import { createClip } from "@/lib/majh-studio-actions"

export async function POST(request: NextRequest) {
  const { streamId, title, durationSeconds } = await request.json()

  if (!streamId) {
    return NextResponse.json({ error: "Stream ID required" }, { status: 400 })
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: "Clip title required" }, { status: 400 })
  }

  const result = await createClip(streamId, title, durationSeconds || 30)
  return NextResponse.json(result)
}
