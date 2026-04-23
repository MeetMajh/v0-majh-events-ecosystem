import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { headers } from "next/headers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface TrackEvent {
  event_type: string
  event_name: string
  target_type?: string
  target_id?: string
  properties?: Record<string, unknown>
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    const body = await request.json()
    const events: TrackEvent[] = Array.isArray(body) ? body : [body]
    
    if (events.length === 0) {
      return NextResponse.json({ error: "No events provided" }, { status: 400 })
    }

    // Get request metadata
    const headersList = await headers()
    const userAgent = headersList.get("user-agent") || ""
    const referer = headersList.get("referer") || ""
    
    // Determine device type from user agent
    const isMobile = /mobile|android|iphone|ipad/i.test(userAgent)
    const isTablet = /tablet|ipad/i.test(userAgent)
    const deviceType = isTablet ? "tablet" : isMobile ? "mobile" : "desktop"
    
    // Determine platform
    const platform = /windows/i.test(userAgent) ? "windows" 
      : /mac/i.test(userAgent) ? "mac"
      : /linux/i.test(userAgent) ? "linux"
      : /android/i.test(userAgent) ? "android"
      : /iphone|ipad/i.test(userAgent) ? "ios"
      : "other"

    // Format events for insertion
    const formattedEvents = events.map(event => ({
      event_type: event.event_type,
      event_name: event.event_name,
      user_id: user?.id || null,
      target_type: event.target_type,
      target_id: event.target_id,
      properties: event.properties || {},
      device_type: deviceType,
      platform,
      server_timestamp: new Date().toISOString(),
    }))

    // Insert events
    const { error } = await supabase
      .from("analytics_events")
      .insert(formattedEvents)

    if (error) {
      // Log error but don't fail - analytics should be non-blocking
      console.error("[v0] Analytics track error:", error.message)
      // Still return success to not block the client
      return NextResponse.json({ success: true, tracked: 0 })
    }

    // Update realtime metrics for view/engagement events
    for (const event of events) {
      if (event.target_id && event.target_type) {
        await updateMetrics(supabase, event)
      }
    }

    return NextResponse.json({ success: true, tracked: events.length })
  } catch (error) {
    console.error("[v0] Analytics API error:", error)
    // Return success anyway - don't block client
    return NextResponse.json({ success: true, tracked: 0 })
  }
}

async function updateMetrics(supabase: any, event: TrackEvent) {
  const updates: Record<string, number> = {}
  
  switch (event.event_name) {
    case "view":
    case "page_view":
    case "clip_view":
    case "media_view":
      updates.p_views = 1
      break
    case "like":
      updates.p_likes = 1
      break
    case "comment":
      updates.p_comments = 1
      break
    case "share":
      updates.p_shares = 1
      break
    case "watch_time":
      updates.p_watch_time = (event.properties?.seconds as number) || 0
      break
    case "ad_impression":
      updates.p_impressions = 1
      break
    case "ad_click":
      updates.p_clicks = 1
      break
    default:
      return // Not a trackable metric
  }

  try {
    await supabase.rpc("update_realtime_metric", {
      p_metric_type: event.target_type,
      p_entity_id: event.target_id,
      p_granularity: "hour",
      p_views: updates.p_views || 0,
      p_likes: updates.p_likes || 0,
      p_comments: updates.p_comments || 0,
      p_shares: updates.p_shares || 0,
      p_watch_time: updates.p_watch_time || 0,
      p_impressions: updates.p_impressions || 0,
      p_clicks: updates.p_clicks || 0,
      p_spend_cents: 0,
    })
  } catch (err) {
    // Non-critical - don't throw
    console.error("[v0] Metrics update failed:", err)
  }
}
