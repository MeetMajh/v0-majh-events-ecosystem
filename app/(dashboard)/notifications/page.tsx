"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { formatDistanceToNow } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  Bell,
  CheckCheck,
  Gamepad2,
  Trophy,
  Users,
  Flame,
  Star,
  AlertCircle,
  Radio,
  Clock,
  Settings,
  Filter,
  Trash2,
  Archive,
} from "lucide-react"
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  dismissNotification,
  type Notification,
  type NotificationType,
} from "@/lib/notification-actions"

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

const typeLabels: Record<NotificationType, string> = {
  match_ready: "Match Ready",
  match_starting: "Match Starting",
  match_result: "Match Result",
  tournament_starting: "Tournament",
  round_starting: "Round Starting",
  followed_player_live: "Live Stream",
  followed_player_match: "Following",
  trending_match: "Trending",
  achievement_earned: "Achievement",
  staff_alert: "Staff Alert",
  system: "System",
}

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

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const [typeFilter, setTypeFilter] = useState<NotificationType | "all">("all")

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    const data = await getNotifications({ limit: 100 })
    setNotifications(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient()
    
    const channel = supabase
      .channel("notifications-page")
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

  const handleDismiss = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    await dismissNotification(id)
  }

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    await markAllAsRead()
  }

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    if (filter === "unread" && n.is_read) return false
    if (typeFilter !== "all" && n.type !== typeFilter) return false
    return true
  })

  const unreadCount = notifications.filter(n => !n.is_read).length
  const groups = groupNotifications(filteredNotifications)

  // Get unique notification types
  const notificationTypes = [...new Set(notifications.map(n => n.type))]

  return (
    <div className="container max-w-4xl py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <Badge className="bg-primary text-primary-foreground">
              {unreadCount} unread
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
          )}
          <Link href="/settings/notifications">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "unread")}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">
              Unread
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {notificationTypes.length > 1 && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as NotificationType | "all")}
              className="text-sm bg-background border border-border rounded-md px-2 py-1"
            >
              <option value="all">All Types</option>
              {notificationTypes.map(type => (
                <option key={type} value={type}>{typeLabels[type]}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Notifications List */}
      <div className="glass-panel rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Bell className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium">No notifications</p>
            <p className="text-sm text-muted-foreground mt-1">
              {filter === "unread" 
                ? "You have read all your notifications"
                : "You have no notifications yet"}
            </p>
          </div>
        ) : (
          <div>
            {groups.map((group, groupIndex) => (
              <div key={group.label}>
                <div className="px-4 py-2 bg-muted/30 border-b border-border/30 sticky top-0 z-10">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </span>
                </div>
                <div className="divide-y divide-border/30">
                  <AnimatePresence mode="popLayout">
                    {group.notifications.map((notification, index) => {
                      const Icon = typeIcons[notification.type] || Bell
                      const iconColor = typeColors[notification.type] || "text-muted-foreground"
                      
                      return (
                        <motion.div
                          key={notification.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20, height: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className={cn(
                            "group flex gap-4 p-4 transition-colors",
                            notification.is_read 
                              ? "hover:bg-muted/20" 
                              : "bg-primary/5 hover:bg-primary/10"
                          )}
                        >
                          {/* Icon */}
                          <div className={cn("mt-0.5 shrink-0", iconColor)}>
                            <Icon className="h-5 w-5" />
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            {notification.link ? (
                              <Link 
                                href={notification.link}
                                onClick={() => !notification.is_read && handleRead(notification.id)}
                                className="block"
                              >
                                <p className={cn(
                                  "text-sm",
                                  !notification.is_read && "font-medium"
                                )}>
                                  {notification.title}
                                </p>
                                {notification.body && (
                                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                                    {notification.body}
                                  </p>
                                )}
                              </Link>
                            ) : (
                              <>
                                <p className={cn(
                                  "text-sm",
                                  !notification.is_read && "font-medium"
                                )}>
                                  {notification.title}
                                </p>
                                {notification.body && (
                                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                                    {notification.body}
                                  </p>
                                )}
                              </>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-[10px] h-5">
                                {typeLabels[notification.type]}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                          
                          {/* Unread indicator */}
                          {!notification.is_read && (
                            <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                          )}
                          
                          {/* Actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!notification.is_read && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleRead(notification.id)}
                                title="Mark as read"
                              >
                                <CheckCheck className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDismiss(notification.id)}
                              title="Dismiss"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
