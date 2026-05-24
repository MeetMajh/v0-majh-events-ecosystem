import { NextRequest, NextResponse } from "next/server"
import { AccessToken } from "livekit-server-sdk"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { roomName, isHost = false } = await request.json()

    if (!roomName) {
      return NextResponse.json({ error: "Room name required" }, { status: 400 })
    }

    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET

    if (!apiKey || !apiSecret) {
      console.error("[v0] LiveKit credentials not configured")
      return NextResponse.json({ error: "LiveKit not configured" }, { status: 500 })
    }

    // Get user profile for display name
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single()

    const displayName = profile 
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || "Anonymous"
      : "Anonymous"

    // Create access token
    const token = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: displayName,
    })

    // Grant permissions based on role
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: isHost,
      canPublishData: true,
      canSubscribe: true,
    })

    const jwt = await token.toJwt()

    return NextResponse.json({ token: jwt })
  } catch (error) {
    console.error("[v0] LiveKit token error:", error)
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 })
  }
}
