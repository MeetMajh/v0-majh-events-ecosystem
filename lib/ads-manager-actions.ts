"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// ═══════════════════════════════════════════════════════════════════════════════
// ADS MANAGER SERVER ACTIONS
// Meta-style Campaign Management
// ═══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════
// ADVERTISER ACCOUNT
// ══════════════════════════════════════════

export async function getOrCreateAdvertiserAccount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // Check existing
  const { data: existing } = await supabase
    .from("advertiser_accounts")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (existing) return { account: existing }

  // Get profile for name
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single()

  // Create new
  const { data: account, error } = await supabase
    .from("advertiser_accounts")
    .insert({
      user_id: user.id,
      account_name: `${profile?.display_name || "My"} Ad Account`,
      account_type: "self_serve",
      billing_type: "prepaid",
    })
    .select()
    .single()

  if (error) {
    console.error("Failed to create advertiser account:", error)
    return { error: "Failed to create advertiser account" }
  }

  return { account }
}

export async function getAdvertiserAccount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("advertiser_accounts")
    .select("*")
    .eq("user_id", user.id)
    .single()

  return data
}

// ══════════════════════════════════════════
// CAMPAIGNS
// ══════════════════════════════════════════

export async function getCampaigns(advertiserId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from("ad_campaigns")
    .select(`
      *,
      advertiser:advertiser_accounts(account_name),
      ad_sets:ad_sets(count)
    `)
    .order("created_at", { ascending: false })

  if (advertiserId) {
    query = query.eq("advertiser_id", advertiserId)
  }

  const { data, error } = await query

  if (error) {
    console.error("Failed to fetch campaigns:", error)
    return []
  }

  return data || []
}

export async function getCampaign(id: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("ad_campaigns")
    .select(`
      *,
      advertiser:advertiser_accounts(*),
      ad_sets:ad_sets(
        *,
        ads:ads(*)
      )
    `)
    .eq("id", id)
    .single()

  if (error) {
    console.error("Failed to fetch campaign:", error)
    return null
  }

  return data
}

export async function createCampaign(data: {
  name: string
  objective: string
  budget_type: "daily" | "lifetime"
  budget_cents: number
  start_date: string
  end_date?: string
  bid_strategy?: string
}) {
  const supabase = await createClient()
  
  const accountResult = await getOrCreateAdvertiserAccount()
  if (accountResult.error || !accountResult.account) {
    return { error: accountResult.error || "No advertiser account" }
  }

  const { data: campaign, error } = await supabase
    .from("ad_campaigns")
    .insert({
      advertiser_id: accountResult.account.id,
      name: data.name,
      objective: data.objective,
      budget_type: data.budget_type,
      budget_cents: data.budget_cents,
      start_date: data.start_date,
      end_date: data.end_date || null,
      bid_strategy: data.bid_strategy || "lowest_cost",
      status: "draft",
    })
    .select()
    .single()

  if (error) {
    console.error("Failed to create campaign:", error)
    return { error: "Failed to create campaign" }
  }

  revalidatePath("/dashboard/ads")
  return { campaign }
}

export async function updateCampaign(id: string, updates: {
  name?: string
  status?: string
  budget_cents?: number
  end_date?: string
}) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("ad_campaigns")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    console.error("Failed to update campaign:", error)
    return { error: "Failed to update campaign" }
  }

  revalidatePath("/dashboard/ads")
  return { success: true }
}

export async function duplicateCampaign(id: string) {
  const supabase = await createClient()

  const original = await getCampaign(id)
  if (!original) return { error: "Campaign not found" }

  const { data: campaign, error } = await supabase
    .from("ad_campaigns")
    .insert({
      advertiser_id: original.advertiser_id,
      name: `${original.name} (Copy)`,
      objective: original.objective,
      budget_type: original.budget_type,
      budget_cents: original.budget_cents,
      start_date: new Date().toISOString(),
      end_date: original.end_date,
      bid_strategy: original.bid_strategy,
      status: "draft",
    })
    .select()
    .single()

  if (error) {
    console.error("Failed to duplicate campaign:", error)
    return { error: "Failed to duplicate campaign" }
  }

  revalidatePath("/dashboard/ads")
  return { campaign }
}

