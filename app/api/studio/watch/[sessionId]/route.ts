import { NextRequest, NextResponse } from "next/server"
import { getStreamSession } from "@/lib/majh-studio-actions"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const result = await getStreamSession(sessionId)
  return NextResponse.json(result)
}
