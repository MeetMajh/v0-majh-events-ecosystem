import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // bypass RLS
  )

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("*")

  const { data: participants, error: participantsError } = await supabase
    .from("tournament_participants")
    .select("*")

  return NextResponse.json({
    players,
    playersError,
    participants,
    participantsError,
    summary: {
      playersCount: players?.length,
      participantsCount: participants?.length,
    },
  })
}
