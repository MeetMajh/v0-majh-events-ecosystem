"use client"

import { LiveKitRoom, VideoConference } from "@livekit/components-react"
import "@livekit/components-styles"

interface PlayerRoomProps {
  token: string
  wsUrl: string
  onDisconnected?: () => void
}

export function PlayerRoom({ token, wsUrl, onDisconnected }: PlayerRoomProps) {
  return (
    <LiveKitRoom
      token={token}
      serverUrl={wsUrl}
      video={true}
      audio={true}
      onDisconnected={onDisconnected}
      style={{ height: "100%" }}
    >
      <VideoConference />
    </LiveKitRoom>
  )
}
