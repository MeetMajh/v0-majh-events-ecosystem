"use client"

import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { StreamEmbed, getEmbedUrl } from "@/components/esports/stream-embed"
import { cn } from "@/lib/utils"
import { Radio, Trophy, Swords, Eye, ExternalLink, Play } from "lucide-react"

interface Player {
  id: string
  first_name?: string | null
  last_name?: string | null
  avatar_url?: string | null
}

interface FeatureMatchCardProps {
  match: {
    id: string
    player1: Player | null
    player2: Player | null
    player1Wins?: number
    player2Wins?: number
    draws?: number
    status: string
    tableNumber?: number | null
    streamUrl?: string | null
    streamPlatform?: string | null
    streamEmbedUrl?: string | null
    viewerCount?: number
    roundNumber?: number
    tournament?: {
      id: string
      name: string
      slug: string
      gameName?: string
      gameSlug?: string
    } | null
  }
  showStream?: boolean
  size?: "compact" | "large"
  className?: string
}

function getPlayerName(player: Player | null): string {
  if (!player) return "TBD"
  const name = `${player.first_name || ""} ${player.last_name || ""}`.trim()
  return name || "Unknown"
}

function getInitials(player: Player | null): string {
  if (!player) return "?"
  const first = player.first_name?.[0] || ""
  const last = player.last_name?.[0] || ""
  return (first + last).toUpperCase() || "?"
}

