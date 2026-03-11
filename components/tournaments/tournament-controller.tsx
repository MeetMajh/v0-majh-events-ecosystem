"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trophy,
  Users,
  Pause,
  Square,
  UserMinus,
  Send,
  Timer,
} from "lucide-react"
import {
  createSwissRound,
  startRound,
  completeRound,
  reportMatchResult,
  dropPlayer,
  updateTournamentStatus,
  startTournament,
  completeTournament,
  adminCheckInPlayer,
  createTournamentPhase,
  recalculateStandings,
  type PlayerStanding,
} from "@/lib/tournament-controller-actions"
import type { TournamentStatus } from "@/lib/tournament-controller-actions"

interface TournamentControllerProps {
  tournament: {
    id: string
    name: string
    slug: string
    status: string
    format: string
    start_date: string | null
    end_date: string | null
    max_participants: number | null
    entry_fee_cents: number
    check_in_required: boolean
    decklist_required: boolean
    games: {
      id: string
      name: string
      slug: string
    } | null
  }
  phases: Array<{
    id: string
    name: string
    phase_type: string
    phase_order: number
    is_current: boolean
    is_complete: boolean
    rounds_count: number | null
  }>
  registrations: Array<{
    id: string
    player_id: string
    status: string
    payment_status: string
    check_in_at: string | null
    profiles: {
      id: string
      display_name: string
      avatar_url: string | null
    }
  }>
  currentRound: {
    id: string
    round_number: number
    round_type: string
    status: string
    started_at: string | null
    end_time: string | null
    matches: Array<{
      id: string
      table_number: number
      status: string
      is_bye: boolean
      player1_wins: number | null
      player2_wins: number | null
      winner_id: string | null
      player1: { id: string; display_name: string; avatar_url: string | null } | null
      player2: { id: string; display_name: string; avatar_url: string | null } | null
    }>
  } | null
  standings: PlayerStanding[]
  paymentSummary: {
    totalRegistrations: number
    paidCount: number
    pendingCount: number
    refundedCount: number
    totalCollected: number
    totalRefunded: number
    netRevenue: number
  } | null
  isStaff: boolean
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-blue-500/10 text-blue-600",
  registration: "bg-blue-500/10 text-blue-600",
  registration_closed: "bg-yellow-500/10 text-yellow-600",
  in_progress: "bg-green-500/10 text-green-600",
  complete: "bg-muted text-muted-foreground",
  cancelled: "bg-red-500/10 text-red-600",
}

