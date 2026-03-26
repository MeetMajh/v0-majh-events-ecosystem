"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { format, formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  CheckCircle2,
  Clock,
  AlertCircle,
  Video,
  LogIn,
  LogOut,
  Send,
  Gamepad2,
  Users,
  Calendar,
  MapPin,
} from "lucide-react"

// Actions
import { checkInToTournament, dropFromTournament, submitPlayerTicket } from "@/lib/player-actions"
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
    currentMatch: true,
    announcements: true,
  })

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const handleCheckIn = () => {
    startTransition(async () => {
      const result = await checkInToTournament(tournament.id)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Successfully checked in!")
      }
    })
  }

  const handleDrop = () => {
    if (!confirm("Are you sure you want to drop from this tournament?")) return
    startTransition(async () => {
      const result = await dropFromTournament(tournament.id)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("You have dropped from the tournament")
      }
    })
  }

  const organizerName = tournament.organizer
    ? `${tournament.organizer.first_name ?? ""} ${tournament.organizer.last_name ?? ""}`.trim()
    : "Unknown"

  const isLive = tournament.status === "in_progress"
  const isCompleted = tournament.status === "completed" || tournament.status === "cancelled"
  const isReadOnly = isCompleted // Read-only mode for completed tournaments
  const isCheckedIn = registration.status === "checked_in"
  const hasDropped = registration.status === "dropped"

  // Find player's rank in standings
  const myRank = standings.find(s => s.player_id === userId)?.rank

  return (
    <div className="container max-w-4xl py-6">
      {/* Back Link */}
      <Link
        href="/dashboard/player-portal"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Player Portal
      </Link>

      {/* Read-Only Banner for Completed Tournaments */}
      {isReadOnly && (
        <div className="mb-4 rounded-lg border border-muted bg-muted/30 p-3">
          <p className="text-sm text-muted-foreground font-medium flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            This tournament has ended. You can view your results but cannot make changes.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Gamepad2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-primary">{tournament.name}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Player Controller - Manage your tournament participation
        </p>
      </div>

      {/* Decklist Required Banner */}
      {tournament.decklist_required && !decklist && !isReadOnly && (
        <div className="mb-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
          <p className="text-sm text-yellow-500 font-medium">
            Decklists are required for this tournament! Submit your decklist in the section below.
          </p>
        </div>
      )}

      {/* Tournament Info Card */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tournament Details */}
            <div className="space-y-2">
              <h3 className="font-semibold text-primary">{tournament.name}</h3>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Organized by:</span>
                  <span className="text-primary">{organizerName}</span>
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
                  <span className="capitalize">{tournament.status.replace("_", " ")}</span>
                </div>
              </div>
            </div>

            {/* Phase/Round Info */}
            <div className="space-y-2 border-l border-border pl-4">
              <div className="text-sm space-y-1">
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
                  <span>{tournament.match_type ?? "-"}</span>
                </div>
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
            </div>

            {/* Player Status */}
            <div className="space-y-3 border-l border-border pl-4">
              <h4 className="font-medium text-primary">Your Status</h4>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Player Status:</span>
                <Badge
                  variant={
                    hasDropped ? "destructive" :
                    isCheckedIn ? "default" :
                    "secondary"
                  }
                >
                  {hasDropped ? "Dropped" : isCheckedIn ? "Checked In" : "Registered"}
                </Badge>
              </div>
              {myRank && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Current Rank:</span>
                  <span className="font-bold">#{myRank}</span>
                </div>
              )}
              {!hasDropped && !isReadOnly && (
                <div className="flex gap-2">
                  {!isCheckedIn && tournament.status === "registration" && (
                    <Button
                      size="sm"
                      onClick={handleCheckIn}
                      disabled={isPending}
                      className="flex-1"
                    >
                      <LogIn className="h-4 w-4 mr-1" />
                      Check In
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDrop}
                    disabled={isPending}
                    className="flex-1"
                  >
                    <LogOut className="h-4 w-4 mr-1" />
                    Drop
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Collapsible Sections */}
      <div className="space-y-2">
        {/* Decklists Section */}
        {tournament.decklist_required && (
          <CollapsibleSection
            title="Decklists"
            icon={<FileText className="h-4 w-4" />}
            isOpen={expandedSections.decklists}
            onToggle={() => toggleSection("decklists")}
          >
            <DecklistSection
              tournamentId={tournament.id}
              decklist={decklist}
              deadline={tournament.decklist_deadline}
              isReadOnly={isReadOnly}
            />
          </CollapsibleSection>
        )}

        {/* Current Match Section */}
        <CollapsibleSection
          title="Current Match"
          icon={<Swords className="h-4 w-4" />}
          isOpen={expandedSections.currentMatch}
          onToggle={() => toggleSection("currentMatch")}
          badge={currentMatch ? <Badge className="bg-primary/10 text-primary text-[10px]">Active</Badge> : null}
        >
          {currentMatch ? (
            <CurrentMatchCard match={currentMatch} userId={userId} />
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No active match. Check back when the next round starts.
            </p>
          )}
        </CollapsibleSection>

        {/* Announcements Section */}
        <CollapsibleSection
          title="Tournament Announcements"
          icon={<Megaphone className="h-4 w-4" />}
          isOpen={expandedSections.announcements}
          onToggle={() => toggleSection("announcements")}
          badge={announcements.length > 0 ? <Badge variant="secondary" className="text-[10px]">{announcements.length}</Badge> : null}
        >
          <AnnouncementsSection announcements={announcements} />
        </CollapsibleSection>

        {/* Your Matches Section */}
        <CollapsibleSection
          title="Your Matches"
          icon={<Swords className="h-4 w-4" />}
          isOpen={expandedSections.myMatches}
          onToggle={() => toggleSection("myMatches")}
        >
          <MyMatchesSection matches={myMatches} userId={userId} />
        </CollapsibleSection>

        {/* All Rounds Section */}
        <CollapsibleSection
          title="All Rounds"
          icon={<ListOrdered className="h-4 w-4" />}
          isOpen={expandedSections.allRounds}
          onToggle={() => toggleSection("allRounds")}
        >
          <AllRoundsSection rounds={allRounds} userId={userId} />
        </CollapsibleSection>

        {/* Standings Section */}
        <CollapsibleSection
          title="Standings"
          icon={<Trophy className="h-4 w-4" />}
          isOpen={expandedSections.standings}
          onToggle={() => toggleSection("standings")}
        >
          <StandingsSection standings={standings} userId={userId} />
        </CollapsibleSection>

        {/* Support Tickets Section */}
        <CollapsibleSection
          title="Support Tickets"
          icon={<TicketCheck className="h-4 w-4" />}
          isOpen={expandedSections.tickets}
          onToggle={() => toggleSection("tickets")}
        >
<TicketsSection
              tournamentId={tournament.id}
              tickets={myTickets}
              isReadOnly={isReadOnly}
            />
        </CollapsibleSection>

        {/* Stream Section */}
        <CollapsibleSection
          title="Stream Your Match"
          icon={<Video className="h-4 w-4" />}
          isOpen={expandedSections.stream}
          onToggle={() => toggleSection("stream")}
        >
          <StreamSection />
        </CollapsibleSection>
      </div>
    </div>
  )
}

// ── Collapsible Section Component ──

function CollapsibleSection({
  title,
  icon,
  isOpen,
  onToggle,
  badge,
  children,
}: {
  title: string
  icon: React.ReactNode
  isOpen: boolean
  onToggle: () => void
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between p-4 bg-card rounded-lg border border-border hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-semibold">{title}</span>
            {badge}
          </div>
          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border border-t-0 border-border rounded-b-lg p-4 bg-card/50">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ── Current Match Card ──

function CurrentMatchCard({ match, userId }: { match: any; userId: string }) {
  const isPlayer1 = match.player1_id === userId
  const opponent = isPlayer1 ? match.player2 : match.player1
  const opponentName = opponent
    ? `${opponent.first_name ?? ""} ${opponent.last_name ?? ""}`.trim() || "Unknown"
    : "BYE"

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
        <div className="text-center flex-1">
          <p className="text-sm text-muted-foreground mb-1">You</p>
          <p className="font-semibold">Player {isPlayer1 ? "1" : "2"}</p>
        </div>
        <div className="px-6">
          <span className="text-2xl font-bold text-muted-foreground">VS</span>
        </div>
        <div className="text-center flex-1">
          <p className="text-sm text-muted-foreground mb-1">Opponent</p>
          <p className="font-semibold">{opponentName}</p>
        </div>
      </div>
      {match.table_number && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-primary" />
          <span>Table {match.table_number}</span>
        </div>
      )}
    </div>
  )
}

// ── Decklist Section ──

function DecklistSection({
  tournamentId,
  decklist,
  deadline,
  isReadOnly = false,
}: {
  tournamentId: string
  decklist: any
  deadline: string | null
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

  return (
    <div className="space-y-4">
      {deadline && (
        <p className="text-sm text-muted-foreground">
          Deadline: {format(new Date(deadline), "MMM d, yyyy h:mm a")}
        </p>
      )}

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
      ) : (
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
          {!isReadOnly && (
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Submitting..." : "Submit Decklist"}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Announcements Section ──

function AnnouncementsSection({ announcements }: { announcements: any[] }) {
  if (announcements.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
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

// ── My Matches Section ──

function MyMatchesSection({ matches, userId }: { matches: any[]; userId: string }) {
  if (matches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No matches yet.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {matches.map((match) => {
        const isPlayer1 = match.player1_id === userId
        const opponent = isPlayer1 ? match.player2 : match.player1
        const opponentName = opponent
          ? `${opponent.first_name ?? ""} ${opponent.last_name ?? ""}`.trim() || "Unknown"
          : "BYE"
        const myWins = isPlayer1 ? match.player1_wins : match.player2_wins
        const theirWins = isPlayer1 ? match.player2_wins : match.player1_wins
        const didWin = match.winner_id === userId

        return (
          <div
            key={match.id}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border",
              match.status === "confirmed"
                ? didWin
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-destructive/30 bg-destructive/5"
                : "border-border bg-muted/30"
            )}
          >
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-[10px]">
                R{match.round?.round_number ?? "?"}
              </Badge>
              <span className="text-sm">vs {opponentName}</span>
            </div>
            <div className="flex items-center gap-2">
              {match.status === "confirmed" ? (
                <>
                  <span className="font-mono font-bold">
                    {myWins ?? 0} - {theirWins ?? 0}
                  </span>
                  {didWin ? (
                    <Badge className="bg-green-500/10 text-green-500 text-[10px]">W</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[10px]">L</Badge>
                  )}
                </>
              ) : (
                <Badge variant="secondary" className="text-[10px]">Pending</Badge>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── All Rounds Section ──

function AllRoundsSection({ rounds, userId }: { rounds: any[]; userId: string }) {
  const [expandedRound, setExpandedRound] = useState<string | null>(
    rounds.length > 0 ? rounds[rounds.length - 1].id : null
  )

  if (rounds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No rounds have been played yet.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {rounds.map((round) => (
        <Collapsible
          key={round.id}
          open={expandedRound === round.id}
          onOpenChange={() => setExpandedRound(expandedRound === round.id ? null : round.id)}
        >
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Round {round.round_number}</Badge>
                <span className="text-sm capitalize">{round.status}</span>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  expandedRound === round.id && "rotate-180"
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-1 pl-4">
              {round.matches?.map((match: any) => {
                const p1Name = match.player1?.display_name ?? "TBD"
                const p2Name = match.player2?.display_name ?? (match.is_bye ? "BYE" : "TBD")
                const isMyMatch = match.isMyMatch

                return (
                  <div
                    key={match.id}
                    className={cn(
                      "flex items-center justify-between p-2 rounded text-sm",
                      isMyMatch && "bg-primary/10 border border-primary/30"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-12">T{match.table_number ?? "-"}</span>
                      <span className={cn(match.winner_id === match.player1_id && "font-semibold")}>
                        {p1Name}
                      </span>
                      <span className="text-muted-foreground">vs</span>
                      <span className={cn(match.winner_id === match.player2_id && "font-semibold")}>
                        {p2Name}
                      </span>
                    </div>
                    {match.status === "confirmed" && (
                      <span className="font-mono text-xs">
                        {match.player1_wins ?? 0}-{match.player2_wins ?? 0}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  )
}

// ── Standings Section ──

function StandingsSection({ standings, userId }: { standings: any[]; userId: string }) {
  if (standings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Standings will appear once the tournament begins.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-2 py-2 text-left font-medium text-muted-foreground">#</th>
            <th className="px-2 py-2 text-left font-medium text-muted-foreground">Player</th>
            <th className="px-2 py-2 text-center font-medium text-muted-foreground">W-L-D</th>
            <th className="px-2 py-2 text-center font-medium text-muted-foreground">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.slice(0, 20).map((standing) => {
            const isMe = standing.player_id === userId
            const playerName = standing.player
              ? `${standing.player.first_name ?? ""} ${standing.player.last_name ?? ""}`.trim()
              : "Unknown"

            return (
              <tr
                key={standing.id}
                className={cn(
                  "border-b border-border/50",
                  isMe && "bg-primary/10"
                )}
              >
                <td className="px-2 py-2 font-bold">{standing.rank}</td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={standing.player?.avatar_url} />
                      <AvatarFallback>{playerName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className={cn(isMe && "font-semibold")}>{playerName}</span>
                    {isMe && <Badge className="text-[10px]">You</Badge>}
                  </div>
                </td>
                <td className="px-2 py-2 text-center font-mono">
                  {standing.wins ?? 0}-{standing.losses ?? 0}-{standing.draws ?? 0}
                </td>
                <td className="px-2 py-2 text-center font-bold">{standing.match_points ?? 0}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Tickets Section ──

function TicketsSection({
  tournamentId,
  tickets,
  isReadOnly = false,
}: {
  tournamentId: string
  tickets: any[]
  isReadOnly?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)

  const handleSubmitTicket = (formData: FormData) => {
    startTransition(async () => {
      const result = await submitPlayerTicket(tournamentId, {
        category: formData.get("category") as string,
        severity: formData.get("severity") as string,
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        affectedRound: formData.get("affected_round")
          ? parseInt(formData.get("affected_round") as string)
          : undefined,
      })
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Ticket submitted!")
        setIsOpen(false)
      }
    })
  }

  return (
    <div className="space-y-4">
      {!isReadOnly && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <TicketCheck className="h-4 w-4 mr-1" />
              Submit Ticket
            </Button>
          </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Support Ticket</DialogTitle>
            <DialogDescription>
              Report an issue or request assistance from tournament staff.
            </DialogDescription>
          </DialogHeader>
          <form action={handleSubmitTicket} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select name="category" defaultValue="technical">
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ISSUE_CATEGORIES).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="severity">Severity</Label>
              <Select name="severity" defaultValue="medium">
                <SelectTrigger>
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input name="title" placeholder="Brief description" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea name="description" placeholder="Details..." rows={4} required />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Submitting..." : "Submit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
        </Dialog>
      )}

      {tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tickets submitted.</p>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{ticket.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{ticket.description}</p>
                </div>
                <Badge variant={ticket.status === "open" ? "destructive" : "secondary"} className="text-[10px]">
                  {ticket.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Stream Section ──

function StreamSection() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect your streaming account to broadcast your matches live.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" className="flex-col h-auto py-4" disabled>
          <Video className="h-6 w-6 mb-1 text-purple-500" />
          <span className="text-xs">Twitch</span>
          <span className="text-[10px] text-muted-foreground">Coming Soon</span>
        </Button>
        <Button variant="outline" className="flex-col h-auto py-4" disabled>
          <Video className="h-6 w-6 mb-1 text-red-500" />
          <span className="text-xs">YouTube</span>
          <span className="text-[10px] text-muted-foreground">Coming Soon</span>
        </Button>
        <Button variant="outline" className="flex-col h-auto py-4" disabled>
          <Video className="h-6 w-6 mb-1 text-blue-500" />
          <span className="text-xs">Facebook</span>
          <span className="text-[10px] text-muted-foreground">Coming Soon</span>
        </Button>
      </div>
    </div>
  )
}
