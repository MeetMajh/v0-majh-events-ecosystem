"use client"

import { useEffect, useState, useCallback } from "react"
import {
  LiveKitRoom,
  VideoTrack,
  useLocalParticipant,
  useRoomContext,
  useTracks,
  RoomAudioRenderer,
} from "@livekit/components-react"
import { Track, RoomEvent } from "livekit-client"
import { Button } from "@/components/ui/button"
import { Video, VideoOff, Mic, MicOff, MonitorUp, MonitorOff, Users } from "lucide-react"
import "@livekit/components-styles"

interface PlayerRoomProps {
  roomName: string
  isHost?: boolean
  onViewerCountChange?: (count: number) => void
  onError?: (error: string) => void
}

export function PlayerRoom({ roomName, isHost = false, onViewerCountChange, onError }: PlayerRoomProps) {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchToken() {
      try {
        const res = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName, isHost }),
        })
        
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Failed to get token")
        }
        
        const data = await res.json()
        setToken(data.token)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to connect"
        setError(message)
        onError?.(message)
      } finally {
        setLoading(false)
      }
    }

    fetchToken()
  }, [roomName, isHost, onError])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-black/50 rounded-lg">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !token) {
    return (
      <div className="flex items-center justify-center h-full bg-black/50 rounded-lg">
        <p className="text-destructive">{error || "Failed to connect to room"}</p>
      </div>
    )
  }

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL

  if (!livekitUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-black/50 rounded-lg">
        <p className="text-destructive">LiveKit URL not configured</p>
      </div>
    )
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={livekitUrl}
      connect={true}
      className="h-full w-full"
      onError={(err) => {
        console.error("[v0] LiveKit error:", err)
        onError?.(err.message)
      }}
    >
      <RoomContent isHost={isHost} onViewerCountChange={onViewerCountChange} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  )
}

function RoomContent({ 
  isHost, 
  onViewerCountChange 
}: { 
  isHost: boolean
  onViewerCountChange?: (count: number) => void 
}) {
  const room = useRoomContext()
  const { localParticipant } = useLocalParticipant()
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [isMicOn, setIsMicOn] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  // Track viewer count
  useEffect(() => {
    const updateViewerCount = () => {
      const count = room.remoteParticipants.size
      onViewerCountChange?.(count)
    }

    room.on(RoomEvent.ParticipantConnected, updateViewerCount)
    room.on(RoomEvent.ParticipantDisconnected, updateViewerCount)
    updateViewerCount()

    return () => {
      room.off(RoomEvent.ParticipantConnected, updateViewerCount)
      room.off(RoomEvent.ParticipantDisconnected, updateViewerCount)
    }
  }, [room, onViewerCountChange])

  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ])

  const toggleCamera = useCallback(async () => {
    try {
      await localParticipant.setCameraEnabled(!isCameraOn)
      setIsCameraOn(!isCameraOn)
    } catch (err) {
      console.error("[v0] Camera toggle error:", err)
    }
  }, [localParticipant, isCameraOn])

  const toggleMic = useCallback(async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicOn)
      setIsMicOn(!isMicOn)
    } catch (err) {
      console.error("[v0] Mic toggle error:", err)
    }
  }, [localParticipant, isMicOn])

  const toggleScreenShare = useCallback(async () => {
    try {
      await localParticipant.setScreenShareEnabled(!isScreenSharing)
      setIsScreenSharing(!isScreenSharing)
    } catch (err) {
      console.error("[v0] Screen share error:", err)
    }
  }, [localParticipant, isScreenSharing])

  // Find the main video track (prefer screen share over camera)
  const screenTrack = tracks.find(
    (t) => t.source === Track.Source.ScreenShare && t.publication?.track
  )
  const cameraTrack = tracks.find(
    (t) => t.source === Track.Source.Camera && t.publication?.track
  )
  const mainTrack = screenTrack || cameraTrack

  return (
    <div className="relative h-full w-full flex flex-col">
      {/* Main video area */}
      <div className="flex-1 relative bg-black rounded-lg overflow-hidden">
        {mainTrack?.publication?.track ? (
          <VideoTrack
            trackRef={mainTrack}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">
              {isHost ? "Start your camera or share your screen" : "Waiting for stream..."}
            </p>
          </div>
        )}

        {/* Picture-in-picture camera when screen sharing */}
        {screenTrack && cameraTrack?.publication?.track && (
          <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden border-2 border-primary shadow-lg">
            <VideoTrack
              trackRef={cameraTrack}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Viewer count */}
        <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded-full flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm">{room.remoteParticipants.size}</span>
        </div>
      </div>

      {/* Host controls */}
      {isHost && (
        <div className="flex items-center justify-center gap-4 py-4 bg-card rounded-b-lg">
          <Button
            variant={isCameraOn ? "default" : "outline"}
            size="icon"
            onClick={toggleCamera}
            title={isCameraOn ? "Turn off camera" : "Turn on camera"}
          >
            {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>

          <Button
            variant={isMicOn ? "default" : "outline"}
            size="icon"
            onClick={toggleMic}
            title={isMicOn ? "Mute microphone" : "Unmute microphone"}
          >
            {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>

          <Button
            variant={isScreenSharing ? "destructive" : "outline"}
            size="icon"
            onClick={toggleScreenShare}
            title={isScreenSharing ? "Stop screen share" : "Share screen"}
          >
            {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
          </Button>
        </div>
      )}
    </div>
  )
}
