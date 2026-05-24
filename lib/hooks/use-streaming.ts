"use client"

import useSWR from "swr"
import useSWRMutation from "swr/mutation"
import type {
  StreamRoom,
  PlayerStream,
  BroadcastSession,
  StreamClip,
  StreamVOD,
  LiveEvent,
} from "@/lib/streaming-actions"

// ═══════════════════════════════════════════════════════════════════════════════
// STREAMING HOOKS
// SWR-based hooks for real-time streaming data
// ═══════════════════════════════════════════════════════════════════════════════

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch")
  return res.json()
}

const postFetcher = async (url: string, { arg }: { arg: Record<string, unknown> }) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  })
  if (!res.ok) throw new Error("Failed to post")
  return res.json()
}

// ─────────────────────────────────────────────────────────────────────────────
// STREAM ROOMS
// ─────────────────────────────────────────────────────────────────────────────

interface StreamRoomData {
  room: StreamRoom
  streams: PlayerStream[]
}

/**
 * Get a stream room by room code
 */
export function useStreamRoom(roomCode: string | null) {
  return useSWR<{ data: StreamRoomData }>(
    roomCode ? `/api/streaming/rooms?code=${roomCode}` : null,
    fetcher,
    {
      refreshInterval: 5000, // Refresh every 5 seconds
      revalidateOnFocus: true,
    }
  )
}

/**
 * Get all live stream rooms
 */
export function useLiveStreamRooms(tenantId?: string) {
  const params = new URLSearchParams({ live: "true" })
  if (tenantId) params.set("tenantId", tenantId)
  
  return useSWR<{ data: StreamRoomData[] }>(
    `/api/streaming/rooms?${params}`,
    fetcher,
    {
      refreshInterval: 10000, // Refresh every 10 seconds
    }
  )
}

/**
 * Get tournament stream rooms
 */
export function useTournamentStreamRooms(tournamentId: string | null) {
  return useSWR<{ data: StreamRoomData[] }>(
    tournamentId ? `/api/streaming/rooms?tournamentId=${tournamentId}` : null,
    fetcher,
    {
      refreshInterval: 5000,
    }
  )
}

/**
 * Create a stream room
 */
export function useCreateStreamRoom() {
  return useSWRMutation("/api/streaming/rooms", postFetcher)
}

/**
 * Join a stream room
 */
export function useJoinStreamRoom(roomId: string | null) {
  return useSWRMutation(
    roomId ? `/api/streaming/rooms/${roomId}/join` : null,
    postFetcher
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BROADCAST SESSIONS
// ─────────────────────────────────────────────────────────────────────────────

interface BroadcastSessionData {
  session: BroadcastSession
  sources: unknown[]
  scenes: Array<{
    scene: unknown
    items: Array<{
      item: unknown
      source: unknown
    }>
  }>
  outputs: unknown[]
}

/**
 * Get broadcast session details
 */
export function useBroadcastSession(sessionId: string | null) {
  return useSWR<{ data: BroadcastSessionData }>(
    sessionId ? `/api/streaming/broadcast?sessionId=${sessionId}` : null,
    fetcher,
    {
      refreshInterval: 3000, // Fast refresh for production
    }
  )
}

/**
 * Broadcast actions (create, start, end, etc.)
 */
export function useBroadcastActions() {
  return useSWRMutation("/api/streaming/broadcast", postFetcher)
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIPS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get trending clips
 */
export function useTrendingClips(limit = 20, tournamentId?: string) {
  const params = new URLSearchParams({ trending: "true", limit: String(limit) })
  if (tournamentId) params.set("tournamentId", tournamentId)
  
  return useSWR<{ data: StreamClip[] }>(
    `/api/streaming/clips?${params}`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
    }
  )
}

/**
 * Get clips for a tournament/match
 */
export function useClips(filters?: {
  tournamentId?: string
  matchId?: string
  featured?: boolean
  limit?: number
}) {
  const params = new URLSearchParams()
  if (filters?.tournamentId) params.set("tournamentId", filters.tournamentId)
  if (filters?.matchId) params.set("matchId", filters.matchId)
  if (filters?.featured) params.set("featured", "true")
  if (filters?.limit) params.set("limit", String(filters.limit))
  
  return useSWR<{ data: StreamClip[] }>(
    `/api/streaming/clips?${params}`,
    fetcher
  )
}

/**
 * Create a clip
 */
export function useCreateClip() {
  return useSWRMutation("/api/streaming/clips", postFetcher)
}

// ─────────────────────────────────────────────────────────────────────────────
// VODs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get VODs
 */
export function useVODs(filters?: {
  tournamentId?: string
  featured?: boolean
  limit?: number
}) {
  const params = new URLSearchParams()
  if (filters?.tournamentId) params.set("tournamentId", filters.tournamentId)
  if (filters?.featured) params.set("featured", "true")
  if (filters?.limit) params.set("limit", String(filters.limit))
  
  return useSWR<{ data: StreamVOD[] }>(
    `/api/streaming/vods?${params}`,
    fetcher
  )
}

/**
 * Get tournament VODs
 */
export function useTournamentVODs(tournamentId: string | null, limit = 50) {
  return useSWR<{ data: StreamVOD[] }>(
    tournamentId ? `/api/streaming/vods?tournamentId=${tournamentId}&limit=${limit}` : null,
    fetcher
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE HUB
// ─────────────────────────────────────────────────────────────────────────────

interface AllLiveStreams {
  rooms: StreamRoom[]
  broadcasts: BroadcastSession[]
  events: LiveEvent[]
}

/**
 * Get all live streams
 */
export function useAllLiveStreams() {
  return useSWR<AllLiveStreams>(
    "/api/streaming/live?all=true",
    fetcher,
    {
      refreshInterval: 10000,
    }
  )
}

/**
 * Get live events
 */
export function useLiveEvents(
  category?: "tournament" | "practice" | "community" | "educational" | "entertainment",
  tenantId?: string,
  limit = 20
) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (category) params.set("category", category)
  if (tenantId) params.set("tenantId", tenantId)
  
  return useSWR<{ data: Array<{ event: LiveEvent; session: BroadcastSession }> }>(
    `/api/streaming/live?${params}`,
    fetcher,
    {
      refreshInterval: 10000,
    }
  )
}

/**
 * Get upcoming events
 */
export function useUpcomingEvents(limit = 10) {
  return useSWR<{ data: LiveEvent[] }>(
    `/api/streaming/live?upcoming=true&limit=${limit}`,
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute
    }
  )
}

/**
 * Update viewer count
 */
export function useUpdateViewerCount() {
  return useSWRMutation(
    "/api/streaming/live",
    async (url: string, { arg }: { arg: { targetType: string; targetId: string; delta: number } }) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateViewers", ...arg }),
      })
      if (!res.ok) throw new Error("Failed to update viewer count")
      return res.json()
    }
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Track viewer presence (join/leave)
 */
export function useViewerPresence(
  targetType: "room" | "broadcast" | "live_event",
  targetId: string | null
) {
  const { trigger } = useUpdateViewerCount()

  const join = async () => {
    if (!targetId) return
    await trigger({ targetType, targetId, delta: 1 })
  }

  const leave = async () => {
    if (!targetId) return
    await trigger({ targetType, targetId, delta: -1 })
  }

  return { join, leave }
}
