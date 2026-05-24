"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Radio,
  MonitorPlay,
  Layers,
  Palette,
  Copy,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  Timer,
  Users,
  Trophy,
  Play,
  Pause,
  RotateCcw,
  Settings,
  Layout,
  Sparkles,
  Wand2,
  AlertCircle,
} from "lucide-react"

interface Tournament {
  id: string
  name: string
  slug: string
  status: string
}

interface OverlaySettings {
  theme: string
  layout: string
  showTimer: boolean
  showRound: boolean
  showRecords: boolean
  showAvatars: boolean
  showTournamentName: boolean
  primaryColor: string
  accentColor: string
  backgroundOpacity: number
}

interface Scene {
  id: string
  name: string
  type: "match" | "standings" | "bracket" | "custom"
  config: Record<string, unknown>
}

const DEFAULT_OVERLAY: OverlaySettings = {
  theme: "dark",
  layout: "standard",
  showTimer: true,
  showRound: true,
  showRecords: true,
  showAvatars: true,
  showTournamentName: true,
  primaryColor: "#6366f1",
  accentColor: "#22c55e",
  backgroundOpacity: 0.85,
}

const PRESET_THEMES = [
  { name: "MAJH Purple", primary: "#6366f1", accent: "#22c55e" },
  { name: "Esports Red", primary: "#dc2626", accent: "#fbbf24" },
  { name: "Ocean Blue", primary: "#0ea5e9", accent: "#14b8a6" },
  { name: "Midnight", primary: "#1e293b", accent: "#8b5cf6" },
  { name: "Fire", primary: "#ea580c", accent: "#fcd34d" },
  { name: "Forest", primary: "#16a34a", accent: "#84cc16" },
]

