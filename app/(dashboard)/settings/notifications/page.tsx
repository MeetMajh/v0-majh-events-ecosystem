"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Bell,
  Gamepad2,
  Trophy,
  Users,
  Flame,
  Star,
  AlertCircle,
  Radio,
  Clock,
  Mail,
  Smartphone,
  Moon,
  Save,
  ArrowLeft,
} from "lucide-react"
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notification-actions"
import Link from "next/link"

const notificationTypes = [
  {
    key: "match_ready" as const,
    label: "Match Ready",
    description: "Get notified when your match is ready to play",
    icon: Gamepad2,
  },
  {
    key: "match_starting" as const,
    label: "Match Starting",
    description: "Reminder when your match is about to start",
    icon: Clock,
  },
  {
    key: "match_result" as const,
    label: "Match Results",
    description: "Get notified when match results are recorded",
    icon: Trophy,
  },
  {
    key: "tournament_starting" as const,
    label: "Tournament Starting",
    description: "Notification when a tournament you registered for begins",
    icon: Trophy,
  },
  {
    key: "round_starting" as const,
    label: "Round Starting",
    description: "Get notified when a new round starts",
    icon: Radio,
  },
  {
    key: "followed_player_live" as const,
    label: "Followed Player Live",
    description: "Get notified when a player you follow goes live",
    icon: Radio,
  },
  {
    key: "followed_player_match" as const,
    label: "Followed Player Match",
    description: "Get notified when a player you follow has a match",
    icon: Users,
  },
  {
    key: "trending_match" as const,
    label: "Trending Matches",
    description: "Get notified about trending/hot matches",
    icon: Flame,
  },
  {
    key: "achievement_earned" as const,
    label: "Achievements",
    description: "Get notified when you earn achievements",
    icon: Star,
  },
  {
    key: "staff_alert" as const,
    label: "Staff Alerts",
    description: "Important alerts from tournament staff",
    icon: AlertCircle,
  },
]

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    async function loadPreferences() {
      const prefs = await getNotificationPreferences()
      setPreferences(prefs)
      setLoading(false)
    }
    loadPreferences()
  }, [])

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    if (!preferences) return
    setPreferences({ ...preferences, [key]: value })
  }

  const handleSave = async () => {
    if (!preferences) return
    
    setSaving(true)
    const result = await updateNotificationPreferences(preferences)
    setSaving(false)

    if (result.success) {
      toast({
        title: "Preferences saved",
        description: "Your notification preferences have been updated.",
      })
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to save preferences",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!preferences) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Please sign in to manage notification preferences.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Notification Settings</h1>
          <p className="text-muted-foreground">Control how and when you receive notifications</p>
        </div>
      </div>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Types
          </CardTitle>
          <CardDescription>
            Choose which notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {notificationTypes.map((type, index) => {
            const Icon = type.icon
            return (
              <div key={type.key}>
                {index > 0 && <Separator className="mb-4" />}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-muted p-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <Label htmlFor={type.key} className="text-sm font-medium">
                        {type.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{type.description}</p>
                    </div>
                  </div>
                  <Switch
                    id={type.key}
                    checked={preferences[type.key]}
                    onCheckedChange={(checked) => handleToggle(type.key, checked)}
                  />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Delivery Methods */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Methods</CardTitle>
          <CardDescription>
            How would you like to receive notifications?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <Label htmlFor="in_app">In-App Notifications</Label>
                <p className="text-xs text-muted-foreground">Show notifications in the app</p>
              </div>
            </div>
            <Switch
              id="in_app"
              checked={preferences.in_app}
              onCheckedChange={(checked) => handleToggle("in_app", checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <Label htmlFor="email">Email Notifications</Label>
                <p className="text-xs text-muted-foreground">Receive notifications via email</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Coming Soon</Badge>
              <Switch
                id="email"
                checked={preferences.email}
                onCheckedChange={(checked) => handleToggle("email", checked)}
                disabled
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <Label htmlFor="push">Push Notifications</Label>
                <p className="text-xs text-muted-foreground">Receive push notifications on mobile</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Coming Soon</Badge>
              <Switch
                id="push"
                checked={preferences.push}
                onCheckedChange={(checked) => handleToggle("push", checked)}
                disabled
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
          <CardDescription>
            Pause notifications during specific times
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="quiet_hours">Enable Quiet Hours</Label>
              <p className="text-xs text-muted-foreground">
                No notifications during quiet hours
              </p>
            </div>
            <Switch
              id="quiet_hours"
              checked={preferences.quiet_hours_enabled}
              onCheckedChange={(checked) => handleToggle("quiet_hours_enabled", checked)}
            />
          </div>

          {preferences.quiet_hours_enabled && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <Label htmlFor="quiet_start" className="text-xs">Start Time</Label>
                <Input
                  id="quiet_start"
                  type="time"
                  value={preferences.quiet_hours_start || "22:00"}
                  onChange={(e) =>
                    setPreferences({ ...preferences, quiet_hours_start: e.target.value })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="quiet_end" className="text-xs">End Time</Label>
                <Input
                  id="quiet_end"
                  type="time"
                  value={preferences.quiet_hours_end || "08:00"}
                  onChange={(e) =>
                    setPreferences({ ...preferences, quiet_hours_end: e.target.value })
                  }
                  className="mt-1"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Preferences
        </Button>
      </div>
    </div>
  )
}
