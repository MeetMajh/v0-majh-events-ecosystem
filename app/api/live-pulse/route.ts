import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/live-pulse
 * Returns REAL data only - live matches, upcoming tournaments, and recent activity
 * No fake/simulated data allowed
 */
export async function GET() {
  const supabase = await createClient()

  try {
    // Fetch live feature matches (actually streaming now)
    const { data: liveMatches } = await supabase
      .from("feature_matches")
      .select(`
        id,
        stream_url,
        viewer_count,
        started_at,
        match:matches(
          id,
          round,
          status,
          tournament:tournaments(id, name, game_id),
          player1:profiles!matches_player1_id_fkey(id, display_name, avatar_url),
          player2:profiles!matches_player2_id_fkey(id, display_name, avatar_url)
        ),
        game:games(id, name, logo_url)
      `)
      .eq("status", "live")
      .order("viewer_count", { ascending: false })
      .limit(5)

    // Fetch upcoming tournaments (starting within 24 hours)
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    
    const { data: upcomingTournaments } = await supabase
      .from("tournaments")
      .select(`
        id,
        name,
        start_date,
        status,
        game:games(id, name, logo_url)
      `)
      .gte("start_date", now.toISOString())
      .lte("start_date", tomorrow.toISOString())
      .in("status", ["upcoming", "open", "registration_open"])
      .order("start_date", { ascending: true })
      .limit(3)

    // Fetch external stream sources (if any are currently active)
    const { data: externalStreams } = await supabase
      .from("stream_sources")
      .select(`
        id,
        title,
        platform,
        channel_url,
        is_live,
        viewer_count,
        thumbnail_url,
        game:games(id, name, logo_url)
      `)
      .eq("is_live", true)
      .eq("is_active", true)
      .order("viewer_count", { ascending: false })
      .limit(3)

    // Fetch recent real activity (last hour)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    
    const { data: recentActivity } = await supabase
      .from("analytics_events")
      .select("id, event_type, event_name, properties, server_timestamp")
      .in("event_type", ["tournament_registration", "match_started", "clip_created"])
      .gte("server_timestamp", oneHourAgo.toISOString())
      .order("server_timestamp", { ascending: false })
      .limit(10)

    // Transform live matches into events
    const liveEvents = (liveMatches || []).map((fm: any) => ({
      id: fm.id,
      type: "match" as const,
      title: fm.match?.tournament?.name 
        ? `${fm.match.round || "Match"} - ${fm.match.tournament.name}`
        : fm.match?.round || "Live Match",
      game: fm.game?.name || fm.match?.tournament?.game_id || "Unknown Game",
      game_id: fm.game?.id,
      viewers: fm.viewer_count || 0,
      isLive: true,
      stream_url: fm.stream_url,
      players: [
        fm.match?.player1 && { 
          name: fm.match.player1.display_name, 
          avatar: fm.match.player1.avatar_url 
        },
        fm.match?.player2 && { 
          name: fm.match.player2.display_name, 
          avatar: fm.match.player2.avatar_url 
        },
      ].filter(Boolean),
    }))

    // Add external streams to live events
    const externalLiveEvents = (externalStreams || []).map((stream: any) => ({
      id: stream.id,
      type: "stream" as const,
      title: stream.title,
      game: stream.game?.name || "Gaming",
      game_id: stream.game?.id,
      viewers: stream.viewer_count || 0,
      isLive: true,
      stream_url: stream.channel_url,
      thumbnail: stream.thumbnail_url,
    }))

    // Transform upcoming tournaments
    const upcomingEvents = (upcomingTournaments || []).map((t: any) => {
      const startDate = new Date(t.start_date)
      const diffMs = startDate.getTime() - now.getTime()
      const diffMins = Math.floor(diffMs / (1000 * 60))
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      
      let startsIn = ""
      if (diffMins < 60) {
        startsIn = `${diffMins} min`
      } else if (diffHours < 24) {
        startsIn = `${diffHours} hr`
      }

      return {
        id: t.id,
        type: "tournament" as const,
        title: t.name,
        game: t.game?.name || "Unknown Game",
        game_id: t.game?.id,
        viewers: 0,
        isLive: false,
        startsIn,
      }
    })

    // Transform activity into feed items
    const activityFeed = (recentActivity || []).map((event: any) => {
      let message = ""
      let type: "clip_trending" | "match_started" | "player_joined" | "tournament_starting" = "player_joined"
      let link = "/"

      switch (event.event_type) {
        case "tournament_registration":
          type = "player_joined"
          message = `New player registered for ${event.properties?.tournament_name || "a tournament"}`
          link = `/esports/tournaments/${event.properties?.tournament_id || ""}`
          break
        case "match_started":
          type = "match_started"
          message = `Match started: ${event.properties?.match_name || "New match"}`
          link = `/live?match=${event.properties?.match_id || ""}`
          break
        case "clip_created":
          type = "clip_trending"
          message = `New clip: "${event.properties?.title || "Untitled"}"`
          link = `/clips/${event.properties?.clip_id || ""}`
          break
      }

      return {
        id: event.id,
        type,
        message,
        timestamp: event.server_timestamp,
        link,
      }
    }).filter((a: any) => a.message) // Only include items with valid messages

    // Calculate totals from REAL data only
    const allLiveEvents = [...liveEvents, ...externalLiveEvents]
    const totalViewers = allLiveEvents.reduce((sum, e) => sum + (e.viewers || 0), 0)
    const liveCount = allLiveEvents.length

    return NextResponse.json({
      liveEvents: allLiveEvents,
      upcomingEvents,
      activityFeed,
      totalViewers,
      liveCount,
    })
  } catch (error) {
    console.error("Live pulse API error:", error)
    // Return empty data on error - don't fake it
    return NextResponse.json({
      liveEvents: [],
      upcomingEvents: [],
      activityFeed: [],
      totalViewers: 0,
      liveCount: 0,
    })
  }
}
