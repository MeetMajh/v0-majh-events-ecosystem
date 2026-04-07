"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { formatDistanceToNow } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Gamepad2,
  Trophy,
  Users,
  Flame,
  Star,
  AlertCircle,
  Radio,
  Clock,
  Settings,
  X,
  Play,
} from "lucide-react"
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  dismissNotification,
  type Notification,
  type NotificationType,
} from "@/lib/notification-actions"
import { usePushNotifications } from "@/hooks/use-notifications"

// Icon mapping for notification types
const typeIcons: Record<NotificationType, typeof Bell> = {
  match_ready: Gamepad2,
  match_starting: Clock,
  match_result: Trophy,
  tournament_starting: Trophy,
  round_starting: Radio,
  followed_player_live: Radio,
  followed_player_match: Users,
  trending_match: Flame,
  achievement_earned: Star,
  staff_alert: AlertCircle,
  system: Bell,
}

const typeColors: Record<NotificationType, string> = {
  match_ready: "text-primary",
  match_starting: "text-orange-500",
  match_result: "text-yellow-500",
  tournament_starting: "text-primary",
  round_starting: "text-blue-500",
  followed_player_live: "text-destructive",
  followed_player_match: "text-purple-500",
  trending_match: "text-orange-500",
  achievement_earned: "text-yellow-500",
  staff_alert: "text-destructive",
  system: "text-muted-foreground",
}

function formatTimeAgo(date: string): string {
  const now = new Date()
  const then = new Date(date)
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return then.toLocaleDateString()
}

interface NotificationItemProps {
  notification: Notification
  onRead: (id: string) => void
  onDismiss: (id: string) => void
}

