"use server"

import { createClient } from "@/lib/supabase/server"

// ═══════════════════════════════════════════════════════════════════════════════
// REAL-TIME ANALYTICS PIPELINE
// Event Streaming + Aggregation + Dashboard Data
// ═══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════

export interface AnalyticsEvent {
  event_type: string
  event_name: string
  user_id?: string
  session_id?: string
  device_id?: string
  target_type?: string
  target_id?: string
  properties?: Record<string, any>
  platform?: string
  device_type?: string
  country?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

export interface MetricUpdate {
  metric_type: string
  entity_id: string
  granularity?: "minute" | "hour" | "day"
  views?: number
  likes?: number
  comments?: number
  shares?: number
  watch_time?: number
  impressions?: number
  clicks?: number
  spend_cents?: number
}

export interface DashboardMetrics {
  totalViews: number
  totalWatchTime: number
  totalEngagements: number
  avgWatchTime: number
  topContent: Array<{
    id: string
    title: string
    views: number
    engagement_rate: number
  }>
  realtimeViewers: number
  chartData: Array<{
    time: string
    views: number
    engagement: number
  }>
}

// ══════════════════════════════════════════
// EVENT INGESTION
// ══════════════════════════════════════════

/**
 * Ingest a single analytics event
 */
export async function ingestEvent(event: AnalyticsEvent) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("analytics_events")
    .insert({
      event_type: event.event_type,
      event_name: event.event_name,
      user_id: event.user_id,
      session_id: event.session_id,
      device_id: event.device_id,
      target_type: event.target_type,
      target_id: event.target_id,
      properties: event.properties || {},
      platform: event.platform,
      device_type: event.device_type,
      country: event.country,
      utm_source: event.utm_source,
      utm_medium: event.utm_medium,
      utm_campaign: event.utm_campaign,
      client_timestamp: event.properties?.client_timestamp,
      server_timestamp: new Date().toISOString(),
    })
  
  if (error) {
    console.error("Failed to ingest event:", error)
    return { error: "Failed to ingest event" }
  }
  
  // Update real-time metrics if this is a trackable event
  if (event.target_id && event.target_type) {
    await updateRealtimeMetrics(event)
  }
  
  return { success: true }
}

/**
 * Ingest multiple events in batch
 */
export async function ingestEventBatch(events: AnalyticsEvent[]) {
  const supabase = await createClient()
  
  const formattedEvents = events.map(event => ({
    event_type: event.event_type,
    event_name: event.event_name,
    user_id: event.user_id,
    session_id: event.session_id,
    device_id: event.device_id,
    target_type: event.target_type,
    target_id: event.target_id,
    properties: event.properties || {},
    platform: event.platform,
    device_type: event.device_type,
    country: event.country,
    utm_source: event.utm_source,
    utm_medium: event.utm_medium,
    utm_campaign: event.utm_campaign,
    server_timestamp: new Date().toISOString(),
  }))
  
  const { error } = await supabase
    .from("analytics_events")
    .insert(formattedEvents)
  
  if (error) {
    console.error("Failed to ingest event batch:", error)
    return { error: "Failed to ingest events", count: 0 }
  }
  
  return { success: true, count: events.length }
}

// ══════════════════════════════════════════
// REAL-TIME METRICS
// ══════════════════════════════════════════

/**
 * Update real-time metrics based on event
 */
async function updateRealtimeMetrics(event: AnalyticsEvent) {
  const supabase = await createClient()
  
  const updates: MetricUpdate = {
    metric_type: event.target_type!,
    entity_id: event.target_id!,
    granularity: "minute",
  }
  
  // Map event to metric increment
  switch (event.event_name) {
    case "view":
    case "page_view":
    case "clip_view":
      updates.views = 1
      break
    case "like":
      updates.likes = 1
      break
    case "comment":
      updates.comments = 1
      break
    case "share":
      updates.shares = 1
      break
    case "watch_time":
      updates.watch_time = event.properties?.seconds || 0
      break
    case "ad_impression":
      updates.impressions = 1
      break
    case "ad_click":
      updates.clicks = 1
      break
    default:
      return // Not a trackable metric
  }
  
  // Use DB function for atomic upsert
  await supabase.rpc("update_realtime_metric", {
    p_metric_type: updates.metric_type,
    p_entity_id: updates.entity_id,
    p_granularity: updates.granularity,
    p_views: updates.views || 0,
    p_likes: updates.likes || 0,
    p_comments: updates.comments || 0,
    p_shares: updates.shares || 0,
    p_watch_time: updates.watch_time || 0,
    p_impressions: updates.impressions || 0,
    p_clicks: updates.clicks || 0,
    p_spend_cents: updates.spend_cents || 0,
  })
}

/**
 * Get real-time metrics for an entity
 */
