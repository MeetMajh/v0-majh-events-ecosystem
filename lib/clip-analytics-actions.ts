"use server"

import { createClient } from "@/lib/supabase/server"

// ═══════════════════════════════════════════════════════════════════════════════
// CLIP ANALYTICS ACTIONS
// Retention curves, drop-off heatmaps, creator insights
// ═══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════

export interface RetentionDataPoint {
  second: number
  viewers: number
  percentage: number
}

export interface HeatmapSegment {
  startSecond: number
  endSecond: number
  dropoffRate: number
  intensity: number // 0-1
}

export interface ClipInsight {
  type: "success" | "warning" | "info"
  title: string
  description: string
  action?: string
}

export interface ClipAnalytics {
  clipId: string
  title: string
  thumbnail_url?: string
  duration_seconds: number
  
  // Overview metrics
  totalViews: number
  uniqueViewers: number
  avgWatchTime: number
  avgWatchPercentage: number
  completionRate: number
  replayRate: number
  
  // Engagement
  likes: number
  comments: number
  shares: number
  saves: number
  engagementRate: number
  
  // Retention data
  retentionCurve: RetentionDataPoint[]
  dropoffHeatmap: HeatmapSegment[]
  
  // AI Insights
  insights: ClipInsight[]
  
  // Time series
  viewsOverTime: Array<{ date: string; views: number }>
}

export interface CreatorOverview {
  totalClips: number
  totalViews: number
  totalWatchTime: number
  avgViewsPerClip: number
  avgEngagementRate: number
  totalFollowers: number
  followersGained7d: number
  estimatedEarnings: number
  topPerformingClips: Array<{
    id: string
    title: string
    thumbnail_url?: string
    views: number
    engagementRate: number
  }>
  recentActivity: Array<{
    type: string
    message: string
    timestamp: string
  }>
}

// ══════════════════════════════════════════
// RETENTION ANALYSIS
// ══════════════════════════════════════════

/**
 * Get retention curve for a clip
 */
export async function getClipRetention(clipId: string): Promise<RetentionDataPoint[]> {
  const supabase = await createClient()
  
  // Get clip duration
  const { data: clip } = await supabase
    .from("player_media")
    .select("duration_seconds")
    .eq("id", clipId)
    .single()
  
  if (!clip?.duration_seconds) {
    return []
  }
  
  // Get view events with watch time data
  const { data: viewEvents } = await supabase
    .from("media_view_events")
    .select("watch_time_seconds, total_duration")
    .eq("media_id", clipId)
    .limit(1000)
  
  if (!viewEvents || viewEvents.length === 0) {
    // Return synthetic data for new clips
    return generateSyntheticRetention(clip.duration_seconds)
  }
  
  // Build retention curve
  const duration = clip.duration_seconds
  const buckets: number[] = new Array(Math.ceil(duration)).fill(0)
  const totalViews = viewEvents.length
  
  for (const event of viewEvents) {
    const watchedSeconds = Math.min(event.watch_time_seconds || 0, duration)
    // Increment all buckets up to watched time
    for (let i = 0; i <= watchedSeconds; i++) {
      if (buckets[i] !== undefined) {
        buckets[i]++
      }
    }
  }
  
  // Convert to retention percentage
  const retention: RetentionDataPoint[] = buckets.map((count, second) => ({
    second,
    viewers: count,
    percentage: totalViews > 0 ? (count / totalViews) * 100 : 0
  }))
  
  return retention
}

/**
 * Generate synthetic retention for new clips (typical pattern)
 */
function generateSyntheticRetention(duration: number): RetentionDataPoint[] {
  const points: RetentionDataPoint[] = []
  
  for (let i = 0; i <= duration; i++) {
    // Typical retention decay: steep initial drop, then gradual
    const percentage = 100 * Math.exp(-0.03 * i) * (0.9 + 0.1 * Math.random())
    points.push({
      second: i,
      viewers: Math.round(percentage),
      percentage: Math.max(0, percentage)
    })
  }
  
  return points
}