function NotificationItem({ notification, onRead, onDismiss }: NotificationItemProps) {
  const Icon = typeIcons[notification.type] || Bell
  const iconColor = typeColors[notification.type] || "text-muted-foreground"

  const handleClick = () => {
    if (!notification.is_read) {
      onRead(notification.id)
    }
  }

  return (
    <div
      className={cn(
        "group relative flex gap-3 p-3 transition-colors hover:bg-muted/50",
        !notification.is_read && "bg-primary/5"
      )}
    >
      {/* Unread indicator */}
      {!notification.is_read && (
        <div className="absolute left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary" />
      )}

      {/* Icon */}
      <div className={cn("mt-0.5 flex-shrink-0", iconColor)}>
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {notification.link ? (
          <Link
            href={notification.link}
            onClick={handleClick}
            className="block"
          >
            <p className={cn(
              "text-sm font-medium leading-tight",
              !notification.is_read && "text-foreground",
              notification.is_read && "text-muted-foreground"
            )}>
              {notification.title}
            </p>
            {notification.body && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                {notification.body}
              </p>
            )}
          </Link>
        ) : (
          <>
            <p className={cn(
              "text-sm font-medium leading-tight",
              !notification.is_read && "text-foreground",
              notification.is_read && "text-muted-foreground"
            )}>
              {notification.title}
            </p>
            {notification.body && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                {notification.body}
              </p>
            )}
          </>
        )}
        <p className="mt-1 text-[10px] text-muted-foreground">
          {formatTimeAgo(notification.created_at)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation()
            onDismiss(notification.id)
          }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const { showNotification: showPush, permission: pushPermission } = usePushNotifications()

  const fetchNotifications = useCallback(async () => {
    const [notifs, count] = await Promise.all([
      getNotifications({ limit: 20 }),
      getUnreadCount(),
    ])
    setNotifications(notifs)
    setUnreadCount(count)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Subscribe to realtime notifications
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const newNotification = payload.new as Notification
          setNotifications((prev) => [newNotification, ...prev.slice(0, 19)])
          setUnreadCount((prev) => prev + 1)
          
          // Show browser push notification if enabled
          if (pushPermission === "granted" && !isOpen) {
            showPush(newNotification.title, {
              body: newNotification.body || undefined,
              tag: newNotification.id,
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [pushPermission, showPush, isOpen])

  const handleRead = async (id: string) => {
    await markAsRead(id)
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
      )
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  const handleDismiss = async (id: string) => {
    await dismissNotification(id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    const notification = notifications.find((n) => n.id === id)
    if (notification && !notification.is_read) {
      setUnreadCount((prev) => Math.max(0, prev - 1))
    }
  }

  const handleMarkAllRead = async () => {
    await markAllAsRead()
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
    )
    setUnreadCount(0)
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={handleMarkAllRead}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                We&apos;ll notify you when something happens
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={handleRead}
                  onDismiss={handleDismiss}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Link href="/settings/notifications">
                <Button variant="ghost" className="w-full justify-start gap-2 text-sm">
                  <Settings className="h-4 w-4" />
                  Notification settings
                </Button>
              </Link>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Compact version for mobile
export function NotificationBellCompact() {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    getUnreadCount().then(setUnreadCount)
  }, [])

  return (
    <Link href="/notifications">
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </Button>
    </Link>
  )
}

// ==========================================
// DISCORD-STYLE FULL PANEL VERSION
// ==========================================

// Group notifications by time (Discord-style)
function groupNotifications(notifications: Notification[]) {
  const groups: { label: string; notifications: Notification[] }[] = []
  const now = new Date()
  
  const today: Notification[] = []
  const yesterday: Notification[] = []
  const thisWeek: Notification[] = []
  const older: Notification[] = []
  
  notifications.forEach((n) => {
    const created = new Date(n.created_at)
    const diffMs = now.getTime() - created.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    
    if (diffHours < 24) {
      today.push(n)
    } else if (diffDays < 2) {
      yesterday.push(n)
    } else if (diffDays < 7) {
      thisWeek.push(n)
    } else {
      older.push(n)
    }
  })
  
  if (today.length > 0) groups.push({ label: "Today", notifications: today })
  if (yesterday.length > 0) groups.push({ label: "Yesterday", notifications: yesterday })
  if (thisWeek.length > 0) groups.push({ label: "This Week", notifications: thisWeek })
  if (older.length > 0) groups.push({ label: "Earlier", notifications: older })
  
  return groups
}

// Discord-style notification panel (slide-out)
export function NotificationPanel({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean
  onClose: () => void 
}) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      getNotifications({ limit: 50 }).then((data) => {
        setNotifications(data)
        setLoading(false)
      })
    }
  }, [isOpen])
  
  // Real-time subscription
  useEffect(() => {
    const supabase = createClient()
    
    const channel = supabase
      .channel("notifications-panel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev])
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
  
  const handleRead = async (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    )
    await markAsRead(id)
  }
  
  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    await markAllAsRead()
  }
  
  const unreadCount = notifications.filter(n => !n.is_read).length
  const groups = groupNotifications(notifications)
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />
          
          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md glass-panel-darker border-l border-border/50 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                <h2 className="font-semibold">Notifications</h2>
                {unreadCount > 0 && (
                  <Badge className="bg-primary text-primary-foreground">
                    {unreadCount}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={handleMarkAllRead}
                  >
                    <CheckCheck className="h-4 w-4 mr-1" />
                    Mark all read
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            
            {/* Content */}
            <ScrollArea className="flex-1 esports-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="font-medium">No notifications yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {"We'll notify you about matches, clips, and more"}
                  </p>
                </div>
              ) : (
                <div>
                  {groups.map((group) => (
                    <div key={group.label}>
                      <div className="px-4 py-2 bg-muted/20 border-b border-border/30 sticky top-0">
                        <span className="esports-subheading text-muted-foreground">
                          {group.label}
                        </span>
                      </div>
                      <div className="divide-y divide-border/30">
                        {group.notifications.map((notification) => {
                          const Icon = typeIcons[notification.type] || Bell
                          const iconColor = typeColors[notification.type] || "text-muted-foreground"
                          
                          const content = (
                            <motion.div
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className={cn(
                                "flex gap-3 p-4 cursor-pointer transition-colors",
                                notification.is_read 
                                  ? "hover:bg-muted/20" 
                                  : "bg-primary/5 hover:bg-primary/10"
                              )}
                              onClick={() => {
                                if (!notification.is_read) handleRead(notification.id)
                                if (notification.link) onClose()
                              }}
                            >
                              <div className={cn("mt-0.5", iconColor)}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "text-sm",
                                  !notification.is_read && "font-medium"
                                )}>
                                  {notification.title}
                                </p>
                                {notification.body && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                    {notification.body}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                </p>
                              </div>
                              {!notification.is_read && (
                                <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                              )}
                            </motion.div>
                          )
                          
                          return notification.link ? (
                            <Link key={notification.id} href={notification.link}>
                              {content}
                            </Link>
                          ) : (
                            <div key={notification.id}>{content}</div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            
            {/* Footer */}
            <div className="border-t border-border/50 p-4">
              <Link href="/settings/notifications" onClick={onClose}>
                <Button variant="outline" className="w-full glass-panel border-0">
                  <Settings className="h-4 w-4 mr-2" />
                  Notification Settings
                </Button>
              </Link>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Bell with Discord-style panel
export function NotificationBellWithPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  
  useEffect(() => {
    getUnreadCount().then(setUnreadCount)
    
    // Poll for updates
    const interval = setInterval(() => {
      getUnreadCount().then(setUnreadCount)
    }, 30000)
    return () => clearInterval(interval)
  }, [])
  
  // Real-time updates
  useEffect(() => {
    const supabase = createClient()
    
    const channel = supabase
      .channel("notification-count-panel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => {
          setUnreadCount(prev => prev + 1)
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
  
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(true)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>
      
      <NotificationPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
