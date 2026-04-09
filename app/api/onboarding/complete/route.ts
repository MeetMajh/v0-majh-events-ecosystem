import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { games, intents, skill_level, followed_players } = body

    // Create or update user preferences
    const { error: prefsError } = await supabase
      .from("user_preferences")
      .upsert({
        user_id: user.id,
        games: games || [],
        intents: intents || [],
        skill_level: skill_level,
        favorite_creators: followed_players || [],
        onboarding_completed: true,
        game_affinities: games?.reduce((acc: Record<string, number>, game: string) => {
          acc[game] = 0.8 // High initial affinity for selected games
          return acc
        }, {}) || {},
        creator_affinities: {},
        tag_affinities: {},
        content_type_affinities: intents?.reduce((acc: Record<string, number>, intent: string) => {
          // Map intents to content types
          const mapping: Record<string, string[]> = {
            compete: ["tournament", "match"],
            watch: ["clip", "highlight", "stream"],
            learn: ["tutorial", "guide"],
            create: ["clip", "highlight"],
          }
          for (const contentType of mapping[intent] || []) {
            acc[contentType] = 0.7
          }
          return acc
        }, {}) || {},
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id",
      })

    if (prefsError) {
      console.error("Failed to save preferences:", prefsError)
      return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 })
    }

    // If they followed players, create follows
    if (followed_players && followed_players.length > 0) {
      const follows = followed_players.map((playerId: string) => ({
        follower_id: user.id,
        followed_id: playerId,
      }))

      await supabase
        .from("player_follows")
        .upsert(follows, { onConflict: "follower_id,followed_id" })
    }

    // Track onboarding completion event
    await supabase
      .from("analytics_events")
      .insert({
        event_type: "onboarding",
        event_name: "onboarding_completed",
        user_id: user.id,
        properties: {
          games_selected: games?.length || 0,
          intents_selected: intents?.length || 0,
          skill_level: skill_level,
          players_followed: followed_players?.length || 0,
        },
        server_timestamp: new Date().toISOString(),
      })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Onboarding error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