export function TournamentController({
  tournament,
  phases,
  registrations,
  currentRound,
  standings,
  paymentSummary,
  isStaff,
}: TournamentControllerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null)
  const [matchResult, setMatchResult] = useState({ p1Wins: 0, p2Wins: 0, draws: 0 })

  const activePhase = phases.find(p => p.is_current) || phases[0]
  const checkedInCount = registrations.filter(r => r.status === "checked_in").length
  const registeredCount = registrations.filter(r => 
    ["registered", "checked_in"].includes(r.status)
  ).length

  const filteredRegistrations = registrations.filter(r => 
    r.profiles?.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Actions
  const handleStartTournament = () => {
    startTransition(async () => {
      const result = await startTournament(tournament.id)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Tournament started!")
        router.refresh()
      }
    })
  }

  const handleCreateRound = () => {
    if (!activePhase) {
      toast.error("No active phase")
      return
    }
    startTransition(async () => {
      const result = await createSwissRound(tournament.id, activePhase.id)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Round created!")
        router.refresh()
      }
    })
  }

  const handleStartRound = () => {
    if (!currentRound) return
    startTransition(async () => {
      const result = await startRound(currentRound.id)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Round started!")
        router.refresh()
      }
    })
  }

  const handleCompleteRound = () => {
    if (!currentRound) return
    startTransition(async () => {
      const result = await completeRound(currentRound.id)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Round completed!")
        router.refresh()
      }
    })
  }

  const handleReportResult = () => {
    if (!selectedMatch) return
    const match = currentRound?.matches.find(m => m.id === selectedMatch)
    if (!match || !match.player1) return

    startTransition(async () => {
      const winnerId = matchResult.p1Wins > matchResult.p2Wins 
        ? match.player1!.id 
        : matchResult.p2Wins > matchResult.p1Wins
          ? match.player2?.id ?? null
          : null

      if (!winnerId && matchResult.p1Wins === matchResult.p2Wins && matchResult.draws === 0) {
        toast.error("Must have a winner or draws")
        return
      }

      const result = await reportMatchResult(
        selectedMatch,
        winnerId || match.player1!.id,
        matchResult.p1Wins,
        matchResult.p2Wins,
        matchResult.draws
      )
      
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Result recorded!")
        setSelectedMatch(null)
        setMatchResult({ p1Wins: 0, p2Wins: 0, draws: 0 })
        router.refresh()
      }
    })
  }

  const handleDropPlayer = (playerId: string) => {
    startTransition(async () => {
      const result = await dropPlayer(tournament.id, playerId, currentRound?.round_number)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Player dropped")
        router.refresh()
      }
    })
  }

  const handleCheckIn = (playerId: string) => {
    startTransition(async () => {
      const result = await adminCheckInPlayer(tournament.id, playerId)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Player checked in")
        router.refresh()
      }
    })
  }

  const handleCompleteTournament = () => {
    startTransition(async () => {
      const result = await completeTournament(tournament.id)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Tournament completed!")
        router.refresh()
      }
    })
  }

  const handleRecalculateStandings = () => {
    if (!activePhase) return
    startTransition(async () => {
      await recalculateStandings(tournament.id, activePhase.id)
      toast.success("Standings recalculated")
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/tournaments">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{tournament.name}</h1>
              <Badge className={STATUS_COLORS[tournament.status] ?? "bg-muted"}>
                {tournament.status.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {tournament.games?.name} - {tournament.format?.replace("_", " ")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/esports/tournaments/${tournament.slug}`}>
              View Public Page
            </Link>
          </Button>
          {tournament.status === "draft" && (
            <Button 
              onClick={() => startTransition(async () => {
                const result = await updateTournamentStatus(tournament.id, "published")
                if (!("error" in result)) {
                  toast.success("Tournament published!")
                  router.refresh()
                }
              })}
              disabled={isPending}
            >
              Publish
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xl font-bold">{registeredCount}</p>
              <p className="text-xs text-muted-foreground">Registered</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-xl font-bold">{checkedInCount}</p>
              <p className="text-xs text-muted-foreground">Checked In</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Trophy className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="text-xl font-bold">
                {currentRound ? `R${currentRound.round_number}` : "-"}
              </p>
              <p className="text-xs text-muted-foreground">Current Round</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-xl font-bold">
                {currentRound?.matches.filter(m => m.status === "confirmed").length ?? 0}/
                {currentRound?.matches.length ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">Matches Done</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <DollarSign className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-xl font-bold">
                ${((paymentSummary?.netRevenue ?? 0) / 100).toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground">Net Revenue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Tournament Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {tournament.status === "published" && (
              <Button onClick={handleStartTournament} disabled={isPending || registeredCount < 2}>
                <Play className="mr-2 h-4 w-4" />
                Start Tournament
              </Button>
            )}
            
            {tournament.status === "in_progress" && !currentRound && (
              <Button onClick={handleCreateRound} disabled={isPending}>
                <Plus className="mr-2 h-4 w-4" />
                Create Round
              </Button>
            )}
            
            {currentRound?.status === "pending" && (
              <Button onClick={handleStartRound} disabled={isPending}>
                <Play className="mr-2 h-4 w-4" />
                Start Round {currentRound.round_number}
              </Button>
            )}
            
            {currentRound?.status === "active" && (
              <>
                <Button onClick={handleCompleteRound} disabled={isPending}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Complete Round
                </Button>
              </>
            )}

            {currentRound?.status === "complete" && tournament.status === "in_progress" && (
              <>
                <Button onClick={handleCreateRound} disabled={isPending}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Next Round
                </Button>
                <Button variant="outline" onClick={handleCompleteTournament} disabled={isPending}>
                  <Trophy className="mr-2 h-4 w-4" />
                  End Tournament
                </Button>
              </>
            )}

            <Button variant="outline" onClick={handleRecalculateStandings} disabled={isPending || !activePhase}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Recalculate Standings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="pairings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pairings">Pairings</TabsTrigger>
          <TabsTrigger value="standings">Standings</TabsTrigger>
          <TabsTrigger value="players">Players ({registrations.length})</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Pairings Tab */}
        <TabsContent value="pairings" className="space-y-4">
          {currentRound ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Round {currentRound.round_number} Pairings</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={currentRound.status === "active" ? "default" : "secondary"}>
                        {currentRound.status}
                      </Badge>
                      {currentRound.end_time && currentRound.status === "active" && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          Ends {format(new Date(currentRound.end_time), "h:mm a")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Table</TableHead>
                        <TableHead>Player 1</TableHead>
                        <TableHead className="w-24 text-center">Result</TableHead>
                        <TableHead>Player 2</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                        <TableHead className="w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentRound.matches.map((match) => (
                        <TableRow key={match.id}>
                          <TableCell className="font-medium">{match.table_number}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={match.player1?.avatar_url ?? undefined} />
                                <AvatarFallback>
                                  {match.player1?.display_name?.charAt(0) ?? "?"}
                                </AvatarFallback>
                              </Avatar>
                              <span className={match.winner_id === match.player1?.id ? "font-semibold" : ""}>
                                {match.player1?.display_name ?? "TBD"}
                              </span>
                              {match.winner_id === match.player1?.id && (
                                <Trophy className="h-3 w-3 text-yellow-600" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono">
                            {match.status === "confirmed" ? (
                              `${match.player1_wins ?? 0} - ${match.player2_wins ?? 0}`
                            ) : match.is_bye ? (
                              "BYE"
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {match.is_bye ? (
                              <span className="text-muted-foreground">---</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={match.player2?.avatar_url ?? undefined} />
                                  <AvatarFallback>
                                    {match.player2?.display_name?.charAt(0) ?? "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <span className={match.winner_id === match.player2?.id ? "font-semibold" : ""}>
                                  {match.player2?.display_name ?? "TBD"}
                                </span>
                                {match.winner_id === match.player2?.id && (
                                  <Trophy className="h-3 w-3 text-yellow-600" />
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={match.status === "confirmed" ? "default" : "secondary"}>
                              {match.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {!match.is_bye && match.status !== "confirmed" && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => setSelectedMatch(match.id)}
                                  >
                                    Report
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Report Match Result</DialogTitle>
                                    <DialogDescription>
                                      Table {match.table_number}: {match.player1?.display_name} vs {match.player2?.display_name}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-3 items-center gap-4">
                                      <Label>{match.player1?.display_name}</Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        value={matchResult.p1Wins}
                                        onChange={(e) => setMatchResult(prev => ({ ...prev, p1Wins: parseInt(e.target.value) || 0 }))}
                                        className="text-center"
                                      />
                                      <span className="text-sm text-muted-foreground">Wins</span>
                                    </div>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                      <Label>{match.player2?.display_name}</Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        value={matchResult.p2Wins}
                                        onChange={(e) => setMatchResult(prev => ({ ...prev, p2Wins: parseInt(e.target.value) || 0 }))}
                                        className="text-center"
                                      />
                                      <span className="text-sm text-muted-foreground">Wins</span>
                                    </div>
                                    <Separator />
                                    <div className="grid grid-cols-3 items-center gap-4">
                                      <Label>Draws</Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        value={matchResult.draws}
                                        onChange={(e) => setMatchResult(prev => ({ ...prev, draws: parseInt(e.target.value) || 0 }))}
                                        className="text-center"
                                      />
                                      <span className="text-sm text-muted-foreground">Games</span>
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button onClick={handleReportResult} disabled={isPending}>
                                      <Send className="mr-2 h-4 w-4" />
                                      Submit Result
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold">No active round</h3>
                <p className="text-sm text-muted-foreground">
                  {tournament.status === "in_progress" 
                    ? "Create a new round to begin pairings"
                    : "Start the tournament to create rounds"
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Standings Tab */}
        <TabsContent value="standings">
          <Card>
            <CardHeader>
              <CardTitle>Standings</CardTitle>
              <CardDescription>
                Current rankings based on match points and tiebreakers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {standings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Standings will appear after the first round is complete
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-center">Points</TableHead>
                      <TableHead className="text-center">Record</TableHead>
                      <TableHead className="text-center">OMW%</TableHead>
                      <TableHead className="text-center">GW%</TableHead>
                      <TableHead className="text-center">OGW%</TableHead>
                      <TableHead className="w-20">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {standings.map((player, idx) => (
                      <TableRow key={player.playerId} className={player.isDropped ? "opacity-50" : ""}>
                        <TableCell className="font-bold">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={player.avatarUrl ?? undefined} />
                              <AvatarFallback>{player.displayName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            {player.displayName}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-bold">{player.points}</TableCell>
                        <TableCell className="text-center font-mono text-sm">
                          {player.matchWins}-{player.matchLosses}
                          {player.matchDraws > 0 && `-${player.matchDraws}`}
                        </TableCell>
                        <TableCell className="text-center text-sm">{player.omwPercent.toFixed(1)}%</TableCell>
                        <TableCell className="text-center text-sm">{player.gwPercent.toFixed(1)}%</TableCell>
                        <TableCell className="text-center text-sm">{player.ogwPercent.toFixed(1)}%</TableCell>
                        <TableCell>
                          {player.isDropped ? (
                            <Badge variant="destructive">Dropped</Badge>
                          ) : (
                            <Badge variant="outline">Active</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Players Tab */}
        <TabsContent value="players" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead className="w-40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegistrations.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={reg.profiles?.avatar_url ?? undefined} />
                            <AvatarFallback>
                              {reg.profiles?.display_name?.charAt(0) ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span>{reg.profiles?.display_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          reg.status === "dropped" ? "destructive" :
                          reg.status === "checked_in" ? "default" :
                          "secondary"
                        }>
                          {reg.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          reg.payment_status === "paid" ? "default" :
                          reg.payment_status === "pending" ? "secondary" :
                          "outline"
                        }>
                          {reg.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {reg.check_in_at ? (
                          <span className="text-sm text-green-600">
                            {format(new Date(reg.check_in_at), "h:mm a")}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not checked in</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {!reg.check_in_at && tournament.check_in_required && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleCheckIn(reg.player_id)}
                              disabled={isPending}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                            </Button>
                          )}
                          {reg.status !== "dropped" && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleDropPlayer(reg.player_id)}
                              disabled={isPending}
                              className="text-destructive hover:text-destructive"
                            >
                              <UserMinus className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Tournament Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Game</span>
                  <span className="font-medium">{tournament.games?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Format</span>
                  <span className="font-medium capitalize">{tournament.format?.replace("_", " ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entry Fee</span>
                  <span className="font-medium">
                    {tournament.entry_fee_cents > 0 
                      ? `$${(tournament.entry_fee_cents / 100).toFixed(2)}`
                      : "Free"
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Players</span>
                  <span className="font-medium">{tournament.max_participants ?? "Unlimited"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Start Date</span>
                  <span className="font-medium">
                    {tournament.start_date 
                      ? format(new Date(tournament.start_date), "MMM d, yyyy")
                      : "Not set"
                    }
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Collected</span>
                  <span className="font-medium text-green-600">
                    ${((paymentSummary?.totalCollected ?? 0) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Refunded</span>
                  <span className="font-medium text-red-600">
                    -${((paymentSummary?.totalRefunded ?? 0) / 100).toFixed(2)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="font-medium">Net Revenue</span>
                  <span className="font-bold">
                    ${((paymentSummary?.netRevenue ?? 0) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {paymentSummary?.paidCount ?? 0} paid / {paymentSummary?.pendingCount ?? 0} pending
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tournament Phases</CardTitle>
              </CardHeader>
              <CardContent>
                {phases.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No phases configured</p>
                ) : (
                  <div className="space-y-2">
                    {phases.map((phase) => (
                      <div key={phase.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium">{phase.name}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {phase.phase_type.replace("_", " ")}
                            {phase.rounds_count && ` - ${phase.rounds_count} rounds`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {phase.is_current && <Badge>Current</Badge>}
                          {phase.is_complete && <Badge variant="secondary">Complete</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Danger Zone</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {tournament.status !== "cancelled" && (
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={() => startTransition(async () => {
                      const result = await updateTournamentStatus(tournament.id, "cancelled")
                      if (!("error" in result)) {
                        toast.success("Tournament cancelled")
                        router.refresh()
                      }
                    })}
                    disabled={isPending}
                  >
                    Cancel Tournament
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
