"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useCallback } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"

// ============================================================================
// UNIFIED REALTIME STATE LAYER
// This connects all pages to the same live data sources
// ============================================================================

export interface LiveStream {
  id: string
  title: string
  status: "live" | "offline" | "ended"
  viewerCount: number
  streamerName: string
  streamerAvatar?: string
  gameId?: string
  gameName?: string
  thumbnailUrl?: string
  type: "studio" | "obs" | "external"
  startedAt?: string
}

export interface LiveEvent {
  id: string
  type: "stream_started" | "stream_ended" | "viewer_joined" | "clip_created" | "match_update"
  data: Record<string, unknown>
  timestamp: string
}

// Global singleton for realtime subscriptions
let globalChannel: RealtimeChannel | null = null
let subscribers: Set<(streams: LiveStream[]) => void> = new Set()
let eventSubscribers: Set<(event: LiveEvent) => void> = new Set()
let currentStreams: LiveStream[] = []

// ============================================================================
// CORE SUBSCRIPTION MANAGER
// ============================================================================

export function initializeRealtimeConnection() {
  if (globalChannel) return // Already initialized

  const supabase = createClient()

  // Subscribe to all live stream changes across tables
  globalChannel = supabase
    .channel("unified-live-state")
    // Stream sessions (MAJH Studio)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "stream_sessions",
        filter: "visibility=eq.public",
      },
      (payload) => {
        handleStreamSessionChange(payload)
      }
    )
    // User streams (Go Live OBS)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "user_streams",
        filter: "is_public=eq.true",
      },
      (payload) => {
        handleUserStreamChange(payload)
      }
    )
    // Stream sources (Admin external)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "stream_sources",
        filter: "is_active=eq.true",
      },
      (payload) => {
        handleStreamSourceChange(payload)
      }
    )
    // Player media (new clips)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "player_media",
        filter: "visibility=eq.public",
      },
      (payload) => {
        emitEvent({
          id: payload.new.id,
          type: "clip_created",
          data: payload.new,
          timestamp: new Date().toISOString(),
        })
      }
    )
    .subscribe()

  // Initial fetch
  fetchAllLiveStreams()
}

function handleStreamSessionChange(payload: any) {
  const { eventType, new: newRecord, old: oldRecord } = payload

  if (eventType === "INSERT" && newRecord.status === "live") {
    emitEvent({
      id: newRecord.id,
      type: "stream_started",
      data: newRecord,
      timestamp: new Date().toISOString(),
    })
  } else if (eventType === "UPDATE" && oldRecord?.status === "live" && newRecord.status !== "live") {
    emitEvent({
      id: newRecord.id,
      type: "stream_ended",
      data: newRecord,
      timestamp: new Date().toISOString(),
    })
  }

  fetchAllLiveStreams()
}

function handleUserStreamChange(payload: any) {
  const { eventType, new: newRecord, old: oldRecord } = payload

  if (eventType === "INSERT" && newRecord.status === "live") {
    emitEvent({
      id: newRecord.id,
      type: "stream_started",
      data: newRecord,
      timestamp: new Date().toISOString(),
    })
  } else if (eventType === "UPDATE" && oldRecord?.status === "live" && newRecord.status !== "live") {
    emitEvent({
      id: newRecord.id,
      type: "stream_ended",
      data: newRecord,
      timestamp: new Date().toISOString(),
    })
  }

  fetchAllLiveStreams()
}

function handleStreamSourceChange(payload: any) {
  const { eventType, new: newRecord, old: oldRecord } = payload

  if (eventType === "UPDATE" && !oldRecord?.is_live && newRecord.is_live) {
    emitEvent({
      id: newRecord.id,
      type: "stream_started",
      data: newRecord,
      timestamp: new Date().toISOString(),
    })
  } else if (eventType === "UPDATE" && oldRecord?.is_live && !newRecord.is_live) {
    emitEvent({
      id: newRecord.id,
      type: "stream_ended",
      data: newRecord,
      timestamp: new Date().toISOString(),
    })
  }

  fetchAllLiveStreams()
}

