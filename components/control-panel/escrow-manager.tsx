"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Search,
  Shield,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  Eye,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface Escrow {
  id: string
  tournament_id: string
  funded_amount_cents: number
  target_amount_cents: number | null
  participant_count: number
  status: string
  is_test: boolean | null
  created_at: string
  tournaments: {
    title: string
    start_time: string
  } | null
}

export function EscrowManager({ escrows }: { escrows: Escrow[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [envFilter, setEnvFilter] = useState<string>("all")
  const [selectedEscrow, setSelectedEscrow] = useState<Escrow | null>(null)
  const [releasing, setReleasing] = useState(false)

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { class: string; icon: React.ReactNode }> = {
      pending: { 
        class: "bg-amber-500/20 text-amber-400 border-amber-500/30", 
        icon: <Clock className="h-3 w-3 mr-1" /> 
      },
      funded: { 
        class: "bg-blue-500/20 text-blue-400 border-blue-500/30", 
        icon: <Shield className="h-3 w-3 mr-1" /> 
      },
      released: { 
        class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", 
        icon: <CheckCircle className="h-3 w-3 mr-1" /> 
      },
    }
    const style = styles[status] || styles.pending
    return (
      <Badge className={cn("flex items-center", style.class)}>
        {style.icon}
        {status}
      </Badge>
    )
  }

  const filteredEscrows = escrows.filter((e) => {
    const matchesSearch = e.tournaments?.title?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || e.status === statusFilter
    const matchesEnv = envFilter === "all" || 
      (envFilter === "test" && e.is_test) || 
      (envFilter === "live" && !e.is_test)
    
    return matchesSearch && matchesStatus && matchesEnv
  })

  const handleReleaseEscrow = async (escrowId: string) => {
    setReleasing(true)
    try {
      const response = await fetch("/api/admin/escrow/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escrowId }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Escrow Released",
          description: result.message || "Escrow funds have been released",
        })
        setSelectedEscrow(null)
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to release escrow",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to release escrow",
        variant: "destructive",
      })
    }
    setReleasing(false)
  }

  const liveEscrows = escrows.filter(e => !e.is_test)
  const testEscrows = escrows.filter(e => e.is_test)
  const activeTotal = liveEscrows
    .filter(e => e.status !== "released")
    .reduce((sum, e) => sum + e.funded_amount_cents, 0)

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-zinc-400">Active Escrow</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">{formatCurrency(activeTotal)}</p>
            <p className="text-xs text-zinc-500 mt-1">
              {liveEscrows.filter(e => e.status !== "released").length} live accounts
            </p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-purple-400" />
              <span className="text-sm text-zinc-400">Total Participants</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">
              {liveEscrows.reduce((sum, e) => sum + e.participant_count, 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span className="text-sm text-amber-400">Test Escrows</span>
            </div>
            <p className="text-2xl font-bold text-amber-400">{testEscrows.length}</p>
            <p className="text-xs text-amber-500/70 mt-1">
              {formatCurrency(testEscrows.reduce((sum, e) => sum + e.funded_amount_cents, 0))} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Search by tournament..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-zinc-800 border-zinc-700 text-zinc-100"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] bg-zinc-800 border-zinc-700 text-zinc-100">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="funded">Funded</SelectItem>
                <SelectItem value="released">Released</SelectItem>
              </SelectContent>
            </Select>

            <Select value={envFilter} onValueChange={setEnvFilter}>
              <SelectTrigger className="w-[150px] bg-zinc-800 border-zinc-700 text-zinc-100">
                <SelectValue placeholder="Environment" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="test">Test</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Escrows Table */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-zinc-100">Escrow Accounts</CardTitle>
          <CardDescription className="text-zinc-500">
            {filteredEscrows.length} escrow accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredEscrows.length > 0 ? (
            <div className="rounded-lg border border-zinc-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Tournament</TableHead>
                    <TableHead className="text-zinc-400 text-right">Funded</TableHead>
                    <TableHead className="text-zinc-400">Progress</TableHead>
                    <TableHead className="text-zinc-400">Participants</TableHead>
                    <TableHead className="text-zinc-400">Status</TableHead>
                    <TableHead className="text-zinc-400">Env</TableHead>
                    <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEscrows.map((e) => {
                    const progress = e.target_amount_cents 
                      ? Math.min((e.funded_amount_cents / e.target_amount_cents) * 100, 100)
                      : 100
                    
                    return (
                      <TableRow 
                        key={e.id} 
                        className={cn(
                          "border-zinc-800 hover:bg-zinc-800/50",
                          e.is_test && "opacity-60"
                        )}
                      >
                        <TableCell>
                          <div>
                            <p className="text-zinc-100 text-sm font-medium">
                              {e.tournaments?.title || "Unknown Tournament"}
                            </p>
                            <p className="text-zinc-500 text-xs">
                              {e.tournaments?.start_time 
                                ? new Date(e.tournaments.start_time).toLocaleDateString()
                                : "No date"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-blue-400">
                          {formatCurrency(e.funded_amount_cents)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={progress} 
                              className="h-2 w-20 bg-zinc-700"
                            />
                            <span className="text-xs text-zinc-500">{progress.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-zinc-300">
                            <Users className="h-3 w-3" />
                            {e.participant_count}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(e.status)}</TableCell>
                        <TableCell>
                          {e.is_test ? (
                            <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">TEST</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">LIVE</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => setSelectedEscrow(e)}
                            className="h-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Shield className="h-12 w-12 mb-4" />
              <p>No escrow accounts found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Escrow Detail Modal */}
      <Dialog open={!!selectedEscrow} onOpenChange={() => setSelectedEscrow(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Escrow Details</DialogTitle>
            <DialogDescription className="text-zinc-500">
              {selectedEscrow?.tournaments?.title}
            </DialogDescription>
          </DialogHeader>

          {selectedEscrow && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-zinc-500">Funded Amount</p>
                  <p className="text-xl font-bold text-blue-400">
                    {formatCurrency(selectedEscrow.funded_amount_cents)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-500">Target</p>
                  <p className="text-xl font-bold text-zinc-100">
                    {selectedEscrow.target_amount_cents 
                      ? formatCurrency(selectedEscrow.target_amount_cents)
                      : "N/A"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-500">Participants</p>
                  <p className="text-lg font-medium text-zinc-100">{selectedEscrow.participant_count}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-500">Status</p>
                  {getStatusBadge(selectedEscrow.status)}
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <p className="text-sm text-zinc-500 mb-2">Funding Progress</p>
                <Progress 
                  value={selectedEscrow.target_amount_cents 
                    ? (selectedEscrow.funded_amount_cents / selectedEscrow.target_amount_cents) * 100
                    : 100
                  } 
                  className="h-3 bg-zinc-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedEscrow(null)}
                  className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                >
                  Close
                </Button>
                {selectedEscrow.status === "funded" && (
                  <Button 
                    onClick={() => handleReleaseEscrow(selectedEscrow.id)}
                    disabled={releasing}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {releasing ? "Releasing..." : "Release Escrow"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