/**
 * Get drop-off heatmap segments
 */
export async function getDropoffHeatmap(clipId: string): Promise<HeatmapSegment[]> {
  const retention = await getClipRetention(clipId)
  
  if (retention.length < 2) return []
  
  const segments: HeatmapSegment[] = []
  const segmentSize = Math.max(1, Math.floor(retention.length / 10)) // 10 segments
  
  for (let i = 0; i < retention.length - segmentSize; i += segmentSize) {
    const startRetention = retention[i]?.percentage || 0
    const endRetention = retention[Math.min(i + segmentSize, retention.length - 1)]?.percentage || 0
    const dropoffRate = startRetention - endRetention
    
    segments.push({
      startSecond: i,
      endSecond: Math.min(i + segmentSize, retention.length - 1),
      dropoffRate,
      intensity: Math.min(dropoffRate / 20, 1) // Normalize to 0-1
    })
  }
  
  return segments
}

// ══════════════════════════════════════════
// AI INSIGHTS
// ══════════════════════════════════════════

/**
 * Generate AI insights based on clip analytics
 */
export async function generateClipInsights(clipId: string): Promise<ClipInsight[]> {
  const supabase = await createClient()
  const insights: ClipInsight[] = []
  
  // Get clip data
  const { data: clip } = await supabase
    .from("player_media")
    .select("*, view_count, like_count, comment_count, share_count, duration_seconds")
    .eq("id", clipId)
    .single()
  
  if (!clip) return []
  
  // Get retention
  const retention = await getClipRetention(clipId)
  
  // Analyze early drop-off (first 3 seconds)
  if (retention.length >= 3) {
    const earlyDropoff = 100 - (retention[3]?.percentage || 0)
    if (earlyDropoff > 40) {
      insights.push({
        type: "warning",
        title: "Slow hook",
        description: `${Math.round(earlyDropoff)}% of viewers leave in the first 3 seconds. Start with your most exciting moment.`,
        action: "Consider trimming the intro or adding a preview of the best moment"
      })
    } else if (earlyDropoff < 15) {
      insights.push({
        type: "success",
        title: "Strong hook",
        description: `Great opening! ${100 - Math.round(earlyDropoff)}% of viewers stay past 3 seconds.`
      })
    }
  }
  
  // Analyze completion rate
  const completionRate = retention.length > 0 
    ? (retention[retention.length - 1]?.percentage || 0) 
    : 0
    
  if (completionRate > 60) {
    insights.push({
      type: "success",
      title: "High completion rate",
      description: `${Math.round(completionRate)}% of viewers watch to the end. This clip is highly engaging!`,
      action: "This clip is a good candidate for promotion"
    })
  } else if (completionRate < 30) {
    insights.push({
      type: "warning",
      title: "Low completion rate",
      description: `Only ${Math.round(completionRate)}% watch to the end. Consider shortening the clip.`,
      action: "Trim content that causes viewers to leave"
    })
  }
  
  // Analyze engagement
  const views = clip.view_count || 1
  const engagementRate = ((clip.like_count + clip.comment_count + clip.share_count) / views) * 100
  
  if (engagementRate > 10) {
    insights.push({
      type: "success",
      title: "High engagement",
      description: `${engagementRate.toFixed(1)}% engagement rate is excellent. Keep creating similar content!`
    })
  } else if (engagementRate < 2 && views > 100) {
    insights.push({
      type: "info",
      title: "Engagement opportunity",
      description: "Try adding a call-to-action asking viewers to like or comment.",
      action: "Ask a question or prompt discussion in your title/description"
    })
  }
  
  // Analyze optimal length
  if (clip.duration_seconds > 60 && completionRate < 40) {
    insights.push({
      type: "info",
      title: "Consider shorter clips",
      description: "Clips under 30 seconds typically perform better. Try trimming to the highlight moment."
    })
  }
  
  // Find drop-off points
  const heatmap = await getDropoffHeatmap(clipId)
  const biggestDropoff = heatmap.reduce((max, seg) => 
    seg.dropoffRate > max.dropoffRate ? seg : max, 
    heatmap[0] || { dropoffRate: 0, startSecond: 0 }
  )
  
  if (biggestDropoff && biggestDropoff.dropoffRate > 15) {
    insights.push({
      type: "warning",
      title: `Drop-off at ${biggestDropoff.startSecond}s`,
      description: `${Math.round(biggestDropoff.dropoffRate)}% of viewers leave around the ${biggestDropoff.startSecond} second mark.`,
      action: "Review what happens at this point and consider editing"
    })
  }
  
  return insights
}

