"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// ==========================================
// NOTIFICATION TYPES
// ==========================================

export type NotificationType =
  | "match_ready"
  | "match_starting"
  | "match_result"
  | "tournament_starting"
  | "round_starting"
  | "followed_player_live"
  | "followed_player_match"
  | "trending_match"
  | "achievement_earned"
  | "staff_alert"
  | "system"

export type NotificationPriority = "low" | "normal" | "high" | "urgent"

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  match_id: string | null
  tournament_id: string | null
  player_id: string | null
  is_read: boolean
  read_at: string | null
  is_dismissed: boolean
  icon: string | null
  priority: NotificationPriority
  created_at: string
  expires_at: string | null
}

export interface NotificationPreferences {
  match_ready: boolean
  match_starting: boolean
  match_result: boolean
  tournament_starting: boolean
  round_starting: boolean
  followed_player_live: boolean
  followed_player_match: boolean
  trending_match: boolean
  achievement_earned: boolean
  staff_alert: boolean
  in_app: boolean
  email: boolean
  push: boolean
  quiet_hours_enabled: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
}

// ==========================================
// GET NOTIFICATIONS
// ==========================================

export async function getNotifications(options?: {
  limit?: number
  unreadOnly?: boolean
  type?: NotificationType
}): Promise<Notification[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_dismissed", false)
    .order("created_at", { ascending: false })

  if (options?.unreadOnly) {
    query = query.eq("is_read", false)
  }

  if (options?.type) {
    query = query.eq("type", options.type)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data } = await query

  return (data || []) as Notification[]
}

// Get unread count
export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return 0

  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false)
    .eq("is_dismissed", false)

  return count || 0
}

// ==========================================
// MARK NOTIFICATIONS
// ==========================================

export async function markAsRead(notificationId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("notifications")
    .update({ 
      is_read: true, 
      read_at: new Date().toISOString() 
    })
    .eq("id", notificationId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function markAllAsRead(): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("notifications")
    .update({ 
      is_read: true, 
      read_at: new Date().toISOString() 
    })
    .eq("user_id", user.id)
    .eq("is_read", false)

  if (error) return { error: error.message }
  
  revalidatePath("/")
  return { success: true }
}

export async function dismissNotification(notificationId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("notifications")
    .update({ is_dismissed: true })
    .eq("id", notificationId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function clearAllNotifications(): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("notifications")
    .update({ is_dismissed: true })
    .eq("user_id", user.id)

  if (error) return { error: error.message }
  
  revalidatePath("/")
  return { success: true }
}

// ==========================================
// CREATE NOTIFICATIONS
// ==========================================

export async function createNotification(params: {
  userId: string
  type: NotificationType
  title: string
  body?: string
  link?: string
  matchId?: string
  tournamentId?: string
  playerId?: string
  icon?: string
  priority?: NotificationPriority
}): Promise<{ success?: boolean; id?: string; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body || null,
      link: params.link || null,
      match_id: params.matchId || null,
      tournament_id: params.tournamentId || null,
      player_id: params.playerId || null,
      icon: params.icon || null,
      priority: params.priority || "normal",
    })
    .select("id")
    .single()

  if (error) return { error: error.message }
  return { success: true, id: data.id }
}

// Notify match players
export async function notifyMatchPlayers(
  matchId: string,
  type: NotificationType,
  title: string,
  body?: string
): Promise<{ success?: boolean; count?: number; error?: string }> {
  const supabase = await createClient()

  const { data: match } = await supabase
    .from("tournament_matches")
    .select("player1_id, player2_id")
    .eq("id", matchId)
    .single()

  if (!match) return { error: "Match not found" }

  let count = 0
  const link = `/match/${matchId}/watch`

  if (match.player1_id) {
    const result = await createNotification({
      userId: match.player1_id,
      type,
      title,
      body,
      link,
      matchId,
    })
    if (result.success) count++
  }

  if (match.player2_id) {
    const result = await createNotification({
      userId: match.player2_id,
      type,
      title,
      body,
      link,
      matchId,
    })
    if (result.success) count++
  }

  return { success: true, count }
}

// Notify player followers
export async function notifyPlayerFollowers(
  playerId: string,
  type: NotificationType,
  title: string,
  body?: string,
  link?: string,
  matchId?: string
): Promise<{ success?: boolean; count?: number; error?: string }> {
  const supabase = await createClient()

  const { data: follows } = await supabase
    .from("player_follows")
    .select("follower_id")
    .eq("player_id", playerId)

  if (!follows || follows.length === 0) return { success: true, count: 0 }

  let count = 0

  for (const follow of follows) {
    const result = await createNotification({
      userId: follow.follower_id,
      type,
      title,
      body,
      link,
      playerId,
      matchId,
    })
    if (result.success) count++
  }

  return { success: true, count }
}

