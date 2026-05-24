import { getLiveMatchOverlayData } from "@/lib/studio-pro-actions"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params
  
  const data = await getLiveMatchOverlayData(matchId)
  
  if (!data) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 })
  }
  
  return NextResponse.json(data)
}