async function fetchAllLiveStreams() {
  const supabase = createClient()
  const streams: LiveStream[] = []

  // Fetch from stream_sessions (MAJH Studio)
  const { data: sessions } = await supabase
    .from("stream_sessions")
    .select("id, title, status, viewer_count, user_id, game_id, thumbnail_url, started_at")
    .eq("status", "live")
    .eq("visibility", "public")

  if (sessions) {
    for (const session of sessions) {
      streams.push({
        id: session.id,
        title: session.title || "MAJH Studio Stream",
        status: session.status as "live",
        viewerCount: session.viewer_count || 0,
        streamerName: "MAJH Streamer",
        gameId: session.game_id,
        thumbnailUrl: session.thumbnail_url,
        type: "studio",
        startedAt: session.started_at,
      })
    }
  }

  // Fetch from user_streams (Go Live OBS)
  const { data: userStreams } = await supabase
    .from("user_streams")
    .select("id, title, status, user_id, game_id, started_at")
    .eq("status", "live")
    .eq("is_public", true)

  if (userStreams) {
    for (const stream of userStreams) {
      streams.push({
        id: stream.id,
        title: stream.title || "OBS Stream",
        status: stream.status as "live",
        viewerCount: 0,
        streamerName: "MAJH Creator",
        gameId: stream.game_id,
        type: "obs",
        startedAt: stream.started_at,
      })
    }
  }

  // Fetch from stream_sources (Admin external)
  const { data: sources } = await supabase
    .from("stream_sources")
    .select("id, title, platform, is_live, viewer_count, thumbnail_url")
    .eq("is_live", true)
    .eq("is_active", true)

  if (sources) {
    for (const source of sources) {
      streams.push({
        id: source.id,
        title: source.title,
        status: "live",
        viewerCount: source.viewer_count || 0,
        streamerName: source.platform || "External",
        thumbnailUrl: source.thumbnail_url,
        type: "external",
      })
    }
  }

  currentStreams = streams
  notifySubscribers()
}

function notifySubscribers() {
  subscribers.forEach((callback) => callback(currentStreams))
}

function emitEvent(event: LiveEvent) {
  eventSubscribers.forEach((callback) => callback(event))
}

// ============================================================================
// REACT HOOKS
// ============================================================================

/**
 * Hook to get all live streams with real-time updates
 */
export function useLiveStreams(): LiveStream[] {
  const [streams, setStreams] = useState<LiveStream[]>(currentStreams)

  useEffect(() => {
    initializeRealtimeConnection()

    const callback = (newStreams: LiveStream[]) => {
      setStreams([...newStreams])
    }

    subscribers.add(callback)
    return () => {
      subscribers.delete(callback)
    }
  }, [])

  return streams
}

/**
 * Hook to get real-time live events (stream started, ended, etc.)
 */
export function useLiveEvents(onEvent?: (event: LiveEvent) => void): LiveEvent[] {
  const [events, setEvents] = useState<LiveEvent[]>([])

  useEffect(() => {
    initializeRealtimeConnection()

    const callback = (event: LiveEvent) => {
      setEvents((prev) => [event, ...prev].slice(0, 50)) // Keep last 50 events
      onEvent?.(event)
    }

    eventSubscribers.add(callback)
    return () => {
      eventSubscribers.delete(callback)
    }
  }, [onEvent])

  return events
}

/**
 * Hook for live stream count (for nav badges, etc.)
 */
export function useLiveCount(): number {
  const streams = useLiveStreams()
  return streams.filter((s) => s.status === "live").length
}

/**
 * Hook for specific stream by ID with real-time updates
 */
export function useStream(streamId: string): LiveStream | null {
  const streams = useLiveStreams()
  return streams.find((s) => s.id === streamId) || null
}

/**
 * Hook to force refresh all streams
 */
export function useRefreshStreams() {
  return useCallback(() => {
    fetchAllLiveStreams()
  }, [])
}

// ============================================================================
// CLEANUP
// ============================================================================

export function cleanupRealtimeConnection() {
  if (globalChannel) {
    const supabase = createClient()
    supabase.removeChannel(globalChannel)
    globalChannel = null
  }
  subscribers.clear()
  eventSubscribers.clear()
  currentStreams = []
}
