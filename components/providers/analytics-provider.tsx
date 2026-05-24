"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { analytics } from "@/lib/analytics-client"

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id ?? null
      setUserId(id)
      analytics.init({ userId: id ?? undefined })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const id = session?.user?.id ?? null
      setUserId(id)
      analytics.setUserId(id)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    analytics.setUserId(userId)
  }, [userId])

  return <>{children}</>
}
