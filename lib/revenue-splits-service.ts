"use server"

import { createClient } from "@/lib/supabase/server"

// ═══════════════════════════════════════════════════════════════════════════════
// REVENUE SPLITS SERVICE
// Platform, Creator, Organizer Revenue Distribution
// ═══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════
// SPLIT CONFIGURATIONS
// ══════════════════════════════════════════

export const REVENUE_SPLIT_CONFIGS = {
  // Standard clip ad revenue
  clip_ad: {
    platform: 0.40,    // 40%
    creator: 0.60,     // 60%
  },
  
  // Stream ad revenue
  stream_ad: {
    platform: 0.45,    // 45%
    streamer: 0.55,    // 55%
  },
  
  // Tournament page ads
  tournament_ad: {
    platform: 0.40,    // 40%
    organizer: 0.40,   // 40%
    featured_players: 0.20, // 20% split among featured players
  },
  
  // Match page ads (feature match)
  feature_match_ad: {
    platform: 0.50,    // 50%
    organizer: 0.25,   // 25%
    caster: 0.10,      // 10%
    players: 0.15,     // 15% split between players
  },
  
  // Sponsorship revenue
  sponsorship: {
    platform: 0.30,    // 30%
    organizer: 0.50,   // 50%
    prize_pool: 0.20,  // 20% added to prize pool
  },
  
  // Subscription/tips
  creator_subscription: {
    platform: 0.20,    // 20%
    creator: 0.80,     // 80%
  },
}

// Payout settings
export const PAYOUT_CONFIG = {
  minimum_payout_cents: 5000, // $50 minimum
  payout_schedule: "weekly", // weekly, biweekly, monthly
  payout_methods: ["stripe", "paypal", "bank_transfer"],
  processing_fee_percent: 2.9,
  processing_fee_fixed_cents: 30,
}

// ══════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════

export interface RevenueEvent {
  id: string
  event_type: "ad_impression" | "ad_click" | "sponsorship" | "subscription" | "tip" | "tournament_entry"
  source_id: string // ad_id, sponsorship_id, etc.
  gross_amount_cents: number
  net_amount_cents: number // after platform fees
  split_config: keyof typeof REVENUE_SPLIT_CONFIGS
  context: {
    clip_id?: string
    match_id?: string
    tournament_id?: string
    stream_id?: string
    creator_id?: string
    organizer_id?: string
    caster_id?: string
    player_ids?: string[]
  }
  created_at: string
}

export interface CreatorEarning {
  id: string
  user_id: string
  revenue_event_id: string
  earning_type: "ad_revenue" | "sponsorship" | "subscription" | "tip" | "prize"
  gross_amount_cents: number
  platform_fee_cents: number
  net_amount_cents: number
  source_type: string
  source_id: string
  status: "pending" | "available" | "paid" | "cancelled"
  payout_id?: string
  created_at: string
}

export interface PayoutRequest {
  id: string
  user_id: string
  amount_cents: number
  fee_cents: number
  net_amount_cents: number
  method: "stripe" | "paypal" | "bank_transfer"
  status: "pending" | "processing" | "completed" | "failed"
  stripe_payout_id?: string
  created_at: string
  processed_at?: string
}

// ══════════════════════════════════════════
// REVENUE DISTRIBUTION
// ══════════════════════════════════════════

/**
 * Process revenue event and distribute to recipients
 */
