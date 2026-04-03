"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  Mic,
  MicOff,
  Copy,
  ExternalLink,
  Users,
  Trophy,
  Clock,
  ChevronRight,
  Star,
  Radio,
  Play,
  Pause,
  SkipForward,
  MessageSquare,
  FileText,
  User,
  Swords,
  TrendingUp,
  Target,
  RefreshCw,
  Maximize,
  ArrowLeft,
} from "lucide-react"
import { toast } from "sonner"

interface Match {
  id: string
  player1_id: string | null
  player2_id: string | null
  player1_wins: number | null
  player2_wins: number | null
  draws: number | null
  status: string
  table_number: number | null
  is_feature_match: boolean
  stream_url: string | null
  round_number: number
}

interface Player {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  match_wins?: number
  match_losses?: number
  game_wins?: number
  game_losses?: number
}

interface Tournament {
  id: string
  name: string
  slug: string
  status: string
  game_name: string | null
}

export default function CasterDashboardPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClient()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [featureMatches, setFeatureMatches] = useState<Match[]>([])
  const [allMatches, setAllMatches] = useState<Match[]>([])
  const [players, setPlayers] = useState<Map<string, Player>>(new Map())
  const [standings, setStandings] = useState<any[]>([])
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [notes, setNotes] = useState("")
  const [talkingPoints, setTalkingPoints] = useState<string[]>([])
  const [newPoint, setNewPoint] = useState("")
  const [isLive, setIsLive] = useState(false)
  const [currentRound, setCurrentRound] = useState<number>(1)
  const [loading, setLoading] = useState(true)

  // Fetch tournament data
  const fetchData = useCallback(async () => {
    // Get tournament
    const { data: t } = await supabase
      .from("tournaments")
      .select("id, name, slug, status, games(name)")
      .eq("slug", slug)
      .single()

    if (!t) return

    setTournament({
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      game_name: (t.games as any)?.name || null,
    })

    // Get current round matches
    const { data: phases } = await supabase
      .from("tournament_phases")
      .select("id")
      .eq("tournament_id", t.id)
      .eq("is_current", true)
      .single()

    if (phases) {
      const { data: rounds } = await supabase
        .from("tournament_rounds")
        .select("id, round_number, status")
        .eq("phase_id", phases.id)
        .eq("status", "active")
        .order("round_number", { ascending: false })
        .limit(1)

      if (rounds && rounds.length > 0) {
        setCurrentRound(rounds[0].round_number)

        const { data: matches } = await supabase
          .from("tournament_matches")
          .select("id, player1_id, player2_id, player1_wins, player2_wins, draws, status, table_number, is_feature_match, stream_url")
          .eq("round_id", rounds[0].id)
          .eq("is_bye", false)

        if (matches) {
          const matchesWithRound = matches.map(m => ({ ...m, round_number: rounds[0].round_number }))
          setAllMatches(matchesWithRound)
          setFeatureMatches(matchesWithRound.filter(m => m.is_feature_match))

          // Get all player IDs
          const playerIds = new Set<string>()
          matches.forEach(m => {
            if (m.player1_id) playerIds.add(m.player1_id)
            if (m.player2_id) playerIds.add(m.player2_id)
          })

          if (playerIds.size > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, first_name, last_name, avatar_url")
              .in("id", Array.from(playerIds))

            if (profiles) {
              const playerMap = new Map<string, Player>()
              profiles.forEach(p => playerMap.set(p.id, p))
              setPlayers(playerMap)
            }
          }
        }
      }
    }

    // Get standings
    const { data: standingsData } = await supabase
      .from("tournament_standings")
      .select("*, profiles(first_name, last_name, avatar_url)")
      .eq("tournament_id", t.id)
      .order("rank", { ascending: true })
      .limit(16)

    if (standingsData) {
      setStandings(standingsData)
    }

    setLoading(false)
  }, [slug, supabase])

  useEffect(() => {
    fetchData()

    // Set up realtime subscription
    const channel = supabase
      .channel(`caster-${slug}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_matches" },
        () => fetchData()
      )
      .subscribe()

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [fetchData, slug, supabase])

  const getPlayerName = (playerId: string | null) => {
    if (!playerId) return "TBD"
    const player = players.get(playerId)
    if (!player) return "Unknown"
    return `${player.first_name || ""} ${player.last_name || ""}`.trim() || "Unknown"
  }

  const getPlayerRecord = (playerId: string | null) => {
    const standing = standings.find(s => s.player_id === playerId)
    if (!standing) return null
    return `${standing.match_wins}-${standing.match_losses}`
  }

  const addTalkingPoint = () => {
    if (newPoint.trim()) {
      setTalkingPoints([...talkingPoints, newPoint.trim()])
      setNewPoint("")
    }
  }

  const removeTalkingPoint = (index: number) => {
    setTalkingPoints(talkingPoints.filter((_, i) => i !== index))
  }

  const copyOverlayUrl = (matchId: string) => {
    const url = `${window.location.origin}/overlay/match/${matchId}`
    navigator.clipboard.writeText(url)
    toast.success("Overlay URL copied!")
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Tournament not found</p>
        <Button asChild variant="outline">
          <Link href="/esports">Back to Esports</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/esports/tournaments/${slug}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-sm font-semibold">{tournament.name}</h1>
              <p className="text-xs text-muted-foreground">Caster Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={tournament.status === "in_progress" ? "destructive" : "secondary"}>
              {tournament.status === "in_progress" ? (
                <><Radio className="mr-1 h-3 w-3 animate-pulse" /> LIVE</>
              ) : tournament.status}
            </Badge>
            <Badge variant="outline">Round {currentRound}</Badge>
            <Button
              variant={isLive ? "destructive" : "default"}
              size="sm"
              onClick={() => setIsLive(!isLive)}
              className="gap-2"
            >
              {isLive ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {isLive ? "End Cast" : "Start Cast"}
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content - Left 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Feature Matches */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    <CardTitle>Feature Matches</CardTitle>
                  </div>
                  <Button variant="ghost" size="sm" onClick={fetchData}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {featureMatches.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    No feature matches set for this round
                  </p>
                ) : (
                  <div className="space-y-3">
                    {featureMatches.map((match) => (
                      <div
                        key={match.id}
                        className={cn(
                          "rounded-lg border p-4 transition-colors cursor-pointer",
                          selectedMatch?.id === match.id
                            ? "border-primary bg-primary/5"
                            : "hover:border-primary/50"
                        )}
                        onClick={() => setSelectedMatch(match)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {match.table_number && (
                              <Badge variant="outline">Table {match.table_number}</Badge>
                            )}
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="font-medium">{getPlayerName(match.player1_id)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {getPlayerRecord(match.player1_id)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 rounded bg-muted px-3 py-1">
                                <span className="text-lg font-bold">{match.player1_wins ?? 0}</span>
                                <span className="text-muted-foreground">-</span>
                                <span className="text-lg font-bold">{match.player2_wins ?? 0}</span>
                              </div>
                              <div>
                                <p className="font-medium">{getPlayerName(match.player2_id)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {getPlayerRecord(match.player2_id)}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={match.status === "confirmed" ? "default" : "secondary"}
                            >
                              {match.status.replace("_", " ")}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                copyOverlayUrl(match.id)
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                window.open(`/overlay/match/${match.id}`, "_blank")
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* All Round Matches */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Swords className="h-5 w-5" />
                    Round {currentRound} Matches
                  </CardTitle>
                  <Badge variant="outline">
                    {allMatches.filter(m => m.status === "confirmed").length} / {allMatches.length} complete
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {allMatches.map((match) => (
                      <div
                        key={match.id}
                        className={cn(
                          "flex items-center justify-between rounded-lg border p-3 text-sm",
                          match.is_feature_match && "border-yellow-500/50 bg-yellow-500/5",
                          match.status === "confirmed" && "opacity-60"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {match.table_number && (
                            <span className="text-xs text-muted-foreground w-12">
                              T{match.table_number}
                            </span>
                          )}
                          <span className={cn(
                            match.player1_wins !== null && match.player2_wins !== null &&
                            match.player1_wins > match.player2_wins && "font-semibold"
                          )}>
                            {getPlayerName(match.player1_id)}
                          </span>
                          <span className="text-muted-foreground">vs</span>
                          <span className={cn(
                            match.player1_wins !== null && match.player2_wins !== null &&
                            match.player2_wins > match.player1_wins && "font-semibold"
                          )}>
                            {getPlayerName(match.player2_id)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {match.player1_wins !== null && (
                            <span className="font-mono text-xs">
                              {match.player1_wins}-{match.player2_wins}
                            </span>
                          )}
                          {match.is_feature_match && (
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            {match.status.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Right column */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{allMatches.length}</p>
                  <p className="text-xs text-muted-foreground">Total Matches</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {allMatches.filter(m => m.status === "confirmed").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Complete</p>
                </CardContent>
              </Card>
            </div>

            {/* Talking Points */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4" />
                  Talking Points
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a talking point..."
                    value={newPoint}
                    onChange={(e) => setNewPoint(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTalkingPoint()}
                  />
                  <Button size="sm" onClick={addTalkingPoint}>Add</Button>
                </div>
                <ScrollArea className="h-[150px]">
                  <div className="space-y-2">
                    {talkingPoints.map((point, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 rounded bg-muted p-2 text-sm"
                      >
                        <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                        <span className="flex-1">{point}</span>
                        <button
                          onClick={() => removeTalkingPoint(i)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {talkingPoints.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-4">
                        No talking points yet
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Top Standings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" />
                  Top Players
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {standings.slice(0, 8).map((s, i) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "w-5 text-center font-mono text-xs",
                            i === 0 && "text-yellow-500 font-bold",
                            i === 1 && "text-gray-400 font-bold",
                            i === 2 && "text-amber-600 font-bold"
                          )}>
                            {i + 1}
                          </span>
                          <span>
                            {s.profiles?.first_name} {s.profiles?.last_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">
                            {s.match_wins}-{s.match_losses}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            ({s.match_points}pts)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  Cast Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Your personal notes for the cast..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
