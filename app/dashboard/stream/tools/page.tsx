"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Layers,
  Image as ImageIcon,
  Copy,
  ExternalLink,
  Palette,
  Monitor,
  Trophy,
  Users,
  Clock,
  CheckCircle,
  Download,
  Tv,
  Radio,
  ArrowLeft,
} from "lucide-react"

const fetcher = (url: string) => fetch(url).then(res => res.json())

// Predefined overlay themes
const OVERLAY_THEMES = [
  { id: "default", name: "MAJH Default", primary: "#D4AF37", accent: "#1a1a2e" },
  { id: "esports", name: "Esports Dark", primary: "#8B5CF6", accent: "#0f0f23" },
  { id: "retro", name: "Retro Gaming", primary: "#00FF88", accent: "#1a0a2e" },
  { id: "fire", name: "Fire", primary: "#FF6B35", accent: "#1a0a00" },
  { id: "ice", name: "Ice", primary: "#00D4FF", accent: "#001a2e" },
  { id: "custom", name: "Custom", primary: "", accent: "" },
]

// Stream assets
const STREAM_ASSETS = [
  {
    id: "starting-soon",
    name: "Starting Soon Screen",
    description: "Display before going live",
    type: "image",
    variants: ["1920x1080", "1280x720"],
  },
  {
    id: "brb",
    name: "Be Right Back",
    description: "Break screen overlay",
    type: "image",
    variants: ["1920x1080", "1280x720"],
  },
  {
    id: "ending",
    name: "Stream Ending",
    description: "End of stream screen",
    type: "image",
    variants: ["1920x1080", "1280x720"],
  },
  {
    id: "webcam-frame",
    name: "Webcam Frame",
    description: "Border for your camera",
    type: "image",
    variants: ["square", "wide"],
  },
  {
    id: "alert-follow",
    name: "New Follower Alert",
    description: "Alert when someone follows",
    type: "alert",
    variants: ["animated", "static"],
  },
  {
    id: "chat-overlay",
    name: "Chat Overlay",
    description: "Display chat on stream",
    type: "browser",
    variants: ["default"],
  },
]

