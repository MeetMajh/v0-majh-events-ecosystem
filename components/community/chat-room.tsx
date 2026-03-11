"use client"

import { useState, useEffect, useRef, useTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import { sendMessage, deleteMessage } from "@/lib/community-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Send, 
  Hash, 
  Megaphone, 
  MoreHorizontal,
  Trash2,
  Pin,
  Reply,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Room = {
  id: string
  name: string
  slug: string
  description: string | null
  room_type: string
}

type Message = {
  id: string
  content: string
  created_at: string
  edited_at: string | null
  is_pinned: boolean
  user_id: string
  profiles: {
    id: string
    display_name: string
    avatar_url: string | null
  } | null
}

type UserProfile = {
  id: string
  display_name: string
  avatar_url: string | null
}

export function ChatRoom({
  room,
  initialMessages,
  currentUser,
  isAuthenticated,
}: {
  room: Room
  initialMessages: Message[]
  currentUser: UserProfile | null
  isAuthenticated: boolean
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [newMessage, setNewMessage] = useState("")
  const [isPending, startTransition] = useTransition()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Set up real-time subscription
  useEffect(() => {
    const supabase = createClient()
    
    const channel = supabase
      .channel(`room-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_messages",
          filter: `room_id=eq.${room.id}`,
        },
        async (payload) => {
          // Fetch full message with profile data
          const { data } = await supabase
            .from("community_messages")
            .select(`
              *,
              profiles:user_id(id, display_name, avatar_url)
            `)
            .eq("id", payload.new.id)
            .single()
          
          if (data) {
            setMessages(prev => [...prev, data as Message])
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "community_messages",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id))
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "community_messages",
          filter: `room_id=eq.${room.id}`,
        },
        async (payload) => {
          if (payload.new.is_deleted) {
            setMessages(prev => prev.filter(m => m.id !== payload.new.id))
          } else {
            const { data } = await supabase
              .from("community_messages")
              .select(`
                *,
                profiles:user_id(id, display_name, avatar_url)
              `)
              .eq("id", payload.new.id)
              .single()
            
            if (data) {
              setMessages(prev => 
                prev.map(m => m.id === data.id ? data as Message : m)
              )
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [room.id])

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || !isAuthenticated) return

    const content = newMessage.trim()
    setNewMessage("")

    // Optimistic update
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      content,
      created_at: new Date().toISOString(),
      edited_at: null,
      is_pinned: false,
      user_id: currentUser?.id || "",
      profiles: currentUser,
    }
    setMessages(prev => [...prev, optimisticMessage])

    startTransition(async () => {
      const result = await sendMessage(room.id, content)
      
      if (result.error) {
        toast.error(result.error)
        // Remove optimistic message
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id))
      }
      // Real message will come through the subscription
    })
  }

  async function handleDeleteMessage(messageId: string) {
    startTransition(async () => {
      const result = await deleteMessage(messageId)
      if (result.error) {
        toast.error(result.error)
      }
    })
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr)
    return date.toLocaleTimeString("en-US", { 
      hour: "numeric", 
      minute: "2-digit",
      hour12: true 
    })
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return "Today"
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday"
    }
    return date.toLocaleDateString("en-US", { 
      weekday: "long",
      month: "long", 
      day: "numeric" 
    })
  }

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = []
  let currentDate = ""

  messages.forEach((message) => {
    const messageDate = new Date(message.created_at).toDateString()
    if (messageDate !== currentDate) {
      currentDate = messageDate
      groupedMessages.push({
        date: message.created_at,
        messages: [message],
      })
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(message)
    }
  })

  const isAnnouncement = room.room_type === "announcement"

  return (
    <div className="flex h-full flex-col">
      {/* Room Header */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        {isAnnouncement ? (
          <Megaphone className="h-5 w-5 text-primary" />
        ) : (
          <Hash className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <h1 className="font-semibold text-foreground">{room.name}</h1>
          {room.description && (
            <p className="text-xs text-muted-foreground">{room.description}</p>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Hash className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="font-medium text-foreground">
              Welcome to #{room.name}!
            </p>
            <p className="text-sm text-muted-foreground">
              This is the start of the conversation.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedMessages.map((group, groupIndex) => (
              <div key={groupIndex}>
                {/* Date Divider */}
                <div className="relative my-4 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <span className="relative bg-background px-3 text-xs text-muted-foreground">
                    {formatDate(group.date)}
                  </span>
                </div>

                {/* Messages for this date */}
                <div className="space-y-2">
                  {group.messages.map((message, msgIndex) => {
                    const prevMessage = msgIndex > 0 ? group.messages[msgIndex - 1] : null
                    const isConsecutive = prevMessage?.user_id === message.user_id
                    const isOwnMessage = message.user_id === currentUser?.id

                    return (
                      <div 
                        key={message.id}
                        className={cn(
                          "group flex gap-3",
                          isConsecutive && "pl-12",
                          message.is_pinned && "rounded-lg bg-primary/5 p-2"
                        )}
                      >
                        {!isConsecutive && (
                          <Avatar className="h-9 w-9 flex-shrink-0">
                            <AvatarImage src={message.profiles?.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {message.profiles?.display_name?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                        )}

                        <div className="flex-1 min-w-0">
                          {!isConsecutive && (
                            <div className="mb-0.5 flex items-baseline gap-2">
                              <span className="font-medium text-foreground">
                                {message.profiles?.display_name || "Unknown"}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatTime(message.created_at)}
                              </span>
                              {message.edited_at && (
                                <span className="text-[10px] text-muted-foreground">
                                  (edited)
                                </span>
                              )}
                              {message.is_pinned && (
                                <Pin className="h-3 w-3 text-primary" />
                              )}
                            </div>
                          )}
                          <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">
                            {message.content}
                          </p>
                        </div>

                        {/* Message Actions */}
                        {isAuthenticated && !message.id.startsWith("temp-") && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 opacity-0 group-hover:opacity-100"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {isOwnMessage && (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteMessage(message.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t border-border p-4">
        {isAuthenticated ? (
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Message #${room.name}`}
              className="flex-1"
              disabled={isPending}
            />
            <Button type="submit" disabled={!newMessage.trim() || isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            <a href="/auth/sign-in" className="text-primary hover:underline">
              Sign in
            </a>{" "}
            to send messages
          </p>
        )}
      </div>
    </div>
  )
}
