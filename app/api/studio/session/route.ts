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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, sessionId, ...data } = body

    switch (action) {
      case "create":
        const createResult = await createStreamSession(data)
        return NextResponse.json(createResult)

      case "start":
        if (!sessionId) {
          return NextResponse.json({ error: "Session ID required" }, { status: 400 })
        }
        const startResult = await startStreamSession(sessionId)
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