// Notify tournament participants
export async function notifyTournamentParticipants(
  tournamentId: string,
  type: NotificationType,
  title: string,
  body?: string,
  link?: string
): Promise<{ success?: boolean; count?: number; error?: string }> {
  const supabase = await createClient()

  const { data: participants } = await supabase
    .from("tournament_participants")
    .select("user_id")
    .eq("tournament_id", tournamentId)
    .eq("status", "registered")

  if (!participants || participants.length === 0) return { success: true, count: 0 }

  let count = 0

  for (const participant of participants) {
    const result = await createNotification({
      userId: participant.user_id,
      type,
      title,
      body,
      link: link || `/esports/tournaments/${tournamentId}`,
      tournamentId,
    })
    if (result.success) count++
  }

  return { success: true, count }
}

// ==========================================
// NOTIFICATION PREFERENCES
// ==========================================

export async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  const { data } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (!data) {
    // Create default preferences
    const { data: newPrefs } = await supabase
      .from("notification_preferences")
      .insert({ user_id: user.id })
      .select("*")
      .single()
    
    return newPrefs as NotificationPreferences | null
  }

  return data as NotificationPreferences
}

export async function updateNotificationPreferences(
  preferences: Partial<NotificationPreferences>
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("notification_preferences")
    .upsert({
      user_id: user.id,
      ...preferences,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })

  if (error) return { error: error.message }
  return { success: true }
}

// ==========================================
// SPECIFIC NOTIFICATION HELPERS
// ==========================================

// Match is ready to play
export async function notifyMatchReady(matchId: string) {
  return notifyMatchPlayers(
    matchId,
    "match_ready",
    "Your match is ready!",
    "Head to your table and report when ready"
  )
}

// Round starting
export async function notifyRoundStarting(tournamentId: string, roundNumber: number) {
  const supabase = await createClient()
  
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("name, slug")
    .eq("id", tournamentId)
    .single()

  return notifyTournamentParticipants(
    tournamentId,
    "round_starting",
    `Round ${roundNumber} Starting`,
    `${tournament?.name || "Tournament"} - Round ${roundNumber} pairings are up!`,
    `/esports/tournaments/${tournament?.slug || tournamentId}`
  )
}

// Player went live
export async function notifyPlayerLive(playerId: string, matchId: string) {
  const supabase = await createClient()
  
  const { data: player } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", playerId)
    .single()

  const playerName = player ? `${player.first_name || ""} ${player.last_name || ""}`.trim() : "A player"

  return notifyPlayerFollowers(
    playerId,
    "followed_player_live",
    `${playerName} is live!`,
    "Watch their match now",
    `/match/${matchId}/watch`,
    matchId
  )
}

// New clip uploaded - notify followers
export async function notifyNewClip(playerId: string, clipId: string, clipTitle: string) {
  const supabase = await createClient()
  
  const { data: player } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", playerId)
    .single()

  const playerName = player ? `${player.first_name || ""} ${player.last_name || ""}`.trim() : "A player"

  return notifyPlayerFollowers(
    playerId,
    "followed_player_match", // Reusing existing type
    `${playerName} uploaded a new clip`,
    clipTitle,
    `/media/${clipId}`
  )
}

// Trending match alert
export async function notifyTrendingMatch(matchId: string, userIds: string[]) {
  const supabase = await createClient()
  
  const { data: match } = await supabase
    .from("tournament_matches")
    .select(`
      id,
      player1:profiles!tournament_matches_player1_id_fkey(first_name, last_name),
      player2:profiles!tournament_matches_player2_id_fkey(first_name, last_name)
    `)
    .eq("id", matchId)
    .single()

  const p1Name = match?.player1 ? `${(match.player1 as any).first_name || ""} ${(match.player1 as any).last_name || ""}`.trim() : "Player 1"
  const p2Name = match?.player2 ? `${(match.player2 as any).first_name || ""} ${(match.player2 as any).last_name || ""}`.trim() : "Player 2"

  let count = 0
  for (const userId of userIds) {
    const result = await createNotification({
      userId,
      type: "trending_match",
      title: "Match is trending!",
      body: `${p1Name} vs ${p2Name} is heating up`,
      link: `/match/${matchId}/watch`,
      matchId,
      icon: "flame",
      priority: "normal",
    })
    if (result.success) count++
  }

  return { success: true, count }
}
