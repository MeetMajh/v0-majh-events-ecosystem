import { createClient } from "@/lib/supabase/server"
import { mux } from "@/lib/mux"
import { NextResponse } from "next/server"

/**
 * Fetch all Mux assets (VODs) and import them to user_streams
 * This allows recovery of previously recorded streams
 */
export async function GET(req: Request) {
  const supabase = await createClient()

  // Verify user is authenticated and is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin" && profile?.role !== "staff") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  try {
    // Fetch all assets from Mux
    console.log("[v0] Fetching all Mux assets...")
    const response = await mux.video.assets.list({
      limit: 100,
    })

    const assets = response.data || []
    console.log(`[v0] Found ${assets.length} Mux assets`)

    const imported = []

    for (const asset of assets) {
      // Skip if asset has no playback IDs (not ready)
      if (!asset.playback_ids || asset.playback_ids.length === 0) {
        console.log(`[v0] Skipping asset ${asset.id} - no playback IDs`)
        continue
      }

      // Check if this asset is already in user_streams
      const { data: existing } = await supabase
        .from("user_streams")
        .select("id")
        .eq("mux_asset_id", asset.id)
        .single()

      if (existing) {
        console.log(`[v0] Asset ${asset.id} already imported`)
        continue
      }

      // Create entry in user_streams for this VOD
      const playbackId = asset.playback_ids[0].id
      const playbackUrl = `https://stream.mux.com/${playbackId}.m3u8`

      const { error: insertError } = await supabase
        .from("user_streams")
        .insert({
          user_id: user.id,
          title: asset.mp4_support === "standard" ? `Recording - ${asset.id}` : `Stream VOD - ${new Date(asset.created_at).toLocaleDateString()}`,
          description: `Imported from Mux - ${asset.id}`,
          status: "ended",
          is_public: true,
          mux_asset_id: asset.id,
          mux_playback_id: playbackId,
          playback_url: playbackUrl,
          duration_seconds: asset.duration ? Math.round(asset.duration) : null,
          created_at: asset.created_at,
          ended_at: asset.created_at,
          updated_at: new Date().toISOString(),
        })

      if (insertError) {
        console.error(`[v0] Failed to import asset ${asset.id}:`, insertError)
        continue
      }

      imported.push({
        id: asset.id,
        title: `Stream VOD - ${new Date(asset.created_at).toLocaleDateString()}`,
        duration: Math.round(asset.duration || 0),
        playback_url: playbackUrl,
      })

      console.log(`[v0] Imported Mux asset ${asset.id}`)
    }

    return NextResponse.json({
      success: true,
      imported_count: imported.length,
      assets: imported,
    })
  } catch (error) {
    console.error("[v0] Error importing Mux assets:", error)
    return NextResponse.json(
      { error: "Failed to import Mux assets" },
      { status: 500 }
    )
  }
}
