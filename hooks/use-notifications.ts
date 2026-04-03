"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

export function useNotificationCount() {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchCount = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      setCount(0)
      setLoading(false)
      return
    }

    const { count: unreadCount } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false)

    setCount(unreadCount || 0)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCount()

    // Real-time subscription
    const supabase = createClient()
    
    const channel = supabase
      .channel("notification-count-hook")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => {
          setCount((prev) => prev + 1)
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload) => {
          // If marked as read, decrement
          if (payload.new && (payload.new as { is_read?: boolean }).is_read) {
            setCount((prev) => Math.max(0, prev - 1))
          }
        }
      )
      .subscribe()

    // Poll every 30s as fallback
    const interval = setInterval(fetchCount, 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [fetchCount])

  const markAllRead = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false)

    setCount(0)
  }, [])

  return { count, loading, refetch: fetchCount, markAllRead }
}
