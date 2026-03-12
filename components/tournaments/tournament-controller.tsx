"use client"

import { useState, useTransition, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  FileText,
  History,
  Layers,
  List,
  Megaphone,
  Pause,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Settings,
  SquareStack,
  Timer,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
  Zap,
  ClipboardList,
  TicketCheck,
  Shield,
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
  addPlayerToTournament,
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
      icon_url?: string | null
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
    time_limit_minutes?: number
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
  registration: "bg-green-500/10 text-green-600",
  registration_closed: "bg-yellow-500/10 text-yellow-600",
  in_progress: "bg-emerald-500/10 text-emerald-600",
  complete: "bg-muted text-muted-foreground",
  cancelled: "bg-red-500/10 text-red-600",
}

const SIDEBAR_ITEMS = [
  { id: "overview", label: "Quick Settings", icon: Zap },
  { id: "players", label: "Players", icon: Users },
  { id: "matches", label: "Matches", icon: SquareStack },
  { id: "standings", label: "Standings", icon: Trophy },
  { id: "phases", label: "Phases", icon: Layers },
  { id: "decklists", label: "Decklists", icon: FileText },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "staff", label: "Staff", icon: Shield },
  { id: "tickets", label: "Support Tickets", icon: TicketCheck },
  { id: "audit", label: "Audit Logs", icon: History },
  { id: "qrcodes", label: "QR Codes", icon: QrCode },
  { id: "settings", label: "Settings", icon: Settings },
]

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
  const [activeSection, setActiveSection] = useState("overview")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null)
  const [matchResult, setMatchResult] = useState({ p1Wins: 0, p2Wins: 0, draws: 0 })
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [newPlayerEmail, setNewPlayerEmail] = useState("")
  const [announcement, setAnnouncement] = useState("")

  const activePhase = phases.find(p => p.is_current) || phases[0]
  const checkedInCount = registrations.filter(r => r.status === "checked_in").length
  const registeredCount = registrations.filter(r => 
    ["registered", "checked_in"].includes(r.status)
  ).length
  const activePlayerCount = registrations.filter(r => 
    !["dropped", "disqualified"].includes(r.status)
  ).length
  const matchesRemaining = currentRound?.matches.filter(m => m.status !== "confirmed").length ?? 0

  const filteredRegistrations = registrations.filter(r => 
    r.profiles?.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Timer logic
  useEffect(() => {
    if (currentRound?.end_time && currentRound.status === "active") {
      const endTime = new Date(currentRound.end_time).getTime()
      
      const updateTimer = () => {
        const now = Date.now()
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
        setTimeRemaining(remaining)
        setIsTimerRunning(remaining > 0)
      }
      
      updateTimer()
      const interval = setInterval(updateTimer, 1000)
      return () => clearInterval(interval)
    } else {
      setTimeRemaining(null)
      setIsTimerRunning(false)
    }
  }, [currentRound?.end_time, currentRound?.status])

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }, [])

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

  const handleAddPlayer = () => {
    if (!newPlayerEmail.trim()) {
      toast.error("Enter player email")
      return
    }
    startTransition(async () => {
      const result = await addPlayerToTournament(tournament.id, newPlayerEmail)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Player added!")
        setNewPlayerEmail("")
        router.refresh()
      }
    })
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r bg-card/50 flex flex-col">
        <div className="p-4 border-b">
          <Button variant="ghost" size="sm" asChild className="mb-3">
            <Link href="/dashboard/tournaments">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Tournaments
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            {tournament.games?.icon_url && (
              <img src={tournament.games.icon_url} alt="" className="h-8 w-8 rounded" />
            )}
            <div className="min-w-0">
              <h2 className="font-semibold truncate">{tournament.name}</h2>
              <p className="text-xs text-muted-foreground">{tournament.games?.name}</p>
            </div>
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <nav className="p-2 space-y-1">
            {SIDEBAR_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  activeSection === item.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </ScrollArea>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header Bar */}
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4">
              {/* Tournament Status Stats */}
              <div className="flex items-center gap-6 text-sm">
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">Current Phase</span>
                  <span className="font-medium">{activePhase?.name ?? "None"}</span>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">Active Players</span>
                  <span className="font-medium">{activePlayerCount} players</span>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">Current Round</span>
                  <span className="font-medium">
                    {currentRound ? `Round ${currentRound.round_number}` : "Not started"}
                  </span>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">Matches Remaining</span>
                  <span className="font-medium">{matchesRemaining} matches</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Status Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className={cn("gap-2", STATUS_COLORS[tournament.status])}>
                    Status: {tournament.status.replace("_", " ")}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => startTransition(async () => {
                    await updateTournamentStatus(tournament.id, "draft")
                    router.refresh()
                  })}>
                    Draft
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => startTransition(async () => {
                    await updateTournamentStatus(tournament.id, "published")
                    router.refresh()
                  })}>
                    Published / Registration Open
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => startTransition(async () => {
                    await updateTournamentStatus(tournament.id, "registration_closed")
                    router.refresh()
                  })}>
                    Registration Closed
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => startTransition(async () => {
                    await updateTournamentStatus(tournament.id, "cancelled")
                    router.refresh()
                  })} className="text-destructive">
                    Cancelled
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Tournament Actions Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-2 bg-primary">
                    <Settings className="h-4 w-4" />
                    Tournament Actions
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {tournament.status === "published" && (
                    <DropdownMenuItem onClick={handleStartTournament} disabled={registeredCount < 2}>
                      <Play className="mr-2 h-4 w-4" />
                      Start Tournament
                    </DropdownMenuItem>
                  )}
                  {tournament.status === "in_progress" && !currentRound && (
                    <DropdownMenuItem onClick={handleCreateRound}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Round
                    </DropdownMenuItem>
                  )}
                  {currentRound?.status === "pending" && (
                    <DropdownMenuItem onClick={handleStartRound}>
                      <Play className="mr-2 h-4 w-4" />
                      Start Round {currentRound.round_number}
                    </DropdownMenuItem>
                  )}
                  {currentRound?.status === "active" && (
                    <DropdownMenuItem onClick={handleCompleteRound}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Complete Round
                    </DropdownMenuItem>
                  )}
                  {currentRound?.status === "complete" && tournament.status === "in_progress" && (
                    <>
                      <DropdownMenuItem onClick={handleCreateRound}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Next Round
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleCompleteTournament}>
                        <Trophy className="mr-2 h-4 w-4" />
                        End Tournament
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleRecalculateStandings} disabled={!activePhase}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Recalculate Standings
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/esports/tournaments/${tournament.slug}`}>
                      <FileText className="mr-2 h-4 w-4" />
                      View Public Page
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-6">
          {/* Overview / Quick Settings */}
          {activeSection === "overview" && (
            <div className="space-y-6">
              {/* Timer Card */}
              {currentRound && currentRound.status === "active" && (
                <Card className="border-2 border-primary/20">
                  <CardContent className="flex items-center justify-between py-6">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "h-16 w-16 rounded-full flex items-center justify-center",
                        timeRemaining && timeRemaining < 300 ? "bg-red-500/20" : "bg-primary/20"
                      )}>
                        <Timer className={cn(
                          "h-8 w-8",
                          timeRemaining && timeRemaining < 300 ? "text-red-500" : "text-primary"
                        )} />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Round {currentRound.round_number} Time Remaining</p>
                        <p className={cn(
                          "text-4xl font-mono font-bold tracking-wider",
                          timeRemaining && timeRemaining < 300 ? "text-red-500" : ""
                        )}>
                          {timeRemaining !== null ? formatTime(timeRemaining) : "--:--"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="lg" disabled>
                        <Pause className="mr-2 h-4 w-4" />
                        Pause Timer
                      </Button>
                      <Button variant="outline" size="lg" disabled>
                        +5 Min
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Quick Stats */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{registeredCount}</p>
                      <p className="text-xs text-muted-foreground">Registered Players</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{checkedInCount}</p>
                      <p className="text-xs text-muted-foreground">Checked In</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                      <Trophy className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {currentRound ? `R${currentRound.round_number}` : "-"}
                      </p>
                      <p className="text-xs text-muted-foreground">Current Round</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        ${((paymentSummary?.netRevenue ?? 0) / 100).toFixed(0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Net Revenue</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-600" />
                    Quick Actions
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
                      <Button onClick={handleCompleteRound} disabled={isPending}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Complete Round
                      </Button>
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
            </div>
          )}

          {/* Players Section */}
          {activeSection === "players" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Players ({registrations.length})</h2>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add Player
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Player to Tournament</DialogTitle>
                      <DialogDescription>
                        Enter the player&apos;s email address to add them to the tournament
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Player Email</Label>
                        <Input
                          placeholder="player@example.com"
                          value={newPlayerEmail}
                          onChange={(e) => setNewPlayerEmail(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddPlayer} disabled={isPending}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Add Player
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

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
                      {filteredRegistrations.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No players found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Matches Section */}
          {activeSection === "matches" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Matches</h2>
              
              {currentRound ? (
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
                            {timeRemaining !== null ? formatTime(timeRemaining) : "--:--"}
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
            </div>
          )}

          {/* Standings Section */}
          {activeSection === "standings" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Standings</h2>
                <Button variant="outline" onClick={handleRecalculateStandings} disabled={isPending || !activePhase}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recalculate
                </Button>
              </div>
              
              <Card>
                <CardContent className="p-0">
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
                            <TableCell className="text-center text-sm">{(player.omwPercent * 100).toFixed(1)}%</TableCell>
                            <TableCell className="text-center text-sm">{(player.gwPercent * 100).toFixed(1)}%</TableCell>
                            <TableCell className="text-center text-sm">{(player.ogwPercent * 100).toFixed(1)}%</TableCell>
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
            </div>
          )}

          {/* Phases Section */}
          {activeSection === "phases" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Tournament Phases</h2>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Phase
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Tournament Phase</DialogTitle>
                      <DialogDescription>
                        Configure a new phase for this tournament
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <p className="text-sm text-muted-foreground">Phase configuration coming soon...</p>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-4">
                {phases.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No phases configured
                    </CardContent>
                  </Card>
                ) : (
                  phases.map((phase) => (
                    <Card key={phase.id}>
                      <CardContent className="flex items-center justify-between p-4">
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
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Decklists Section */}
          {activeSection === "decklists" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Decklists</h2>
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>Decklist management coming soon</p>
                  <p className="text-sm">View and validate player decklists</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Announcements Section */}
          {activeSection === "announcements" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Announcements</h2>
              <Card>
                <CardHeader>
                  <CardTitle>Send Announcement</CardTitle>
                  <CardDescription>Broadcast a message to all tournament participants</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Type your announcement here..."
                    value={announcement}
                    onChange={(e) => setAnnouncement(e.target.value)}
                    rows={4}
                  />
                  <Button disabled={!announcement.trim()}>
                    <Megaphone className="mr-2 h-4 w-4" />
                    Send Announcement
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Staff Section */}
          {activeSection === "staff" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Tournament Staff</h2>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Staff
                </Button>
              </div>
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Shield className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No staff were found</p>
                  <p className="text-sm">Add staff members to help manage this tournament</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Support Tickets Section */}
          {activeSection === "tickets" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Support Tickets</h2>
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <TicketCheck className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No support tickets</p>
                  <p className="text-sm">Player issues and disputes will appear here</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Audit Logs Section */}
          {activeSection === "audit" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Audit Logs</h2>
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <History className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No audit logs yet</p>
                  <p className="text-sm">Tournament activity will be logged here</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* QR Codes Section */}
          {activeSection === "qrcodes" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">QR Codes</h2>
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <QrCode className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>QR Code generation coming soon</p>
                  <p className="text-sm">Generate QR codes for check-in and result reporting</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Settings Section */}
          {activeSection === "settings" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Tournament Settings</h2>
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

                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {tournament.status !== "cancelled" && (
                      <Button 
                        variant="destructive"
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
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