// ══════════════════════════════════════════
// FULL CLIP ANALYTICS
// ══════════════════════════════════════════

/**
 * Get comprehensive analytics for a clip
 */
export async function getClipAnalytics(clipId: string): Promise<ClipAnalytics | null> {
  const supabase = await createClient()
  
  // Get clip data
  const { data: clip } = await supabase
    .from("player_media")
    .select("*")
    .eq("id", clipId)
    .single()
  
  if (!clip) return null
  
  // Get view events
  const { data: viewEvents } = await supabase
    .from("media_view_events")
    .select("*")
    .eq("media_id", clipId)
  
  const events = viewEvents || []
  const totalViews = clip.view_count || events.length
  const uniqueViewers = new Set(events.map(e => e.user_id).filter(Boolean)).size
  
  // Calculate watch metrics
  const totalWatchTime = events.reduce((sum, e) => sum + (e.watch_time_seconds || 0), 0)
  const avgWatchTime = events.length > 0 ? totalWatchTime / events.length : 0
  const duration = clip.duration_seconds || 1
  const avgWatchPercentage = (avgWatchTime / duration) * 100
  
  // Completion rate
  const completions = events.filter(e => 
    (e.watch_time_seconds || 0) >= duration * 0.9
  ).length
  const completionRate = events.length > 0 ? (completions / events.length) * 100 : 0
  
  // Replay rate
  const replays = events.filter(e => e.is_replay).length
  const replayRate = events.length > 0 ? (replays / events.length) * 100 : 0
  
  // Engagement
  const likes = clip.like_count || 0
  const comments = clip.comment_count || 0
  const shares = clip.share_count || 0
  const saves = clip.save_count || 0
  const engagementRate = totalViews > 0 
    ? ((likes + comments + shares) / totalViews) * 100 
    : 0
  
  // Get retention and heatmap
  const [retentionCurve, dropoffHeatmap, insights] = await Promise.all([
    getClipRetention(clipId),
    getDropoffHeatmap(clipId),
    generateClipInsights(clipId)
  ])
  
  // Views over time (last 7 days)
  const { data: timeSeriesData } = await supabase
    .from("media_view_events")
    .select("created_at")
    .eq("media_id", clipId)
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  
  const viewsByDate: Record<string, number> = {}
  for (const event of timeSeriesData || []) {
    const date = new Date(event.created_at).toISOString().split("T")[0]
    viewsByDate[date] = (viewsByDate[date] || 0) + 1
  }
  
  const viewsOverTime = Object.entries(viewsByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, views]) => ({ date, views }))
  
  return {
    clipId,
    title: clip.title || "Untitled",
    thumbnail_url: clip.thumbnail_url,
    duration_seconds: duration,
    totalViews,
    uniqueViewers,
    avgWatchTime,
    avgWatchPercentage,
    completionRate,
    replayRate,
    likes,
    comments,
    shares,
    saves,
    engagementRate,
    retentionCurve,
    dropoffHeatmap,
    insights,
    viewsOverTime
  }
}

// ══════════════════════════════════════════
// CREATOR OVERVIEW
// ══════════════════════════════════════════

/**
 * Get creator dashboard overview
 */
