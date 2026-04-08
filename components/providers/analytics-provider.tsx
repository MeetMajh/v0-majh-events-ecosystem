"use client"

import { useEffect } from "react"
import { useUser } from "@/hooks/use-user"
import { analytics } from "@/lib/analytics-client"

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  
  useEffect(() => {
    // Initialize analytics
    analytics.init({ userId: user?.id })
  }, [user?.id])
  
  useEffect(() => {
    // Update user ID when auth changes
    analytics.setUserId(user?.id || null)
  }, [user?.id])
  
  return <>{children}</>
}