export async function processRevenueEvent(event: RevenueEvent) {
  const supabase = await createClient()
  
  const splitConfig = REVENUE_SPLIT_CONFIGS[event.split_config]
  if (!splitConfig) {
    throw new Error(`Unknown split config: ${event.split_config}`)
  }
  
  const distributions: {
    user_id: string
    role: string
    amount_cents: number
  }[] = []
  
  // Calculate distributions based on config
  switch (event.split_config) {
    case "clip_ad": {
      if (event.context.creator_id) {
        distributions.push({
          user_id: event.context.creator_id,
          role: "creator",
          amount_cents: Math.floor(event.net_amount_cents * splitConfig.creator),
        })
      }
      break
    }
    
    case "stream_ad": {
      if (event.context.creator_id) {
        distributions.push({
          user_id: event.context.creator_id,
          role: "streamer",
          amount_cents: Math.floor(event.net_amount_cents * splitConfig.streamer),
        })
      }
      break
    }
    
    case "tournament_ad": {
      if (event.context.organizer_id) {
        distributions.push({
          user_id: event.context.organizer_id,
          role: "organizer",
          amount_cents: Math.floor(event.net_amount_cents * splitConfig.organizer),
        })
      }
      
      // Split among featured players
      if (event.context.player_ids?.length) {
        const perPlayerAmount = Math.floor(
          (event.net_amount_cents * splitConfig.featured_players) / event.context.player_ids.length
        )
        for (const playerId of event.context.player_ids) {
          distributions.push({
            user_id: playerId,
            role: "featured_player",
            amount_cents: perPlayerAmount,
          })
        }
      }
      break
    }
    
    case "feature_match_ad": {
      if (event.context.organizer_id) {
        distributions.push({
          user_id: event.context.organizer_id,
          role: "organizer",
          amount_cents: Math.floor(event.net_amount_cents * splitConfig.organizer),
        })
      }
      
      if (event.context.caster_id) {
        distributions.push({
          user_id: event.context.caster_id,
          role: "caster",
          amount_cents: Math.floor(event.net_amount_cents * splitConfig.caster),
        })
      }
      
      // Split among players
      if (event.context.player_ids?.length) {
        const perPlayerAmount = Math.floor(
          (event.net_amount_cents * splitConfig.players) / event.context.player_ids.length
        )
        for (const playerId of event.context.player_ids) {
          distributions.push({
            user_id: playerId,
            role: "player",
            amount_cents: perPlayerAmount,
          })
        }
      }
      break
    }
    
    case "sponsorship": {
      if (event.context.organizer_id) {
        distributions.push({
          user_id: event.context.organizer_id,
          role: "organizer",
          amount_cents: Math.floor(event.net_amount_cents * splitConfig.organizer),
        })
      }
      // Prize pool portion handled separately
      break
    }
    
    case "creator_subscription": {
      if (event.context.creator_id) {
        distributions.push({
          user_id: event.context.creator_id,
          role: "creator",
          amount_cents: Math.floor(event.net_amount_cents * splitConfig.creator),
        })
      }
      break
    }
  }
  
  // Create earnings records
  for (const dist of distributions) {
    await createEarning({
      user_id: dist.user_id,
      revenue_event_id: event.id,
      earning_type: event.event_type === "ad_impression" || event.event_type === "ad_click" 
        ? "ad_revenue" 
        : event.event_type,
      gross_amount_cents: dist.amount_cents,
      platform_fee_cents: 0, // Already deducted
      net_amount_cents: dist.amount_cents,
      source_type: event.split_config,
      source_id: event.source_id,
    })
  }
  
  // Calculate and record platform revenue
  const totalDistributed = distributions.reduce((sum, d) => sum + d.amount_cents, 0)
  const platformRevenue = event.net_amount_cents - totalDistributed
  
  await supabase
    .from("platform_revenue")
    .insert({
      revenue_event_id: event.id,
      amount_cents: platformRevenue,
      source_type: event.split_config,
      created_at: new Date().toISOString(),
    })
  
  return { distributions, platformRevenue }
}

/**
 * Process ad revenue from impressions
 */
export async function processAdRevenue(
  impressionId: string,
  pricePaidCents: number,
  context: RevenueEvent["context"]
) {
  // Determine split config based on context
  let splitConfig: keyof typeof REVENUE_SPLIT_CONFIGS = "clip_ad"
  
  if (context.match_id) {
    splitConfig = "feature_match_ad"
  } else if (context.tournament_id && !context.clip_id) {
    splitConfig = "tournament_ad"
  } else if (context.stream_id) {
    splitConfig = "stream_ad"
  }
  
  const event: RevenueEvent = {
    id: impressionId,
    event_type: "ad_impression",
    source_id: impressionId,
    gross_amount_cents: pricePaidCents,
    net_amount_cents: pricePaidCents, // Platform fee already in split
    split_config: splitConfig,
    context,
    created_at: new Date().toISOString(),
  }
  
  return processRevenueEvent(event)
}

// ══════════════════════════════════════════
// CREATOR EARNINGS
// ══════════════════════════════════════════

/**
 * Create an earning record
 */
async function createEarning(data: Omit<CreatorEarning, "id" | "status" | "created_at">) {
  const supabase = await createClient()
  
  const { data: earning, error } = await supabase
    .from("creator_earnings")
    .insert({
      ...data,
      status: "available",
      created_at: new Date().toISOString(),
    })
    .select()
    .single()
  
  if (error) {
    console.error("Failed to create earning:", error)
    throw error
  }
  
  // Update user's wallet balance
  await updateWalletBalance(data.user_id, data.net_amount_cents)
  
  return earning
}