export async function getRealtimeMetrics(
  metricType: string,
  entityId: string,
  options: {
    granularity?: "minute" | "hour" | "day"
    startTime?: string
    endTime?: string
  } = {}
) {
  const supabase = await createClient()
  const { granularity = "hour", startTime, endTime } = options
  
  let query = supabase
    .from("realtime_metrics")
    .select("*")
    .eq("metric_type", metricType)
    .eq("entity_id", entityId)
    .eq("granularity", granularity)
    .order("time_bucket", { ascending: false })
  
  if (startTime) {
    query = query.gte("time_bucket", startTime)
  }
  if (endTime) {
    query = query.lte("time_bucket", endTime)
  }
  
  const { data, error } = await query.limit(100)
  
  if (error) {
    console.error("Failed to get realtime metrics:", error)
    return []
  }
  
  return data || []
}

// ══════════════════════════════════════════
// AGGREGATIONS
// ══════════════════════════════════════════

/**
 * Get aggregated metrics for a time period
 */
export async function getAggregatedMetrics(
  metricType: string,
  entityId: string,
  period: "today" | "7d" | "30d" | "all"
) {
  const supabase = await createClient()
  
  const now = new Date()
  let startDate: Date
  
  switch (period) {
    case "today":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    default:
      startDate = new Date(0)
  }
  
  const { data, error } = await supabase
    .from("realtime_metrics")
    .select("views, likes, comments, shares, watch_time_seconds, impressions, clicks, spend_cents")
    .eq("metric_type", metricType)
    .eq("entity_id", entityId)
    .gte("time_bucket", startDate.toISOString())
  
  if (error || !data) {
    return {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      watch_time_seconds: 0,
      impressions: 0,
      clicks: 0,
      spend_cents: 0,
      engagement_rate: 0,
      ctr: 0,
    }
  }
  
  // Aggregate
  const totals = data.reduce((acc, row) => ({
    views: acc.views + (row.views || 0),
    likes: acc.likes + (row.likes || 0),
    comments: acc.comments + (row.comments || 0),
    shares: acc.shares + (row.shares || 0),
    watch_time_seconds: acc.watch_time_seconds + (row.watch_time_seconds || 0),
    impressions: acc.impressions + (row.impressions || 0),
    clicks: acc.clicks + (row.clicks || 0),
    spend_cents: acc.spend_cents + (row.spend_cents || 0),
  }), {
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    watch_time_seconds: 0,
    impressions: 0,
    clicks: 0,
    spend_cents: 0,
  })
  
  // Calculate rates
  const engagement_rate = totals.views > 0
    ? ((totals.likes + totals.comments + totals.shares) / totals.views) * 100
    : 0
  
  const ctr = totals.impressions > 0
    ? (totals.clicks / totals.impressions) * 100
    : 0
  
  return { ...totals, engagement_rate, ctr }
}

// ══════════════════════════════════════════
// DASHBOARD DATA
// ══════════════════════════════════════════

/**
 * Get creator dashboard metrics
 */
