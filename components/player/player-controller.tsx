"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { format, formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { getPlayerDisplayName } from "@/lib/player-utils"

// UI Components
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Icons
import {
  ArrowLeft,
  Megaphone,
  Trophy,
  Swords,
  FileText,
  TicketCheck,
  ListOrdered,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Video,
  LogOut,
  Send,
  Gamepad2,
  Users,
  Calendar,
  MapPin,
  Info,
  ExternalLink,
} from "lucide-react"

// Actions
import { dropFromTournament, submitPlayerTicket } from "@/lib/player-actions"
import { submitDecklist } from "@/lib/tournament-controller-actions"
import { ISSUE_CATEGORIES } from "@/lib/tournament-issue-constants"

interface PlayerControllerProps {
  tournament: any
  registration: any
  currentPhase: any
  currentRound: any
  currentMatch: any
  myMatches: any[]
  decklist: any
  standings: any[]
  announcements: any[]
  myTickets: any[]
  allRounds: any[]
  userId: string
}

export function PlayerController({
  tournament,
  registration,
  currentPhase,
  currentRound,
  currentMatch,
  myMatches,
  decklist,
  standings,
  announcements,
  myTickets,
  allRounds,
  userId,
}: PlayerControllerProps) {
  const [isPending, startTransition] = useTransition()
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    decklists: false,
    currentMatch: true,
    announcements: false,
    seatings: false,
  })

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const handleDrop = () => {
    if (!confirm("Are you sure you want to drop from this tournament? This action cannot be undone.")) return
    startTransition(async () => {
      const result = await dropFromTournament(tournament.id)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("You have dropped from the tournament")
      }
    })
  }

  const isLive = tournament.status === "in_progress"
  const isCompleted = tournament.status === "completed" || tournament.status === "cancelled"
  const isReadOnly = isCompleted
  const hasDropped = registration.status === "dropped"
  
  // Find player's current standing
  const myStanding = standings.find(s => s.player_id === userId)
  const myPoints = myStanding?.match_points ?? 0

  // Get organizer name
  const organizerName = tournament.organizer_id 
    ? "Tournament Organizer" 
    : "MAJH Events"

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-primary">Player Controller</h1>
        </div>
        <Link 
          href="/dashboard/player-portal" 
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-3 w-3" />
          Go to the Player Portal
        </Link>
        <p className="text-sm text-muted-foreground italic">
          Designed for mobile &amp; in-person tournaments
        </p>
      </div>

      {/* Connection Status */}
      <div className="flex items-center gap-2 text-sm py-2 px-3 bg-card rounded-lg border">
        <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
        <span>MAJH Events Connection</span>
        <Info className="h-3.5 w-3.5 text-muted-foreground ml-1" />
      </div>

      {/* Decklist Warning Banner */}
      {tournament.decklist_required && !decklist && !isReadOnly && (
        <div className="rounded-lg bg-orange-500/90 text-white p-3">
          <p className="text-sm font-medium">
            Decklists are required for this tournament! You can submit your decklist in the Decklist Submission panel below.
          </p>
        </div>
      )}

      {/* Read-Only Banner for Completed Tournaments */}
      {isReadOnly && (
        <div className="rounded-lg bg-muted p-3 border">
          <p className="text-sm text-muted-foreground font-medium flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            This tournament has ended. You can view your results but cannot make changes.
          </p>
        </div>
      )}

      {/* Main Info Grid - 3 columns like Melee */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tournament Info */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-primary text-lg">{tournament.name}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Organized by:</span>
                <span className="text-primary font-medium">{organizerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Start Date:</span>
                <span>
                  {tournament.start_date
                    ? format(new Date(tournament.start_date), "MM/dd/yyyy h:mm a")
                    : "TBD"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className="capitalize">{tournament.status === "in_progress" ? "In Progress" : tournament.status}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Phase/Round Info */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Phase:</span>
                <span>{currentPhase?.name ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Format:</span>
                <span className="capitalize">{tournament.format ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Match Type:</span>
                <span>-</span>
              </div>
              <div className="h-px bg-border my-2" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Round:</span>
                <span>{currentRound?.round_number ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Matches Remaining:</span>
                <span>
                  {currentRound
                    ? currentRound.matches?.filter((m: any) => m.status !== "confirmed").length ?? 0
                    : 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Player Status */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h4 className="font-semibold">Your Name Here</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Player Status:</span>
                <span className={cn(
                  "font-medium",
                  hasDropped ? "text-red-500" : "text-green-500"
                )}>
                  {hasDropped ? "Dropped" : "Active"}
                </span>
              </div>
            </div>
            {!hasDropped && !isReadOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDrop}
                disabled={isPending}
                className="w-full text-red-500 border-red-500/50 hover:bg-red-500/10 hover:text-red-500"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Click here to drop
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Collapsible Sections */}
      <div className="space-y-2">
        {/* Decklists */}
        {tournament.decklist_required && (
          <CollapsiblePanel
            title="Decklists"
            isOpen={expandedSections.decklists}
            onToggle={() => toggleSection("decklists")}
            rightContent={
              decklist 
                ? <span className="text-green-500 text-sm">1 out of 1 submitted</span>
                : <span className="text-red-500 text-sm">0 out of 1 submitted</span>
            }
          >
            <DecklistSection
              tournamentId={tournament.id}
              decklist={decklist}
              deadline={tournament.decklist_deadline}
              format={tournament.format}
              isReadOnly={isReadOnly}
            />
          </CollapsiblePanel>
        )}

        {/* Current Match */}
        <CollapsiblePanel
          title="Current Match"
          isOpen={expandedSections.currentMatch}
          onToggle={() => toggleSection("currentMatch")}
        >
          <CurrentMatchSection 
            match={currentMatch} 
            userId={userId} 
            points={myPoints}
            tournamentId={tournament.id}
          />
        </CollapsiblePanel>

        {/* Tournament Announcements */}
        <CollapsiblePanel
          title="Tournament Announcements"
          isOpen={expandedSections.announcements}
          onToggle={() => toggleSection("announcements")}
        >
          <AnnouncementsSection announcements={announcements} />
        </CollapsiblePanel>

        {/* Your Seatings/Match History */}
        <CollapsiblePanel
          title="Your Seatings"
          isOpen={expandedSections.seatings}
          onToggle={() => toggleSection("seatings")}
        >
          <SeatingsSection matches={myMatches} userId={userId} />
        </CollapsiblePanel>
      </div>
    </div>
  )
}

// ── Collapsible Panel Component (Melee style) ──

function CollapsiblePanel({
  title,
  isOpen,
  onToggle,
  rightContent,
  children,
}: {
  title: string
  isOpen: boolean
  onToggle: () => void
  rightContent?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button 
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-card hover:bg-muted/50 transition-colors"
      >
        <span className="font-semibold">{title}</span>
        <div className="flex items-center gap-3">
          {rightContent}
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {isOpen && (
        <div className="p-4 border-t border-border bg-card/50">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Current Match Section ──

function CurrentMatchSection({ 
  match, 
  userId, 
  points,
  tournamentId 
}: { 
  match: any
  userId: string
  points: number
  tournamentId: string
}) {
  if (!match) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">You</span>
            <p className="font-medium">Waiting...</p>
          </div>
          <div>
            <span className="text-muted-foreground">Points</span>
            <p className="font-medium">{points}</p>
          </div>
        </div>
        <p className="text-yellow-500 text-center text-lg font-medium py-4">
          Waiting on pairing!
        </p>
      </div>
    )
  }

  const isPlayer1 = match.player1_id === userId
  const opponent = isPlayer1 ? match.player2 : match.player1
  const opponentName = opponent ? getPlayerDisplayName(opponent) : "BYE"

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">You</span>
          <p className="font-medium text-primary">{opponentName !== "BYE" ? "vs " + opponentName : "BYE"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Points</span>
          <p className="font-medium">{points}</p>
        </div>
      </div>
      
      {match.table_number && (
        <div className="text-center py-2 bg-primary/10 rounded-lg">
          <span className="text-sm text-muted-foreground">Table</span>
          <p className="text-2xl font-bold text-primary">{match.table_number}</p>
        </div>
      )}

      {match.status === "pending" && (
        <p className="text-center text-yellow-500 font-medium">
          Match in progress
        </p>
      )}

      <div className="flex justify-center">
        <Button asChild variant="outline">
          <Link href={`/esports/tournaments/${tournamentId}`}>
            <ExternalLink className="h-4 w-4 mr-2" />
            View Tournament &amp; Report Result
          </Link>
        </Button>
      </div>
    </div>
  )
}

// ── Decklist Section ──

function DecklistSection({
  tournamentId,
  decklist,
  deadline,
  format,
  isReadOnly = false,
}: {
  tournamentId: string
  decklist: any
  deadline: string | null
  format: string
  isReadOnly?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [deckName, setDeckName] = useState(decklist?.decklist_name ?? "")
  const [deckText, setDeckText] = useState(decklist?.decklist_text ?? "")
  const [deckUrl, setDeckUrl] = useState(decklist?.decklist_url ?? "")

  const handleSubmit = () => {
    if (!deckText.trim()) {
      toast.error("Please enter your decklist")
      return
    }

    startTransition(async () => {
      const result = await submitDecklist(tournamentId, {
        name: deckName,
        text: deckText,
        url: deckUrl,
      })
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Decklist submitted successfully!")
      }
    })
  }

  const deadlinePassed = deadline && new Date(deadline) < new Date()

  return (
    <div className="space-y-4">
      {deadline && (
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <span>
            Submission {deadlinePassed ? "closed" : "closes"} at: {format}{deadline ? ` - ${new Date(deadline).toLocaleDateString()}` : ""}
          </span>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-3 bg-muted/30">
          <div>
            <span className="text-sm text-muted-foreground">Format</span>
            <p className="font-medium capitalize">{format || "Standard"}</p>
          </div>
          <span className={cn(
            "text-sm",
            decklist ? "text-green-500" : deadlinePassed ? "text-red-500" : "text-yellow-500"
          )}>
            {decklist ? "Submitted" : deadlinePassed ? "Submission Closed" : "Pending"}
          </span>
        </div>
      </div>

      {decklist ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-500 font-medium">Decklist Submitted</span>
          </div>
          <div className="text-sm">
            <p className="font-medium">{decklist.decklist_name || "Unnamed Deck"}</p>
            <pre className="mt-2 p-3 bg-muted rounded-lg text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">
              {decklist.decklist_text}
            </pre>
          </div>
        </div>
      ) : !isReadOnly && !deadlinePassed ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deck-name">Deck Name (optional)</Label>
            <Input
              id="deck-name"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="My Awesome Deck"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deck-text">Decklist *</Label>
            <Textarea
              id="deck-text"
              value={deckText}
              onChange={(e) => setDeckText(e.target.value)}
              placeholder="Enter your decklist here..."
              rows={8}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deck-url">Deck URL (optional)</Label>
            <Input
              id="deck-url"
              value={deckUrl}
              onChange={(e) => setDeckUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Submitting..." : "Submit Decklist"}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

// ── Announcements Section ──

function AnnouncementsSection({ announcements }: { announcements: any[] }) {
  if (announcements.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No announcements yet.
      </p>
    )
  }

  return (
    <div className="space-y-3 max-h-64 overflow-y-auto">
      {announcements.map((ann) => (
        <div
          key={ann.id}
          className={cn(
            "p-3 rounded-lg border",
            ann.priority === "high" || ann.priority === "urgent"
              ? "border-yellow-500/50 bg-yellow-500/5"
              : "border-border bg-muted/30"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm">{ann.message}</p>
            {ann.priority !== "normal" && (
              <Badge variant="outline" className="text-[10px] shrink-0">
                {ann.priority}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(ann.created_at), { addSuffix: true })}
          </p>
        </div>
      ))}
    </div>
  )
}

// ── Seatings/Match History Section ──

function SeatingsSection({ matches, userId }: { matches: any[], userId: string }) {
  if (matches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No matches yet.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {matches.map((match, index) => {
        const isPlayer1 = match.player1_id === userId
        const opponent = isPlayer1 ? match.player2 : match.player1
        const opponentName = opponent ? getPlayerDisplayName(opponent) : "BYE"
        
        const won = (isPlayer1 && match.result === "player1") || (!isPlayer1 && match.result === "player2")
        const lost = (isPlayer1 && match.result === "player2") || (!isPlayer1 && match.result === "player1")
        const draw = match.result === "draw"

        return (
          <div 
            key={match.id} 
            className="flex items-center justify-between p-3 rounded-lg border bg-card"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-8">R{match.round_number || index + 1}</span>
              <span className="font-medium">{opponentName}</span>
              {match.table_number && (
                <span className="text-xs text-muted-foreground">Table {match.table_number}</span>
              )}
            </div>
            <Badge className={cn(
              won && "bg-green-500/20 text-green-500",
              lost && "bg-red-500/20 text-red-500",
              draw && "bg-yellow-500/20 text-yellow-500",
              !match.result && "bg-muted text-muted-foreground"
            )}>
              {won ? "Win" : lost ? "Loss" : draw ? "Draw" : "Pending"}
            </Badge>
          </div>
        )
      })}
    </div>
  )
}