/**
 * Update user's wallet balance
 */
async function updateWalletBalance(userId: string, amountCents: number) {
  const supabase = await createClient()
  
  // Upsert wallet
  const { data: wallet } = await supabase
    .from("player_wallets")
    .select("*")
    .eq("player_id", userId)
    .single()
  
  if (wallet) {
    await supabase
      .from("player_wallets")
      .update({
        available_balance_cents: wallet.available_balance_cents + amountCents,
        lifetime_earnings_cents: wallet.lifetime_earnings_cents + amountCents,
        updated_at: new Date().toISOString(),
      })
      .eq("player_id", userId)
  } else {
    await supabase
      .from("player_wallets")
      .insert({
        player_id: userId,
        available_balance_cents: amountCents,
        pending_balance_cents: 0,
        lifetime_earnings_cents: amountCents,
        created_at: new Date().toISOString(),
      })
  }
}

/**
 * Get creator's earnings history
 */
export async function getCreatorEarnings(
  userId: string,
  options: {
    limit?: number
    offset?: number
    startDate?: string
    endDate?: string
    type?: string
  } = {}
) {
  const supabase = await createClient()
  const { limit = 50, offset = 0, startDate, endDate, type } = options
  
  let query = supabase
    .from("creator_earnings")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)
  
  if (startDate) {
    query = query.gte("created_at", startDate)
  }
  if (endDate) {
    query = query.lte("created_at", endDate)
  }
  if (type) {
    query = query.eq("earning_type", type)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error("Failed to fetch earnings:", error)
    return []
  }
  
  return data || []
}

/**
 * Get earnings summary for dashboard
 */
export async function getEarningsSummary(userId: string) {
  const supabase = await createClient()
  
  const now = new Date()
  const today = now.toISOString().split("T")[0]
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()
  
  // Get wallet
  const { data: wallet } = await supabase
    .from("player_wallets")
    .select("*")
    .eq("player_id", userId)
    .single()
  
  // Get this month's earnings
  const { data: thisMonthEarnings } = await supabase
    .from("creator_earnings")
    .select("net_amount_cents")
    .eq("user_id", userId)
    .gte("created_at", thisMonth)
  
  // Get last month's earnings
  const { data: lastMonthEarnings } = await supabase
    .from("creator_earnings")
    .select("net_amount_cents")
    .eq("user_id", userId)
    .gte("created_at", lastMonth)
    .lt("created_at", thisMonth)
  
  // Get today's earnings
  const { data: todayEarnings } = await supabase
    .from("creator_earnings")
    .select("net_amount_cents")
    .eq("user_id", userId)
    .gte("created_at", today)
  
  // Get earnings by type
  const { data: byType } = await supabase
    .from("creator_earnings")
    .select("earning_type, net_amount_cents")
    .eq("user_id", userId)
    .gte("created_at", thisMonth)
  
  const earningsByType: Record<string, number> = {}
  for (const e of byType || []) {
    earningsByType[e.earning_type] = (earningsByType[e.earning_type] || 0) + e.net_amount_cents
  }
  
  const thisMonthTotal = (thisMonthEarnings || []).reduce((sum, e) => sum + e.net_amount_cents, 0)
  const lastMonthTotal = (lastMonthEarnings || []).reduce((sum, e) => sum + e.net_amount_cents, 0)
  const todayTotal = (todayEarnings || []).reduce((sum, e) => sum + e.net_amount_cents, 0)
  
  return {
    available_balance_cents: wallet?.available_balance_cents || 0,
    pending_balance_cents: wallet?.pending_balance_cents || 0,
    lifetime_earnings_cents: wallet?.lifetime_earnings_cents || 0,
    this_month_cents: thisMonthTotal,
    last_month_cents: lastMonthTotal,
    today_cents: todayTotal,
    month_over_month_change: lastMonthTotal > 0 
      ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 
      : 0,
    earnings_by_type: earningsByType,
    payout_eligible: (wallet?.available_balance_cents || 0) >= PAYOUT_CONFIG.minimum_payout_cents,
    minimum_payout_cents: PAYOUT_CONFIG.minimum_payout_cents,
  }
}

// ══════════════════════════════════════════
// PAYOUTS
// ══════════════════════════════════════════

/**
 * Request a payout
 */
