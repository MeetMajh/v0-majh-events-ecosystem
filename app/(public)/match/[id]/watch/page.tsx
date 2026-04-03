"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  Radio,
  Trophy,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Clock,
  Swords,
  BarChart3,
  History,
  ExternalLink,
  Eye,
  Wifi,
  WifiOff,
  Flame,
  TrendingUp,
  MessageSquare,
  Zap,
} from "lucide-react"
import { ReactionsBar, ReactionFeed } from "@/components/esports/reactions-bar"
import { MatchPredictions } from "@/components/esports/match-predictions"
import { ViewerCount, EngagementStats } from "@/components/esports/viewer-presence"
import { MatchChat } from "@/components/esports/match-chat"
import { MomentumBadge, MomentumIndicator, GameHistoryBar } from "@/components/esports/momentum-badge"
import { getMatchMomentum, getMatchGameHistory, type MatchMomentum } from "@/lib/tournament-controller-actions"

interface MatchData {
  id: string
  player1_id: string
  player2_id: string
  player1_wins: number
  player2_wins: number
  draws: number
  status: string
  table_number?: number
  stream_url?: string
  stream_platform?: string
  stream_embed_url?: string
  viewer_count?: number
  timer_started_at?: string
  timer_duration_seconds?: number
  round_number?: number
  tournament?: {
    id: string
    name: string
    slug: string
    game_name?: string
    game_slug?: string
  }
  player1?: {
    id: string
    first_name?: string
    last_name?: string
    avatar_url?: string
    match_record?: { wins: number; losses: number; draws: number }
  }
  player2?: {
    id: string
    first_name?: string
    last_name?: string
    avatar_url?: string
    match_record?: { wins: number; losses: number; draws: number }
  }
}

interface OtherMatch {
  id: string
  player1_name: string
  player2_name: string
  player1_wins: number
  player2_wins: number
  status: string
  has_stream: boolean
}

function getPlayerName(player: any): string {
  if (!player) return "TBD"
  return `${player.first_name || ""} ${player.last_name || ""}`.trim() || "Unknown"
}

function getInitials(player: any): string {
  if (!player) return "?"
  const first = player.first_name?.[0] || ""
  const last = player.last_name?.[0] || ""
  return (first + last).toUpperCase() || "?"
}

