"use server"

import { createClient } from "@/lib/supabase/server"

// ═══════════════════════════════════════════════════════════════════════════════
// ADS AUCTION ENGINE
// Google Ads-Style Real-Time Bidding with Second-Price Auction
// ═══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════

export interface AuctionContext {
  placement: "clip_feed" | "match_page" | "stream_overlay" | "tournament_page" | "profile_page"
  user_id?: string
  game_id?: string
  tournament_id?: string
  match_id?: string
  clip_id?: string
  country?: string
  device_type?: "mobile" | "desktop" | "tablet"
  user_segments?: string[]
}

export interface EligibleCampaign {
  campaign_id: string
  ad_set_id: string
  ad_id: string
  advertiser_id: string
  bid_strategy: "cpc" | "cpm" | "cpa"
  bid_amount_cents: number
  target_cpm_cents?: number
  daily_budget_cents: number
  daily_spend_cents: number
  lifetime_budget_cents?: number
  lifetime_spend_cents: number
  ad_format: string
  media_url: string
  thumbnail_url?: string
  click_url: string
  headline?: string
  primary_text?: string
  call_to_action?: string
  quality_score: number // 0-10 based on historical CTR + engagement
  relevance_score: number // 0-10 based on targeting match
}

export interface AuctionResult {
  winner: {
    campaign_id: string
    ad_set_id: string
    ad_id: string
    advertiser_id: string
    ad_format: string
    media_url: string
    thumbnail_url?: string
    click_url: string
    headline?: string
    primary_text?: string
    call_to_action?: string
  } | null
  price_paid_cents: number
  auction_id: string
  no_fill_reason?: string
}

export interface BidScore {
  campaign: EligibleCampaign
  rawBid: number
  qualityMultiplier: number
  relevanceMultiplier: number
  finalScore: number
}

// ══════════════════════════════════════════
// AUCTION ALGORITHM
// ══════════════════════════════════════════

/**
 * Calculate final bid score using Google Ads-style formula:
 * score = bid × quality_score × relevance_score
 */
function calculateBidScore(campaign: EligibleCampaign): BidScore {
  // Normalize quality and relevance to multipliers (0.5 - 1.5 range)
  const qualityMultiplier = 0.5 + (campaign.quality_score / 10)
  const relevanceMultiplier = 0.5 + (campaign.relevance_score / 10)
  
  // For CPM, use bid directly. For CPC, estimate CPM equivalent
  let effectiveCpm = campaign.bid_amount_cents
  if (campaign.bid_strategy === "cpc") {
    // Estimate CTR based on quality score (higher quality = higher CTR)
    const estimatedCtr = 0.005 + (campaign.quality_score / 10) * 0.02 // 0.5% - 2.5%
    effectiveCpm = campaign.bid_amount_cents * estimatedCtr * 1000
  } else if (campaign.bid_strategy === "cpa") {
    // Estimate conversion rate based on quality
    const estimatedCvr = 0.01 + (campaign.quality_score / 10) * 0.04 // 1% - 5%
    const estimatedCtr = 0.01
    effectiveCpm = campaign.bid_amount_cents * estimatedCtr * estimatedCvr * 1000
  }
  
  const finalScore = effectiveCpm * qualityMultiplier * relevanceMultiplier
  
  return {
    campaign,
    rawBid: effectiveCpm,
    qualityMultiplier,
    relevanceMultiplier,
    finalScore,
  }
}

/**
 * Run second-price auction
 * Winner pays slightly above the second highest bid
 */
function runSecondPriceAuction(bids: BidScore[]): { winner: BidScore; pricePaid: number } | null {
  if (bids.length === 0) return null
  
  // Sort by final score descending
  const sorted = [...bids].sort((a, b) => b.finalScore - a.finalScore)
  
  if (sorted.length === 1) {
    // Only one bidder, they pay their bid (or floor price)
    const floorPrice = 10 // $0.10 CPM floor
    return {
      winner: sorted[0],
      pricePaid: Math.max(sorted[0].rawBid, floorPrice),
    }
  }
  
  // Winner pays second-highest score + $0.01 (1 cent)
  const winner = sorted[0]
  const secondBid = sorted[1]
  
  // Calculate price needed to beat second place
  // price = (secondScore / (qualityMult × relevanceMult)) + 1 cent
  const priceNeededToBeatSecond = 
    (secondBid.finalScore / (winner.qualityMultiplier * winner.relevanceMultiplier)) + 1
  
  // Price paid is minimum of: calculated second-price OR winner's max bid
  const pricePaid = Math.min(priceNeededToBeatSecond, winner.rawBid)
  
  return { winner, pricePaid }
}

