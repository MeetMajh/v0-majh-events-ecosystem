import { NextRequest, NextResponse } from "next/server"
import { getLeaderboard } from "@/lib/esports-actions"

export async function GET(request: NextRequest) {
  const game = request.nextUrl.searchParams.get("game")
  const entries = await getLeaderboard(game ?? undefined)
  return NextResponse.json(entries)
}
