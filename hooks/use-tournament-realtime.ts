"use client"

import { useEffect, useCallback, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface UseTournamentRealtimeOptions {
  tournamentId: string
  onMatchUpdate?: (match: any) => void
  onRoundUpdate?: (round: any) => void
  onAnnouncementUpdate?: (announcement: any) => void
  autoRefresh?: boolean // If true, triggers router.refresh() on updates
}

export function useTournamentRealtime({
  tournamentId,
  onMatchUpdate,
  onRoundUpdate,
  onAnnouncementUpdate,
  autoRefresh = true,
}: UseTournamentRealtimeOptions) {
  const router = useRouter()
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Debounced refresh to avoid multiple rapid refreshes
  const debouncedRefresh = useCallback(() => {
    setLastUpdate(new Date())
    if (autoRefresh) {
      router.refresh()
    }
  }, [router, autoRefresh])

  useEffect(() => {
    const supabase = createClient()
    
    // Create channel for this tournament
    const channel = supabase
      .channel(`tournament-live-${tournamentId}`)
      // Listen for match updates
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "tournament_matches", 
          filter: `tournament_id=eq.${tournamentId}` 
        },
        (payload) => {
          if (onMatchUpdate) {
            onMatchUpdate(payload.new)
          }
          debouncedRefresh()
        }
      )
      // Listen for round updates (status changes, time updates)
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "tournament_rounds", 
          filter: `tournament_id=eq.${tournamentId}` 
        },
        (payload) => {
          if (onRoundUpdate) {
            onRoundUpdate(payload.new)
          }
          debouncedRefresh()
        }
      )
      // Listen for announcements
      .on(
        "postgres_changes",
        { 
          event: "INSERT", 
          schema: "public", 
          table: "tournament_announcements", 
          filter: `tournament_id=eq.${tournamentId}` 
        },
        (payload) => {
          if (onAnnouncementUpdate) {
            onAnnouncementUpdate(payload.new)
          }
          debouncedRefresh()
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED")
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournamentId, onMatchUpdate, onRoundUpdate, onAnnouncementUpdate, debouncedRefresh])

  return { isConnected, lastUpdate }
}

// Hook specifically for the player controller - listens to their specific match
export function usePlayerMatchRealtime({
  matchId,
  onUpdate,
}: {
  matchId: string | null
  onUpdate?: (match: any) => void
}) {
  const router = useRouter()
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!matchId) return

    const supabase = createClient()
    
    const channel = supabase
      .channel(`match-live-${matchId}`)
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "tournament_matches", 
          filter: `id=eq.${matchId}` 
        },
        (payload) => {
          if (onUpdate) {
            onUpdate(payload.new)
          }
          router.refresh()
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED")
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId, onUpdate, router])

  return { isConnected }
}
