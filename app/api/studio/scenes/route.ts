import { getScenes } from "@/lib/studio-pro-actions"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId")
  
  if (!sessionId) {
    return NextResponse.json({ error: "Session ID required" }, { status: 400 })
  }
  
  const scenes = await getScenes(sessionId)
  return NextResponse.json({ scenes })
}
