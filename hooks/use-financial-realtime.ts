"use client"

import { useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export function useFinancialRealtime() {
  const router = useRouter()
  const supabase = createClient()

  const refresh = useCallback(() => {
    router.refresh()
  }, [router])

  useEffect(() => {
    const channel = supabase
      .channel("financial-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "financial_transactions" },
        () => {
          console.log("[v0] Financial transaction update detected")
          refresh()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets" },
        () => {
          console.log("[v0] Wallet update detected")
          refresh()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "escrow_accounts" },
        () => {
          console.log("[v0] Escrow update detected")
          refresh()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_payouts" },
        () => {
          console.log("[v0] Payout update detected")
          refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, refresh])

  return { refresh }
}