export async function getCreatorDashboard(creatorId: string): Promise<DashboardMetrics> {
  const supabase = await createClient()
  
  // Get creator's content
  const { data: content } = await supabase
    .from("content_items")
    .select("id, title, view_count, like_count, comment_count, share_count")
    .eq("creator_id", creatorId)
    .order("view_count", { ascending: false })
    .limit(10)
  
  // Calculate totals
  const totalViews = (content || []).reduce((sum, c) => sum + c.view_count, 0)
  const totalEngagements = (content || []).reduce(
    (sum, c) => sum + c.like_count + c.comment_count + c.share_count, 
    0
  )
  
  // Get recent metrics for chart
  const { data: recentMetrics } = await supabase
    .from("realtime_metrics")
    .select("time_bucket, views, likes, comments, shares")
    .eq("metric_type", "creator")
    .eq("entity_id", creatorId)
    .eq("granularity", "hour")
    .gte("time_bucket", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("time_bucket", { ascending: true })
  
  const chartData = (recentMetrics || []).map(m => ({
    time: new Date(m.time_bucket).toLocaleTimeString([], { hour: "2-digit" }),
    views: m.views || 0,
    engagement: (m.likes || 0) + (m.comments || 0) + (m.shares || 0),
  }))
  
  // Top content
  const topContent = (content || []).slice(0, 5).map(c => ({
    id: c.id,
    title: c.title || "Untitled",
    views: c.view_count,
    engagement_rate: c.view_count > 0 
      ? ((c.like_count + c.comment_count + c.share_count) / c.view_count) * 100 
      : 0,
  }))
  
  return {
    totalViews,
    totalWatchTime: 0, // Would need to aggregate from watch_time
    totalEngagements,
    avgWatchTime: 0,
    topContent,
    realtimeViewers: 0, // Would need realtime subscription
    chartData,
  }
}

/**
 * Get platform-wide analytics (admin only)
 */
export async function getPlatformAnalytics(period: "today" | "7d" | "30d" = "7d") {
  const supabase = await createClient()
  
  const now = new Date()
  let startDate: Date
  
  switch (period) {
    case "today":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
  }
  
  // Get event counts by type
  const { data: eventCounts } = await supabase
    .from("analytics_events")
    .select("event_type, event_name")
    .gte("server_timestamp", startDate.toISOString())
  
  const eventsByType: Record<string, number> = {}
  const eventsByName: Record<string, number> = {}
  
  for (const event of eventCounts || []) {
    eventsByType[event.event_type] = (eventsByType[event.event_type] || 0) + 1
    eventsByName[event.event_name] = (eventsByName[event.event_name] || 0) + 1
  }
  
  // Get user activity
  const { data: uniqueUsers } = await supabase
    .from("analytics_events")
    .select("user_id")
    .gte("server_timestamp", startDate.toISOString())
    .not("user_id", "is", null)
  
  const uniqueUserIds = new Set((uniqueUsers || []).map(u => u.user_id))
  
  // Get ad metrics
  const { data: adMetrics } = await supabase
    .from("realtime_metrics")
    .select("impressions, clicks, spend_cents")
    .eq("metric_type", "ad")
    .gte("time_bucket", startDate.toISOString())
  
  const adTotals = (adMetrics || []).reduce((acc, m) => ({
    impressions: acc.impressions + (m.impressions || 0),
    clicks: acc.clicks + (m.clicks || 0),
    spend: acc.spend + (m.spend_cents || 0),
  }), { impressions: 0, clicks: 0, spend: 0 })
  
  return {
    period,
    events: {
      total: eventCounts?.length || 0,
      byType: eventsByType,
      byName: eventsByName,
    },
    users: {
      active: uniqueUserIds.size,
    },
    ads: {
      impressions: adTotals.impressions,
      clicks: adTotals.clicks,
      spend_cents: adTotals.spend,
      ctr: adTotals.impressions > 0 ? (adTotals.clicks / adTotals.impressions) * 100 : 0,
    },
  }
}

// ══════════════════════════════════════════
// AD ANALYTICS
// ══════════════════════════════════════════

/**
 * Get campaign analytics
 */
export async function getCampaignAnalytics(
  campaignId: string,
  options: { startDate?: string; endDate?: string } = {}
) {
  const supabase = await createClient()
  
  let query = supabase
    .from("ad_impressions")
    .select("*")
    .eq("campaign_id", campaignId)
  
  if (options.startDate) {
    query = query.gte("created_at", options.startDate)
  }
  if (options.endDate) {
    query = query.lte("created_at", options.endDate)
  }
  
  const { data: impressions } = await query
  
  if (!impressions || impressions.length === 0) {
    return {
      impressions: 0,
      clicks: 0,
      spend_cents: 0,
      conversions: 0,
      ctr: 0,
      cpm: 0,
      cpc: 0,
      byPlacement: {},
      byDevice: {},
      byCountry: {},
    }
  }
  
  // Aggregate
  const totals = impressions.reduce((acc, imp) => ({
    impressions: acc.impressions + 1,
    clicks: acc.clicks + (imp.clicked ? 1 : 0),
    spend: acc.spend + imp.won_price_cents,
    conversions: acc.conversions + (imp.converted ? 1 : 0),
  }), { impressions: 0, clicks: 0, spend: 0, conversions: 0 })
  
  // By placement
  const byPlacement: Record<string, { impressions: number; clicks: number }> = {}
  const byDevice: Record<string, { impressions: number; clicks: number }> = {}
  const byCountry: Record<string, { impressions: number; clicks: number }> = {}
  
  for (const imp of impressions) {
    // Placement
    if (!byPlacement[imp.placement]) {
      byPlacement[imp.placement] = { impressions: 0, clicks: 0 }
    }
    byPlacement[imp.placement].impressions++
    if (imp.clicked) byPlacement[imp.placement].clicks++
    
    // Device
    const device = imp.device_type || "unknown"
    if (!byDevice[device]) {
      byDevice[device] = { impressions: 0, clicks: 0 }
    }
    byDevice[device].impressions++
    if (imp.clicked) byDevice[device].clicks++
    
    // Country
    const country = imp.country || "unknown"
    if (!byCountry[country]) {
      byCountry[country] = { impressions: 0, clicks: 0 }
    }
    byCountry[country].impressions++
    if (imp.clicked) byCountry[country].clicks++
  }
  
  return {
    impressions: totals.impressions,
    clicks: totals.clicks,
    spend_cents: totals.spend,
    conversions: totals.conversions,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    byPlacement,
    byDevice,
    byCountry,
  }
}
