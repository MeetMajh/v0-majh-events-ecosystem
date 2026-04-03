"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { sendChatMessage, getMatchChatMessages } from "@/lib/tournament-controller-actions"
import { createClient } from "@/lib/supabase/client"
import { Send, Mic, Shield, MessageCircle, Users } from "lucide-react"
import { toast } from "sonner"

interface ChatMessage {
  id: string
  match_id: string
  user_id: string | null
  display_name: string
  avatar_url: string | null
  message: string
  is_caster: boolean
  is_moderator: boolean
  is_deleted: boolean
  created_at: string
}

interface MatchChatProps {
  matchId: string
  currentUserId?: string
  className?: string
}

export function MatchChat({ matchId, currentUserId, className }: MatchChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch initial messages
  useEffect(() => {
    getMatchChatMessages(matchId).then(setMessages)
  }, [matchId])

  // Subscribe to realtime chat updates
  useEffect(() => {
    const supabase = createClient()
    
    const channel = supabase
      .channel(`chat-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "match_chat_messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          setMessages(prev => [...prev, newMsg])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = useCallback(async () => {
    if (!newMessage.trim() || isSending) return

    if (!currentUserId) {
      toast.error("Please sign in to chat")
      return
    }

    setIsSending(true)
    const result = await sendChatMessage(matchId, newMessage.trim())
    setIsSending(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      setNewMessage("")
      inputRef.current?.focus()
    }
  }, [matchId, newMessage, currentUserId, isSending])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div className={cn("flex flex-col h-full bg-background border border-border rounded-lg overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Live Chat</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>{messages.length} messages</span>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No messages yet</p>
              <p className="text-xs">Be the first to chat!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="flex gap-2 group">
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarImage src={msg.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {msg.display_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={cn(
                      "font-medium text-sm",
                      msg.is_caster && "text-primary",
                      msg.is_moderator && "text-yellow-500"
                    )}>
                      {msg.display_name}
                    </span>
                    {msg.is_caster && (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-primary/10 text-primary">
                        <Mic className="h-2.5 w-2.5 mr-0.5" />
                        CASTER
                      </Badge>
                    )}
                    {msg.is_moderator && !msg.is_caster && (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-yellow-500/10 text-yellow-500">
                        <Shield className="h-2.5 w-2.5 mr-0.5" />
                        MOD
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 break-words">{msg.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border bg-muted/30">
        {currentUserId ? (
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message..."
              maxLength={500}
              disabled={isSending}
              className="flex-1 h-9 text-sm"
            />
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!newMessage.trim() || isSending}
              className="h-9 px-3"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground">
              <a href="/auth/login" className="text-primary hover:underline">Sign in</a> to join the chat
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// Compact chat for sidebar
export function CompactChat({ matchId, currentUserId }: { matchId: string; currentUserId?: string }) {
  return (
    <MatchChat matchId={matchId} currentUserId={currentUserId} className="h-[400px]" />
  )
}
