import { createAdminClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tournamentId = searchParams.get("tournamentId")
  
  if (!tournamentId) {
    return NextResponse.json({ error: "tournamentId required" }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    // Step 1: Get raw registrations
    const { data: rawRegistrations, error: regError } = await supabase
      .from("tournament_registrations")
      .select("*")
      .eq("tournament_id", tournamentId)

    if (regError) {
      return NextResponse.json({ 
        step: "raw_registrations",
        error: regError.message,
        code: regError.code
      }, { status: 500 })
    }

    // Step 2: Get registrations with profiles join
    const { data: withProfiles, error: joinError } = await supabase
      .from("tournament_registrations")
      .select("*, profiles(id, first_name, last_name)")
      .eq("tournament_id", tournamentId)

    if (joinError) {
      return NextResponse.json({ 
        step: "with_profiles_join",
        error: joinError.message,
        code: joinError.code,
        rawCount: rawRegistrations?.length ?? 0
      }, { status: 500 })
    }

    // Step 3: Get profile IDs from registrations and check if they exist
    const playerIds = rawRegistrations?.map(r => r.player_id) ?? []
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", playerIds)

    return NextResponse.json({
      success: true,
      tournamentId,
      rawRegistrations: {
        count: rawRegistrations?.length ?? 0,
        data: rawRegistrations
      },
      withProfilesJoin: {
        count: withProfiles?.length ?? 0,
        data: withProfiles
      },
      profilesLookup: {
        requestedIds: playerIds,
        foundCount: profiles?.length ?? 0,
        error: profilesError?.message ?? null,
        data: profiles
      }
    })
  } catch (err: any) {
    return NextResponse.json({ 
      error: err.message,
      stack: err.stack
    }, { status: 500 })
  }
}