// ══════════════════════════════════════════
// ELIGIBILITY CHECKS
// ══════════════════════════════════════════

/**
 * Fetch eligible campaigns for auction context
 */
async function fetchEligibleCampaigns(context: AuctionContext): Promise<EligibleCampaign[]> {
  const supabase = await createClient()
  
  // Get active campaigns with budget remaining
  const { data: campaigns, error } = await supabase
    .from("ad_campaigns")
    .select(`
      id,
      advertiser_id,
      bid_strategy,
      budget_cents,
      budget_type,
      status,
      ad_sets!inner (
        id,
        bid_amount_cents,
        optimization_goal,
        targeting,
        placements,
        status,
        ads!inner (
          id,
          format,
          media_urls,
          thumbnail_url,
          destination_url,
          headline,
          primary_text,
          call_to_action,
          status,
          quality_score
        )
      )
    `)
    .eq("status", "active")
    .gte("budget_cents", 100) // At least $1 budget
  
  if (error || !campaigns) {
    console.error("Failed to fetch campaigns:", error)
    return []
  }
  
  const eligible: EligibleCampaign[] = []
  
  for (const campaign of campaigns) {
    for (const adSet of campaign.ad_sets || []) {
      if (adSet.status !== "active") continue
      
      // Check placement targeting
      const placements = adSet.placements || ["clip_feed"]
      if (!placements.includes(context.placement)) continue
      
      // Check targeting match
      const targeting = adSet.targeting as any || {}
      const relevanceScore = calculateRelevanceScore(targeting, context)
      
      // Skip if relevance too low
      if (relevanceScore < 3) continue
      
      for (const ad of adSet.ads || []) {
        if (ad.status !== "active" && ad.status !== "approved") continue
        
        eligible.push({
          campaign_id: campaign.id,
          ad_set_id: adSet.id,
          ad_id: ad.id,
          advertiser_id: campaign.advertiser_id,
          bid_strategy: (campaign.bid_strategy || "cpm") as "cpc" | "cpm" | "cpa",
          bid_amount_cents: adSet.bid_amount_cents || 100,
          daily_budget_cents: campaign.budget_type === "daily" ? campaign.budget_cents : 0,
          daily_spend_cents: 0, // Would be fetched from metrics
          lifetime_budget_cents: campaign.budget_type === "lifetime" ? campaign.budget_cents : undefined,
          lifetime_spend_cents: 0,
          ad_format: ad.format,
          media_url: ad.media_urls?.[0] || "",
          thumbnail_url: ad.thumbnail_url,
          click_url: ad.destination_url,
          headline: ad.headline,
          primary_text: ad.primary_text,
          call_to_action: ad.call_to_action,
          quality_score: ad.quality_score || 5,
          relevance_score: relevanceScore,
        })
      }
    }
  }
  
  return eligible
}

/**
 * Calculate relevance score based on targeting match
 */
function calculateRelevanceScore(targeting: any, context: AuctionContext): number {
  let score = 5 // Base score
  
  // Game targeting
  if (targeting.game_ids?.length > 0) {
    if (context.game_id && targeting.game_ids.includes(context.game_id)) {
      score += 2
    } else if (context.game_id) {
      score -= 2 // Targeting games but not this one
    }
  }
  
  // Country targeting
  if (targeting.countries?.length > 0) {
    if (context.country && targeting.countries.includes(context.country)) {
      score += 1
    } else if (context.country) {
      score -= 3 // Hard requirement
    }
  }
  
  // Device targeting
  if (targeting.devices?.length > 0) {
    if (context.device_type && targeting.devices.includes(context.device_type)) {
      score += 1
    }
  }
  
  // Interest/segment targeting
  if (targeting.interests?.length > 0 && context.user_segments?.length) {
    const matchedInterests = targeting.interests.filter((i: string) => 
      context.user_segments?.includes(i)
    )
    score += matchedInterests.length * 0.5
  }
  
  return Math.max(0, Math.min(10, score))
}

