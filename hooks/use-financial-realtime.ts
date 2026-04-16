"use client"

import { useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

/**
 * Real-time financial updates hook with optimized subscriptions.
 * 
 * Performance optimizations:
 * - Specific event types (INSERT, UPDATE, DELETE) instead of wildcard
 * - Debounced refresh to prevent excessive re-renders
 * - Proper cleanup on unmount
 */
export function useFinancialRealtime() {
  const router = useRouter()
  const supabase = createClient()
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastRefreshRef = useRef<number>(0)

  // Debounced refresh to prevent rapid re-renders
  const debouncedRefresh = useCallback(() => {
    const now = Date.now()
    
    // Minimum 500ms between refreshes
    if (now - lastRefreshRef.current < 500) {
      // Clear any existing timeout
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
      // Schedule a refresh for later
      refreshTimeoutRef.current = setTimeout(() => {
        lastRefreshRef.current = Date.now()
        router.refresh()
      }, 500)
      return
    }
    
    lastRefreshRef.current = now
    router.refresh()
  }, [router])

  const refresh = useCallback(() => {
    router.refresh()
  }, [router])

  useEffect(() => {
    const channel = supabase
      .channel("financial-updates")
      // Financial transactions - track all changes for accurate ledger
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "financial_transactions" },
        () => debouncedRefresh()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "financial_transactions" },
        () => debouncedRefresh()
      )
      // Wallets - balance changes
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "wallets" },
        () => debouncedRefresh()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wallets" },
        () => debouncedRefresh()
      )
      // Escrow accounts - status changes
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "escrow_accounts" },
        () => debouncedRefresh()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "escrow_accounts" },
        () => debouncedRefresh()
      )
      // Tournament payouts - payout processing
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tournament_payouts" },
        () => debouncedRefresh()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tournament_payouts" },
        () => debouncedRefresh()
      )
      // System controls - circuit breakers, kill switches
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "system_controls" },
        () => debouncedRefresh()
      )
      // Audit log - new entries (admin monitoring)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reconciliation_audit_log" },
        () => debouncedRefresh()
      )
      // System alerts - critical notifications
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "system_alerts" },
        () => debouncedRefresh()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "system_alerts" },
        () => debouncedRefresh()
      )
      // Chaos test runs - track test results
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chaos_test_runs" },
        () => debouncedRefresh()
      )
      // Deployment integrity runs
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deployment_integrity_runs" },
        () => debouncedRefresh()
      )
      .subscribe()

    return () => {
      // Cleanup timeout
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
      supabase.removeChannel(channel)
    }
  }, [supabase, debouncedRefresh])

  return { refresh }
}

/**
 * Hook for tracking specific user's wallet changes
 */
export function useWalletRealtime(userId: string | undefined) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`wallet-${userId}`)
      .on(
        "postgres_changes",
        { 
          event: "UPDATE", 
          schema: "public", 
          table: "wallets",
          filter: `user_id=eq.${userId}`
        },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { 
          event: "INSERT", 
          schema: "public", 
          table: "financial_transactions",
          filter: `user_id=eq.${userId}`
        },
        () => router.refresh()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, userId, router])
}

/**
 * Hook for tracking specific tournament escrow changes
 */
export function useEscrowRealtime(tournamentId: string | undefined) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!tournamentId) return

    const channel = supabase
      .channel(`escrow-${tournamentId}`)
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "escrow_accounts",
          filter: `tournament_id=eq.${tournamentId}`
        },
        () => router.refresh()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, tournamentId, router])
}