export async function getCreatorOverview(creatorId: string): Promise<CreatorOverview | null> {
  const supabase = await createClient()
  
  // Get all clips
  const { data: clips } = await supabase
    .from("player_media")
    .select("id, title, thumbnail_url, view_count, like_count, comment_count, share_count, created_at")
    .eq("player_id", creatorId)
    .eq("status", "approved")
    .order("view_count", { ascending: false })
  
  if (!clips) return null
  
  const totalClips = clips.length
  const totalViews = clips.reduce((sum, c) => sum + (c.view_count || 0), 0)
  const avgViewsPerClip = totalClips > 0 ? totalViews / totalClips : 0
  
  // Calculate total engagement
  const totalEngagement = clips.reduce((sum, c) => 
    sum + (c.like_count || 0) + (c.comment_count || 0) + (c.share_count || 0), 0
  )
  const avgEngagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0
  
  // Get follower count
  const { count: totalFollowers } = await supabase
    .from("player_follows")
    .select("*", { count: "exact", head: true })
    .eq("player_id", creatorId)
  
  // Get followers gained in last 7 days
  const { count: followersGained7d } = await supabase
    .from("player_follows")
    .select("*", { count: "exact", head: true })
    .eq("player_id", creatorId)
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  
  // Estimate earnings (simplified: $2 per 1000 views)
  const estimatedEarnings = (totalViews / 1000) * 2
  
  // Top performing clips
  const topPerformingClips = clips.slice(0, 5).map(c => ({
    id: c.id,
    title: c.title || "Untitled",
    thumbnail_url: c.thumbnail_url,
    views: c.view_count || 0,
    engagementRate: (c.view_count || 0) > 0 
      ? (((c.like_count || 0) + (c.comment_count || 0) + (c.share_count || 0)) / (c.view_count || 1)) * 100
      : 0
  }))
  
  // Recent activity (simplified)
  const recentActivity = clips.slice(0, 3).map(c => ({
    type: "clip_upload",
    message: `Uploaded "${c.title || "Untitled"}"`,
    timestamp: c.created_at
  }))
  
  return {
    totalClips,
    totalViews,
    totalWatchTime: 0, // Would need to aggregate
    avgViewsPerClip,
    avgEngagementRate,
    totalFollowers: totalFollowers || 0,
    followersGained7d: followersGained7d || 0,
    estimatedEarnings,
    topPerformingClips,
    recentActivity
  }
}

/**
 * Get best time to post based on historical engagement
 */
export async function getBestTimeToPost(creatorId: string): Promise<{ hour: number; day: string; score: number }[]> {
  const supabase = await createClient()
  
  // Get view events for creator's clips
  const { data: clips } = await supabase
    .from("player_media")
    .select("id")
    .eq("player_id", creatorId)
  
  if (!clips || clips.length === 0) {
    // Return default recommendations
    return [
      { hour: 18, day: "Friday", score: 0.9 },
      { hour: 20, day: "Saturday", score: 0.85 },
      { hour: 19, day: "Sunday", score: 0.8 },
    ]
  }
  
  const clipIds = clips.map(c => c.id)
  
  const { data: events } = await supabase
    .from("media_view_events")
    .select("created_at")
    .in("media_id", clipIds)
    .limit(5000)
  
  if (!events || events.length === 0) {
    return [
      { hour: 18, day: "Friday", score: 0.9 },
      { hour: 20, day: "Saturday", score: 0.85 },
      { hour: 19, day: "Sunday", score: 0.8 },
    ]
  }
  
  // Analyze when views happen
  const hourCounts: Record<string, number> = {}
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  
  for (const event of events) {
    const date = new Date(event.created_at)
    const hour = date.getHours()
    const day = days[date.getDay()]
    const key = `${day}-${hour}`
    hourCounts[key] = (hourCounts[key] || 0) + 1
  }
  
  // Find top times
  const sorted = Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
  
  const maxCount = sorted[0]?.[1] || 1
  
  return sorted.map(([key, count]) => {
    const [day, hour] = key.split("-")
    return {
      hour: parseInt(hour),
      day,
      score: count / maxCount
    }
  })
}
