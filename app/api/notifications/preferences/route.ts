import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Return defaults if no row exists yet
    const defaults = {
      user_id: user.id,
      email: false,
      email_frequency: "important",
      in_app: true,
      push: false,
      match_ready: true,
      match_starting: true,
      match_result: true,
      tournament_starting: true,
      round_starting: true,
      followed_player_live: true,
      followed_player_match: true,
      trending_match: false,
      achievement_earned: true,
      staff_alert: true,
      tournaments: true,
      purchases: true,
      announcements: true,
      quiet_hours_enabled: false,
      quiet_hours_start: null,
      quiet_hours_end: null,
    }

    return NextResponse.json(data ?? defaults)
  } catch (err) {
    console.error("[Notifications] Get preferences error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()

    // Strip user_id from body so caller can't spoof it
    const { user_id: _ignored, ...updates } = body

    const { error } = await supabase
      .from("notification_preferences")
      .upsert(
        { user_id: user.id, ...updates, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[Notifications] Save preferences error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
