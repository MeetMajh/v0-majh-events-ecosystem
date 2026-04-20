"use client"

import { createContext, useContext, useEffect, ReactNode } from "react"
import { 
  initializeRealtimeConnection, 
  cleanupRealtimeConnection,
  useLiveStreams,
  useLiveEvents,
  useLiveCount,
  type LiveStream,
  type LiveEvent
} from "@/lib/unified-realtime"

// ============================================================================
// REALTIME CONTEXT
// Provides unified live data to all components in the app
// ============================================================================

interface RealtimeContextValue {
  liveStreams: LiveStream[]
  liveEvents: LiveEvent[]
  liveCount: number
  isConnected: boolean
}

const RealtimeContext = createContext<RealtimeContextValue>({
  liveStreams: [],
  liveEvents: [],
  liveCount: 0,
  isConnected: false,
})

export function useRealtime() {
  return useContext(RealtimeContext)
}

interface RealtimeProviderProps {
  children: ReactNode
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const liveStreams = useLiveStreams()
  const liveEvents = useLiveEvents()
  const liveCount = useLiveCount()

  useEffect(() => {
    initializeRealtimeConnection()
    
    return () => {
      cleanupRealtimeConnection()
    }
  }, [])

  return (
    <RealtimeContext.Provider
      value={{
        liveStreams,
        liveEvents,
        liveCount,
        isConnected: true,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  )
}