// ══════════════════════════════════════════
// MAIN AUCTION FUNCTION
// ══════════════════════════════════════════

/**
 * Run a real-time ad auction for the given context
 */
export async function runAdAuction(context: AuctionContext): Promise<AuctionResult> {
  const supabase = await createClient()
  const auctionId = crypto.randomUUID()
  
  try {
    // 1. Fetch eligible campaigns
    const eligible = await fetchEligibleCampaigns(context)
    
    if (eligible.length === 0) {
      return {
        winner: null,
        price_paid_cents: 0,
        auction_id: auctionId,
        no_fill_reason: "no_eligible_campaigns",
      }
    }
    
    // 2. Calculate bid scores
    const bidScores = eligible.map(calculateBidScore)
    
    // 3. Run second-price auction
    const result = runSecondPriceAuction(bidScores)
    
    if (!result) {
      return {
        winner: null,
        price_paid_cents: 0,
        auction_id: auctionId,
        no_fill_reason: "auction_failed",
      }
    }
    
    // 4. Record impression
    await recordAdImpression({
      auction_id: auctionId,
      campaign_id: result.winner.campaign.campaign_id,
      ad_set_id: result.winner.campaign.ad_set_id,
      ad_id: result.winner.campaign.ad_id,
      advertiser_id: result.winner.campaign.advertiser_id,
      user_id: context.user_id,
      placement: context.placement,
      price_paid_cents: Math.round(result.pricePaid),
      winning_bid_cents: Math.round(result.winner.rawBid),
      quality_score: result.winner.campaign.quality_score,
      relevance_score: result.winner.campaign.relevance_score,
      context: context,
    })
    
    return {
      winner: {
        campaign_id: result.winner.campaign.campaign_id,
        ad_set_id: result.winner.campaign.ad_set_id,
        ad_id: result.winner.campaign.ad_id,
        advertiser_id: result.winner.campaign.advertiser_id,
        ad_format: result.winner.campaign.ad_format,
        media_url: result.winner.campaign.media_url,
        thumbnail_url: result.winner.campaign.thumbnail_url,
        click_url: result.winner.campaign.click_url,
        headline: result.winner.campaign.headline,
        primary_text: result.winner.campaign.primary_text,
        call_to_action: result.winner.campaign.call_to_action,
      },
      price_paid_cents: Math.round(result.pricePaid),
      auction_id: auctionId,
    }
  } catch (error) {
    console.error("Auction failed:", error)
    return {
      winner: null,
      price_paid_cents: 0,
      auction_id: auctionId,
      no_fill_reason: "error",
    }
  }
}

/**
 * Record ad impression in database
 */
async function recordAdImpression(data: {
  auction_id: string
  campaign_id: string
  ad_set_id: string
  ad_id: string
  advertiser_id: string
  user_id?: string
  placement: string
  price_paid_cents: number
  winning_bid_cents: number
  quality_score: number
  relevance_score: number
  context: AuctionContext
}) {
  const supabase = await createClient()
  
  await supabase
    .from("ad_impressions")
    .insert({
      id: data.auction_id,
      campaign_id: data.campaign_id,
      ad_set_id: data.ad_set_id,
      ad_id: data.ad_id,
      advertiser_id: data.advertiser_id,
      user_id: data.user_id,
      placement: data.placement,
      price_paid_cents: data.price_paid_cents,
      winning_bid_cents: data.winning_bid_cents,
      quality_score: data.quality_score,
      relevance_score: data.relevance_score,
      context: data.context,
      created_at: new Date().toISOString(),
    })
  
  // Update daily spend counters
  await supabase.rpc("increment_ad_spend", {
    p_campaign_id: data.campaign_id,
    p_ad_set_id: data.ad_set_id,
    p_amount_cents: data.price_paid_cents,
  })
}

/**
 * Record ad click
 */
