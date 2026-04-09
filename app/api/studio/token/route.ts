import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateLiveKitToken } from "@/lib/majh-studio-actions"

export async function POST(request: NextRequest) {
  try {
    const { roomName, canPublish } = await request.json()

    if (!roomName) {
      return NextResponse.json({ error: "Room name required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user profile for display name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single()

    const displayName = profile?.display_name || user.email?.split("@")[0] || "Anonymous"

    // If requesting publish permissions, verify they own the stream
    if (canPublish) {
      const { data: session } = await supabase
        .from("stream_sessions")
        .select("host_id")
        .eq("room_name", roomName)
        .single()

      if (session?.host_id !== user.id) {
        return NextResponse.json({ error: "Not authorized to publish" }, { status: 403 })
      }
    }

    const { token, wsUrl } = await generateLiveKitToken({
      roomName,
      participantName: displayName,
      participantIdentity: user.id,
      canPublish: canPublish || false,
      canSubscribe: true,
    })

    return NextResponse.json({ token, wsUrl })
  } catch (error) {
    console.error("Token generation error:", error)
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 })
  }
}