export async function requestPayout(
  userId: string,
  amountCents: number,
  method: PayoutRequest["method"]
) {
  const supabase = await createClient()
  
  // Verify balance
  const { data: wallet } = await supabase
    .from("player_wallets")
    .select("*")
    .eq("player_id", userId)
    .single()
  
  if (!wallet || wallet.available_balance_cents < amountCents) {
    return { error: "Insufficient balance" }
  }
  
  if (amountCents < PAYOUT_CONFIG.minimum_payout_cents) {
    return { error: `Minimum payout is $${PAYOUT_CONFIG.minimum_payout_cents / 100}` }
  }
  
  // Calculate fees
  const processingFee = Math.ceil(
    (amountCents * PAYOUT_CONFIG.processing_fee_percent / 100) + 
    PAYOUT_CONFIG.processing_fee_fixed_cents
  )
  const netAmount = amountCents - processingFee
  
  // Create payout request
  const { data: payout, error } = await supabase
    .from("payout_requests")
    .insert({
      user_id: userId,
      amount_cents: amountCents,
      fee_cents: processingFee,
      net_amount_cents: netAmount,
      method,
      status: "pending",
      created_at: new Date().toISOString(),
    })
    .select()
    .single()
  
  if (error) {
    console.error("Failed to create payout request:", error)
    return { error: "Failed to create payout request" }
  }
  
  // Move balance from available to pending
  await supabase
    .from("player_wallets")
    .update({
      available_balance_cents: wallet.available_balance_cents - amountCents,
      pending_balance_cents: wallet.pending_balance_cents + amountCents,
      updated_at: new Date().toISOString(),
    })
    .eq("player_id", userId)
  
  // Mark earnings as pending payout
  await supabase
    .from("creator_earnings")
    .update({ status: "pending", payout_id: payout.id })
    .eq("user_id", userId)
    .eq("status", "available")
    .lte("net_amount_cents", amountCents)
  
  return { payout }
}

/**
 * Process payout (admin function)
 */
export async function processPayout(payoutId: string) {
  const supabase = await createClient()
  
  const { data: payout } = await supabase
    .from("payout_requests")
    .select("*")
    .eq("id", payoutId)
    .single()
  
  if (!payout || payout.status !== "pending") {
    return { error: "Invalid payout request" }
  }
  
  // Update to processing
  await supabase
    .from("payout_requests")
    .update({ status: "processing" })
    .eq("id", payoutId)
  
  // Here you would integrate with Stripe Connect or PayPal
  // For now, we'll simulate success
  
  // Mark as completed
  await supabase
    .from("payout_requests")
    .update({
      status: "completed",
      processed_at: new Date().toISOString(),
    })
    .eq("id", payoutId)
  
  // Update wallet
  const { data: wallet } = await supabase
    .from("player_wallets")
    .select("*")
    .eq("player_id", payout.user_id)
    .single()
  
  if (wallet) {
    await supabase
      .from("player_wallets")
      .update({
        pending_balance_cents: wallet.pending_balance_cents - payout.amount_cents,
        total_withdrawn_cents: (wallet.total_withdrawn_cents || 0) + payout.amount_cents,
        updated_at: new Date().toISOString(),
      })
      .eq("player_id", payout.user_id)
  }
  
  // Mark earnings as paid
  await supabase
    .from("creator_earnings")
    .update({ status: "paid" })
    .eq("payout_id", payoutId)
  
  return { success: true }
}

/**
 * Get payout history
 */
export async function getPayoutHistory(userId: string, limit: number = 20) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("payout_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error("Failed to fetch payout history:", error)
    return []
  }
  
  return data || []
}

// ══════════════════════════════════════════
// ANALYTICS
// ══════════════════════════════════════════

/**
 * Get platform revenue analytics
 */
export async function getPlatformRevenueAnalytics(dateRange: { start: string; end: string }) {
  const supabase = await createClient()
  
  const { data: revenue } = await supabase
    .from("platform_revenue")
    .select("amount_cents, source_type, created_at")
    .gte("created_at", dateRange.start)
    .lte("created_at", dateRange.end)
  
  const bySource: Record<string, number> = {}
  const byDay: Record<string, number> = {}
  let total = 0
  
  for (const r of revenue || []) {
    bySource[r.source_type] = (bySource[r.source_type] || 0) + r.amount_cents
    const day = r.created_at.split("T")[0]
    byDay[day] = (byDay[day] || 0) + r.amount_cents
    total += r.amount_cents
  }
  
  return {
    total_cents: total,
    by_source: bySource,
    by_day: Object.entries(byDay).map(([date, amount]) => ({ date, amount })),
  }
}