export async function recordAdClick(
  impressionId: string,
  userId?: string
) {
  const supabase = await createClient()
  
  // Update impression with click
  const { data: impression } = await supabase
    .from("ad_impressions")
    .update({ 
      clicked: true,
      clicked_at: new Date().toISOString(),
    })
    .eq("id", impressionId)
    .select()
    .single()
  
  if (impression) {
    // Record click event
    await supabase
      .from("ad_clicks")
      .insert({
        impression_id: impressionId,
        campaign_id: impression.campaign_id,
        ad_set_id: impression.ad_set_id,
        ad_id: impression.ad_id,
        advertiser_id: impression.advertiser_id,
        user_id: userId,
        created_at: new Date().toISOString(),
      })
    
    // Charge for CPC campaigns
    if (impression.bid_strategy === "cpc") {
      await supabase.rpc("increment_ad_spend", {
        p_campaign_id: impression.campaign_id,
        p_ad_set_id: impression.ad_set_id,
        p_amount_cents: impression.price_paid_cents,
      })
    }
  }
  
  return { success: true }
}

/**
 * Record ad conversion
 */
export async function recordAdConversion(
  impressionId: string,
  conversionType: string,
  conversionValue?: number
) {
  const supabase = await createClient()
  
  const { data: impression } = await supabase
    .from("ad_impressions")
    .select("*")
    .eq("id", impressionId)
    .single()
  
  if (impression) {
    await supabase
      .from("ad_conversions")
      .insert({
        impression_id: impressionId,
        campaign_id: impression.campaign_id,
        ad_set_id: impression.ad_set_id,
        ad_id: impression.ad_id,
        advertiser_id: impression.advertiser_id,
        conversion_type: conversionType,
        conversion_value_cents: conversionValue,
        created_at: new Date().toISOString(),
      })
  }
  
  return { success: true }
}

// ══════════════════════════════════════════
// AD SERVING COMPONENT
// ══════════════════════════════════════════

/**
 * Get ad for placement (simplified wrapper)
 */
export async function getAdForPlacement(
  placement: AuctionContext["placement"],
  options: Partial<AuctionContext> = {}
): Promise<AuctionResult> {
  const context: AuctionContext = {
    placement,
    ...options,
  }
  
  return runAdAuction(context)
}

/**
 * Pre-fetch multiple ads for feed
 */
export async function prefetchAdsForFeed(
  count: number,
  context: Partial<AuctionContext>
): Promise<AuctionResult[]> {
  const results: AuctionResult[] = []
  
  // Run multiple auctions in parallel
  const auctions = Array(count).fill(null).map(() => 
    runAdAuction({ placement: "clip_feed", ...context })
  )
  
  const settled = await Promise.allSettled(auctions)
  
  for (const result of settled) {
    if (result.status === "fulfilled" && result.value.winner) {
      results.push(result.value)
    }
  }
  
  return results
}

/**
 * Update quality score based on performance
 */
export async function updateAdQualityScore(adId: string) {
  const supabase = await createClient()
  
  // Get recent performance
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  
  const { data: impressions } = await supabase
    .from("ad_impressions")
    .select("id, clicked")
    .eq("ad_id", adId)
    .gte("created_at", thirtyDaysAgo)
  
  if (!impressions || impressions.length < 100) {
    // Not enough data, keep default score
    return
  }
  
  const totalImpressions = impressions.length
  const totalClicks = impressions.filter(i => i.clicked).length
  const ctr = totalClicks / totalImpressions
  
  // Calculate quality score (1-10 based on CTR percentile)
  // Assuming average CTR is 1%, scale accordingly
  let qualityScore = 5
  if (ctr >= 0.03) qualityScore = 10
  else if (ctr >= 0.025) qualityScore = 9
  else if (ctr >= 0.02) qualityScore = 8
  else if (ctr >= 0.015) qualityScore = 7
  else if (ctr >= 0.01) qualityScore = 6
  else if (ctr >= 0.007) qualityScore = 5
  else if (ctr >= 0.005) qualityScore = 4
  else if (ctr >= 0.003) qualityScore = 3
  else if (ctr >= 0.001) qualityScore = 2
  else qualityScore = 1
  
  await supabase
    .from("ads")
    .update({ 
      quality_score: qualityScore,
      updated_at: new Date().toISOString(),
    })
    .eq("id", adId)
}