export default function StreamerToolsPage() {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [selectedTheme, setSelectedTheme] = useState("default")
  const [customPrimary, setCustomPrimary] = useState("#D4AF37")
  const [customAccent, setCustomAccent] = useState("#1a1a2e")

  const { data: tournamentsData } = useSWR<{ data: any[] }>("/api/tournaments?status=in_progress", fetcher)
  const { data: matchesData } = useSWR<{ data: any[] }>("/api/matches?feature=true", fetcher)

  const liveTournaments = tournamentsData?.data || []
  const featureMatches = matchesData?.data || []

  const theme = OVERLAY_THEMES.find(t => t.id === selectedTheme) || OVERLAY_THEMES[0]
  const primaryColor = selectedTheme === "custom" ? customPrimary : theme.primary
  const accentColor = selectedTheme === "custom" ? customAccent : theme.accent

  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    setTimeout(() => setCopiedUrl(null), 2000)
  }

  const buildOverlayUrl = (path: string) => {
    const params = new URLSearchParams({
      primary: primaryColor.replace("#", ""),
      accent: accentColor.replace("#", ""),
    })
    return `${baseUrl}${path}?${params}`
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8">
        <Link 
          href="/dashboard/stream" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Go Live
        </Link>
        <h1 className="text-3xl font-bold">Streamer Tools</h1>
        <p className="text-muted-foreground mt-1">
          Overlays, assets, and tools for your stream
        </p>
      </div>

      <Tabs defaultValue="overlays" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overlays" className="gap-2">
            <Layers className="h-4 w-4" />
            OBS Overlays
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-2">
            <ImageIcon className="h-4 w-4" />
            Stream Assets
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <Radio className="h-4 w-4" />
            Alerts
          </TabsTrigger>
        </TabsList>

        {/* OBS Overlays Tab */}
        <TabsContent value="overlays" className="space-y-6">
          {/* Theme Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Overlay Theme
              </CardTitle>
              <CardDescription>
                Choose a theme for your overlays
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {OVERLAY_THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTheme(t.id)}
                    className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                      selectedTheme === t.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {t.id !== "custom" && (
                        <div
                          className="h-8 w-8 rounded-full border"
                          style={{ backgroundColor: t.primary }}
                        />
                      )}
                      {t.id === "custom" && (
                        <div className="h-8 w-8 rounded-full border bg-gradient-to-br from-pink-500 to-blue-500" />
                      )}
                      <span className="font-medium">{t.name}</span>
                    </div>
                    {selectedTheme === t.id && (
                      <CheckCircle className="absolute top-2 right-2 h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>

              {selectedTheme === "custom" && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={customPrimary}
                        onChange={(e) => setCustomPrimary(e.target.value)}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={customPrimary}
                        onChange={(e) => setCustomPrimary(e.target.value)}
                        placeholder="#D4AF37"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Background Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={customAccent}
                        onChange={(e) => setCustomAccent(e.target.value)}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={customAccent}
                        onChange={(e) => setCustomAccent(e.target.value)}
                        placeholder="#1a1a2e"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Available Overlays */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Match Overlay */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Match Overlay
                </CardTitle>
                <CardDescription>
                  Shows player names, scores, and timer for a specific match
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {featureMatches.length > 0 ? (
                  <div className="space-y-3">
                    {featureMatches.slice(0, 3).map((match: any) => (
                      <div key={match.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">
                            {match.player1_name || "TBD"} vs {match.player2_name || "TBD"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {match.tournament_name} - Round {match.round_number}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(buildOverlayUrl(`/overlay/match/${match.id}`))}
                        >
                          {copiedUrl?.includes(match.id) ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No active feature matches</p>
                    <p className="text-xs">Start a tournament to use match overlays</p>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <Label className="text-xs text-muted-foreground">Manual URL (replace MATCH_ID)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={buildOverlayUrl("/overlay/match/MATCH_ID")}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => copyToClipboard(buildOverlayUrl("/overlay/match/MATCH_ID"))}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Standings Overlay */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Standings Overlay
                </CardTitle>
                <CardDescription>
                  Shows tournament standings and rankings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {liveTournaments.length > 0 ? (
                  <div className="space-y-3">
                    {liveTournaments.slice(0, 3).map((tournament: any) => (
                      <div key={tournament.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{tournament.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {tournament.player_count} players
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(buildOverlayUrl(`/overlay/tournament/${tournament.slug}/standings`))}
                        >
                          {copiedUrl?.includes(tournament.slug) ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No active tournaments</p>
                    <p className="text-xs">Start a tournament to use standings overlay</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Timer Overlay */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Round Timer
                </CardTitle>
                <CardDescription>
                  Standalone timer for rounds
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-4 px-6 bg-muted/50 rounded-lg">
                  <div className="text-4xl font-mono font-bold text-primary">50:00</div>
                  <p className="text-sm text-muted-foreground mt-1">Preview</p>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={buildOverlayUrl("/overlay/timer")}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(buildOverlayUrl("/overlay/timer"))}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Chat Overlay */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tv className="h-5 w-5" />
                  Chat Overlay
                </CardTitle>
                <CardDescription>
                  Display stream chat on your broadcast
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-6 text-muted-foreground">
                  <Tv className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Coming Soon</p>
                  <p className="text-xs">Chat overlay integration</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* OBS Setup Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                How to Add Overlays in OBS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium shrink-0">1</span>
                  <span>In OBS, click the + button under Sources</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium shrink-0">2</span>
                  <span>Select &quot;Browser&quot; and give it a name</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium shrink-0">3</span>
                  <span>Paste the overlay URL and set width/height (1920x1080 recommended)</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium shrink-0">4</span>
                  <span>Position the overlay where you want it on your stream</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium shrink-0">5</span>
                  <span>The overlay updates automatically - no refresh needed!</span>
                </li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stream Assets Tab */}
        <TabsContent value="assets" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Downloadable Assets</CardTitle>
              <CardDescription>
                Graphics and images for your stream
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {STREAM_ASSETS.filter(a => a.type === "image").map((asset) => (
                  <div key={asset.id} className="p-4 border rounded-lg space-y-3">
                    <div className="aspect-video bg-muted rounded flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium">{asset.name}</h3>
                      <p className="text-sm text-muted-foreground">{asset.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {asset.variants.map((variant) => (
                        <Button key={variant} size="sm" variant="outline" className="gap-1">
                          <Download className="h-3 w-3" />
                          {variant}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  More assets coming soon! Request specific assets in our Discord.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Stream Alerts</CardTitle>
              <CardDescription>
                Notifications and alerts for your stream
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Radio className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="font-medium text-foreground mb-2">Alerts Coming Soon</h3>
                <p className="text-sm max-w-md mx-auto">
                  We&apos;re working on follower alerts, donation alerts, and more. 
                  Stay tuned for updates!
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
