"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Users,
  MessageSquare,
  Heart,
  Share2,
  Scissors,
  Send,
  CircleDot,
  Gamepad2,
  AlertTriangle,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { StreamSession } from "@/lib/majh-studio-actions"

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface ChatMessage {
  id: string
  message: string
  created_at: string
  user: {
    id: string
    display_name: string
    avatar_url?: string
  }
}

export default function WatchStreamPage() {
  const params = useParams()
  const sessionId = params.sessionId as string
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  
  const [chatMessage, setChatMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [viewerSessionId] = useState(() => `viewer_${Date.now()}_${Math.random().toString(36).slice(2)}`)

  // Fetch stream data
  const { data: sessionData, error: sessionError } = useSWR<{ data: StreamSession }>(
    `/api/studio/watch/${sessionId}`,
    fetcher,
    { refreshInterval: 5000 }
  )

  // Fetch chat messages
  const { data: chatData, mutate: mutateChat } = useSWR<{ data: ChatMessage[] }>(
    `/api/studio/chat/${sessionId}`,
    fetcher,
    { refreshInterval: 2000 }
  )

  const session = sessionData?.data
  const messages = chatData?.data || []

  // Join/leave stream tracking
  useEffect(() => {
    if (!sessionId) return

    // Join stream
    fetch(`/api/studio/viewer/${sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", viewerSessionId }),
    })

    // Leave stream on unmount
    return () => {
      fetch(`/api/studio/viewer/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave", viewerSessionId }),
      })
    }
  }, [sessionId, viewerSessionId])

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatMessage.trim() || isSending) return

    setIsSending(true)
    try {
      await fetch(`/api/studio/chat/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatMessage }),
      })
      setChatMessage("")
      mutateChat()
    } catch (err) {
      console.error("Failed to send message:", err)
    }
    setIsSending(false)
  }

  if (sessionError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Stream Not Found</h2>
            <p className="text-muted-foreground mb-4">
              This stream may have ended or doesn&apos;t exist.
            </p>
            <Button asChild>
              <Link href="/live">Browse Live Streams</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading stream...</div>
      </div>
    )
  }

  const isLive = session.is_live

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
          {/* Main Video */}
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className="aspect-video bg-black relative">
                {isLive ? (
                  <>
                    {/* Video would connect via LiveKit here */}
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-contain"
                    />
                    
                    {/* Live indicator */}
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                      <Badge variant="destructive" className="font-bold">
                        <CircleDot className="h-3 w-3 mr-1 animate-pulse" />
                        LIVE
                      </Badge>
                      <Badge variant="secondary">
                        <Users className="h-3 w-3 mr-1" />
                        {session.viewer_count || 0}
                      </Badge>
                    </div>

                    {/* Connecting message while video loads */}
                    <div className="absolute inset-0 flex items-center justify-center text-white bg-black/50">
                      <div className="text-center">
                        <CircleDot className="h-8 w-8 mx-auto mb-2 animate-pulse" />
                        <p>Connecting to stream...</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                    <AlertTriangle className="h-16 w-16 mb-4 opacity-30" />
                    <p className="text-lg font-medium">Stream Offline</p>
                    <p className="text-sm">This stream has ended or hasn&apos;t started yet.</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Stream Info */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={session.host?.avatar_url} />
                      <AvatarFallback>
                        {session.host?.display_name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h1 className="text-xl font-bold">{session.title}</h1>
                      <Link 
                        href={`/esports/players/${session.host_id}`}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        {session.host?.display_name || "Anonymous"}
                      </Link>
                      {session.game && (
                        <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                          <Gamepad2 className="h-3 w-3" />
                          {session.game.name}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Heart className="h-4 w-4 mr-1" />
                      Follow
                    </Button>
                    <Button variant="outline" size="sm">
                      <Share2 className="h-4 w-4" />
                    </Button>
                    {session.allow_clips && (
                      <Button variant="outline" size="sm">
                        <Scissors className="h-4 w-4 mr-1" />
                        Clip
                      </Button>
                    )}
                  </div>
                </div>

                {session.description && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    {session.description}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Chat Sidebar */}
          <div className="lg:h-[calc(100vh-8rem)]">
            <Card className="h-full flex flex-col">
              <CardHeader className="py-3 border-b">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Stream Chat
                  {!session.allow_chat && (
                    <Badge variant="secondary" className="ml-auto">Disabled</Badge>
                  )}
                </CardTitle>
              </CardHeader>

              {session.allow_chat ? (
                <>
                  <ScrollArea className="flex-1 p-4" ref={chatScrollRef}>
                    <div className="space-y-3">
                      {messages.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No messages yet. Be the first to say hi!
                        </p>
                      ) : (
                        messages.map((msg) => (
                          <div key={msg.id} className="flex items-start gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={msg.user?.avatar_url} />
                              <AvatarFallback className="text-xs">
                                {msg.user?.display_name?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-primary">
                                {msg.user?.display_name || "Anonymous"}
                              </span>
                              <span className="text-sm ml-2">{msg.message}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>

                  <div className="p-4 border-t">
                    <form onSubmit={sendMessage} className="flex gap-2">
                      <Input
                        placeholder="Send a message..."
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        maxLength={500}
                        disabled={isSending}
                      />
                      <Button type="submit" size="icon" disabled={isSending || !chatMessage.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Chat is disabled for this stream</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
