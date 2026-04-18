import { NextRequest, NextResponse } from "next/server"
import {
  createBroadcastSession,
  getBroadcastSession,
  startBroadcast,
  endBroadcast,
  addBroadcastSource,
  addSourceToScene,
  switchBroadcastScene,
} from "@/lib/streaming-actions"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get("sessionId")

  if (!sessionId) {
    return NextResponse.json({ error: "Session ID required" }, { status: 400 })
  }

  try {
    const result = await getBroadcastSession(sessionId)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Get broadcast session error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, sessionId, ...data } = body

    switch (action) {
      case "create": {
        const { title, description, tenantId, tournamentId } = data
        if (!title) {
          return NextResponse.json({ error: "Title required" }, { status: 400 })
        }
        const result = await createBroadcastSession({
          title,
          description,
          tenantId,
          tournamentId,
        })
        return NextResponse.json(result)
      }

      case "start": {
        if (!sessionId) {
          return NextResponse.json({ error: "Session ID required" }, { status: 400 })
        }
        const result = await startBroadcast(sessionId)
        return NextResponse.json(result)
      }

      case "end": {
        if (!sessionId) {
          return NextResponse.json({ error: "Session ID required" }, { status: 400 })
        }
        const { recordingUrl } = data
        const result = await endBroadcast(sessionId, recordingUrl)
        return NextResponse.json(result)
      }

      case "addSource": {
        if (!sessionId) {
          return NextResponse.json({ error: "Session ID required" }, { status: 400 })
        }
        const { sourceType, name, playerStreamId, roomId, mediaUrl, metadata } = data
        if (!sourceType || !name) {
          return NextResponse.json({ error: "Source type and name required" }, { status: 400 })
        }
        const result = await addBroadcastSource({
          sessionId,
          sourceType,
          name,
          playerStreamId,
          roomId,
          mediaUrl,
          metadata,
        })
        return NextResponse.json(result)
      }

      case "addToScene": {
        const { sceneId, sourceId, x, y, width, height, zIndex } = data
        if (!sceneId || !sourceId) {
          return NextResponse.json({ error: "Scene ID and Source ID required" }, { status: 400 })
        }
        const result = await addSourceToScene({
          sceneId,
          sourceId,
          x,
          y,
          width,
          height,
          zIndex,
        })
        return NextResponse.json(result)
      }

      case "switchScene": {
        if (!sessionId) {
          return NextResponse.json({ error: "Session ID required" }, { status: 400 })
        }
        const { sceneId } = data
        if (!sceneId) {
          return NextResponse.json({ error: "Scene ID required" }, { status: 400 })
        }
        const result = await switchBroadcastScene(sessionId, sceneId)
        return NextResponse.json(result)
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Broadcast API error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
