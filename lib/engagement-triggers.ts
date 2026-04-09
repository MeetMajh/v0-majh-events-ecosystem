"use server"

import { createClient } from "@/lib/supabase/server"
import { createNotification, NotificationType } from "@/lib/notification-actions"

// ==========================================
// ENGAGEMENT TRIGGERS
// These fire notifications to re-engage users
// ==========================================

export type EngagementEvent =
  | "clip_viewed"
  | "clip_liked"
  | "clip_shared"
  | "player_followed"
  | "match_started"
  | "match_ended"
  | "tournament_starting_soon"
  | "followed_player_posted"
  | "clip_trending"
  | "milestone_reached"

interface TriggerContext {
  userId?: string
  clipId?: string
  playerId?: string
  matchId?: string
  tournamentId?: string
  metadata?: Record<string, any>
}

/**
 * Process engagement events and trigger appropriate notifications
 */
export async function processEngagementEvent(
  event: EngagementEvent,
  context: TriggerContext
): Promise<void> {
  const supabase = await createClient()

  switch (event) {
    case "player_followed":
      await handlePlayerFollowed(supabase, context)
      break
    case "clip_trending":
      await handleClipTrending(supabase, context)
      break
    case "followed_player_posted":
      await handleFollowedPlayerPosted(supabase, context)
      break
    case "match_started":
      await handleMatchStarted(supabase, context)
      break
    case "tournament_starting_soon":
      await handleTournamentStartingSoon(supabase, context)
      break
    case "milestone_reached":
      await handleMilestoneReached(supabase, context)
      break
  }
}

/**
 * Notify a player when someone follows them
 */
async function handlePlayerFollowed(supabase: any, context: TriggerContext) {
  if (!context.playerId || !context.userId) return

  // Get follower info
  const { data: follower } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", context.userId)
    .single()

  // Get player's user ID
  const { data: player } = await supabase
    .from("players")
    .select("user_id, first_name")
    .eq("id", context.playerId)
    .single()

  if (!player?.user_id) return

  const followerName = follower?.first_name || "Someone"

  await createNotification({
    userId: player.user_id,
    type: "system" as NotificationType,
    title: "New Follower!",
    body: `${followerName} started following you`,
    link: `/esports/players/${context.playerId}/followers`,
    priority: "normal",
  })
}

/**
 * Notify clip owner when their clip is trending
 */
async function handleClipTrending(supabase: any, context: TriggerContext) {
  if (!context.clipId) return

  // Get clip and creator info
  const { data: clip } = await supabase
    .from("player_media")
    .select(`
      id,
      title,
      player_id,
      players:player_id (
        user_id,
        first_name
      )
    `)
    .eq("id", context.clipId)
    .single()

  if (!clip?.players?.user_id) return

  await createNotification({
    userId: clip.players.user_id,
    type: "achievement_earned" as NotificationType,
    title: "Your clip is trending!",
    body: `"${clip.title}" is getting a lot of views`,
    link: `/media/${context.clipId}`,
    priority: "high",
  })
}

/**
 * Notify followers when a player posts new content
 */
async function handleFollowedPlayerPosted(supabase: any, context: TriggerContext) {
  if (!context.playerId || !context.clipId) return

  // Get player info
  const { data: player } = await supabase
    .from("players")
    .select("first_name, last_name")
    .eq("id", context.playerId)
    .single()

  // Get clip info
  const { data: clip } = await supabase
    .from("player_media")
    .select("title")
    .eq("id", context.clipId)
    .single()

  // Get all followers
  const { data: followers } = await supabase
    .from("player_follows")
    .select("follower_id")
    .eq("followed_id", context.playerId)

  if (!followers?.length) return

  const playerName = player?.first_name || "A player you follow"

  // Create notifications for all followers (batch)
  const notifications = followers.map((f: any) => ({
    user_id: f.follower_id,
    type: "followed_player_live",
    title: `${playerName} posted a new clip`,
    body: clip?.title || "Check it out!",
    link: `/media/${context.clipId}`,
    player_id: context.playerId,
    priority: "normal",
    is_read: false,
    is_dismissed: false,
  }))

  await supabase.from("notifications").insert(notifications)
}

/**
 * Notify registered players when their match starts
 */
async function handleMatchStarted(supabase: any, context: TriggerContext) {
  if (!context.matchId) return

  // Get match details with players
  const { data: match } = await supabase
    .from("matches")
    .select(`
      id,
      round,
      table_number,
      tournament_id,
      player1_id,
      player2_id,
      tournaments:tournament_id (
        name
      ),
      player1:player1_id (
        user_id,
        first_name
      ),
      player2:player2_id (
        user_id,
        first_name
      )
    `)
    .eq("id", context.matchId)
    .single()

  if (!match) return

  const notifications = []

  // Notify player 1
  if (match.player1?.user_id) {
    notifications.push({
      user_id: match.player1.user_id,
      type: "match_ready",
      title: "Your match is ready!",
      body: `Round ${match.round} vs ${match.player2?.first_name || "opponent"} - Table ${match.table_number}`,
      link: `/esports/tournaments/${match.tournament_id}/matches/${match.id}`,
      match_id: context.matchId,
      tournament_id: match.tournament_id,
      priority: "urgent",
      is_read: false,
      is_dismissed: false,
    })
  }

  // Notify player 2
  if (match.player2?.user_id) {
    notifications.push({
      user_id: match.player2.user_id,
      type: "match_ready",
      title: "Your match is ready!",
      body: `Round ${match.round} vs ${match.player1?.first_name || "opponent"} - Table ${match.table_number}`,
      link: `/esports/tournaments/${match.tournament_id}/matches/${match.id}`,
      match_id: context.matchId,
      tournament_id: match.tournament_id,
      priority: "urgent",
      is_read: false,
      is_dismissed: false,
    })
  }

  if (notifications.length > 0) {
    await supabase.from("notifications").insert(notifications)
  }
}

