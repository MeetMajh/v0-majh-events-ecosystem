"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  Radio,
  Trophy,
  Users,
  Eye,
  ExternalLink,
  Play,
  ChevronRight,
  Wifi,
  WifiOff,
  Clock,
  Gamepad2,
  Tv,
  Hash,
  Flame,
  TrendingUp,
  ArrowUp,
} from "lucide-react"
import { ReactionsBar, ReactionFeed } from "@/components/esports/reactions-bar"
import { ViewerCount } from "@/components/esports/viewer-presence"
import { TrendingMatchCard, TrendingList } from "@/components/esports/trending-match-card"
import { LiveStatsBar } from "@/components/esports/live-stats-bar"
import { getTrendingMatchesWithMetrics, type TrendingMatch } from "@/lib/tournament-controller-actions"
import { CountdownTimer, ScheduledStreamCard } from "@/components/streaming/countdown-timer"

interface FeatureMatch {
  id: string
  player1: { id: string; first_name?: string; last_name?: string; avatar_url?: string } | null
  player2: { id: string; first_name?: string; last_name?: string; avatar_url?: string } | null
  player1Wins: number
  player2Wins: number
  draws: number
  status: string
  tableNumber?: number
  streamUrl?: string
  streamPlatform?: string
  streamEmbedUrl?: string
  viewerCount?: number
  roundNumber?: number
  tournament?: {
    id: string
    name: string
    slug: string
    gameName?: string
    gameSlug?: string
  }
}

interface LiveTournament {
  id: string
  name: string
  slug: string
  status: string
  playerCount: number
  currentRound?: number
  gameName?: string
  gameSlug?: string
  featureMatchCount: number
}

interface Stream {
  id: string
  title: string
  platform: string
  embed_url: string
  channel_url?: string
  channel_name?: string
  is_live: boolean
  scheduled_at?: string
  mux_playback_id?: string
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
  const hostname = typeof window !== "undefined" ? window.location.hostname : "majhevents.com"
  
  if (platform === "youtube") {
    const videoId = url.match(/(?:v=|\/)([\w-]{11})/)?.[1]
    if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`
  } else if (platform === "twitch") {
    // Check if it's a VOD link (contains /video/ or video= parameter)
    const videoMatch = url.match(/video[=/](\d+)/)
    if (videoMatch) {
      return `https://player.twitch.tv/?video=${videoMatch[1]}&parent=${hostname}&muted=true`
    }
    // Otherwise treat as live channel
    const channel = url.match(/twitch\.tv\/(\w+)/)?.[1]
    if (channel) return `https://player.twitch.tv/?channel=${channel}&parent=${hostname}&muted=true`
  } else if (platform === "kick") {
    const channel = url.match(/kick\.com\/(\w+)/)?.[1]
    if (channel) return `https://player.kick.com/${channel}`
  }
  return url
}

