import { switchScene } from "@/lib/studio-pro-actions"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { session_id, scene_id, transition, duration_ms } = body
  
  if (!session_id || !scene_id) {
    return NextResponse.json({ error: "Session ID and Scene ID required" }, { status: 400 })
  }
  
  const result = await switchScene({
    session_id,
    scene_id,
    transition: transition || "cut",
    duration_ms: duration_ms || 300,
  })
  
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  
  return NextResponse.json({ success: true })
}