/**
 * Notify registered players when tournament is starting soon
 */
async function handleTournamentStartingSoon(supabase: any, context: TriggerContext) {
  if (!context.tournamentId) return

  // Get tournament and registered players
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, start_date")
    .eq("id", context.tournamentId)
    .single()

  const { data: registrations } = await supabase
    .from("tournament_registrations")
    .select(`
      player_id,
      players:player_id (
        user_id
      )
    `)
    .eq("tournament_id", context.tournamentId)
    .eq("status", "confirmed")

  if (!registrations?.length) return

  const minutesUntilStart = context.metadata?.minutesUntilStart || 15

  const notifications = registrations
    .filter((r: any) => r.players?.user_id)
    .map((r: any) => ({
      user_id: r.players.user_id,
      type: "tournament_starting",
      title: `${tournament?.name} starts in ${minutesUntilStart} minutes!`,
      body: "Head to the tournament area",
      link: `/esports/tournaments/${context.tournamentId}`,
      tournament_id: context.tournamentId,
      priority: "high",
      is_read: false,
      is_dismissed: false,
    }))

  if (notifications.length > 0) {
    await supabase.from("notifications").insert(notifications)
  }
}

/**
 * Notify user when they reach a milestone
 */
async function handleMilestoneReached(supabase: any, context: TriggerContext) {
  if (!context.userId) return

  const milestone = context.metadata?.milestone
  const milestoneMessages: Record<string, { title: string; body: string }> = {
    first_clip: {
      title: "First clip posted!",
      body: "Your content journey has begun",
    },
    ten_followers: {
      title: "10 followers!",
      body: "Your audience is growing",
    },
    hundred_followers: {
      title: "100 followers!",
      body: "You're becoming popular",
    },
    thousand_views: {
      title: "1,000 views!",
      body: "Your clips are getting noticed",
    },
    first_tournament_win: {
      title: "First tournament win!",
      body: "Congratulations on your victory",
    },
    ten_tournament_wins: {
      title: "10 tournament wins!",
      body: "You're a champion",
    },
  }

  const message = milestoneMessages[milestone]
  if (!message) return

  await createNotification({
    userId: context.userId,
    type: "achievement_earned" as NotificationType,
    title: message.title,
    body: message.body,
    link: "/dashboard/profile",
    priority: "normal",
  })
}

/**
 * Check for dormant users and send re-engagement notifications
 */
export async function checkDormantUsers(): Promise<void> {
  const supabase = await createClient()

  // Find users who haven't been active in 3+ days
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  const { data: dormantUsers } = await supabase
    .from("profiles")
    .select("id, first_name")
    .lt("last_active_at", threeDaysAgo)
    .limit(100)

  if (!dormantUsers?.length) return

  // Get trending content to feature
  const { data: trendingClips } = await supabase
    .from("player_media")
    .select("id, title")
    .eq("status", "published")
    .order("view_count", { ascending: false })
    .limit(1)

  const trendingClip = trendingClips?.[0]

  const notifications = dormantUsers.map((user: any) => ({
    user_id: user.id,
    type: "system",
    title: "We miss you!",
    body: trendingClip 
      ? `Check out "${trendingClip.title}" - it's trending!`
      : "See what's happening in the community",
    link: trendingClip ? `/media/${trendingClip.id}` : "/clips",
    priority: "low",
    is_read: false,
    is_dismissed: false,
  }))

  await supabase.from("notifications").insert(notifications)
}

/**
 * Trigger notifications for live content to relevant users
 */
export async function notifyRelevantUsersOfLiveContent(
  matchId: string,
  gameId: string,
  tournamentId?: string
): Promise<void> {
  const supabase = await createClient()

  // Find users interested in this game
  const { data: interestedUsers } = await supabase
    .from("user_preferences")
    .select("user_id")
    .contains("games", [gameId])
    .limit(500)

  if (!interestedUsers?.length) return

  // Get match details
  const { data: match } = await supabase
    .from("matches")
    .select(`
      id,
      player1:player1_id (first_name),
      player2:player2_id (first_name),
      tournaments:tournament_id (name)
    `)
    .eq("id", matchId)
    .single()

  if (!match) return

  const title = `Live: ${match.player1?.first_name || "Player 1"} vs ${match.player2?.first_name || "Player 2"}`
  const body = match.tournaments?.name || "Watch now!"

  const notifications = interestedUsers.map((u: any) => ({
    user_id: u.user_id,
    type: "trending_match",
    title,
    body,
    link: `/live?match=${matchId}`,
    match_id: matchId,
    tournament_id: tournamentId,
    priority: "normal",
    is_read: false,
    is_dismissed: false,
  }))

  // Insert in batches to avoid timeout
  const batchSize = 100
  for (let i = 0; i < notifications.length; i += batchSize) {
    const batch = notifications.slice(i, i + batchSize)
    await supabase.from("notifications").insert(batch)
  }
}
