"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { BracketView } from "@/components/esports/bracket-view"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield, Users, Trophy, ScrollText, ListOrdered, Swords, Send, Timer, CheckCircle2, LayoutList } from "lucide-react"
import { format } from "date-fns"

type TabKey = "bracket" | "rounds" | "standings" | "pairings" | "participants" | "rules" | "results"

// Helper to get display name, preferring username if available
function getPlayerDisplayName(profile: { display_name?: string; username?: string | null; first_name?: string; last_name?: string } | null): string {
  if (!profile) return "Unknown"
  if (profile.username) return profile.username
  if (profile.display_name) return profile.display_name
  if (profile.first_name || profile.last_name) return `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
  return "Unknown"
}

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "bracket", label: "Bracket", icon: Trophy },
  { key: "rounds", label: "Rounds", icon: LayoutList },
  { key: "standings", label: "Standings", icon: ListOrdered },
  { key: "pairings", label: "Pairings", icon: Swords },
  { key: "participants", label: "Participants", icon: Users },
  { key: "rules", label: "Rules", icon: ScrollText },
  { key: "results", label: "Results", icon: Shield },
]

export function TournamentTabs({
  tournament,
  matches,
  participants,
  standings,
  currentRound,
  allRounds,
  currentUserId,
}: {
  tournament: any
  matches: any[]
  participants: any[]
  standings?: any[]
  currentRound?: any
  allRounds?: any[]
  currentUserId?: string
}) {
  const [activeTab, setActiveTab] = useState<TabKey>(
    tournament.status === "in_progress" ? "standings" : "bracket"
  )

  const showResults = tournament.status === "completed"
  const showPairings = tournament.status === "in_progress" && currentRound
  const showRounds = (allRounds?.length ?? 0) > 0

  const filteredTabs = TABS.filter((t) => {
    if (t.key === "results" && !showResults) return false
    if (t.key === "pairings" && !showPairings) return false
    if (t.key === "standings" && tournament.status === "registration") return false
    if (t.key === "rounds" && !showRounds) return false
    return true
  })

  return (
    <div>
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-border bg-muted/30 p-1">
        {filteredTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "bracket" && (
        <BracketView
          tournamentId={tournament.id}
          matches={matches}
          participants={participants}
          format={tournament.format}
        />
      )}

      {activeTab === "rounds" && (
        <RoundsView rounds={allRounds ?? []} tournamentStatus={tournament.status} />
      )}

      {activeTab === "standings" && (
        <StandingsView standings={standings ?? []} />
      )}

      {activeTab === "pairings" && currentRound && (
        <PairingsView 
          round={currentRound} 
          currentUserId={currentUserId}
          tournamentId={tournament.id}
        />
      )}

      {activeTab === "participants" && (
        <ParticipantsList participants={participants} />
      )}

      {activeTab === "rules" && (
        <RulesView rules={tournament.rules_text} />
      )}

      {activeTab === "results" && showResults && (
        <ResultsView tournamentId={tournament.id} standings={standings ?? []} />
      )}
    </div>
  )
}

function ParticipantsList({ participants }: { participants: any[] }) {
  if (participants.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <p className="text-muted-foreground">No participants yet. Be the first to register!</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Seed</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Player</th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {participants.map((p: any, idx: number) => (
            <tr key={p.id} className="border-b border-border/50">
              <td className="px-4 py-2.5 text-sm text-muted-foreground">{p.seed_number ?? idx + 1}</td>
              <td className="px-4 py-2.5">
                {p.profiles ? (
                  <Link
                    href={`/esports/players/${p.profiles.id || p.user_id}`}
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {getPlayerDisplayName(p.profiles)}
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">Unknown Player</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-center">
                <StatusBadge status={p.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    registered: "bg-chart-3/10 text-chart-3",
    checked_in: "bg-primary/10 text-primary",
    eliminated: "bg-destructive/10 text-destructive",
    winner: "bg-primary/10 text-primary",
    disqualified: "bg-muted text-muted-foreground",
  }
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", styles[status] ?? "bg-muted text-muted-foreground")}>
      {status}
    </span>
  )
}

function RulesView({ rules }: { rules: string | null }) {
  if (!rules) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <p className="text-muted-foreground">No rules have been published for this tournament yet.</p>
      </div>
    )
  }

  return (
    <div className="prose prose-invert max-w-none rounded-xl border border-border bg-card p-6">
      <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">{rules}</div>
    </div>
  )
}

function ResultsView({ tournamentId, standings }: { tournamentId: string; standings: any[] }) {
  if (standings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <Trophy className="mx-auto mb-3 h-8 w-8 text-primary" />
        <p className="text-muted-foreground">Tournament results will be displayed here after completion.</p>
      </div>
    )
  }

  const top3 = standings.slice(0, 3)

  return (
    <div className="space-y-6">
      {/* Podium */}
      <div className="flex items-end justify-center gap-4 py-8">
        {/* 2nd Place */}
        <div className="flex flex-col items-center">
          <Avatar className="h-16 w-16 ring-2 ring-muted">
            <AvatarImage src={top3[1]?.avatarUrl} />
            <AvatarFallback>{(top3[1]?.username || top3[1]?.displayName)?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="mt-2 text-center">
            <p className="font-medium">{(top3[1]?.username || top3[1]?.displayName) ?? "---"}</p>
            <Badge variant="secondary">2nd Place</Badge>
          </div>
          <div className="mt-2 h-20 w-24 rounded-t-lg bg-muted/50" />
        </div>

        {/* 1st Place */}
        <div className="flex flex-col items-center">
          <Trophy className="mb-2 h-8 w-8 text-yellow-500" />
          <Avatar className="h-20 w-20 ring-4 ring-yellow-500">
            <AvatarImage src={top3[0]?.avatarUrl} />
            <AvatarFallback>{(top3[0]?.username || top3[0]?.displayName)?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="mt-2 text-center">
            <p className="text-lg font-bold">{(top3[0]?.username || top3[0]?.displayName) ?? "---"}</p>
            <Badge className="bg-yellow-500/10 text-yellow-600">1st Place</Badge>
          </div>
          <div className="mt-2 h-28 w-24 rounded-t-lg bg-yellow-500/20" />
        </div>

        {/* 3rd Place */}
        <div className="flex flex-col items-center">
          <Avatar className="h-14 w-14 ring-2 ring-muted">
            <AvatarImage src={top3[2]?.avatarUrl} />
            <AvatarFallback>{(top3[2]?.username || top3[2]?.displayName)?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="mt-2 text-center">
            <p className="font-medium">{(top3[2]?.username || top3[2]?.displayName) ?? "---"}</p>
            <Badge variant="outline">3rd Place</Badge>
          </div>
          <div className="mt-2 h-14 w-24 rounded-t-lg bg-muted/30" />
        </div>
      </div>

      {/* Full Results Table */}
      <StandingsView standings={standings} showTitle={false} />
    </div>
  )
}

function StandingsView({ standings, showTitle = true }: { standings: any[]; showTitle?: boolean }) {
  if (standings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <ListOrdered className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">Standings will appear after the first round is complete.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {showTitle && (
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <h3 className="font-semibold">Current Standings</h3>
        </div>
      )}
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground w-16">Rank</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Player</th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Points</th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Record</th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">OMW%</th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">GW%</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((player, idx) => (
            <tr key={player.playerId} className={cn(
              "border-b border-border/50",
              player.isDropped && "opacity-50"
            )}>
              <td className="px-4 py-2.5 font-bold text-sm">
                {idx + 1}
                {idx === 0 && <Trophy className="inline ml-1 h-3 w-3 text-yellow-500" />}
              </td>
              <td className="px-4 py-2.5">
                <Link
                  href={`/esports/players/${player.playerId}`}
                  className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={player.avatarUrl} />
                    <AvatarFallback>{(player.username || player.displayName)?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {player.username || player.displayName}
                  {player.isDropped && <Badge variant="destructive" className="text-[10px]">Dropped</Badge>}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-center font-bold text-sm">{player.points}</td>
              <td className="px-4 py-2.5 text-center font-mono text-sm">
                {player.matchWins}-{player.matchLosses}
                {player.matchDraws > 0 && `-${player.matchDraws}`}
              </td>
              <td className="px-4 py-2.5 text-center text-sm text-muted-foreground hidden md:table-cell">
                {(player.omwPercent ?? 0).toFixed(1)}%
              </td>
              <td className="px-4 py-2.5 text-center text-sm text-muted-foreground hidden md:table-cell">
                {(player.gwPercent ?? 0).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PairingsView({ 
  round, 
  currentUserId,
  tournamentId 
}: { 
  round: any
  currentUserId?: string
  tournamentId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null)
  const [result, setResult] = useState({ p1Wins: 0, p2Wins: 0, draws: 0 })

  const userMatch = round.matches?.find((m: any) => 
    m.player1?.id === currentUserId || m.player2?.id === currentUserId
  )

  const handleReportResult = async () => {
    if (!selectedMatch) return
    
    const { reportMatchResult } = await import("@/lib/tournament-controller-actions")
    
    const match = round.matches?.find((m: any) => m.id === selectedMatch)
    if (!match) return

    const winnerId = result.p1Wins > result.p2Wins 
      ? match.player1?.id 
      : result.p2Wins > result.p1Wins
        ? match.player2?.id
        : null

    startTransition(async () => {
      const res = await reportMatchResult(
        selectedMatch,
        winnerId || match.player1?.id,
        result.p1Wins,
        result.p2Wins,
        result.draws
      )
      
      if ("error" in res) {
        toast.error(res.error)
      } else {
        toast.success("Result submitted!")
        setSelectedMatch(null)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Round Header */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <div>
          <h3 className="font-semibold">Round {round.round_number}</h3>
          <p className="text-sm text-muted-foreground capitalize">{round.round_type} round</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={round.status === "active" ? "default" : "secondary"}>
            {round.status}
          </Badge>
          {round.end_time && round.status === "active" && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Timer className="h-3 w-3" />
              Ends {format(new Date(round.end_time), "h:mm a")}
            </Badge>
          )}
        </div>
      </div>

      {/* Your Match Highlight */}
      {userMatch && (
        <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <Swords className="h-4 w-4" />
            Your Match - Table {userMatch.table_number}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={userMatch.player1?.avatar_url} />
                <AvatarFallback>{getPlayerDisplayName(userMatch.player1)?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{getPlayerDisplayName(userMatch.player1)}</p>
                {userMatch.winner_id === userMatch.player1?.id && (
                  <Badge className="text-[10px]">Winner</Badge>
                )}
              </div>
            </div>
            <div className="text-center">
              {userMatch.status === "confirmed" ? (
                <p className="font-mono text-lg font-bold">
                  {userMatch.player1_wins ?? 0} - {userMatch.player2_wins ?? 0}
                </p>
              ) : (
                <p className="text-muted-foreground">vs</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="font-medium">{userMatch.player2 ? getPlayerDisplayName(userMatch.player2) : "BYE"}</p>
                {userMatch.winner_id === userMatch.player2?.id && (
                  <Badge className="text-[10px]">Winner</Badge>
                )}
              </div>
              <Avatar className="h-10 w-10">
                <AvatarImage src={userMatch.player2?.avatar_url} />
                <AvatarFallback>{userMatch.player2 ? getPlayerDisplayName(userMatch.player2)?.charAt(0) : "-"}</AvatarFallback>
              </Avatar>
            </div>
          </div>
          {userMatch.status !== "confirmed" && !userMatch.is_bye && (
            <div className="mt-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    size="sm" 
                    onClick={() => setSelectedMatch(userMatch.id)}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Report Result
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Report Match Result</DialogTitle>
                    <DialogDescription>
                      Enter the game wins for each player
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label>{getPlayerDisplayName(userMatch.player1)}</Label>
                      <Input
                        type="number"
                        min="0"
                        value={result.p1Wins}
                        onChange={(e) => setResult(prev => ({ ...prev, p1Wins: parseInt(e.target.value) || 0 }))}
                        className="text-center"
                      />
                      <span className="text-sm text-muted-foreground">Wins</span>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label>{getPlayerDisplayName(userMatch.player2)}</Label>
                      <Input
                        type="number"
                        min="0"
                        value={result.p2Wins}
                        onChange={(e) => setResult(prev => ({ ...prev, p2Wins: parseInt(e.target.value) || 0 }))}
                        className="text-center"
                      />
                      <span className="text-sm text-muted-foreground">Wins</span>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleReportResult} disabled={isPending}>
                      {isPending ? "Submitting..." : "Submit Result"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
          {userMatch.status === "confirmed" && (
            <div className="mt-4 flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Result confirmed
            </div>
          )}
        </div>
      )}

      {/* All Pairings */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <h3 className="font-semibold">All Pairings</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground w-16">Table</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Player 1</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground w-24">Result</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Player 2</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground w-24">Status</th>
            </tr>
          </thead>
          <tbody>
            {round.matches?.map((match: any) => (
              <tr key={match.id} className={cn(
                "border-b border-border/50",
                (match.player1?.id === currentUserId || match.player2?.id === currentUserId) && "bg-primary/5"
              )}>
                <td className="px-4 py-2.5 font-medium text-sm">{match.table_number}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={match.player1?.avatar_url} />
                      <AvatarFallback>{match.player1 ? getPlayerDisplayName(match.player1)?.charAt(0) : "?"}</AvatarFallback>
                    </Avatar>
                    <span className={cn(
                      "text-sm",
                      match.winner_id === match.player1?.id && "font-semibold"
                    )}>
                      {match.player1 ? getPlayerDisplayName(match.player1) : "TBD"}
                    </span>
                    {match.winner_id === match.player1?.id && (
                      <Trophy className="h-3 w-3 text-yellow-500" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-center font-mono text-sm">
                  {match.status === "confirmed" ? (
                    `${match.player1_wins ?? 0} - ${match.player2_wins ?? 0}`
                  ) : match.is_bye ? (
                    "BYE"
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {match.is_bye ? (
                    <span className="text-sm text-muted-foreground">---</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={match.player2?.avatar_url} />
                        <AvatarFallback>{match.player2 ? getPlayerDisplayName(match.player2)?.charAt(0) : "?"}</AvatarFallback>
                      </Avatar>
                      <span className={cn(
                        "text-sm",
                        match.winner_id === match.player2?.id && "font-semibold"
                      )}>
                        {match.player2 ? getPlayerDisplayName(match.player2) : "TBD"}
                      </span>
                      {match.winner_id === match.player2?.id && (
                        <Trophy className="h-3 w-3 text-yellow-500" />
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <Badge variant={match.status === "confirmed" ? "default" : "secondary"} className="text-[10px]">
                    {match.status.replace("_", " ")}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Rounds View ──

function RoundsView({ rounds, tournamentStatus }: { rounds: any[]; tournamentStatus: string }) {
  const [expandedRound, setExpandedRound] = useState<string | null>(
    rounds.length > 0 ? rounds[rounds.length - 1].id : null
  )

  if (rounds.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <LayoutList className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">No rounds have been played yet.</p>
        <p className="text-sm text-muted-foreground mt-2">Round history will appear here once the tournament begins.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <div>
          <h3 className="font-semibold">Tournament Rounds</h3>
          <p className="text-sm text-muted-foreground">
            {rounds.length} round{rounds.length !== 1 ? "s" : ""} {tournamentStatus === "completed" ? "completed" : "played"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tournamentStatus === "completed" && (
            <Badge className="bg-primary/10 text-primary">Tournament Complete</Badge>
          )}
          {tournamentStatus === "in_progress" && (
            <Badge className="bg-destructive/10 text-destructive">In Progress</Badge>
          )}
        </div>
      </div>

      {/* Rounds List */}
      <div className="space-y-3">
        {rounds.map((round) => {
          const isExpanded = expandedRound === round.id
          const completedMatches = round.matches?.filter((m: any) => m.status === "confirmed").length ?? 0
          const totalMatches = round.matches?.length ?? 0
          const isComplete = round.status === "complete"
          const isActive = round.status === "active"

          return (
            <div key={round.id} className="overflow-hidden rounded-xl border border-border">
              {/* Round Header - Clickable */}
              <button
                onClick={() => setExpandedRound(isExpanded ? null : round.id)}
                className="w-full flex items-center justify-between p-4 bg-card hover:bg-muted/30 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold",
                    isComplete ? "bg-primary/10 text-primary" : 
                    isActive ? "bg-destructive/10 text-destructive" : 
                    "bg-muted text-muted-foreground"
                  )}>
                    {round.round_number}
                  </div>
                  <div>
                    <h4 className="font-semibold">Round {round.round_number}</h4>
                    <p className="text-xs text-muted-foreground capitalize">
                      {round.round_type} • {completedMatches}/{totalMatches} matches complete
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={isComplete ? "default" : isActive ? "destructive" : "secondary"}>
                    {round.status === "complete" ? "Complete" : round.status === "active" ? "Active" : "Pending"}
                  </Badge>
                  <svg
                    className={cn(
                      "h-5 w-5 text-muted-foreground transition-transform",
                      isExpanded && "rotate-180"
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded Match List */}
              {isExpanded && round.matches && round.matches.length > 0 && (
                <div className="border-t border-border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground w-16">Table</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Player 1</th>
                        <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground w-20">Result</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Player 2</th>
                      </tr>
                    </thead>
                    <tbody>
                      {round.matches.map((match: any) => (
                        <tr key={match.id} className="border-b border-border/50 last:border-0">
                          <td className="px-4 py-2 text-sm text-muted-foreground">
                            {match.table_number ?? "-"}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={match.player1?.avatar_url} />
                                <AvatarFallback>{match.player1 ? getPlayerDisplayName(match.player1)?.charAt(0) : "?"}</AvatarFallback>
                              </Avatar>
                              <span className={cn(
                                "text-sm",
                                match.winner_id === match.player1_id && "font-semibold text-primary"
                              )}>
                                {match.player1 ? getPlayerDisplayName(match.player1) : "TBD"}
                              </span>
                              {match.winner_id === match.player1_id && (
                                <Trophy className="h-3 w-3 text-yellow-500" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-center">
                            {match.status === "confirmed" ? (
                              <span className="font-mono text-sm font-bold">
                                {match.player1_wins ?? 0} - {match.player2_wins ?? 0}
                              </span>
                            ) : match.is_bye ? (
                              <span className="text-xs text-muted-foreground">BYE</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">vs</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {match.is_bye ? (
                              <span className="text-sm text-muted-foreground">---</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={match.player2?.avatar_url} />
                                  <AvatarFallback>{match.player2 ? getPlayerDisplayName(match.player2)?.charAt(0) : "?"}</AvatarFallback>
                                </Avatar>
                                <span className={cn(
                                  "text-sm",
                                  match.winner_id === match.player2_id && "font-semibold text-primary"
                                )}>
                                  {match.player2 ? getPlayerDisplayName(match.player2) : "TBD"}
                                </span>
                                {match.winner_id === match.player2_id && (
                                  <Trophy className="h-3 w-3 text-yellow-500" />
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Empty matches state */}
              {isExpanded && (!round.matches || round.matches.length === 0) && (
                <div className="border-t border-border p-6 text-center text-sm text-muted-foreground">
                  No matches in this round yet.
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
