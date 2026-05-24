"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Maximize2, 
  Minimize2, 
  Trophy, 
  Users, 
  Swords, 
  Radio, 
  Timer,
  ChevronLeft,
  ArrowUpRight,
  RefreshCw,
  Star,
  Clock,
  Wifi,
  WifiOff
} from "lucide-react"

type ViewMode = "bracket" | "standings" | "feature"

interface Match {
  id: string
  player1_id: string | null
  player2_id: string | null
  player1_wins: number
  player2_wins: number
  draws: number
  status: string
  is_feature_match: boolean
  table_number: number | null
  round_number: number
  player1?: { first_name: string | null; last_name: string | null; avatar_url: string | null }
  player2?: { first_name: string | null; last_name: string | null; avatar_url: string | null }
}

interface Standing {
  rank: number
  userId: string
  displayName: string
  username?: string
  avatarUrl?: string
  points: number
  wins: number
  losses: number
  draws: number
  opponentWinRate: number
}

function getPlayerName(player: { first_name: string | null; last_name: string | null } | null | undefined): string {
  if (!player) return "TBD"
  return `${player.first_name || ""} ${player.last_name || ""}`.trim() || "Unknown"
}

export default function SpectatorViewPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  
  const [tournament, setTournament] = useState<any>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [standings, setStandings] = useState<Standing[]>([])
  const [featureMatches, setFeatureMatches] = useState<Match[]>([])
  const [currentRound, setCurrentRound] = useState<number>(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("standings")
  const [isConnected, setIsConnected] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [loading, setLoading] = useState(true)

  // Fetch tournament data
  const fetchData = useCallback(async () => {
    const supabase = createClient()
    
    // Get tournament
    const { data: t } = await supabase
      .from("tournaments")
      .select("*, games(name, slug)")
      .eq("slug", slug)
      .single()
    
    if (!t) {
      router.push("/esports")
      return
    }
    
    setTournament(t)
    
    // Get current phase and round
    const { data: phases } = await supabase
      .from("tournament_phases")
      .select("id, is_current")
      .eq("tournament_id", t.id)
      .eq("is_current", true)
      .single()
    
    if (phases) {
      // Get current round matches
      const { data: rounds } = await supabase
        .from("tournament_rounds")
        .select(`
          id, round_number, status,
          tournament_matches(
            id, player1_id, player2_id, player1_wins, player2_wins, draws,
            status, is_feature_match, table_number
          )
        `)
        .eq("phase_id", phases.id)
        .order("round_number", { ascending: false })
        .limit(1)
      
      if (rounds && rounds[0]) {
        setCurrentRound(rounds[0].round_number)
        const roundMatches = (rounds[0].tournament_matches as any[]) || []
        
        // Get player profiles
        const playerIds = new Set<string>()
        roundMatches.forEach(m => {
          if (m.player1_id) playerIds.add(m.player1_id)
          if (m.player2_id) playerIds.add(m.player2_id)
        })
        
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, avatar_url")
          .in("id", Array.from(playerIds))
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])
        
        const enrichedMatches = roundMatches.map(m => ({
          ...m,
          round_number: rounds[0].round_number,
          player1: profileMap.get(m.player1_id),
          player2: profileMap.get(m.player2_id),
        }))
        
        setMatches(enrichedMatches)
        setFeatureMatches(enrichedMatches.filter(m => m.is_feature_match))
      }
      
      // Get standings
      const { data: standingsData } = await supabase
        .from("tournament_player_stats")
        .select(`
          *, 
          profiles(id, first_name, last_name, username, avatar_url)
        `)
        .eq("phase_id", phases.id)
        .eq("is_active", true)
        .order("ranking_points", { ascending: false })
        .limit(32)
      
      if (standingsData) {
        setStandings(standingsData.map((s, i) => ({
          rank: i + 1,
          userId: s.user_id,
          displayName: `${s.profiles?.first_name || ""} ${s.profiles?.last_name || ""}`.trim() || "Unknown",
          username: s.profiles?.username,
          avatarUrl: s.profiles?.avatar_url,
          points: s.ranking_points,
          wins: s.match_wins,
          losses: s.match_losses,
          draws: s.match_draws,
          opponentWinRate: s.opponent_win_percentage,
        })))
      }
    }
    
    setLastUpdate(new Date())
    setLoading(false)
  }, [slug, router])

  // Initial fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Realtime subscription
  useEffect(() => {
    if (!tournament?.id) return
    
    const supabase = createClient()
    const channel = supabase
      .channel(`spectator-${tournament.id}`)
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "tournament_matches",
        },
        () => {
          fetchData()
        }
      )
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "tournament_player_stats",
        },
        () => {
          fetchData()
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED")
      })
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournament?.id, fetchData])

  // Auto-refresh every 30 seconds as backup
  useEffect(() => {
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  if (loading || !tournament) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading tournament...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "min-h-screen bg-background",
      isFullscreen && "fixed inset-0 z-50"
    )}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={`/esports/tournaments/${slug}`}>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="gap-1">
                <Radio className="h-3 w-3 animate-pulse" />
                LIVE
              </Badge>
              <h1 className="font-semibold truncate max-w-[200px] sm:max-w-none">{tournament.name}</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Connection status */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {isConnected ? (
                <Wifi className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-destructive" />
              )}
              <span className="hidden sm:inline">
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            </div>
            
            {/* View mode tabs */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList className="h-8">
                <TabsTrigger value="standings" className="text-xs px-2 h-6">
                  <Trophy className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Standings</span>
                </TabsTrigger>
                <TabsTrigger value="bracket" className="text-xs px-2 h-6">
                  <Swords className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Matches</span>
                </TabsTrigger>
                {featureMatches.length > 0 && (
                  <TabsTrigger value="feature" className="text-xs px-2 h-6">
                    <Star className="h-3.5 w-3.5 sm:mr-1 fill-yellow-500 text-yellow-500" />
                    <span className="hidden sm:inline">Featured</span>
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
            
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFullscreen}>
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6">
        {/* Round indicator */}
        <div className="mb-6 flex items-center justify-center gap-4">
          <Badge variant="outline" className="text-lg px-4 py-1">
            Round {currentRound}
          </Badge>
          <div className="text-sm text-muted-foreground">
            {matches.filter(m => m.status === "confirmed").length} / {matches.length} matches complete
          </div>
        </div>

        {/* Standings View */}
        {viewMode === "standings" && (
          <div className="mx-auto max-w-4xl">
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="w-12 px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Player</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground">W-L-D</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Points</th>
                    <th className="hidden md:table-cell px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">OWR%</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((player, idx) => (
                    <tr 
                      key={player.userId} 
                      className={cn(
                        "border-b border-border/50 transition-colors",
                        idx < 8 && "bg-primary/5",
                        idx === 0 && "bg-yellow-500/10"
                      )}
                    >
                      <td className="px-4 py-3">
                        <span className={cn(
                          "text-sm font-bold",
                          idx === 0 && "text-yellow-500",
                          idx === 1 && "text-muted-foreground",
                          idx === 2 && "text-amber-700"
                        )}>
                          {player.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={player.avatarUrl || undefined} />
                            <AvatarFallback className="text-xs">
                              {(player.username || player.displayName).charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">
                              {player.username || player.displayName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-center">
                        <span className="font-mono text-sm">
                          <span className="text-green-600">{player.wins}</span>
                          <span className="text-muted-foreground">-</span>
                          <span className="text-red-500">{player.losses}</span>
                          {player.draws > 0 && (
                            <>
                              <span className="text-muted-foreground">-</span>
                              <span className="text-yellow-500">{player.draws}</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-lg font-bold text-primary">{player.points}</span>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-right">
                        <span className="text-sm text-muted-foreground">
                          {(player.opponentWinRate * 100).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Matches/Bracket View */}
        {viewMode === "bracket" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}

        {/* Feature Match View */}
        {viewMode === "feature" && featureMatches.length > 0 && (
          <div className="mx-auto max-w-4xl space-y-6">
            {featureMatches.map((match) => (
              <FeatureMatchDisplay key={match.id} match={match} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function MatchCard({ match }: { match: Match }) {
  const isComplete = match.status === "confirmed"
  const isLive = match.status === "in_progress" || match.status === "player1_reported" || match.status === "player2_reported"
  
  return (
    <div className={cn(
      "rounded-xl border bg-card p-4 transition-colors",
      isLive && "border-destructive/50 bg-destructive/5",
      match.is_feature_match && "ring-2 ring-yellow-500/50"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {match.table_number && (
            <Badge variant="outline" className="text-[10px]">Table {match.table_number}</Badge>
          )}
          {match.is_feature_match && (
            <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
          )}
        </div>
        {isLive && (
          <Badge variant="destructive" className="gap-1 text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </Badge>
        )}
        {isComplete && (
          <Badge variant="secondary" className="text-[10px]">Complete</Badge>
        )}
      </div>
      
      {/* Players */}
      <div className="space-y-2">
        <PlayerRow 
          player={match.player1} 
          score={match.player1_wins}
          isWinner={isComplete && match.player1_wins > match.player2_wins}
        />
        <div className="border-t border-border/50" />
        <PlayerRow 
          player={match.player2} 
          score={match.player2_wins}
          isWinner={isComplete && match.player2_wins > match.player1_wins}
        />
      </div>
    </div>
  )
}

function PlayerRow({ 
  player, 
  score, 
  isWinner 
}: { 
  player: Match["player1"]
  score: number
  isWinner: boolean
}) {
  return (
    <div className={cn(
      "flex items-center justify-between py-1",
      isWinner && "text-primary"
    )}>
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6">
          <AvatarImage src={player?.avatar_url || undefined} />
          <AvatarFallback className="text-[10px]">
            {getPlayerName(player).charAt(0)}
          </AvatarFallback>
        </Avatar>
        <span className={cn(
          "text-sm font-medium truncate max-w-[120px]",
          isWinner && "font-bold"
        )}>
          {getPlayerName(player)}
        </span>
      </div>
      <span className={cn(
        "text-lg font-bold",
        isWinner ? "text-primary" : "text-muted-foreground"
      )}>
        {score}
      </span>
    </div>
  )
}

function FeatureMatchDisplay({ match }: { match: Match }) {
  return (
    <div className="rounded-2xl border-2 border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-transparent p-6">
      <div className="flex items-center justify-center gap-2 mb-6">
        <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
        <span className="text-sm font-semibold uppercase tracking-wider text-yellow-600">Feature Match</span>
        <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
      </div>
      
      <div className="flex items-center justify-between gap-8">
        {/* Player 1 */}
        <div className="flex-1 text-center">
          <Avatar className="mx-auto h-20 w-20 ring-2 ring-border">
            <AvatarImage src={match.player1?.avatar_url || undefined} />
            <AvatarFallback className="text-2xl">
              {getPlayerName(match.player1).charAt(0)}
            </AvatarFallback>
          </Avatar>
          <p className="mt-3 text-lg font-bold">{getPlayerName(match.player1)}</p>
        </div>
        
        {/* Score */}
        <div className="flex items-center gap-4">
          <span className={cn(
            "text-5xl font-black",
            match.player1_wins > match.player2_wins ? "text-primary" : "text-muted-foreground"
          )}>
            {match.player1_wins}
          </span>
          <span className="text-2xl text-muted-foreground">-</span>
          <span className={cn(
            "text-5xl font-black",
            match.player2_wins > match.player1_wins ? "text-primary" : "text-muted-foreground"
          )}>
            {match.player2_wins}
          </span>
        </div>
        
        {/* Player 2 */}
        <div className="flex-1 text-center">
          <Avatar className="mx-auto h-20 w-20 ring-2 ring-border">
            <AvatarImage src={match.player2?.avatar_url || undefined} />
            <AvatarFallback className="text-2xl">
              {getPlayerName(match.player2).charAt(0)}
            </AvatarFallback>
          </Avatar>
          <p className="mt-3 text-lg font-bold">{getPlayerName(match.player2)}</p>
        </div>
      </div>
      
      {match.table_number && (
        <div className="mt-6 text-center">
          <Badge variant="outline">Table {match.table_number}</Badge>
        </div>
      )}
    </div>
  )
}
