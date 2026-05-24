import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = params

    // Fetch the stream
    const { data: stream } = await supabase
      .from("user_streams")
      .select(`
        id,
        title,
        description,
        mux_playback_id,
        playback_url,
        status,
        is_public,
        user_id,
        profiles(display_name, avatar_url)
      `)
      .eq("id", id)
      .eq("status", "ended")
      .single()

    if (!stream) {
      return NextResponse.json(
        { error: "Stream not found" },
        { status: 404 }
      )
    }

    // Generate share metadata
    const baseUrl = request.nextUrl.origin
    const shareUrl = `${baseUrl}/watch/${id}`
    const title = `${stream.title} - Watch on MAJH Events`
    const description = stream.description || `Check out this stream on MAJH Events!`
    const image = `https://image.mux.com/${stream.mux_playback_id}/thumbnail.jpg`

    return NextResponse.json({
      url: shareUrl,
      title,
      description,
      image,
      stream: {
        id: stream.id,
        title: stream.title,
        playbackUrl: stream.playback_url,
        creatorName: (stream.profiles as any)?.display_name,
        creatorImage: (stream.profiles as any)?.avatar_url,
      }
    })
  } catch (error) {
    console.error("[v0] Error generating share link:", error)
    return NextResponse.json(
      { error: "Failed to generate share link" },
      { status: 500 }
    )
  }
}
