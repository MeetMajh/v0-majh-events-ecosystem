import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const streamId = searchParams.get("id")

    if (!streamId) {
      return NextResponse.json(
        { error: "Stream ID is required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check if it's a stream source
    const { data: streamSource } = await supabase
      .from("stream_sources")
      .select("*")
      .eq("id", streamId)
      .single()

    if (streamSource) {
      const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://majhevents.com"}/watch/stream/${streamId}`
      return NextResponse.json({
        url: shareUrl,
        title: streamSource.title,
        type: "stream",
      })
    }

    // Check if it's a VOD
    const { data: vod } = await supabase
      .from("user_streams")
      .select("*")
      .eq("id", streamId)
      .single()

    if (vod) {
      const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://majhevents.com"}/watch/vod/${streamId}`
      return NextResponse.json({
        url: shareUrl,
        title: vod.title,
        type: "vod",
      })
    }

    return NextResponse.json(
      { error: "Stream or VOD not found" },
      { status: 404 }
    )
  } catch (error) {
    console.error("Error sharing stream:", error)
    return NextResponse.json(
      { error: "Failed to share stream" },
      { status: 500 }
    )
  }
}
