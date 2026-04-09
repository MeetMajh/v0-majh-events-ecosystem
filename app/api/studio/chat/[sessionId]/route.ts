import { NextRequest, NextResponse } from "next/server"
import { getChatMessages, sendChatMessage } from "@/lib/majh-studio-actions"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const result = await getChatMessages(sessionId)
  return NextResponse.json(result)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const { message } = await request.json()

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 })
  }

  const result = await sendChatMessage(sessionId, message)
  return NextResponse.json(result)
}
