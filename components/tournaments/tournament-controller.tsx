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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { getPlayerDisplayName } from "@/lib/player-utils"
import { calculateSwissRounds } from "@/lib/pairing-algorithms"
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
  RotateCcw,
  Search,
  Send,
  Settings,
  Shuffle,
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
  ArrowLeftRight,
  Edit2,
  AlertCircle,
  Scale,
  Wifi,
  Radio,
  Activity,
  Gauge,
  CircleCheck,
  CircleDashed,
  CircleAlert,
  Sparkles,
  FastForward,
  Star,
  Video,
  Copy,
  ExternalLink,
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
  sendTournamentAnnouncement,
  getTournamentAnnouncements,
  deleteAnnouncement,
  pauseRound,
  resumeRound,
  addTimeToRound,
  swapMatchPlayers,
  createManualMatch,
  deleteMatch,
  updateMatchPlayers,
  regeneratePairings,
  getTournamentDecklists,
  resolveDispute,
  getDisputedMatches,
  confirmAllMatchingReports,
  forceCompleteRound,
  getRoundStats,
  setFeatureMatch,
  getFeatureMatches,
  setMatchLive,
  type PlayerStanding,
} from "@/lib/tournament-controller-actions"
import { resetRoundTimer } from "@/lib/timer-actions"
import { getTournamentIssues, updateIssueStatus, createIssue } from "@/lib/tournament-issue-actions"
import { ISSUE_CATEGORIES } from "@/lib/tournament-issue-constants"
import type { TournamentStatus } from "@/lib/tournament-controller-actions"
import { useTournamentRealtime } from "@/hooks/use-tournament-realtime"

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
  allRounds: Array<{
    id: string
    round_number: number
    round_type: string
    status: string
    started_at: string | null
    end_time: string | null
    time_limit_minutes?: number
    tournament_phases: { name: string } | null
    matches: Array<{
      id: string
      table_number: number
      status: string
      is_bye: boolean
      player1_wins: number | null
      player2_wins: number | null
      winner_id: string | null
      loser_id: string | null
      reported_player1_wins: number | null
      reported_player2_wins: number | null
      player1: { id: string; display_name: string; avatar_url: string | null } | null
      player2: { id: string; display_name: string; avatar_url: string | null } | null
    }>
  }>
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
  allRounds,
  standings,
  paymentSummary,
  isStaff,
}: TournamentControllerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeSection, setActiveSection] = useState("overview")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null)
  const [matchResult, setMatchResult] = useState({ player1Wins: 0, player2Wins: 0, draws: 0 })
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [newPlayerEmail, setNewPlayerEmail] = useState("")
  const [showAddPlayerDialog, setShowAddPlayerDialog] = useState(false)
  const [announcement, setAnnouncement] = useState("")
  const [announcementPriority, setAnnouncementPriority] = useState<"normal" | "high" | "urgent">("normal")
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false)
  const [showManualPairingDialog, setShowManualPairingDialog] = useState(false)
  const [selectedMatchForSwap, setSelectedMatchForSwap] = useState<string | null>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [decklists, setDecklists] = useState<any[]>([])
  const [loadingDecklists, setLoadingDecklists] = useState(false)
  const [roundStats, setRoundStats] = useState<{
    totalMatches: number
    confirmedMatches: number
    pendingMatches: number
    reportedMatches: number
    disputedMatches: number
    byeMatches: number
    progressPercent: number
  } | null>(null)
  const [showAutoAdvanceDialog, setShowAutoAdvanceDialog] = useState(false)
  const [bulkActionPending, setBulkActionPending] = useState(false)

  const activePhase = phases.find(p => p.is_current) || phases[0]
  
  // Realtime subscriptions for live tournament updates
  const isLive = tournament.status === "in_progress"
  const { isConnected, lastUpdate } = useTournamentRealtime({
    tournamentId: tournament.id,
    autoRefresh: isLive,
    onMatchUpdate: (match) => {
      // Show toast when a match result is reported
      if (match.status === "player1_reported" || match.status === "player2_reported") {
        toast.info("A player has reported a match result", { duration: 3000 })
      } else if (match.status === "disputed") {
        toast.warning("A match dispute has been raised!", { duration: 5000 })
      } else if (match.status === "confirmed") {
        toast.success("Match result confirmed", { duration: 2000 })
      }
    },
  })
  
  const checkedInCount = registrations.filter(r => r.status === "checked_in").length
  const registeredCount = registrations.filter(r => 
    ["registered", "checked_in"].includes(r.status)
  ).length
  const activePlayerCount = registrations.filter(r => 
    !["dropped", "disqualified"].includes(r.status)
  ).length
  const matchesRemaining = currentRound?.matches.filter(m => m.status !== "confirmed").length ?? 0
  
  // Fetch round stats when current round changes
  useEffect(() => {
    if (currentRound?.id) {
      getRoundStats(currentRound.id).then(stats => {
        setRoundStats(stats)
        // Show auto-advance prompt when all matches are complete
        if (stats.progressPercent === 100 && currentRound.status === "active") {
          setShowAutoAdvanceDialog(true)
        }
      })
    } else {
      setRoundStats(null)
    }
  }, [currentRound?.id, currentRound?.status, currentRound?.matches.length])

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

  // Load announcements when section changes to announcements
  useEffect(() => {
    if (activeSection === "announcements") {
      setLoadingAnnouncements(true)
      getTournamentAnnouncements(tournament.id).then((result) => {
        if ("announcements" in result) {
          setAnnouncements(result.announcements)
        }
        setLoadingAnnouncements(false)
      })
    }
  }, [activeSection, tournament.id])
  
  // Load tickets when section changes to tickets
  useEffect(() => {
    if (activeSection === "tickets") {
      setLoadingTickets(true)
      getTournamentIssues(tournament.id).then((data) => {
        setTickets(data)
        setLoadingTickets(false)
      })
    }
  }, [activeSection, tournament.id])
  
  // Load decklists when section changes to decklists
  useEffect(() => {
    if (activeSection === "decklists") {
      setLoadingDecklists(true)
      getTournamentDecklists(tournament.id).then((data) => {
        setDecklists(data)
        setLoadingDecklists(false)
      })
    }
  }, [activeSection, tournament.id])

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
    
    // Calculate current round number and recommended rounds
    const currentRoundNum = currentRound?.round_number ?? 0
    const recommendedRounds = activePhase.rounds_count ?? calculateSwissRounds(registeredCount)
    
    // Warn if exceeding recommended rounds
    if (currentRoundNum >= recommendedRounds) {
      const proceed = window.confirm(
        `You are about to create round ${currentRoundNum + 1}, which exceeds the recommended ${recommendedRounds} rounds for ${registeredCount} players. Continue anyway?`
      )
      if (!proceed) return
    }
    
    startTransition(async () => {
      const result = await createSwissRound(tournament.id, activePhase.id)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        const newRoundNum = currentRoundNum + 1
        if (newRoundNum === recommendedRounds) {
          toast.success(`Round ${newRoundNum} created! This is the final recommended round.`)
        } else if (newRoundNum < recommendedRounds) {
          toast.success(`Round ${newRoundNum} of ${recommendedRounds} created!`)
        } else {
          toast.success(`Round ${newRoundNum} created (extra round).`)
        }
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
        setShowAutoAdvanceDialog(false)
        router.refresh()
      }
    })
  }
  
  // Bulk action: Confirm all matching reports
  const handleConfirmAllMatching = async () => {
    if (!currentRound) return
    setBulkActionPending(true)
    try {
      const result = await confirmAllMatchingReports(currentRound.id)
      if ("error" in result) {
        toast.error(result.error)
      } else if (result.confirmedCount === 0) {
        toast.info("No matching reports to confirm")
      } else {
        toast.success(`Confirmed ${result.confirmedCount} matching reports!`)
        router.refresh()
      }
    } finally {
      setBulkActionPending(false)
    }
  }
  
  // Bulk action: Force complete all pending matches
  const handleForceCompleteRound = async () => {
    if (!currentRound) return
    const confirmed = window.confirm(
      "This will mark all pending/reported matches as 0-0-0 draws. Are you sure?"
    )
    if (!confirmed) return
    
    setBulkActionPending(true)
    try {
      const result = await forceCompleteRound(currentRound.id)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success(`Force-completed ${result.forcedCount} matches`)
        router.refresh()
      }
    } finally {
      setBulkActionPending(false)
    }
  }

  const handleReportResult = (matchIdOverride?: string) => {
    const matchId = matchIdOverride || selectedMatch
    if (!matchId) return
    
    // Find match in currentRound or allRounds
    let match = currentRound?.matches.find(m => m.id === matchId)
    if (!match) {
      for (const round of allRounds) {
        match = round.matches.find(m => m.id === matchId)
        if (match) break
      }
    }
    if (!match || !match.player1) return

    startTransition(async () => {
      const winnerId = matchResult.player1Wins > matchResult.player2Wins 
        ? match.player1!.id 
        : matchResult.player2Wins > matchResult.player1Wins
          ? match.player2?.id ?? null
          : null

      if (!winnerId && matchResult.player1Wins === matchResult.player2Wins && matchResult.draws === 0) {
        toast.error("Must have a winner or draws")
        return
      }

      const result = await reportMatchResult(
        matchId,
        winnerId || match.player1!.id,
        matchResult.player1Wins,
        matchResult.player2Wins,
        matchResult.draws
      )
      
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Result recorded!")
        setSelectedMatch(null)
        setMatchResult({ player1Wins: 0, player2Wins: 0, draws: 0 })
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
  // Don't close dialog on error so user can retry
  } else if ("isPreregistration" in result && result.isPreregistration) {
  toast.success(result.message || `Preregistration created for ${newPlayerEmail}`)
  setNewPlayerEmail("")
  setShowAddPlayerDialog(false)
  router.refresh()
  } else {
  toast.success(`${result.playerName} added to tournament!`)
  setNewPlayerEmail("")
  setShowAddPlayerDialog(false)
  router.refresh()
  }
  })
  }

  const handleSendAnnouncement = () => {
    if (!announcement.trim()) {
      toast.error("Please enter an announcement message")
      return
    }
    startTransition(async () => {
      const result = await sendTournamentAnnouncement(tournament.id, announcement, announcementPriority)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Announcement sent!")
        setAnnouncement("")
        setAnnouncementPriority("normal")
        // Refresh announcements list
        const refreshResult = await getTournamentAnnouncements(tournament.id)
        if ("announcements" in refreshResult) {
          setAnnouncements(refreshResult.announcements)
        }
      }
    })
  }

  const handleDeleteAnnouncement = (announcementId: string) => {
    startTransition(async () => {
      const result = await deleteAnnouncement(announcementId)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Announcement deleted")
        setAnnouncements(prev => prev.filter(a => a.id !== announcementId))
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
            
            <div className="flex items-center gap-3">
              {/* Live Connection Indicator */}
              {isLive && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  <span className="text-xs font-medium text-primary">LIVE</span>
                  {isConnected ? (
                    <Wifi className="h-3 w-3 text-green-500" />
                  ) : (
                    <Wifi className="h-3 w-3 text-muted-foreground animate-pulse" />
                  )}
                </div>
              )}
              
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
                    await updateTournamentStatus(tournament.id, "registration")
                    router.refresh()
                  })}>
                    Registration (Re-open)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => startTransition(async () => {
                    await updateTournamentStatus(tournament.id, "registration_closed")
                    router.refresh()
                  })}>
                    Registration Closed
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => startTransition(async () => {
                    await updateTournamentStatus(tournament.id, "in_progress")
                    router.refresh()
                  })}>
                    In Progress
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => startTransition(async () => {
                    await updateTournamentStatus(tournament.id, "completed")
                    router.refresh()
                  })}>
                    Completed
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
                  {(tournament.status === "published" || tournament.status === "registration") && (
                    <DropdownMenuItem onClick={handleStartTournament} disabled={registeredCount < 2}>
                      <Play className="mr-2 h-4 w-4" />
                      Start Tournament
                    </DropdownMenuItem>
                  )}
                  {tournament.status === "in_progress" && (
                    <>
                      <DropdownMenuItem onClick={() => startTransition(async () => {
                        const result = await updateTournamentStatus(tournament.id, "registration")
                        if ("error" in result) {
                          toast.error(result.error)
                        } else {
                          toast.success("Reverted to registration")
                          router.refresh()
                        }
                      })}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Revert to Registration
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {tournament.status === "in_progress" && !currentRound && (
                    <DropdownMenuItem onClick={handleCreateRound}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Round
                    </DropdownMenuItem>
                  )}
                  {currentRound?.status === "pending" && (
                    <>
                      <DropdownMenuItem onClick={handleStartRound}>
                        <Play className="mr-2 h-4 w-4" />
                        Start Round {currentRound.round_number}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={async () => {
                        startTransition(async () => {
                          const result = await regeneratePairings(tournament.id, currentRound.id)
                          if ("error" in result) {
                            toast.error(result.error)
                          } else {
                            toast.success(`Generated ${result.pairingsCount} pairings`)
                            router.refresh()
                          }
                        })
                      }}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Regenerate Pairings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowManualPairingDialog(true)}>
                        <Shuffle className="mr-2 h-4 w-4" />
                        Edit Pairings
                      </DropdownMenuItem>
                    </>
                  )}
                  {(currentRound?.status === "active" || currentRound?.status === "paused") && (
                    <>
                      <DropdownMenuItem onClick={handleCompleteRound}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Complete Round
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={async () => {
                        startTransition(async () => {
                          const result = await regeneratePairings(tournament.id, currentRound.id)
                          if ("error" in result) {
                            toast.error(result.error)
                          } else {
                            toast.success(`Regenerated ${result.pairingsCount} pairings`)
                            router.refresh()
                          }
                        })
                      }}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Regenerate Pairings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowManualPairingDialog(true)}>
                        <Shuffle className="mr-2 h-4 w-4" />
                        Repair Pairings
                      </DropdownMenuItem>
                    </>
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
              {currentRound && (currentRound.status === "active" || currentRound.status === "paused") && (
                <Card className={cn("border-2", currentRound.status === "paused" ? "border-destructive/40" : "border-primary/20")}>
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
              
              {/* ROUND CONTROL PANEL - The heart of TO operations */}
              {currentRound && roundStats && (currentRound.status === "active" || currentRound.status === "paused") && (
                <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                          <Activity className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            Round {currentRound.round_number}
                            <Badge variant={currentRound.status === "active" ? "default" : "destructive"}>
                              {currentRound.status === "active" ? "LIVE" : "PAUSED"}
                            </Badge>
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">Match Control Panel</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-primary">{roundStats.progressPercent}%</p>
                        <p className="text-xs text-muted-foreground">Complete</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Match Progress</span>
                        <span className="font-medium">{roundStats.confirmedMatches} / {roundStats.totalMatches - roundStats.byeMatches} matches</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                        <div 
                          className={cn(
                            "h-full transition-all duration-500",
                            roundStats.progressPercent === 100 ? "bg-green-500" : "bg-primary"
                          )}
                          style={{ width: `${roundStats.progressPercent}%` }}
                        />
                      </div>
                    </div>
                    
                    {/* Status Grid */}
                    <div className="grid grid-cols-4 gap-3">
                      <div className="rounded-lg border bg-card p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-green-600">
                          <CircleCheck className="h-4 w-4" />
                          <span className="text-xl font-bold">{roundStats.confirmedMatches}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Confirmed</p>
                      </div>
                      <div className="rounded-lg border bg-card p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-blue-600">
                          <CircleDashed className="h-4 w-4" />
                          <span className="text-xl font-bold">{roundStats.reportedMatches}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Reported</p>
                      </div>
                      <div className="rounded-lg border bg-card p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span className="text-xl font-bold">{roundStats.pendingMatches}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Pending</p>
                      </div>
                      <div className={cn(
                        "rounded-lg border p-3 text-center",
                        roundStats.disputedMatches > 0 ? "border-destructive/50 bg-destructive/5" : "bg-card"
                      )}>
                        <div className={cn(
                          "flex items-center justify-center gap-1.5",
                          roundStats.disputedMatches > 0 ? "text-destructive" : "text-muted-foreground"
                        )}>
                          <CircleAlert className="h-4 w-4" />
                          <span className="text-xl font-bold">{roundStats.disputedMatches}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Disputed</p>
                      </div>
                    </div>
                    
                    {/* Alert Banners */}
                    {roundStats.disputedMatches > 0 && (
                      <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                        <Scale className="h-5 w-5 text-destructive" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-destructive">
                            {roundStats.disputedMatches} match{roundStats.disputedMatches !== 1 ? "es" : ""} need resolution
                          </p>
                          <p className="text-xs text-muted-foreground">Review disputed results below</p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => setActiveSection("matches")}
                        >
                          Review
                        </Button>
                      </div>
                    )}
                    
                    {timeRemaining !== null && timeRemaining <= 0 && roundStats.pendingMatches > 0 && (
                      <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                        <Timer className="h-5 w-5 text-amber-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-600">Round time exceeded</p>
                          <p className="text-xs text-muted-foreground">{roundStats.pendingMatches} matches still pending</p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={handleForceCompleteRound}
                          disabled={bulkActionPending}
                        >
                          Force Complete
                        </Button>
                      </div>
                    )}
                    
                    {roundStats.progressPercent === 100 && (
                      <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
                        <Sparkles className="h-5 w-5 text-green-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-600">All matches complete!</p>
                          <p className="text-xs text-muted-foreground">Ready to proceed to next round</p>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={handleCompleteRound}
                          disabled={isPending}
                        >
                          Complete Round
                        </Button>
                      </div>
                    )}
                    
                    {/* Bulk Actions */}
                    <Separator />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleConfirmAllMatching}
                        disabled={bulkActionPending || roundStats.reportedMatches === 0}
                        className="gap-1.5"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Confirm Matching Reports
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleForceCompleteRound}
                        disabled={bulkActionPending || (roundStats.pendingMatches === 0 && roundStats.reportedMatches === 0)}
                        className="gap-1.5"
                      >
                        <FastForward className="h-3.5 w-3.5" />
                        Force Complete All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveSection("matches")}
                        className="gap-1.5"
                      >
                        <List className="h-3.5 w-3.5" />
                        View All Matches
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
                        {currentRound ? `R${currentRound.round_number}` : "-"} / {activePhase?.rounds_count ?? calculateSwissRounds(registeredCount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Round Progress {registeredCount > 0 && `(${calculateSwissRounds(registeredCount)} recommended)`}
                      </p>
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
                    {(tournament.status === "published" || tournament.status === "registration") && (
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
                <Dialog open={showAddPlayerDialog} onOpenChange={setShowAddPlayerDialog}>
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
                        Enter the player&apos;s email address to add them to the tournament. 
                        If they don&apos;t have an account yet, a preregistration will be created.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Player Email</Label>
                        <Input
                          placeholder="player@example.com"
                          value={newPlayerEmail}
                          onChange={(e) => setNewPlayerEmail(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
                        />
                        <p className="text-xs text-muted-foreground">
                          The player must have an account on majhevents.com to be added directly.
                          Otherwise, they will be preregistered and added when they sign up.
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowAddPlayerDialog(false)}>
                        Cancel
                      </Button>
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
                              {!reg.check_in_at && reg.status !== "dropped" && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={async () => {
                                    startTransition(async () => {
                                      const result = await adminCheckInPlayer(tournament.id, reg.player_id, true)
                                      if ("error" in result) {
                                        toast.error(result.error)
                                      } else {
                                        toast.success(`${reg.profiles?.display_name || 'Player'} checked in`)
                                        router.refresh()
                                      }
                                    })
                                  }}
                                  disabled={isPending}
                                  title="Check in player"
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
                                  title="Drop player"
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
                        <Badge variant={currentRound.status === "active" ? "default" : currentRound.status === "paused" ? "destructive" : "secondary"}>
                          {currentRound.status}
                        </Badge>
                        {(currentRound.end_time || currentRound.status === "paused") && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Timer className="h-3 w-3" />
                            {currentRound.status === "paused" 
                              ? `${currentRound.time_limit_minutes || 0}:00`
                              : timeRemaining !== null ? formatTime(timeRemaining) : "--:--"}
                          </Badge>
                        )}
                        {/* Timer Controls */}
                        {(currentRound.status === "active" || currentRound.status === "paused") && (
                          <div className="flex items-center gap-1 ml-2">
                            {currentRound.status === "active" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  const result = await pauseRound(tournament.id, currentRound.id)
                                  if ("error" in result) {
                                    toast.error(result.error)
                                  } else {
                                    toast.success("Round paused")
                                    router.refresh()
                                  }
                                }}
                                disabled={isPending}
                              >
                                <Pause className="h-3 w-3 mr-1" />
                                Pause
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  const result = await resumeRound(tournament.id, currentRound.id)
                                  if ("error" in result) {
                                    toast.error(result.error)
                                  } else {
                                    toast.success("Round resumed")
                                    router.refresh()
                                  }
                                }}
                                disabled={isPending}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Resume
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Time
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                {[1, 3, 5, 10, 15].map((mins) => (
                                  <DropdownMenuItem
                                    key={mins}
                                    onClick={async () => {
                                      const result = await addTimeToRound(tournament.id, currentRound.id, mins)
                                      if ("error" in result) {
                                        toast.error(result.error)
                                      } else {
                                        toast.success(`Added ${mins} minute${mins !== 1 ? 's' : ''}`)
                                        router.refresh()
                                      }
                                    }}
                                  >
                                    +{mins} min
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                const result = await resetRoundTimer(tournament.id, currentRound.id)
                                if ("error" in result) {
                                  toast.error(result.error)
                                } else {
                                  toast.success(`Timer reset to ${result.minutes} minutes`)
                                  router.refresh()
                                }
                              }}
                              disabled={isPending}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Reset
                            </Button>
                          </div>
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
                          <TableHead className="w-16 text-center">Feature</TableHead>
                          <TableHead className="w-20 text-center">Overlay</TableHead>
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
                            <TableCell className="text-center">
                              {!match.is_bye && (
                                <Button
                                  size="sm"
                                  variant={match.is_feature_match ? "default" : "ghost"}
                                  className={cn(
                                    "h-8 w-8 p-0",
                                    match.is_feature_match && "bg-yellow-500 hover:bg-yellow-600"
                                  )}
                                  onClick={async () => {
                                    const result = await setFeatureMatch(
                                      match.id,
                                      !match.is_feature_match
                                    )
                                    if ("error" in result) {
                                      toast.error(result.error)
                                    } else {
                                      toast.success(
                                        match.is_feature_match
                                          ? "Removed from feature matches"
                                          : "Set as feature match"
                                      )
                                      router.refresh()
                                    }
                                  }}
                                  title={match.is_feature_match ? "Remove feature match" : "Set as feature match"}
                                >
                                  <Star className={cn(
                                    "h-4 w-4",
                                    match.is_feature_match ? "fill-current" : ""
                                  )} />
                                </Button>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {!match.is_bye && (
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={() => {
                                      const url = `${window.location.origin}/overlay/match/${match.id}`
                                      navigator.clipboard.writeText(url)
                                      toast.success("Overlay URL copied!")
                                    }}
                                    title="Copy overlay URL for OBS"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={() => {
                                      const url = `${window.location.origin}/overlay/match/${match.id}`
                                      window.open(url, "_blank")
                                    }}
                                    title="Preview overlay"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
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
                                          value={matchResult.player1Wins}
                                          onChange={(e) => setMatchResult(prev => ({ ...prev, player1Wins: parseInt(e.target.value) || 0 }))}
                                          className="text-center"
                                        />
                                        <span className="text-sm text-muted-foreground">Wins</span>
                                      </div>
                                      <div className="grid grid-cols-3 items-center gap-4">
                                        <Label>{match.player2?.display_name}</Label>
                                        <Input
                                          type="number"
                                          min="0"
                                          value={matchResult.player2Wins}
                                          onChange={(e) => setMatchResult(prev => ({ ...prev, player2Wins: parseInt(e.target.value) || 0 }))}
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
                                      <Button onClick={() => handleReportResult()} disabled={isPending}>
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
              ) : allRounds.length > 0 ? (
                // Show all historical rounds with matches
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {allRounds.length} round{allRounds.length !== 1 ? 's' : ''} • {allRounds.reduce((sum, r) => sum + r.matches.length, 0)} total matches
                    </p>
                  </div>
                  {allRounds.map((round) => (
                    <Card key={round.id}>
                      <Collapsible defaultOpen={round.status !== "completed"}>
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                                  {round.round_number}
                                </div>
                                <div>
                                  <CardTitle className="text-base">Round {round.round_number}</CardTitle>
                                  <p className="text-xs text-muted-foreground">
                                    {round.matches.filter(m => m.status === 'confirmed' || m.winner_id).length}/{round.matches.length} matches completed
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={round.status === "completed" ? "secondary" : round.status === "active" ? "default" : "outline"}>
                                  {round.status}
                                </Badge>
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="pt-0">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-16">Table</TableHead>
                                  <TableHead>Player 1</TableHead>
                                  <TableHead className="text-center w-24">Result</TableHead>
                                  <TableHead>Player 2</TableHead>
                                  <TableHead className="text-center w-24">Status</TableHead>
                                  <TableHead className="w-32">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {round.matches.map((match) => (
                                  <TableRow key={match.id}>
                                    <TableCell className="font-mono">{match.table_number}</TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                          <AvatarImage src={match.player1?.avatar_url ?? undefined} />
                                          <AvatarFallback>{match.player1?.display_name?.charAt(0) ?? "?"}</AvatarFallback>
                                        </Avatar>
                                        <span className={match.winner_id === match.player1?.id ? "font-bold text-green-500" : ""}>
                                          {match.player1?.display_name ?? (match.is_bye ? "BYE" : "TBD")}
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center font-mono">
                                      {match.is_bye ? (
                                        <span className="text-muted-foreground">BYE</span>
                                      ) : match.winner_id ? (
                                        <span>{match.player1_wins ?? 0} - {match.player2_wins ?? 0}</span>
                                      ) : (
                                        <span className="text-muted-foreground">vs</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                          <AvatarImage src={match.player2?.avatar_url ?? undefined} />
                                          <AvatarFallback>{match.player2?.display_name?.charAt(0) ?? "?"}</AvatarFallback>
                                        </Avatar>
                                        <span className={match.winner_id === match.player2?.id ? "font-bold text-green-500" : ""}>
                                          {match.player2?.display_name ?? (match.is_bye ? "-" : "TBD")}
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Badge variant={
                                        match.status === "confirmed" || match.status === "completed" ? "secondary" :
                                        match.status === "disputed" ? "destructive" :
                                        match.status === "player1_reported" || match.status === "player2_reported" ? "outline" :
                                        "default"
                                      } className="text-xs">
                                        {match.status === "confirmed" || match.status === "completed" ? "Done" :
                                         match.status === "disputed" ? "Disputed" :
                                         match.status === "player1_reported" ? "P1 Reported" :
                                         match.status === "player2_reported" ? "P2 Reported" :
                                         "Pending"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {!match.is_bye && (
                                        <Dialog>
                                          <DialogTrigger asChild>
                                            <Button 
                                              variant={match.status === "disputed" ? "destructive" : "outline"}
                                              size="sm"
                                              onClick={() => {
                                                setSelectedMatch(match.id)
                                                setMatchResult({
                                                  player1Wins: match.player1_wins ?? 0,
                                                  player2Wins: match.player2_wins ?? 0,
                                                  draws: match.draws ?? 0
                                                })
                                              }}
                                            >
                                              {match.status === "disputed" ? (
                                                <>
                                                  <Scale className="h-3 w-3 mr-1" />
                                                  Resolve
                                                </>
                                              ) : (
                                                <>
                                                  <Edit2 className="h-3 w-3 mr-1" />
                                                  Edit
                                                </>
                                              )}
                                            </Button>
                                          </DialogTrigger>
                                          <DialogContent className={match.status === "disputed" ? "max-w-lg" : ""}>
                                            <DialogHeader>
                                              <DialogTitle>
                                                {match.status === "disputed" ? (
                                                  <span className="flex items-center gap-2 text-destructive">
                                                    <AlertCircle className="h-5 w-5" />
                                                    Resolve Disputed Match
                                                  </span>
                                                ) : (
                                                  "Edit Match Result"
                                                )}
                                              </DialogTitle>
                                              <DialogDescription>
                                                Round {round.round_number}, Table {match.table_number}
                                                {match.status === "disputed" && match.dispute_reason && (
                                                  <span className="block mt-2 text-destructive">
                                                    {match.dispute_reason}
                                                  </span>
                                                )}
                                              </DialogDescription>
                                            </DialogHeader>
                                            
                                            {/* Show reported results if disputed */}
                                            {match.status === "disputed" && (
                                              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 mb-4">
                                                <h4 className="font-medium mb-3 text-sm">Player Reports:</h4>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                  <div className="space-y-1">
                                                    <span className="font-medium">{match.player1?.display_name}:</span>
                                                    <p className="text-muted-foreground">
                                                      Claims {match.reported_player1_wins ?? "?"} wins, {match.reported_player1_draws ?? 0} draws
                                                    </p>
                                                  </div>
                                                  <div className="space-y-1">
                                                    <span className="font-medium">{match.player2?.display_name}:</span>
                                                    <p className="text-muted-foreground">
                                                      Claims {match.reported_player2_wins ?? "?"} wins, {match.reported_player2_draws ?? 0} draws
                                                    </p>
                                                  </div>
                                                </div>
                                              </div>
                                            )}
                                            
                                            <div className="grid grid-cols-3 gap-4 py-4">
                                              <div className="flex flex-col items-center gap-2">
                                                <Avatar className="h-12 w-12">
                                                  <AvatarImage src={match.player1?.avatar_url ?? undefined} />
                                                  <AvatarFallback>{match.player1?.display_name?.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm font-medium text-center">{match.player1?.display_name}</span>
                                                <Input
                                                  type="number"
                                                  min="0"
                                                  value={matchResult.player1Wins}
                                                  onChange={(e) => setMatchResult(prev => ({ ...prev, player1Wins: parseInt(e.target.value) || 0 }))}
                                                  className="text-center w-16"
                                                />
                                                <span className="text-xs text-muted-foreground">Wins</span>
                                              </div>
                                              <div className="flex flex-col items-center justify-center gap-2">
                                                <span className="text-2xl font-bold text-muted-foreground">vs</span>
                                                <Input
                                                  type="number"
                                                  min="0"
                                                  value={matchResult.draws}
                                                  onChange={(e) => setMatchResult(prev => ({ ...prev, draws: parseInt(e.target.value) || 0 }))}
                                                  className="text-center w-16"
                                                />
                                                <span className="text-xs text-muted-foreground">Draws</span>
                                              </div>
                                              <div className="flex flex-col items-center gap-2">
                                                <Avatar className="h-12 w-12">
                                                  <AvatarImage src={match.player2?.avatar_url ?? undefined} />
                                                  <AvatarFallback>{match.player2?.display_name?.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm font-medium text-center">{match.player2?.display_name}</span>
                                                <Input
                                                  type="number"
                                                  min="0"
                                                  value={matchResult.player2Wins}
                                                  onChange={(e) => setMatchResult(prev => ({ ...prev, player2Wins: parseInt(e.target.value) || 0 }))}
                                                  className="text-center w-16"
                                                />
                                                <span className="text-xs text-muted-foreground">Wins</span>
                                              </div>
                                            </div>
                                            
                                            {/* Quick resolution buttons for disputed matches */}
                                            {match.status === "disputed" && (
                                              <div className="flex gap-2 mb-4">
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  className="flex-1"
                                                  onClick={() => {
                                                    setMatchResult({
                                                      player1Wins: match.reported_player1_wins ?? 0,
                                                      player2Wins: match.player2_wins ?? 0,
                                                      draws: match.reported_player1_draws ?? 0
                                                    })
                                                  }}
                                                >
                                                  Accept {match.player1?.display_name?.split(" ")[0]}&apos;s Report
                                                </Button>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  className="flex-1"
                                                  onClick={() => {
                                                    setMatchResult({
                                                      player1Wins: match.player1_wins ?? 0,
                                                      player2Wins: match.reported_player2_wins ?? 0,
                                                      draws: match.reported_player2_draws ?? 0
                                                    })
                                                  }}
                                                >
                                                  Accept {match.player2?.display_name?.split(" ")[0]}&apos;s Report
                                                </Button>
                                              </div>
                                            )}
                                            
                                            <DialogFooter>
                                              <Button 
                                                onClick={() => handleReportResult(match.id)} 
                                                disabled={isPending}
                                                variant={match.status === "disputed" ? "default" : "default"}
                                              >
                                                <Send className="mr-2 h-4 w-4" />
                                                {match.status === "disputed" ? "Resolve & Confirm" : "Save Result"}
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
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Clock className="mb-4 h-12 w-12 text-muted-foreground/50" />
                    <h3 className="text-lg font-semibold">No rounds yet</h3>
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
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Decklists</h2>
                <Badge variant="outline">
                  {decklists.filter(d => d.is_valid).length}/{decklists.length} validated
                </Badge>
              </div>
              
              {decklists.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No decklists submitted yet</p>
                    <p className="text-sm">Player decklists will appear here when submitted</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {decklists.map((deck) => (
                    <Card key={deck.id} className={cn(
                      "transition-colors",
                      !deck.is_valid && deck.validation_errors && "border-destructive/50 bg-destructive/5"
                    )}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={deck.is_valid ? "default" : "destructive"} className="text-[10px]">
                                {deck.is_valid ? "Valid" : "Invalid"}
                              </Badge>
                              {deck.format && (
                                <Badge variant="outline" className="text-[10px]">
                                  {deck.format}
                                </Badge>
                              )}
                            </div>
                            <h4 className="font-medium text-sm truncate">
                              {deck.decklist_name || "Unnamed Deck"}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              Submitted by {getPlayerDisplayName(deck.profiles)}
                            </p>
                            {deck.validation_errors && (
                              <p className="text-xs text-destructive mt-1 line-clamp-2">
                                {deck.validation_errors}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span>
                                {formatDistanceToNow(new Date(deck.submitted_at), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline">
                                  <FileText className="h-3 w-3 mr-1" />
                                  View
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>{deck.decklist_name || "Decklist"}</DialogTitle>
                                  <DialogDescription>
                                    Submitted by {getPlayerDisplayName(deck.profiles)}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="flex gap-2">
                                    <Badge variant={deck.is_valid ? "default" : "destructive"}>
                                      {deck.is_valid ? "Valid" : "Invalid"}
                                    </Badge>
                                    {deck.format && <Badge variant="outline">{deck.format}</Badge>}
                                  </div>
                                  {deck.decklist_url && (
                                    <div>
                                      <Label className="text-sm">External Link</Label>
                                      <a 
                                        href={deck.decklist_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-sm text-primary hover:underline block truncate"
                                      >
                                        {deck.decklist_url}
                                      </a>
                                    </div>
                                  )}
                                  {deck.decklist_text && (
                                    <div>
                                      <Label className="text-sm">Decklist</Label>
                                      <pre className="mt-2 p-4 bg-muted rounded-lg text-sm font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                                        {deck.decklist_text}
                                      </pre>
                                    </div>
                                  )}
                                  {deck.validation_errors && (
                                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                                      <p className="text-sm text-destructive font-medium">Validation Errors:</p>
                                      <p className="text-sm text-destructive mt-1">{deck.validation_errors}</p>
                                    </div>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
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
                  <div className="flex items-center gap-4">
                    <div className="space-y-1">
                      <Label className="text-sm">Priority</Label>
                      <Select 
                        value={announcementPriority} 
                        onValueChange={(v) => setAnnouncementPriority(v as "normal" | "high" | "urgent")}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      onClick={handleSendAnnouncement} 
                      disabled={!announcement.trim() || isPending}
                      className="mt-auto"
                    >
                      <Megaphone className="mr-2 h-4 w-4" />
                      Send Announcement
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Past Announcements */}
              <Card>
                <CardHeader>
                  <CardTitle>Announcement History</CardTitle>
                  <CardDescription>Previous announcements sent to participants</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingAnnouncements ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading announcements...
                    </div>
                  ) : announcements.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Megaphone className="mx-auto h-12 w-12 mb-4 opacity-50" />
                      <p>No announcements yet</p>
                      <p className="text-sm">Send your first announcement above</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {announcements.map((ann) => (
                        <div 
                          key={ann.id} 
                          className={cn(
                            "p-4 rounded-lg border",
                            ann.priority === "urgent" && "border-destructive bg-destructive/10",
                            ann.priority === "high" && "border-yellow-500 bg-yellow-500/10",
                            ann.priority === "normal" && "border-border"
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {ann.priority !== "normal" && (
                                  <Badge variant={ann.priority === "urgent" ? "destructive" : "outline"}>
                                    {ann.priority}
                                  </Badge>
                                )}
                                <span className="text-sm text-muted-foreground">
                                  {formatDistanceToNow(new Date(ann.created_at), { addSuffix: true })}
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap">{ann.message}</p>
                              {ann.profiles && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  Sent by {getPlayerDisplayName(ann.profiles)}
                                </p>
                              )}
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDeleteAnnouncement(ann.id)}
                              disabled={isPending}
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Support Tickets</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {tickets.filter(t => t.status !== "resolved" && t.status !== "closed").length} open
                  </Badge>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Create Ticket
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Support Ticket</DialogTitle>
                        <DialogDescription>
                          Report an issue or request assistance for this tournament.
                        </DialogDescription>
                      </DialogHeader>
                      <form
                        action={async (formData: FormData) => {
                          formData.set("tournament_id", tournament.id)
                          startTransition(async () => {
                            const result = await createIssue(formData)
                            if ("error" in result) {
                              toast.error(result.error)
                            } else {
                              toast.success("Ticket created successfully")
                              // Refresh tickets
                              const newTickets = await getTournamentIssues(tournament.id)
                              setTickets(newTickets)
                            }
                          })
                        }}
                        className="space-y-4"
                      >
                        <div className="space-y-2">
                          <Label htmlFor="ticket-category">Category</Label>
                          <Select name="category" defaultValue="technical">
                            <SelectTrigger id="ticket-category">
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
                          <Label htmlFor="ticket-severity">Severity</Label>
                          <Select name="severity" defaultValue="medium">
                            <SelectTrigger id="ticket-severity">
                              <SelectValue placeholder="Select severity" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ticket-title">Title</Label>
                          <Input id="ticket-title" name="title" placeholder="Brief description of the issue" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ticket-description">Description</Label>
                          <Textarea 
                            id="ticket-description" 
                            name="description" 
                            placeholder="Detailed description of the issue..."
                            rows={4}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ticket-round">Affected Round (optional)</Label>
                          <Input id="ticket-round" name="affected_round" type="number" min="1" placeholder="Round number" />
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={isPending}>
                            {isPending ? "Creating..." : "Create Ticket"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              
              {loadingTickets ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <RefreshCw className="mx-auto h-8 w-8 mb-4 animate-spin opacity-50" />
                    <p>Loading tickets...</p>
                  </CardContent>
                </Card>
              ) : tickets.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <TicketCheck className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No support tickets</p>
                    <p className="text-sm">Player issues and disputes will appear here</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <Card key={ticket.id} className={cn(
                      "transition-colors",
                      ticket.severity === "critical" && "border-destructive/50 bg-destructive/5",
                      ticket.severity === "high" && "border-orange-500/50",
                      ticket.status === "resolved" && "opacity-60"
                    )}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={
                                ticket.status === "open" ? "destructive" :
                                ticket.status === "in_progress" ? "default" :
                                ticket.status === "escalated" ? "secondary" :
                                "outline"
                              } className="text-[10px]">
                                {ticket.status}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {ISSUE_CATEGORIES[ticket.category as keyof typeof ISSUE_CATEGORIES]?.label || ticket.category}
                              </Badge>
                              {ticket.severity === "critical" && (
                                <Badge className="bg-destructive text-destructive-foreground text-[10px]">
                                  CRITICAL
                                </Badge>
                              )}
                            </div>
                            <h4 className="font-medium text-sm truncate">{ticket.title}</h4>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {ticket.description}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span>
                                Reported by {getPlayerDisplayName(ticket.reporter)}
                              </span>
                              <span>
                                {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {ticket.status !== "resolved" && ticket.status !== "closed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const fd = new FormData()
                                  fd.set("issue_id", ticket.id)
                                  fd.set("status", "resolved")
                                  startTransition(async () => {
                                    const result = await updateIssueStatus(fd)
                                    if ("error" in result) {
                                      toast.error(result.error)
                                    } else {
                                      toast.success("Ticket resolved")
                                      setTickets(prev => prev.map(t => 
                                        t.id === ticket.id ? { ...t, status: "resolved" } : t
                                      ))
                                    }
                                  })
                                }}
                                disabled={isPending}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Resolve
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
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

      {/* Manual Pairing Dialog */}
      <Dialog open={showManualPairingDialog} onOpenChange={setShowManualPairingDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Match Pairings - Round {currentRound?.round_number}</DialogTitle>
            <DialogDescription>
              Swap players between matches or manually assign players. Changes will create an announcement for players.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Current Matches */}
            <div className="space-y-2">
              <h3 className="font-medium">Current Matches</h3>
              {currentRound?.matches?.map((match: any, idx: number) => (
                <div key={match.id} className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                  <span className="w-12 text-sm text-muted-foreground">Table {match.table_number}</span>
                  
                  <Select
                    value={match.player1_id || ""}
                    onValueChange={async (newPlayerId) => {
                      if (newPlayerId !== match.player1_id) {
                        startTransition(async () => {
                          const result = await updateMatchPlayers(
                            tournament.id,
                            match.id,
                            newPlayerId || null,
                            match.player2_id
                          )
                          if ("error" in result) {
                            toast.error(result.error)
                          } else {
                            toast.success("Match updated")
                            router.refresh()
                          }
                        })
                      }
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select Player 1" />
                    </SelectTrigger>
                    <SelectContent>
                      {registrations.filter(r => r.status !== "dropped").map((reg) => (
                        <SelectItem key={reg.player_id} value={reg.player_id}>
                          {reg.profiles?.display_name || "Unknown"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <span className="text-muted-foreground">vs</span>
                  
                  <Select
                    value={match.player2_id || "bye"}
                    onValueChange={async (newPlayerId) => {
                      const actualPlayerId = newPlayerId === "bye" ? null : newPlayerId
                      if (actualPlayerId !== match.player2_id) {
                        startTransition(async () => {
                          const result = await updateMatchPlayers(
                            tournament.id,
                            match.id,
                            match.player1_id,
                            actualPlayerId
                          )
                          if ("error" in result) {
                            toast.error(result.error)
                          } else {
                            toast.success("Match updated")
                            router.refresh()
                          }
                        })
                      }
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select Player 2" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bye">BYE</SelectItem>
                      {registrations.filter(r => r.status !== "dropped").map((reg) => (
                        <SelectItem key={reg.player_id} value={reg.player_id}>
                          {reg.profiles?.display_name || "Unknown"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {selectedMatchForSwap === match.id ? (
                    <div className="flex items-center gap-1 ml-auto">
                      <span className="text-sm text-muted-foreground">Select another match to swap with</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedMatchForSwap(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : selectedMatchForSwap ? (
                    <div className="flex items-center gap-1 ml-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          startTransition(async () => {
                            const result = await swapMatchPlayers(
                              tournament.id,
                              selectedMatchForSwap,
                              match.id,
                              true // swap player1s
                            )
                            if ("error" in result) {
                              toast.error(result.error)
                            } else {
                              toast.success("Players swapped")
                              setSelectedMatchForSwap(null)
                              router.refresh()
                            }
                          })
                        }}
                        disabled={isPending}
                      >
                        <ArrowLeftRight className="h-3 w-3 mr-1" />
                        Swap P1
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          startTransition(async () => {
                            const result = await swapMatchPlayers(
                              tournament.id,
                              selectedMatchForSwap,
                              match.id,
                              false // swap player2s
                            )
                            if ("error" in result) {
                              toast.error(result.error)
                            } else {
                              toast.success("Players swapped")
                              setSelectedMatchForSwap(null)
                              router.refresh()
                            }
                          })
                        }}
                        disabled={isPending}
                      >
                        <ArrowLeftRight className="h-3 w-3 mr-1" />
                        Swap P2
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 ml-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedMatchForSwap(match.id)}
                        title="Swap players with another match"
                      >
                        <Shuffle className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={async () => {
                          if (confirm("Delete this match?")) {
                            startTransition(async () => {
                              const result = await deleteMatch(tournament.id, match.id)
                              if ("error" in result) {
                                toast.error(result.error)
                              } else {
                                toast.success("Match deleted")
                                router.refresh()
                              }
                            })
                          }
                        }}
                        disabled={isPending}
                        title="Delete match"
                      >
                        <UserMinus className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add New Match */}
            {currentRound && (
              <div className="pt-4 border-t">
                <h3 className="font-medium mb-2">Add New Match</h3>
                <div className="flex items-center gap-2">
                  <Select onValueChange={(id) => {
                    const p1Select = document.getElementById("new-match-p1") as HTMLSelectElement
                    if (p1Select) p1Select.value = id
                  }}>
                    <SelectTrigger id="new-match-p1" className="w-48">
                      <SelectValue placeholder="Player 1" />
                    </SelectTrigger>
                    <SelectContent>
                      {registrations.filter(r => r.status !== "dropped").map((reg) => (
                        <SelectItem key={reg.player_id} value={reg.player_id}>
                          {reg.profiles?.display_name || "Unknown"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <span className="text-muted-foreground">vs</span>
                  
                  <Select onValueChange={(id) => {
                    const p2Select = document.getElementById("new-match-p2") as HTMLSelectElement
                    if (p2Select) p2Select.value = id
                  }}>
                    <SelectTrigger id="new-match-p2" className="w-48">
                      <SelectValue placeholder="Player 2 (or BYE)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bye">BYE</SelectItem>
                      {registrations.filter(r => r.status !== "dropped").map((reg) => (
                        <SelectItem key={reg.player_id} value={reg.player_id}>
                          {reg.profiles?.display_name || "Unknown"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Button
                    onClick={async () => {
                      const p1 = (document.getElementById("new-match-p1") as HTMLSelectElement)?.value
                      const p2Val = (document.getElementById("new-match-p2") as HTMLSelectElement)?.value
                      const p2 = p2Val === "bye" ? null : p2Val
                      
                      if (!p1) {
                        toast.error("Select Player 1")
                        return
                      }
                      
                      startTransition(async () => {
                        const result = await createManualMatch(
                          tournament.id,
                          currentRound.id,
                          p1,
                          p2
                        )
                        if ("error" in result) {
                          toast.error(result.error)
                        } else {
                          toast.success("Match created")
                          router.refresh()
                        }
                      })
                    }}
                    disabled={isPending}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Match
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualPairingDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Auto-Advance Dialog */}
      <Dialog open={showAutoAdvanceDialog} onOpenChange={setShowAutoAdvanceDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-green-600" />
              All Matches Complete!
            </DialogTitle>
            <DialogDescription>
              Round {currentRound?.round_number} has all matches confirmed. Would you like to proceed?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Confirmed Matches</span>
                <span className="font-bold text-green-600">{roundStats?.confirmedMatches ?? 0}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button 
                onClick={() => {
                  handleCompleteRound()
                }}
                disabled={isPending}
                className="w-full"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Complete Round & Create Next
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  if (window.confirm("This will end the tournament and calculate final standings. Are you sure?")) {
                    startTransition(async () => {
                      const completeResult = await completeRound(currentRound!.id)
                      if ("error" in completeResult) {
                        toast.error(completeResult.error)
                        return
                      }
                      const finishResult = await completeTournament(tournament.id)
                      if ("error" in finishResult) {
                        toast.error(finishResult.error)
                      } else {
                        toast.success("Tournament completed!")
                        setShowAutoAdvanceDialog(false)
                        router.refresh()
                      }
                    })
                  }
                }}
                disabled={isPending}
                className="w-full"
              >
                <Trophy className="mr-2 h-4 w-4" />
                End Tournament (Final Round)
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAutoAdvanceDialog(false)}>
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