// ══════════════════════════════════════════
// AD SETS
// ══════════════════════════════════════════

export async function getAdSets(campaignId?: string) {
  const supabase = await createClient()

  let query = supabase
    .from("ad_sets")
    .select(`
      *,
      campaign:ad_campaigns(name, objective),
      ads:ads(count)
    `)
    .order("created_at", { ascending: false })

  if (campaignId) {
    query = query.eq("campaign_id", campaignId)
  }

  const { data, error } = await query

  if (error) {
    console.error("Failed to fetch ad sets:", error)
    return []
  }

  return data || []
}

export async function createAdSet(data: {
  campaign_id: string
  name: string
  budget_type?: "daily" | "lifetime"
  budget_cents?: number
  optimization_goal: string
  targeting: object
  placements: string[]
  bid_amount_cents?: number
}) {
  const supabase = await createClient()

  const { data: adSet, error } = await supabase
    .from("ad_sets")
    .insert({
      campaign_id: data.campaign_id,
      name: data.name,
      budget_type: data.budget_type,
      budget_cents: data.budget_cents,
      optimization_goal: data.optimization_goal,
      targeting: data.targeting,
      placements: data.placements,
      bid_amount_cents: data.bid_amount_cents,
      status: "active",
    })
    .select()
    .single()

  if (error) {
    console.error("Failed to create ad set:", error)
    return { error: "Failed to create ad set" }
  }

  revalidatePath("/dashboard/ads")
  return { adSet }
}

export async function updateAdSet(id: string, updates: {
  name?: string
  status?: string
  budget_cents?: number
  targeting?: object
  placements?: string[]
}) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("ad_sets")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    console.error("Failed to update ad set:", error)
    return { error: "Failed to update ad set" }
  }

  revalidatePath("/dashboard/ads")
  return { success: true }
}

// ══════════════════════════════════════════
// ADS
// ══════════════════════════════════════════

export async function getAds(adSetId?: string) {
  const supabase = await createClient()

  let query = supabase
    .from("ads")
    .select(`
      *,
      ad_set:ad_sets(name, campaign:ad_campaigns(name))
    `)
    .order("created_at", { ascending: false })

  if (adSetId) {
    query = query.eq("ad_set_id", adSetId)
  }

  const { data, error } = await query

  if (error) {
    console.error("Failed to fetch ads:", error)
    return []
  }

  return data || []
}

export async function createAd(data: {
  ad_set_id: string
  name: string
  format: string
  media_urls: string[]
  thumbnail_url?: string
  headline?: string
  primary_text?: string
  description?: string
  call_to_action?: string
  destination_url: string
}) {
  const supabase = await createClient()

  const { data: ad, error } = await supabase
    .from("ads")
    .insert({
      ad_set_id: data.ad_set_id,
      name: data.name,
      format: data.format,
      media_urls: data.media_urls,
      thumbnail_url: data.thumbnail_url,
      headline: data.headline,
      primary_text: data.primary_text,
      description: data.description,
      call_to_action: data.call_to_action,
      destination_url: data.destination_url,
      status: "pending_review",
      review_status: "pending",
    })
    .select()
    .single()

  if (error) {
    console.error("Failed to create ad:", error)
    return { error: "Failed to create ad" }
  }

  revalidatePath("/dashboard/ads")
  return { ad }
}

export async function updateAd(id: string, updates: {
  name?: string
  status?: string
  headline?: string
  primary_text?: string
  destination_url?: string
}) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("ads")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    console.error("Failed to update ad:", error)
    return { error: "Failed to update ad" }
  }

  revalidatePath("/dashboard/ads")
  return { success: true }
}

// ══════════════════════════════════════════
// BULK ACTIONS
// ══════════════════════════════════════════