export default function BroadcastControlPage() {
  const supabase = createClient()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [selectedTournament, setSelectedTournament] = useState<string>("")
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>(DEFAULT_OVERLAY)
  const [scenes, setScenes] = useState<Scene[]>([
    { id: "1", name: "Match Overlay", type: "match", config: {} },
    { id: "2", name: "Standings", type: "standings", config: {} },
    { id: "3", name: "Bracket View", type: "bracket", config: {} },
  ])
  const [activeScene, setActiveScene] = useState<string>("1")
  const [isLive, setIsLive] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(50 * 60)
  const [timerRunning, setTimerRunning] = useState(false)
  const [loading, setLoading] = useState(true)

  // Fetch active tournaments
  useEffect(() => {
    const fetchTournaments = async () => {
      const { data } = await supabase
        .from("tournaments")
        .select("id, name, slug, status")
        .in("status", ["registration", "in_progress"])
        .order("start_date", { ascending: false })
        .limit(20)

      if (data) {
        setTournaments(data)
        if (data.length > 0 && !selectedTournament) {
          setSelectedTournament(data[0].id)
        }
      }
      setLoading(false)
    }

    fetchTournaments()
  }, [supabase, selectedTournament])

  // Timer countdown
  useEffect(() => {
    if (!timerRunning) return
    const interval = setInterval(() => {
      setTimerSeconds((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [timerRunning])

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const copyOverlayUrl = (type: string, matchId?: string) => {
    const tournament = tournaments.find((t) => t.id === selectedTournament)
    if (!tournament) return

    let url = ""
    switch (type) {
      case "match":
        url = matchId
          ? `${window.location.origin}/overlay/match/${matchId}`
          : `${window.location.origin}/overlay/tournament/${tournament.slug}/match`
        break
      case "standings":
        url = `${window.location.origin}/overlay/tournament/${tournament.slug}/standings`
        break
      case "bracket":
        url = `${window.location.origin}/overlay/tournament/${tournament.slug}/bracket`
        break
    }

    navigator.clipboard.writeText(url)
    toast.success("Overlay URL copied!")
  }

  const applyTheme = (theme: (typeof PRESET_THEMES)[0]) => {
    setOverlaySettings((prev) => ({
      ...prev,
      primaryColor: theme.primary,
      accentColor: theme.accent,
    }))
    toast.success(`Applied ${theme.name} theme`)
  }

  const updateOverlaySetting = <K extends keyof OverlaySettings>(
    key: K,
    value: OverlaySettings[K]
  ) => {
    setOverlaySettings((prev) => ({ ...prev, [key]: value }))
  }

  const saveOverlaySettings = async () => {
    // In a real app, this would save to the database
    toast.success("Overlay settings saved")
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-panel-darker sticky top-0 z-50 border-b border-border/30">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <MonitorPlay className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-sm font-semibold">Broadcast Control</h1>
              <p className="text-xs text-muted-foreground">OBS Overlays & Scenes</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedTournament} onValueChange={setSelectedTournament}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select tournament" />
              </SelectTrigger>
              <SelectContent>
                {tournaments.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={isLive ? "destructive" : "default"}
              className="gap-2"
              onClick={() => setIsLive(!isLive)}
            >
              <Radio className={cn("h-4 w-4", isLive && "animate-pulse")} />
              {isLive ? "END BROADCAST" : "GO LIVE"}
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Panel - Scene Manager */}
          <div className="space-y-6">
            {/* Live Status */}
            <Card className={cn(isLive && "border-red-500/50 bg-red-500/5")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "h-3 w-3 rounded-full",
                        isLive ? "bg-red-500 animate-pulse" : "bg-muted"
                      )}
                    />
                    <span className="font-medium">
                      {isLive ? "LIVE" : "Offline"}
                    </span>
                  </div>
                  {isLive && (
                    <Badge variant="destructive">Broadcasting</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Scene Switcher */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="h-4 w-4" />
                  Scenes
                </CardTitle>
                <CardDescription>Switch between overlay views</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {scenes.map((scene) => (
                  <div
                    key={scene.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors",
                      activeScene === scene.id
                        ? "border-primary bg-primary/10"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => setActiveScene(scene.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          activeScene === scene.id ? "bg-primary" : "bg-muted"
                        )}
                      />
                      <span className="font-medium">{scene.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {scene.type}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Round Timer */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Timer className="h-4 w-4" />
                  Round Timer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <span
                    className={cn(
                      "font-mono text-4xl font-bold",
                      timerSeconds < 300 && "text-red-500"
                    )}
                  >
                    {formatTimer(timerSeconds)}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setTimerSeconds(50 * 60)}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={timerRunning ? "destructive" : "default"}
                    size="lg"
                    className="gap-2 px-8"
                    onClick={() => setTimerRunning(!timerRunning)}
                  >
                    {timerRunning ? (
                      <>
                        <Pause className="h-4 w-4" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Start
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setTimerSeconds((prev) => Math.max(0, prev - 60))
                    }
                  >
                    -1m
                  </Button>
                </div>
                <div className="flex justify-center gap-2">
                  {[50, 40, 30, 20, 10].map((mins) => (
                    <Button
                      key={mins}
                      variant="ghost"
                      size="sm"
                      onClick={() => setTimerSeconds(mins * 60)}
                    >
                      {mins}m
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Center Panel - Preview & Overlay URLs */}
          <div className="space-y-6">
            {/* Preview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Eye className="h-4 w-4" />
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="aspect-video rounded-lg overflow-hidden"
                  style={{
                    backgroundColor: `rgba(0,0,0,${overlaySettings.backgroundOpacity})`,
                  }}
                >
                  {/* Mini preview of overlay */}
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center space-y-2 p-4">
                      <div
                        className="h-2 w-24 rounded mx-auto"
                        style={{ backgroundColor: overlaySettings.primaryColor }}
                      />
                      <div className="flex items-center justify-center gap-4">
                        <div className="text-white font-bold">Player 1</div>
                        <div className="flex gap-2">
                          <span
                            className="w-8 h-8 rounded flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: overlaySettings.accentColor }}
                          >
                            2
                          </span>
                          <span className="text-white/40">-</span>
                          <span className="w-8 h-8 rounded flex items-center justify-center text-white font-bold bg-white/10">
                            1
                          </span>
                        </div>
                        <div className="text-white font-bold">Player 2</div>
                      </div>
                      {overlaySettings.showTimer && (
                        <div className="text-white/60 text-sm font-mono">
                          {formatTimer(timerSeconds)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Overlay URLs */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MonitorPlay className="h-4 w-4" />
                  OBS Browser Sources
                </CardTitle>
                <CardDescription>
                  Add these URLs as browser sources in OBS
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Match Overlay", type: "match", recommended: "1920x200" },
                  { label: "Standings", type: "standings", recommended: "400x800" },
                  { label: "Bracket", type: "bracket", recommended: "1920x1080" },
                ].map((item) => (
                  <div
                    key={item.type}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        Recommended: {item.recommended}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyOverlayUrl(item.type)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const tournament = tournaments.find(
                            (t) => t.id === selectedTournament
                          )
                          if (tournament) {
                            window.open(
                              `/overlay/tournament/${tournament.slug}/${item.type}`,
                              "_blank"
                            )
                          }
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Overlay Customization */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Palette className="h-4 w-4" />
                  Overlay Style
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="theme" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="theme">Theme</TabsTrigger>
                    <TabsTrigger value="layout">Layout</TabsTrigger>
                    <TabsTrigger value="elements">Elements</TabsTrigger>
                  </TabsList>

                  <TabsContent value="theme" className="space-y-4">
                    {/* Preset Themes */}
                    <div className="space-y-2">
                      <Label>Preset Themes</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {PRESET_THEMES.map((theme) => (
                          <button
                            key={theme.name}
                            className="rounded-lg border p-2 hover:bg-muted/50 transition-colors"
                            onClick={() => applyTheme(theme)}
                          >
                            <div className="flex gap-1 mb-1">
                              <div
                                className="h-4 w-4 rounded"
                                style={{ backgroundColor: theme.primary }}
                              />
                              <div
                                className="h-4 w-4 rounded"
                                style={{ backgroundColor: theme.accent }}
                              />
                            </div>
                            <p className="text-xs">{theme.name}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Colors */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Primary Color</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={overlaySettings.primaryColor}
                            onChange={(e) =>
                              updateOverlaySetting("primaryColor", e.target.value)
                            }
                            className="h-10 w-10 rounded cursor-pointer"
                          />
                          <Input
                            value={overlaySettings.primaryColor}
                            onChange={(e) =>
                              updateOverlaySetting("primaryColor", e.target.value)
                            }
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Accent Color</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={overlaySettings.accentColor}
                            onChange={(e) =>
                              updateOverlaySetting("accentColor", e.target.value)
                            }
                            className="h-10 w-10 rounded cursor-pointer"
                          />
                          <Input
                            value={overlaySettings.accentColor}
                            onChange={(e) =>
                              updateOverlaySetting("accentColor", e.target.value)
                            }
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Opacity */}
                    <div className="space-y-2">
                      <Label>Background Opacity</Label>
                      <Slider
                        value={[overlaySettings.backgroundOpacity * 100]}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={(v) =>
                          updateOverlaySetting("backgroundOpacity", v[0] / 100)
                        }
                      />
                      <p className="text-xs text-muted-foreground text-right">
                        {Math.round(overlaySettings.backgroundOpacity * 100)}%
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="layout" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Layout Style</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {["standard", "compact", "vertical", "minimal"].map(
                          (layout) => (
                            <button
                              key={layout}
                              className={cn(
                                "rounded-lg border p-3 text-left transition-colors",
                                overlaySettings.layout === layout
                                  ? "border-primary bg-primary/10"
                                  : "hover:bg-muted/50"
                              )}
                              onClick={() =>
                                updateOverlaySetting("layout", layout)
                              }
                            >
                              <p className="font-medium capitalize">{layout}</p>
                              <p className="text-xs text-muted-foreground">
                                {layout === "standard" && "Full horizontal bar"}
                                {layout === "compact" && "Smaller horizontal"}
                                {layout === "vertical" && "Side panel style"}
                                {layout === "minimal" && "Score only"}
                              </p>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="elements" className="space-y-4">
                    {[
                      { key: "showTimer", label: "Show Timer" },
                      { key: "showRound", label: "Show Round Number" },
                      { key: "showRecords", label: "Show Player Records" },
                      { key: "showAvatars", label: "Show Avatars" },
                      { key: "showTournamentName", label: "Show Tournament Name" },
                    ].map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between"
                      >
                        <Label>{item.label}</Label>
                        <Switch
                          checked={
                            overlaySettings[item.key as keyof OverlaySettings] as boolean
                          }
                          onCheckedChange={(checked) =>
                            updateOverlaySetting(
                              item.key as keyof OverlaySettings,
                              checked as never
                            )
                          }
                        />
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>

                <Separator className="my-4" />

                <Button className="w-full" onClick={saveOverlaySettings}>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Save Settings
                </Button>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Refresh All Overlays
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Show Technical Difficulties
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" asChild>
                  <Link href={`/esports/tournaments/${tournaments.find(t => t.id === selectedTournament)?.slug}/cast`}>
                    <Users className="h-4 w-4" />
                    Open Caster Dashboard
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
