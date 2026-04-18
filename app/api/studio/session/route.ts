import { NextRequest, NextResponse } from "next/server"
import {
  getMyStreamSession,
  createStreamSession,
  startStreamSession,
  endStreamSession,
} from "@/lib/majh-studio-actions"

export async function GET() {
  const result = await getMyStreamSession()
  return NextResponse.json(result)
}

// PUT - Create a new stream session
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    console.log("[v0] Creating stream session:", body)
    const result = await createStreamSession(body)
    console.log("[v0] Create session result:", result)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[v0] PUT Session API error:", error)
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, sessionId, ...data } = body
    console.log("[v0] POST /api/studio/session - action:", action, "sessionId:", sessionId)

    switch (action) {
      case "create":
        const createResult = await createStreamSession(data)
        return NextResponse.json(createResult)

      case "start":
        if (!sessionId) {
          return NextResponse.json({ error: "Session ID required" }, { status: 400 })
        }
        console.log("[v0] Starting stream session:", sessionId)
        const startResult = await startStreamSession(sessionId)
        console.log("[v0] Start result:", startResult)
        return NextResponse.json(startResult)

      case "end":
        if (!sessionId) {
          return NextResponse.json({ error: "Session ID required" }, { status: 400 })
        }
        const endResult = await endStreamSession(sessionId)
        return NextResponse.json(endResult)

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Session API error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
