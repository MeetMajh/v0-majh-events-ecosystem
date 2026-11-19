"use client"

/*
  CREATED 2026-11-19.

  components/providers/analytics-provider.tsx has imported `useUser` from
  this path since 2026-05-25, but the file was never written — one of three
  missing modules found by the first `tsc --noEmit` run on this repository.

  It was not a build failure only because nothing imports AnalyticsProvider
  yet. The analytics feature itself IS live (app/dashboard/admin/analytics
  and app/api/analytics/ingest both use lib/analytics-client), so this is a
  missing wire-up rather than dead weight, and leaving the import broken
  would mean the next person who mounts AnalyticsProvider breaks the build.

  Deliberately uses getUser() rather than getSession(): getUser() validates
  the token with the auth server, whereas getSession() trusts whatever is in
  local storage. The onAuthStateChange subscription is what
  AnalyticsProvider's second effect is for — it comments "Update user ID when
  auth changes", which only works if something is listening.
*/

import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

export interface UseUserResult {
  user: User | null
  /** true until the first auth check resolves */
  loading: boolean
}

export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // `active` guards against setting state after unmount, which React
    // warns about and which happens routinely on fast navigation.
    let active = true

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return
        setUser(data.user ?? null)
        setLoading(false)
      })
      .catch(() => {
        // A signed-out visitor is not an error condition; it is the common
        // case on public pages. Resolve to null rather than throwing into a
        // provider that wraps the tree.
        if (!active) return
        setUser(null)
        setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}

export default useUser