export default function MajhLivePage() {
  const [featureMatches, setFeatureMatches] = useState<FeatureMatch[]>([])
  const [liveTournaments, setLiveTournaments] = useState<LiveTournament[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [recentVods, setRecentVods] = useState<any[]>([])
  const [scheduledContent, setScheduledContent] = useState<any[]>([])
  const [trendingMatches, setTrendingMatches] = useState<TrendingMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(true)
  const [selectedMatch, setSelectedMatch] = useState<FeatureMatch | null>(null)
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null)
  const [activeTab, setActiveTab] = useState("trending")
  const [streamIndex, setStreamIndex] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    console.log("[v0] Live page fetchData starting...")

    async function fetchData() {
      console.log("[v0] fetchData running")
      // Fetch feature matches
      const { data: matches } = await supabase
        .from("tournament_matches")
        .select(`
          id, player1_id, player2_id, player1_wins, player2_wins, draws,
          status, table_number, is_feature_match, stream_url, stream_platform, stream_embed_url, viewer_count,
          tournament_rounds(
            round_number, status,
            tournament_phases(
              tournaments(id, name, slug, status, games(name, slug))
            )
          )
        `)
        .eq("is_feature_match", true)
        .in("status", ["pending", "in_progress", "player1_reported", "player2_reported"])

      if (matches) {
        // Filter to live tournaments only
        const liveMatches = matches.filter((m: any) => {
          const tournament = m.tournament_rounds?.tournament_phases?.tournaments
          return tournament?.status === "in_progress"
        })

        // Get player profiles
        const playerIds = new Set<string>()
        liveMatches.forEach((m: any) => {
          if (m.player1_id) playerIds.add(m.player1_id)
          if (m.player2_id) playerIds.add(m.player2_id)
        })

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, avatar_url")
          .in("id", Array.from(playerIds))

        const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || [])

        const formattedMatches: FeatureMatch[] = liveMatches.map((m: any) => {
          const tournament = m.tournament_rounds?.tournament_phases?.tournaments
          return {
            id: m.id,
            player1: profileMap.get(m.player1_id) || null,
            player2: profileMap.get(m.player2_id) || null,
            player1Wins: m.player1_wins || 0,
            player2Wins: m.player2_wins || 0,
            draws: m.draws || 0,
            status: m.status,
            tableNumber: m.table_number,
            streamUrl: m.stream_url,
            streamPlatform: m.stream_platform,
            streamEmbedUrl: m.stream_embed_url,
            viewerCount: m.viewer_count || 0,
            roundNumber: m.tournament_rounds?.round_number,
            tournament: tournament ? {
              id: tournament.id,
              name: tournament.name,
              slug: tournament.slug,
              gameName: tournament.games?.name,
              gameSlug: tournament.games?.slug,
            } : undefined,
          }
        })

        setFeatureMatches(formattedMatches)
        if (formattedMatches.length > 0 && !selectedMatch) {
          setSelectedMatch(formattedMatches[0])
        }
      }

      // Fetch live tournaments
      const { data: tournaments } = await supabase
        .from("tournaments")
        .select(`
          id, name, slug, status,
          games(name, slug),
          tournament_participants(count),
          tournament_phases(
            tournament_rounds(round_number, status)
          )
        `)
        .eq("status", "in_progress")
        .order("created_at", { ascending: false })

      if (tournaments) {
        // Get feature match counts
        const { data: featureCounts } = await supabase
          .from("tournament_matches")
          .select("id, tournament_rounds!inner(tournament_phases!inner(tournament_id))")
          .eq("is_feature_match", true)

        const countMap = new Map<string, number>()
        featureCounts?.forEach((m: any) => {
          const tid = m.tournament_rounds?.tournament_phases?.tournament_id
          if (tid) countMap.set(tid, (countMap.get(tid) || 0) + 1)
        })

        const formattedTournaments: LiveTournament[] = tournaments.map((t: any) => {
          const currentRound = t.tournament_phases
            ?.flatMap((p: any) => p.tournament_rounds || [])
            ?.find((r: any) => r.status === "in_progress")?.round_number

          return {
            id: t.id,
            name: t.name,
            slug: t.slug,
            status: t.status,
            playerCount: t.tournament_participants?.[0]?.count || 0,
            currentRound,
            gameName: t.games?.name,
            gameSlug: t.games?.slug,
            featureMatchCount: countMap.get(t.id) || 0,
          }
        })

        setLiveTournaments(formattedTournaments)
      }

      // Fetch from stream_sources (admin-added external streams)
      // Show ALL stream_sources, not just is_active=true, so admins can toggle visibility
      const { data: streamSourcesData, error: sourcesError } = await supabase
        .from("stream_sources")
        .select("*, game:games(id, name, icon_url)")
        .order("is_live", { ascending: false })
        .order("is_featured", { ascending: false })
        .order("priority", { ascending: false })

      console.log("[v0] stream_sources:", streamSourcesData?.length, "error:", sourcesError?.message)

      // Fetch from stream_sessions (MAJH Studio user streams)
      const { data: streamSessionsData, error: sessionsError } = await supabase
        .from("stream_sessions")
        .select("*, user:profiles(id, first_name, last_name, avatar_url)")
        .eq("status", "live")
        .eq("visibility", "public")
        .order("viewer_count", { ascending: false })

      console.log("[v0] stream_sessions:", streamSessionsData?.length, "error:", sessionsError?.message)

      // Fetch from user_streams (OBS/external software streams via Mux)
      const { data: userStreamsData, error: userStreamsError } = await supabase
        .from("user_streams")
        .select("*, user:profiles(id, first_name, last_name, avatar_url)")
        .eq("status", "live")
        .eq("is_public", true)
        .order("total_views", { ascending: false })

      console.log("[v0] user_streams:", userStreamsData?.length, "error:", userStreamsError?.message)

      // Fetch recent VODs (ended streams) - simplified query without complex filters
      const { data: vodsData, error: vodsError } = await supabase
        .from("user_streams")
        .select("*")
        .eq("status", "ended")
        .eq("is_public", true)
        .not("mux_playback_id", "is", null)
        .order("ended_at", { ascending: false })
        .limit(12)

      console.log("[v0] VODs found:", vodsData?.length, "error:", vodsError?.message, "code:", vodsError?.code, "data:", vodsData)

      if (vodsData) {
        setRecentVods(vodsData)
      }

      // Fetch scheduled/coming soon content from player_media
      const { data: scheduledMedia, error: schedError } = await supabase
        .from("player_media")
        .select("*, player:profiles(id, first_name, last_name, avatar_url)")
        .not("scheduled_live_at", "is", null)
        .gt("scheduled_live_at", new Date().toISOString())
        .eq("visibility", "public")
        .order("scheduled_live_at", { ascending: true })
        .limit(10)

      console.log("[v0] Scheduled content:", scheduledMedia?.length, "error:", schedError?.message)

      if (scheduledMedia) {
        setScheduledContent(scheduledMedia)
      }

      // Combine streams from all sources
      const combinedStreams: Stream[] = []
      
      // Convert stream_sources to Stream format
      if (streamSourcesData) {
        const hostname = typeof window !== "undefined" ? window.location.hostname : "majhevents.com"
        const convertedSources = streamSourcesData.map((source: any) => {
          // Generate proper embed URL from channel_url, fixing parent domain for Twitch
          let embedUrl = source.embed_url || 
            (source.channel_url ? getEmbedUrl(source.channel_url, source.platform || 'custom') : '')
          
          // Fix Twitch parent domain for current hostname
          if (source.platform === 'twitch' && embedUrl.includes('player.twitch.tv')) {
            embedUrl = embedUrl.replace(/parent=[^&]+/, `parent=${hostname}`)
          }
          
          return {
            id: source.id,
            title: source.title,
            platform: source.platform || 'custom',
            embed_url: embedUrl,
            channel_url: source.channel_url, // Keep original URL for fallback
            channel_name: source.title,
            is_live: source.is_live,
            is_active: source.is_active, // Include active status
            scheduled_at: source.created_at,
          }
        })
        combinedStreams.push(...convertedSources)
      }

      // Convert stream_sessions (MAJH Studio) to Stream format
      if (streamSessionsData) {
        const convertedSessions = streamSessionsData.map((session: any) => {
          const streamerName = session.profiles 
            ? `${session.profiles.first_name || ''} ${session.profiles.last_name || ''}`.trim() || 'MAJH Streamer'
            : 'MAJH Streamer'
          return {
            id: session.id,
            title: session.title || `${streamerName}'s Stream`,
            platform: 'majh',
            embed_url: `/live?stream=${session.id}`,
            channel_name: streamerName,
            is_live: session.status === 'live',
            scheduled_at: session.started_at,
          }
        })
        combinedStreams.push(...convertedSessions)
      }

      // Convert user_streams (OBS/Mux streams) to Stream format
      if (userStreamsData) {
        const convertedUserStreams = userStreamsData.map((stream: any) => {
          const streamerName = stream.user 
            ? `${stream.user.first_name || ''} ${stream.user.last_name || ''}`.trim() || 'MAJH Creator'
            : 'MAJH Creator'
          return {
            id: stream.id,
            title: stream.title || `${streamerName}'s Stream`,
            platform: 'mux',
            embed_url: stream.playback_url || '',
            channel_name: streamerName,
            is_live: stream.status === 'live',
            scheduled_at: stream.started_at,
            mux_playback_id: stream.mux_playback_id,
          }
        })
        combinedStreams.push(...convertedUserStreams)
      }

      setStreams(combinedStreams)

      // Fetch trending matches
      try {
        const trending = await getTrendingMatchesWithMetrics(10)
        setTrendingMatches(trending)
      } catch (error) {
        console.error("Failed to fetch trending:", error)
      }

      setLoading(false)
    }

    fetchData()

    // Realtime subscriptions
    const matchChannel = supabase
      .channel("live-matches")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_matches" },
        () => fetchData()
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED")
      })

    const tournamentChannel = supabase
      .channel("live-tournaments")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments" },
        () => fetchData()
      )
      .subscribe()

    // Refresh every 30 seconds as backup
    const interval = setInterval(fetchData, 30000)

    return () => {
      supabase.removeChannel(matchChannel)
      supabase.removeChannel(tournamentChannel)
      clearInterval(interval)
    }
  }, [])

  const liveStreams = streams.filter((s) => s.is_live)
  const hasLiveContent = featureMatches.length > 0 || liveTournaments.length > 0 || liveStreams.length > 0

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="glass-panel-darker border-b border-border/30">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="badge-live mb-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold">
                <Radio className="h-4 w-4" />
                MAJH LIVE
              </div>
              <h1 className="esports-heading text-4xl text-foreground">Live Hub</h1>
              <p className="mt-2 text-muted-foreground">
                Watch competitive matches and tournaments in real-time
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button asChild variant="default" size="sm">
                <Link href="/dashboard/stream">
                  <Radio className="h-4 w-4 mr-2" />
                  Go Live
                </Link>
              </Button>
              <Badge variant="outline" className={cn(
                "gap-1.5 backdrop-blur-sm",
                connected ? "border-green-500/50 text-green-500 bg-green-500/10" : "border-destructive/50 text-destructive bg-destructive/10"
              )}>
                {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {connected ? "Connected" : "Reconnecting..."}
              </Badge>
            </div>
          </div>
          
          {/* Live Stats Bar */}
          <div className="mt-6">
            <LiveStatsBar />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : !hasLiveContent ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
            <Tv className="mx-auto mb-4 h-16 w-16 text-muted-foreground/30" />
            <h2 className="mb-2 text-2xl font-bold text-foreground">No Live Content</h2>
            <p className="mx-auto max-w-md text-muted-foreground">
              There are no live tournaments or feature matches right now. Be the first to go live!
            </p>
            <div className="flex items-center justify-center gap-4 mt-6">
              <Button asChild variant="default">
                <Link href="/dashboard/stream">
                  <Radio className="h-4 w-4 mr-2" />
                  Go Live
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/esports/tournaments">Browse Tournaments</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Hot Now - Featured Trending Match */}
            {trendingMatches.length > 0 && trendingMatches[0].trendingBadge && (
              <div className="glass-panel rounded-xl p-6 glow-trending">
                <div className="mb-4 flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500 animate-pulse-glow" />
                  <h2 className="esports-subheading text-muted-foreground">Hot Now</h2>
                  {trendingMatches[0].viewerVelocity > 0 && (
                    <Badge className="badge-trending gap-1">
                      <ArrowUp className="h-3 w-3" />
                      +{trendingMatches[0].viewerVelocity} viewers
                    </Badge>
                  )}
                </div>
                <TrendingMatchCard match={trendingMatches[0]} variant="featured" />
              </div>
            )}
            
            <div className="grid gap-8 lg:grid-cols-3">
            {/* Main Content - Feature Stream */}
            <div className="lg:col-span-2">
              {selectedStream ? (
                <div className="esports-card glass-panel overflow-hidden rounded-xl border-0">
                  {/* Stream Player for external/Mux streams */}
                  <div className="video-container">
                    {selectedStream.mux_playback_id ? (
                      <iframe
                        src={`https://stream.mux.com/${selectedStream.mux_playback_id}.m3u8`}
                        title={selectedStream.title}
                        className="h-full w-full"
                        allowFullScreen
                        allow="autoplay; encrypted-media; fullscreen"
                      />
                    ) : selectedStream.embed_url ? (
                      <iframe
                        src={selectedStream.embed_url}
                        title={selectedStream.title}
                        className="h-full w-full"
                        allowFullScreen
                        allow="autoplay; encrypted-media; fullscreen"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <div className="text-center">
                          <Play className="mx-auto mb-3 h-16 w-16 text-muted-foreground/30" />
                          <p className="text-muted-foreground">No embed available</p>
                          {selectedStream.channel_url && (
                            <a 
                              href={selectedStream.channel_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              Watch on {selectedStream.platform}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Live badge overlay */}
                    <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-4">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-destructive text-destructive-foreground gap-1.5 px-3 py-1">
                          <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                          LIVE
                        </Badge>
                        <Badge variant="outline" className="text-xs capitalize bg-black/30">{selectedStream.platform}</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Stream Info Bar */}
                  <div className="border-t border-border bg-card p-4">
                    <h3 className="font-bold text-lg text-foreground">{selectedStream.title}</h3>
                    {selectedStream.channel_name && (
                      <p className="text-sm text-muted-foreground mt-1">{selectedStream.channel_name}</p>
                    )}
                  </div>
                </div>
              ) : selectedMatch ? (
                <div className="esports-card glass-panel overflow-hidden rounded-xl border-0">
                  {/* Stream Player */}
                  <div className="video-container">
                    {selectedMatch.streamUrl || selectedMatch.streamEmbedUrl ? (
                      <iframe
                        src={selectedMatch.streamEmbedUrl || getEmbedUrl(selectedMatch.streamUrl!, selectedMatch.streamPlatform || "custom")}
                        title="Feature Match Stream"
                        className="h-full w-full"
                        allowFullScreen
                        allow="autoplay; encrypted-media; fullscreen"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <div className="text-center">
                          <Play className="mx-auto mb-3 h-16 w-16 text-muted-foreground/30" />
                          <p className="text-muted-foreground">No stream available for this match</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Live badge overlay */}
                    <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-4">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-destructive text-destructive-foreground gap-1.5 px-3 py-1">
                          <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                          LIVE
                        </Badge>
                        <ViewerCount matchId={selectedMatch.id} size="sm" />
                      </div>
                      <ReactionsBar matchId={selectedMatch.id} compact />
                    </div>
                    
                    {/* Reaction Feed */}
                    <div className="absolute bottom-4 left-4 max-w-xs">
                      <ReactionFeed matchId={selectedMatch.id} />
                    </div>
                  </div>

                  {/* Match Info Bar */}
                  <div className="border-t border-border bg-card p-4">
                    <div className="flex items-center justify-between">
                      {/* Player 1 */}
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 border-2 border-primary">
                          <AvatarImage src={selectedMatch.player1?.avatar_url || ""} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(selectedMatch.player1)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-foreground">{getPlayerName(selectedMatch.player1)}</p>
                          <p className="text-sm text-muted-foreground">Player 1</p>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="text-center">
                        <div className="flex items-center gap-4">
                          <span className={cn(
                            "text-4xl font-bold",
                            selectedMatch.player1Wins > selectedMatch.player2Wins ? "text-primary" : "text-foreground"
                          )}>
                            {selectedMatch.player1Wins}
                          </span>
                          <span className="text-2xl text-muted-foreground">-</span>
                          <span className={cn(
                            "text-4xl font-bold",
                            selectedMatch.player2Wins > selectedMatch.player1Wins ? "text-primary" : "text-foreground"
                          )}>
                            {selectedMatch.player2Wins}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Round {selectedMatch.roundNumber || "?"} {selectedMatch.tableNumber ? `• Table ${selectedMatch.tableNumber}` : ""}
                        </p>
                      </div>

                      {/* Player 2 */}
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-foreground">{getPlayerName(selectedMatch.player2)}</p>
                          <p className="text-sm text-muted-foreground">Player 2</p>
                        </div>
                        <Avatar className="h-12 w-12 border-2 border-primary">
                          <AvatarImage src={selectedMatch.player2?.avatar_url || ""} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(selectedMatch.player2)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </div>

                    {/* Tournament Link */}
                    {selectedMatch.tournament && (
                      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-primary" />
                          <span className="font-medium text-foreground">{selectedMatch.tournament.name}</span>
                          {selectedMatch.tournament.gameName && (
                            <Badge variant="outline" className="text-xs">
                              {selectedMatch.tournament.gameName}
                            </Badge>
                          )}
                        </div>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/esports/tournaments/${selectedMatch.tournament.slug}/live`}>
                            Watch Tournament <ChevronRight className="ml-1 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : liveStreams.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-primary/30 bg-card">
                  <div className="aspect-video bg-black relative">
                    {liveStreams[0].embed_url && (liveStreams[0].embed_url.includes('twitch.tv') || liveStreams[0].embed_url.includes('youtube.com') || liveStreams[0].embed_url.includes('kick.com')) ? (
                      <iframe
                        src={liveStreams[0].embed_url}
                        title={liveStreams[0].title}
                        className="h-full w-full"
                        allowFullScreen
                        allow="autoplay; encrypted-media"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                        <Radio className="h-16 w-16 mb-4 opacity-50 animate-pulse text-destructive" />
                        <p className="text-lg font-semibold text-foreground">{liveStreams[0].title}</p>
                        <p className="text-sm">Stream is live on {liveStreams[0].platform}</p>
                        <Badge className="mt-3 bg-destructive/10 text-destructive border-destructive/30">
                          <span className="mr-1.5 h-2 w-2 rounded-full bg-destructive animate-pulse" />
                          LIVE NOW
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="bg-destructive/10 text-destructive border-destructive/30">
                            <span className="mr-1 h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                            LIVE
                          </Badge>
                          <Badge variant="outline" className="capitalize">{liveStreams[0].platform}</Badge>
                        </div>
                        <h3 className="text-lg font-bold text-foreground">{liveStreams[0].title}</h3>
                        {liveStreams[0].channel_name && (
                          <p className="text-sm text-muted-foreground">{liveStreams[0].channel_name}</p>
                        )}
                      </div>
                      <a
                        href={liveStreams[0].embed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary"
                      >
                        <ExternalLink className="h-5 w-5" />
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
                  <Play className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
                  <p className="text-muted-foreground">Select a match to watch</p>
                </div>
              )}
            </div>

            {/* Sidebar - Live Channels */}
            <div className="space-y-6">
              <div className="glass-panel rounded-xl p-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
<TabsList className="w-full grid grid-cols-4 bg-background/50">
<TabsTrigger value="trending" className="gap-1.5">
  <Flame className="h-3.5 w-3.5" />
  Hot
  </TabsTrigger>
<TabsTrigger value="matches" className="gap-1.5">
  <Gamepad2 className="h-3.5 w-3.5" />
  Matches
  </TabsTrigger>
  <TabsTrigger value="tournaments" className="gap-1.5">
  <Trophy className="h-3.5 w-3.5" />
  Events
  </TabsTrigger>
  <TabsTrigger value="streams" className="gap-1.5">
  <Tv className="h-3.5 w-3.5" />
  Streams
  </TabsTrigger>
  </TabsList>

                <TabsContent value="trending" className="mt-4 space-y-3">
                  {trendingMatches.length > 0 ? (
                    <div className="space-y-2">
                      {trendingMatches.slice(0, 5).map((match, index) => (
                        <TrendingMatchCard
                          key={match.id}
                          match={match}
                          rank={index + 1}
                          variant="compact"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                      <TrendingUp className="mb-2 h-8 w-8 opacity-50" />
                      <p className="text-sm">No trending matches</p>
                      <p className="text-xs">Check back when events are live</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="matches" className="mt-4 space-y-2">
                  {featureMatches.length > 0 ? (
                    featureMatches.map((match) => (
                      <button
                        key={match.id}
                        onClick={() => setSelectedMatch(match)}
                        className={cn(
                          "w-full rounded-xl border p-3 text-left transition-all hover:border-primary/50",
                          selectedMatch?.id === match.id
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                            <span className="mr-1 h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                            LIVE
                          </Badge>
                          {match.viewerCount ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Eye className="h-3 w-3" />
                              {match.viewerCount}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={match.player1?.avatar_url || ""} />
                              <AvatarFallback className="text-xs">{getInitials(match.player1)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-foreground truncate max-w-[80px]">
                              {getPlayerName(match.player1)}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-muted-foreground">
                            {match.player1Wins} - {match.player2Wins}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground truncate max-w-[80px]">
                              {getPlayerName(match.player2)}
                            </span>
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={match.player2?.avatar_url || ""} />
                              <AvatarFallback className="text-xs">{getInitials(match.player2)}</AvatarFallback>
                            </Avatar>
                          </div>
                        </div>
                        {match.tournament && (
                          <p className="mt-2 text-xs text-muted-foreground truncate">
                            {match.tournament.name}
                          </p>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-6 text-center">
                      <Gamepad2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">No feature matches live</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="tournaments" className="mt-4 space-y-2">
                  {liveTournaments.length > 0 ? (
                    liveTournaments.map((tournament) => (
                      <Link
                        key={tournament.id}
                        href={`/esports/tournaments/${tournament.slug}/live`}
                        className="block rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                            <span className="mr-1 h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                            LIVE
                          </Badge>
                          {tournament.gameName && (
                            <Badge variant="outline" className="text-xs">{tournament.gameName}</Badge>
                          )}
                        </div>
                        <h4 className="font-semibold text-foreground">{tournament.name}</h4>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {tournament.playerCount} players
                          </span>
                          {tournament.currentRound && (
                            <span className="flex items-center gap-1">
                              <Hash className="h-3 w-3" />
                              Round {tournament.currentRound}
                            </span>
                          )}
                          {tournament.featureMatchCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Radio className="h-3 w-3" />
                              {tournament.featureMatchCount} featured
                            </span>
                          )}
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-6 text-center">
                      <Trophy className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">No live tournaments</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="streams" className="mt-4 space-y-2">
                  {liveStreams.length > 0 ? (
                    <>
                      {/* Navigation Controls */}
                      <div className="flex items-center justify-between gap-2 mb-4 p-2 bg-card/50 rounded-lg border border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setStreamIndex(Math.max(0, streamIndex - 1))}
                          disabled={streamIndex === 0}
                          className="flex-shrink-0"
                        >
                          <ChevronRight className="h-4 w-4 rotate-180" />
                          Previous
                        </Button>
                        <span className="text-xs text-muted-foreground text-center flex-1">
                          Stream {streamIndex + 1} of {liveStreams.length}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setStreamIndex(Math.min(liveStreams.length - 1, streamIndex + 1))}
                          disabled={streamIndex === liveStreams.length - 1}
                          className="flex-shrink-0"
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Stream List */}
                      <div className="space-y-2">
                        {liveStreams.map((stream, index) => (
                          <button
                            key={stream.id}
                            onClick={() => {
                              setSelectedStream(stream)
                              setStreamIndex(index)
                              setSelectedMatch(null)
                            }}
                            className={cn(
                              "w-full text-left rounded-xl border bg-card p-3 transition-all hover:border-primary/50 group",
                              selectedStream?.id === stream.id ? "border-primary ring-1 ring-primary" : "border-border"
                            )}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                                <span className="mr-1 h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                                LIVE
                              </Badge>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://majhevents.com'}/watch/stream/${stream.id}`
                                    navigator.clipboard.writeText(shareUrl)
                                  }}
                                  title="Copy share link"
                                >
                                  <Share2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              <Badge variant="outline" className="text-xs capitalize">{stream.platform}</Badge>
                            </div>
                            <h4 className="font-semibold text-foreground">{stream.title}</h4>
                            {stream.channel_name && (
                              <p className="mt-1 text-xs text-muted-foreground">{stream.channel_name}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-6 text-center">
                      <Tv className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">No streams live</p>
                    </div>
                  )}

                  {/* Scheduled streams */}
                  {streams.filter((s) => !s.is_live && s.scheduled_at).length > 0 && (
                    <div className="mt-4">
                      <h4 className="mb-2 text-sm font-medium text-muted-foreground">Coming Up</h4>
                      {streams
                        .filter((s) => !s.is_live && s.scheduled_at)
                        .slice(0, 3)
                        .map((stream) => (
                          <div
                            key={stream.id}
                            className="rounded-xl border border-border bg-card/50 p-3 mb-2"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <Badge variant="outline" className="text-xs capitalize">{stream.platform}</Badge>
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(new Date(stream.scheduled_at!))}
                              </span>
                            </div>
                            <h4 className="text-sm font-medium text-foreground">{stream.title}</h4>
                          </div>
                        ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
              </div>
            </div>

            {/* Coming Soon Section */}
            {scheduledContent.length > 0 && (
              <div className="mt-8">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-500" />
                    <h2 className="esports-subheading text-muted-foreground">Coming Soon</h2>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {scheduledContent.slice(0, 4).map((item) => {
                    const creatorName = item.player 
                      ? `${item.player.first_name || ''} ${item.player.last_name || ''}`.trim() || 'MAJH Creator'
                      : 'MAJH Creator'
                    const scheduledDate = new Date(item.scheduled_live_at)
                    const isWithin24Hours = scheduledDate.getTime() - Date.now() < 24 * 60 * 60 * 1000
                    
                    return (
                      <div
                        key={item.id}
                        className="group relative rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-amber-500/50"
                      >
                        {/* Thumbnail */}
                        <div className="relative aspect-video bg-gradient-to-br from-amber-500/10 to-amber-500/5">
                          {item.thumbnail_url || item.video_url ? (
                            <img 
                              src={item.thumbnail_url || item.video_url}
                              alt={item.title || 'Scheduled content'}
                              className="w-full h-full object-cover opacity-80"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Clock className="h-12 w-12 text-muted-foreground/30" />
                            </div>
                          )}
                          
                          {/* Badges */}
                          <div className="absolute top-2 left-2 flex items-center gap-2">
                            <Badge className={cn(
                              "text-xs",
                              isWithin24Hours 
                                ? "bg-amber-500/90 text-black" 
                                : "bg-card/90 text-foreground"
                            )}>
                              {isWithin24Hours ? "Coming Soon" : "Scheduled"}
                            </Badge>
                          </div>
                          
                          {/* Countdown Overlay */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                            <CountdownTimer targetDate={item.scheduled_live_at} size="sm" />
                          </div>
                        </div>
                        
                        {/* Info */}
                        <div className="p-3">
                          <h4 className="font-semibold text-foreground line-clamp-1">{item.title || 'Upcoming Stream'}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{creatorName}</p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>
                              {scheduledDate.toLocaleDateString(undefined, { 
                                month: "short", 
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit"
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Recent VODs Section */}
            {recentVods.length > 0 ? (
              <div className="mt-8">
                <div className="mb-4 flex items-center gap-2">
                  <Play className="h-5 w-5 text-primary" />
                  <h2 className="esports-subheading text-muted-foreground">Recent Recordings</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {recentVods.map((vod) => {
                    const streamerName = vod.user 
                      ? `${vod.user.first_name || ''} ${vod.user.last_name || ''}`.trim() || 'MAJH Creator'
                      : 'MAJH Creator'
                    const duration = vod.started_at && vod.ended_at
                      ? Math.round((new Date(vod.ended_at).getTime() - new Date(vod.started_at).getTime()) / 60000)
                      : null
                    return (
                      <Link
                        key={vod.id}
                        href={`/watch/vod/${vod.id}`}
                        className="group block rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-primary/50 hover:shadow-lg"
                      >
                        {/* Thumbnail */}
                        <div className="relative aspect-video bg-muted">
                          {vod.mux_playback_id ? (
                            <img 
                              src={`https://image.mux.com/${vod.mux_playback_id}/thumbnail.jpg?time=10`}
                              alt={vod.title || 'Recording'}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Fallback to placeholder on error
                                e.currentTarget.style.display = 'none'
                                e.currentTarget.nextElementSibling?.classList.remove('hidden')
                              }}
                            />
                          ) : null}
                          <div className={`flex items-center justify-center h-full ${vod.mux_playback_id ? 'hidden' : ''}`}>
                            <Play className="h-12 w-12 text-muted-foreground/30" />
                          </div>
                          {duration && (
                            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-0.5 rounded">
                              {duration} min
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <Play className="h-12 w-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                        {/* Info */}
                        <div className="p-3">
                          <h4 className="font-semibold text-foreground line-clamp-1">{vod.title || 'Stream Recording'}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{streamerName}</p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            {vod.game && (
                              <Badge variant="outline" className="text-xs">{vod.game.name}</Badge>
                            )}
                            <span>
                              {new Intl.DateTimeFormat("en-US", { dateStyle: "short" }).format(new Date(vod.ended_at || vod.created_at))}
                            </span>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-8 p-4 border border-dashed border-border rounded-lg text-center text-muted-foreground">
                <Play className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No recordings yet. Start streaming to create your first VOD!</p>
              </div>
            )}
          </div>
          </div>
        )}
      </div>
    </div>
  )
}