export async function bulkUpdateStatus(
  type: "campaigns" | "ad_sets" | "ads",
  ids: string[],
  status: string
) {
  const supabase = await createClient()

  const table = type === "campaigns" ? "ad_campaigns" : type
  
  const { error } = await supabase
    .from(table)
    .update({ status, updated_at: new Date().toISOString() })
    .in("id", ids)

  if (error) {
    console.error(`Failed to bulk update ${type}:`, error)
    return { error: `Failed to update ${type}` }
  }

  revalidatePath("/dashboard/ads")
  return { success: true }
}

export async function bulkDelete(
  type: "campaigns" | "ad_sets" | "ads",
  ids: string[]
) {
  const supabase = await createClient()

  const table = type === "campaigns" ? "ad_campaigns" : type
  
  // Soft delete by setting status to deleted
  const { error } = await supabase
    .from(table)
    .update({ status: "deleted", updated_at: new Date().toISOString() })
    .in("id", ids)

  if (error) {
    console.error(`Failed to bulk delete ${type}:`, error)
    return { error: `Failed to delete ${type}` }
  }

  revalidatePath("/dashboard/ads")
  return { success: true }
}

// ══════════════════════════════════════════
// METRICS & ANALYTICS
// ══════════════════════════════════════════

export async function getCampaignMetrics(campaignId: string, dateRange?: { start: string; end: string }) {
  const supabase = await createClient()

  // Get aggregated metrics from realtime_metrics
  let query = supabase
    .from("realtime_metrics")
    .select("*")
    .eq("metric_type", "ad")
    .eq("entity_id", campaignId)

  if (dateRange) {
    query = query
      .gte("time_bucket", dateRange.start)
      .lte("time_bucket", dateRange.end)
  }

  const { data: metrics } = await query

  // Aggregate
  const totals = (metrics || []).reduce((acc, m) => ({
    impressions: acc.impressions + (m.impressions || 0),
    clicks: acc.clicks + (m.clicks || 0),
    spend_cents: acc.spend_cents + (m.spend_cents || 0),
    conversions: acc.conversions + (m.conversions || 0),
  }), { impressions: 0, clicks: 0, spend_cents: 0, conversions: 0 })

  return {
    ...totals,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpm: totals.impressions > 0 ? (totals.spend_cents / totals.impressions) * 1000 : 0,
    cpc: totals.clicks > 0 ? totals.spend_cents / totals.clicks : 0,
  }
}

export async function getAdsOverview() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const account = await getAdvertiserAccount()
  if (!account) return null

  // Get counts
  const [campaigns, adSets, ads] = await Promise.all([
    supabase.from("ad_campaigns").select("id, status").eq("advertiser_id", account.id),
    supabase.from("ad_sets").select("id, status, campaign_id"),
    supabase.from("ads").select("id, status, ad_set_id"),
  ])

  const activeCampaigns = (campaigns.data || []).filter(c => c.status === "active")
  const activeAdSets = (adSets.data || []).filter(s => s.status === "active")
  const activeAds = (ads.data || []).filter(a => a.status === "active")

  // Get total spend today
  const today = new Date().toISOString().split("T")[0]
  const { data: todayMetrics } = await supabase
    .from("realtime_metrics")
    .select("spend_cents, impressions, clicks")
    .eq("metric_type", "ad")
    .gte("time_bucket", today)

  const todayTotals = (todayMetrics || []).reduce((acc, m) => ({
    spend: acc.spend + (m.spend_cents || 0),
    impressions: acc.impressions + (m.impressions || 0),
    clicks: acc.clicks + (m.clicks || 0),
  }), { spend: 0, impressions: 0, clicks: 0 })

  return {
    account,
    counts: {
      campaigns: campaigns.data?.length || 0,
      activeCampaigns: activeCampaigns.length,
      adSets: adSets.data?.length || 0,
      activeAdSets: activeAdSets.length,
      ads: ads.data?.length || 0,
      activeAds: activeAds.length,
    },
    today: todayTotals,
  }
}