function getEmbedUrl(url: string, platform: string): string {
  if (platform === "youtube") {
    const videoId = url.match(/(?:v=|\/)([\w-]{11})/)?.[1]
    if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1`
  } else if (platform === "twitch") {
    const channel = url.match(/twitch\.tv\/(\w+)/)?.[1]
    if (channel) return `https://player.twitch.tv/?channel=${channel}&parent=${typeof window !== "undefined" ? window.location.hostname : "localhost"}`
  } else if (platform === "kick") {
    const channel = url.match(/kick\.com\/(\w+)/)?.[1]
    if (channel) return `https://player.kick.com/${channel}`
  }
  return url
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export default function MatchWatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = use(params)
  const router = useRouter()
  const [match, setMatch] = useState<MatchData | null>(null)
  const [otherMatches, setOtherMatches] = useState<OtherMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState("stats")

  useEffect(() => {
    const supabase = createClient()

    async function fetchMatch() {
      const { data: matchData } = await supabase
        .from("tournament_matches")
.select(`
      id, player1_id, player2_id, player1_wins, player2_wins, draws,
      status, table_number, stream_url, stream_platform, stream_embed_url, viewer_count,
      timer_started_at, timer_duration_seconds,
      momentum_badge, momentum_player_id, momentum_streak, lead_changes, is_deciding_game,
          tournament_rounds(
            round_number,
            tournament_phases(
              tournaments(id, name, slug, games(name, slug))
            )
          )
        `)
        .eq("id", matchId)
        .single()

      if (!matchData) {
        setLoading(false)
        return
      }

      // Get player profiles
      const playerIds = [matchData.player1_id, matchData.player2_id].filter(Boolean)
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", playerIds)

      const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || [])

      // Get tournament standings for records
      const tournament = (matchData.tournament_rounds as any)?.tournament_phases?.tournaments
      let player1Record = { wins: 0, losses: 0, draws: 0 }
      let player2Record = { wins: 0, losses: 0, draws: 0 }

      if (tournament?.id) {
        const { data: standings } = await supabase
          .from("tournament_standings")
          .select("player_id, match_wins, match_losses, match_draws")
          .eq("tournament_id", tournament.id)
          .in("player_id", playerIds)

        standings?.forEach((s: any) => {
          if (s.player_id === matchData.player1_id) {
            player1Record = { wins: s.match_wins, losses: s.match_losses, draws: s.match_draws }
          } else if (s.player_id === matchData.player2_id) {
            player2Record = { wins: s.match_wins, losses: s.match_losses, draws: s.match_draws }
          }
        })

        // Get other live feature matches from same tournament
        const { data: otherMatchesData } = await supabase
          .from("tournament_matches")
          .select(`
            id, player1_id, player2_id, player1_wins, player2_wins, status, stream_url,
            tournament_rounds!inner(tournament_phases!inner(tournament_id))
          `)
          .eq("is_feature_match", true)
          .neq("id", matchId)
          .in("status", ["pending", "in_progress"])
          .limit(5)

        if (otherMatchesData) {
          const otherPlayerIds = new Set<string>()
          otherMatchesData.forEach((m: any) => {
            if (m.player1_id) otherPlayerIds.add(m.player1_id)
            if (m.player2_id) otherPlayerIds.add(m.player2_id)
          })

          const { data: otherProfiles } = await supabase
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", Array.from(otherPlayerIds))

          const otherProfileMap = new Map(otherProfiles?.map((p: any) => [p.id, p]) || [])

          setOtherMatches(
            otherMatchesData.map((m: any) => ({
              id: m.id,
              player1_name: getPlayerName(otherProfileMap.get(m.player1_id)),
              player2_name: getPlayerName(otherProfileMap.get(m.player2_id)),
              player1_wins: m.player1_wins || 0,
              player2_wins: m.player2_wins || 0,
              status: m.status,
              has_stream: !!m.stream_url,
            }))
          )
        }
      }

      setMatch({
        ...matchData,
        round_number: (matchData.tournament_rounds as any)?.round_number,
        tournament: tournament ? {
          id: tournament.id,
          name: tournament.name,
          slug: tournament.slug,
          game_name: tournament.games?.name,
          game_slug: tournament.games?.slug,
        } : undefined,
        player1: {
          ...profileMap.get(matchData.player1_id),
          match_record: player1Record,
        },
        player2: {
          ...profileMap.get(matchData.player2_id),
          match_record: player2Record,
        },
      })

      setLoading(false)
    }

    fetchMatch()

    // Realtime subscription
    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_matches", filter: `id=eq.${matchId}` },
        () => fetchMatch()
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED")
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId])

  // Timer countdown
  useEffect(() => {
    if (!match?.timer_started_at || !match?.timer_duration_seconds) {
      setTimeRemaining(null)
      return
    }

    const startTime = new Date(match.timer_started_at).getTime()
    const duration = match.timer_duration_seconds * 1000

    function updateTimer() {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, Math.floor((duration - elapsed) / 1000))
      setTimeRemaining(remaining)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [match?.timer_started_at, match?.timer_duration_seconds])

  const embedUrl = match?.stream_embed_url || 
    (match?.stream_url && match?.stream_platform 
      ? getEmbedUrl(match.stream_url, match.stream_platform) 
      : null)

  const isLive = match?.status === "in_progress" || match?.status === "pending"

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!match) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Swords className="mb-4 h-16 w-16 text-muted-foreground/30" />
        <h1 className="mb-2 text-2xl font-bold">Match Not Found</h1>
        <p className="mb-6 text-muted-foreground">This match does not exist or has been removed.</p>
        <Button asChild>
          <Link href="/live">Back to Live</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("min-h-screen bg-background", isFullscreen && "fixed inset-0 z-50")}>
      {/* Top Bar */}
      {!isFullscreen && (
        <div className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/live">
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back to Live
                </Link>
              </Button>
              {match.tournament && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">/</span>
                  <Link
                    href={`/esports/tournaments/${match.tournament.slug}`}
                    className="text-sm font-medium text-foreground hover:text-primary"
                  >
                    {match.tournament.name}
                  </Link>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={cn(
                "gap-1.5",
                connected ? "border-green-500/50 text-green-500" : "border-destructive/50 text-destructive"
              )}>
                {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {connected ? "Live" : "Reconnecting"}
              </Badge>
              {match.viewer_count ? (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Eye className="h-4 w-4" />
                  {match.viewer_count}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className={cn(
        "mx-auto grid gap-6 p-4",
        isFullscreen ? "h-full" : "max-w-7xl py-6",
        !isFullscreen && "lg:grid-cols-[1fr_320px]"
      )}>
        {/* Main Content */}
        <div className={cn(isFullscreen && "h-full")}>
          {/* Stream Player */}
          <div className={cn(
            "relative overflow-hidden rounded-2xl border border-primary/30 bg-black",
            isFullscreen ? "h-full" : "aspect-video"
          )}>
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title="Match Stream"
                className="h-full w-full"
                allowFullScreen
                allow="autoplay; encrypted-media; fullscreen"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Radio className="mx-auto mb-3 h-16 w-16 text-muted-foreground/30" />
                  <p className="text-lg text-muted-foreground">No stream available</p>
                  <p className="text-sm text-muted-foreground/70">This match is not being streamed</p>
                </div>
              </div>
            )}

            {/* Overlay Controls */}
            <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-4">
              <div className="flex items-center gap-2">
                {isLive && (
                  <Badge className="bg-destructive text-destructive-foreground gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    LIVE
                  </Badge>
                )}
                <ViewerCount matchId={matchId} size="sm" />
                {match.tournament?.game_name && (
                  <Badge variant="secondary">{match.tournament.game_name}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ReactionsBar matchId={matchId} compact />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                >
                  {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </Button>
              </div>
            </div>
            
            {/* Reaction Feed (floating) */}
            <div className="absolute bottom-16 left-4 max-w-xs">
              <ReactionFeed matchId={matchId} />
            </div>

            {/* Timer Overlay */}
            {timeRemaining !== null && (
              <div className="absolute bottom-4 right-4">
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "gap-1.5 px-3 py-1.5 text-lg font-mono",
                    timeRemaining <= 300 && "bg-destructive text-destructive-foreground"
                  )}
                >
                  <Clock className="h-4 w-4" />
                  {formatTime(timeRemaining)}
                </Badge>
              </div>
            )}
          </div>

          {/* Match Info Bar */}
          {!isFullscreen && (
            <div className="glass-panel mt-4 rounded-xl p-6">
              <div className="flex items-center justify-between">
                {/* Player 1 */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2 border-primary">
                    <AvatarImage src={match.player1?.avatar_url || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl">
                      {getInitials(match.player1)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xl font-bold text-foreground">{getPlayerName(match.player1)}</p>
                    {match.player1?.match_record && (
                      <p className="text-sm text-muted-foreground">
                        {match.player1.match_record.wins}-{match.player1.match_record.losses}
                        {match.player1.match_record.draws > 0 && `-${match.player1.match_record.draws}`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Score */}
                <div className="text-center">
                  <div className="score-display flex items-center gap-6">
                    <span className={cn(
                      "text-5xl font-bold",
                      match.player1_wins > match.player2_wins ? "text-primary" : "text-foreground"
                    )}>
                      {match.player1_wins}
                    </span>
                    <span className="text-3xl text-muted-foreground">-</span>
                    <span className={cn(
                      "text-5xl font-bold",
                      match.player2_wins > match.player1_wins ? "text-primary" : "text-foreground"
                    )}>
                      {match.player2_wins}
                    </span>
                  </div>
                  {/* Momentum indicator */}
                  {(match as any).momentum_badge && (
                    <div className="mt-2">
                      <MomentumBadge badge={(match as any).momentum_badge} size="md" animate />
                    </div>
                  )}
                  {(match as any).is_deciding_game && !(match as any).momentum_badge && (
                    <Badge className="mt-2 animate-pulse bg-destructive">MATCH POINT</Badge>
                  )}
                  <p className="mt-2 text-muted-foreground">
                    Round {match.round_number || "?"} {match.table_number ? `• Table ${match.table_number}` : ""}
                  </p>
                </div>

                {/* Player 2 */}
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xl font-bold text-foreground">{getPlayerName(match.player2)}</p>
                    {match.player2?.match_record && (
                      <p className="text-sm text-muted-foreground">
                        {match.player2.match_record.wins}-{match.player2.match_record.losses}
                        {match.player2.match_record.draws > 0 && `-${match.player2.match_record.draws}`}
                      </p>
                    )}
                  </div>
                  <Avatar className="h-16 w-16 border-2 border-primary">
                    <AvatarImage src={match.player2?.avatar_url || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl">
                      {getInitials(match.player2)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        {!isFullscreen && (
          <div className="space-y-6">
            {/* Reactions */}
            <ReactionsBar matchId={matchId} />
            
            {/* Predictions */}
            <MatchPredictions
              matchId={matchId}
              player1={match.player1}
              player2={match.player2}
              matchStatus={match.status}
            />
            
            {/* Chat */}
            <MatchChat matchId={matchId} className="h-[400px]" />
            
            {/* Stats Tabs */}
            <Card>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <CardHeader className="pb-2">
                  <TabsList className="w-full grid grid-cols-2">
                    <TabsTrigger value="stats" className="gap-1.5">
                      <BarChart3 className="h-3.5 w-3.5" />
                      Stats
                    </TabsTrigger>
                    <TabsTrigger value="games" className="gap-1.5">
                      <Swords className="h-3.5 w-3.5" />
                      Games
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>
                <CardContent>
                  <TabsContent value="stats" className="mt-0 space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Tournament Record</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg bg-muted/50 p-3 text-center">
                          <p className="text-2xl font-bold text-foreground">
                            {match.player1?.match_record?.wins || 0}-{match.player1?.match_record?.losses || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">{getPlayerName(match.player1)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3 text-center">
                          <p className="text-2xl font-bold text-foreground">
                            {match.player2?.match_record?.wins || 0}-{match.player2?.match_record?.losses || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">{getPlayerName(match.player2)}</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="games" className="mt-0 space-y-3">
                    {/* Game-by-game history */}
                    <GameHistoryBar
                      player1Id={match.player1_id}
                      player2Id={match.player2_id}
                      player1Wins={match.player1_wins}
                      player2Wins={match.player2_wins}
                      player1Name={getPlayerName(match.player1)}
                      player2Name={getPlayerName(match.player2)}
                    />
                    <div className="text-center text-sm text-muted-foreground">
                      {match.player1_wins + match.player2_wins === 0 
                        ? "No games played yet"
                        : `${match.player1_wins + match.player2_wins} games played`
                      }
                    </div>
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>

            {/* Other Live Matches */}
            {otherMatches.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Radio className="h-4 w-4 text-destructive" />
                    Other Live Matches
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {otherMatches.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => router.push(`/match/${m.id}/watch`)}
                      className="w-full rounded-lg border border-border bg-muted/30 p-3 text-left transition-all hover:border-primary/50 hover:bg-muted/50"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate font-medium">{m.player1_name}</span>
                        <span className="font-bold text-muted-foreground">
                          {m.player1_wins} - {m.player2_wins}
                        </span>
                        <span className="truncate font-medium">{m.player2_name}</span>
                      </div>
                      {m.has_stream && (
                        <Badge variant="outline" className="mt-2 text-xs">
                          <Radio className="mr-1 h-2.5 w-2.5" />
                          Stream
                        </Badge>
                      )}
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Tournament Link */}
            {match.tournament && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Trophy className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{match.tournament.name}</p>
                      <p className="text-xs text-muted-foreground">View full tournament</p>
                    </div>
                    <Button asChild variant="ghost" size="icon">
                      <Link href={`/esports/tournaments/${match.tournament.slug}/live`}>
                        <ChevronRight className="h-5 w-5" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
