import { NextRequest, NextResponse } from "next/server"
import { joinStream, leaveStream } from "@/lib/majh-studio-actions"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const { action, viewerSessionId } = await request.json()

  if (!viewerSessionId) {
    return NextResponse.json({ error: "Viewer session ID required" }, { status: 400 })
  }

  switch (action) {
    case "join":
      const joinResult = await joinStream(sessionId, viewerSessionId)
      return NextResponse.json(joinResult)

    case "leave":
      const leaveResult = await leaveStream(sessionId, viewerSessionId)
      return NextResponse.json(leaveResult)

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }
}