export function FeatureMatchCard({
  match,
  showStream = true,
  size = "large",
  className,
}: FeatureMatchCardProps) {
  const isLive = match.status === "in_progress" || match.status === "pending"
  const hasStream = !!(match.streamEmbedUrl || match.streamUrl)
  
  // Generate embed URL if not provided
  const embedUrl = match.streamEmbedUrl || 
    (match.streamUrl && match.streamPlatform 
      ? getEmbedUrl(match.streamUrl, match.streamPlatform) 
      : null)

  if (size === "compact") {
    return (
      <Card className={cn("overflow-hidden border-primary/30 bg-card", className)}>
        <CardContent className="p-0">
          <div className="flex items-stretch">
            {/* Stream preview (if available) */}
            {showStream && embedUrl && (
              <div className="relative w-40 shrink-0">
                <div className="absolute inset-0 bg-black">
                  <iframe
                    src={embedUrl}
                    title="Stream"
                    className="h-full w-full pointer-events-none"
                    allow="autoplay"
                  />
                </div>
                {isLive && (
                  <div className="absolute left-2 top-2">
                    <Badge className="bg-destructive text-[10px]">
                      <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      LIVE
                    </Badge>
                  </div>
                )}
              </div>
            )}
            
            {/* Match info */}
            <div className="flex flex-1 flex-col justify-center p-4">
              {/* Tournament badge */}
              {match.tournament && (
                <Link 
                  href={`/esports/tournaments/${match.tournament.slug}`}
                  className="mb-2 text-xs text-muted-foreground hover:text-primary transition-colors line-clamp-1"
                >
                  {match.tournament.name}
                  {match.roundNumber && ` • Round ${match.roundNumber}`}
                </Link>
              )}
              
              {/* Players */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={match.player1?.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">{getInitials(match.player1)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm truncate">{getPlayerName(match.player1)}</span>
                </div>
                
                <div className="flex items-center gap-1 shrink-0 font-mono text-sm">
                  <span className={cn(
                    "font-bold",
                    (match.player1Wins ?? 0) > (match.player2Wins ?? 0) && "text-green-600"
                  )}>
                    {match.player1Wins ?? 0}
                  </span>
                  <span className="text-muted-foreground">-</span>
                  <span className={cn(
                    "font-bold",
                    (match.player2Wins ?? 0) > (match.player1Wins ?? 0) && "text-green-600"
                  )}>
                    {match.player2Wins ?? 0}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  <span className="font-medium text-sm truncate">{getPlayerName(match.player2)}</span>
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={match.player2?.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">{getInitials(match.player2)}</AvatarFallback>
                  </Avatar>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Large (featured) variant
  return (
    <Card className={cn("overflow-hidden border-2 border-primary/30", className)}>
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between bg-primary/5 px-4 py-2 border-b border-primary/20">
          <div className="flex items-center gap-2">
            {isLive ? (
              <Badge className="bg-destructive gap-1">
                <Radio className="h-3 w-3 animate-pulse" />
                LIVE
              </Badge>
            ) : (
              <Badge variant="outline">Feature Match</Badge>
            )}
            {match.tournament && (
              <Link 
                href={`/esports/tournaments/${match.tournament.slug}`}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {match.tournament.name}
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {match.roundNumber && <span>Round {match.roundNumber}</span>}
            {match.tableNumber && <span>• Table {match.tableNumber}</span>}
            {match.viewerCount && match.viewerCount > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {match.viewerCount.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Stream embed (if available and enabled) */}
        {showStream && embedUrl && (
          <div className="relative">
            <StreamEmbed
              embedUrl={embedUrl}
              streamUrl={match.streamUrl || undefined}
              platform={match.streamPlatform as any}
              title={`${getPlayerName(match.player1)} vs ${getPlayerName(match.player2)}`}
            />
          </div>
        )}

        {/* No stream placeholder */}
        {showStream && !embedUrl && (
          <div className="flex aspect-video items-center justify-center bg-muted/30">
            <div className="text-center">
              <Play className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">No stream available</p>
            </div>
          </div>
        )}

        {/* Watch Link Banner */}
        {embedUrl && (
          <Link
            href={`/match/${match.id}/watch`}
            className="flex items-center justify-center gap-2 bg-primary/10 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <ExternalLink className="h-4 w-4" />
            Open Full Watch Experience
          </Link>
        )}

        {/* Players section */}
        <div className="p-4">
          <div className="flex items-center justify-between">
            {/* Player 1 */}
            <div className="flex items-center gap-3 flex-1">
              <Avatar className="h-12 w-12 border-2 border-background shadow-md">
                <AvatarImage src={match.player1?.avatar_url || undefined} />
                <AvatarFallback>{getInitials(match.player1)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-foreground">{getPlayerName(match.player1)}</p>
                {match.tournament?.gameName && (
                  <p className="text-xs text-muted-foreground">{match.tournament.gameName}</p>
                )}
              </div>
            </div>

            {/* Score */}
            <div className="flex items-center gap-2 px-4">
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-lg text-2xl font-bold",
                (match.player1Wins ?? 0) > (match.player2Wins ?? 0)
                  ? "bg-green-500/10 text-green-600"
                  : "bg-muted text-muted-foreground"
              )}>
                {match.player1Wins ?? 0}
              </div>
              <Swords className="h-6 w-6 text-muted-foreground" />
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-lg text-2xl font-bold",
                (match.player2Wins ?? 0) > (match.player1Wins ?? 0)
                  ? "bg-green-500/10 text-green-600"
                  : "bg-muted text-muted-foreground"
              )}>
                {match.player2Wins ?? 0}
              </div>
            </div>

            {/* Player 2 */}
            <div className="flex items-center gap-3 flex-1 justify-end text-right">
              <div>
                <p className="font-semibold text-foreground">{getPlayerName(match.player2)}</p>
                {match.tournament?.gameName && (
                  <p className="text-xs text-muted-foreground">{match.tournament.gameName}</p>
                )}
              </div>
              <Avatar className="h-12 w-12 border-2 border-background shadow-md">
                <AvatarImage src={match.player2?.avatar_url || undefined} />
                <AvatarFallback>{getInitials(match.player2)}</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Grid display for multiple feature matches
export function FeatureMatchGrid({
  matches,
  showStreams = true,
  className,
}: {
  matches: FeatureMatchCardProps["match"][]
  showStreams?: boolean
  className?: string
}) {
  if (matches.length === 0) return null

  // First match is featured (large), rest are compact
  const [featured, ...rest] = matches

  return (
    <div className={cn("space-y-4", className)}>
      {featured && (
        <FeatureMatchCard
          match={featured}
          showStream={showStreams}
          size="large"
        />
      )}
      {rest.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {rest.map((match) => (
            <FeatureMatchCard
              key={match.id}
              match={match}
              showStream={showStreams}
              size="compact"
            />
          ))}
        </div>
      )}
    </div>
  )
}
