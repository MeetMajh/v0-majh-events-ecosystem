"use client"

import { useState, useTransition } from "react"
import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Shield, Unlock, AlertTriangle, Trophy, Calendar, Search, RefreshCw, DollarSign, Lock, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface EscrowAccount {
  id: string
  tournament_id: string
  funded_amount_cents: number
  released_amount_cents: number
  status: string
  funded_at: string | null
  created_at: string
  tournaments: {
    id: string
    name: string
    status: string
    start_date: string
    prize_pool_cents: number
  }
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "border-amber-500/20 bg-amber-500/10 text-amber-500", icon: <Lock className="h-3 w-3" /> },
  funded: { label: "Funded", color: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500", icon: <Shield className="h-3 w-3" /> },
  partially_released: { label: "Partial Release", color: "border-blue-500/20 bg-blue-500/10 text-blue-500", icon: <Unlock className="h-3 w-3" /> },
  released: { label: "Released", color: "border-muted-foreground/20 bg-muted text-muted-foreground", icon: <Unlock className="h-3 w-3" /> },
  disputed: { label: "Disputed", color: "border-red-500/20 bg-red-500/10 text-red-500", icon: <AlertTriangle className="h-3 w-3" /> },
}

export function EscrowOverview() {
  const { data, error, isLoading, mutate } = useSWR<{ escrows: EscrowAccount[] }>(
    "/api/admin/escrow/list",
    fetcher,
    { refreshInterval: 60000 }
  )
  const [isPending, startTransition] = useTransition()
  const [selectedEscrow, setSelectedEscrow] = useState<EscrowAccount | null>(null)
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  const handleReleaseEscrow = async () => {
    if (!selectedEscrow) return

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/escrow/release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ escrowId: selectedEscrow.id }),
        })
        
        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.message || "Failed to release escrow")
        }

        toast.success("Escrow released successfully")
        setReleaseDialogOpen(false)
        setSelectedEscrow(null)
        mutate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to release escrow")
      }
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-destructive">Failed to load escrow accounts</p>
        </CardContent>
      </Card>
    )
  }

  const escrows = data?.escrows || []

  const filteredEscrows = escrows.filter((e) => {
    const matchesSearch = e.tournaments?.name?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || e.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalFunded = escrows.reduce((sum, e) => sum + e.funded_amount_cents, 0)
  const totalReleased = escrows.reduce((sum, e) => sum + e.released_amount_cents, 0)
  const pendingRelease = totalFunded - totalReleased

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Funded</p>
                <p className="text-2xl font-bold text-emerald-500">{formatCurrency(totalFunded)}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                <Shield className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Release</p>
                <p className="text-2xl font-bold text-blue-500">{formatCurrency(pendingRelease)}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                <Lock className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted-foreground/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Released</p>
                <p className="text-2xl font-bold">{formatCurrency(totalReleased)}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Unlock className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Escrow Accounts</CardTitle>
              <CardDescription>Tournament prize pools held in escrow</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => mutate()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tournaments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="funded">Funded</SelectItem>
                <SelectItem value="partially_released">Partially Released</SelectItem>
                <SelectItem value="released">Released</SelectItem>
                <SelectItem value="disputed">Disputed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredEscrows.length === 0 ? (
            <div className="py-8 text-center">
              <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No escrow accounts found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Tournament</TableHead>
                    <TableHead className="text-right">Prize Pool</TableHead>
                    <TableHead className="text-right">Funded</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEscrows.map((escrow) => {
                    const releasePercent = escrow.funded_amount_cents > 0
                      ? (escrow.released_amount_cents / escrow.funded_amount_cents) * 100
                      : 0
                    const config = statusConfig[escrow.status]
                    
                    return (
                      <TableRow key={escrow.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                              <Trophy className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{escrow.tournaments?.name}</p>
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {escrow.tournaments?.status}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(escrow.tournaments?.prize_pool_cents || 0)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-500">
                          {formatCurrency(escrow.funded_amount_cents)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={releasePercent} className="h-2 w-20" />
                            <span className="text-xs text-muted-foreground">{Math.round(releasePercent)}%</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatCurrency(escrow.released_amount_cents)} released
                          </p>
                        </TableCell>
                        <TableCell>
                          {config && (
                            <Badge variant="outline" className={cn("flex w-fit items-center gap-1", config.color)}>
                              {config.icon}
                              {config.label}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(escrow.tournaments?.start_date).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          {escrow.status === "funded" && escrow.tournaments?.status === "completed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                setSelectedEscrow(escrow)
                                setReleaseDialogOpen(true)
                              }}
                            >
                              Release
                              <ArrowRight className="ml-1 h-3 w-3" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Release Confirmation Dialog */}
      <Dialog open={releaseDialogOpen} onOpenChange={setReleaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release Escrow Funds</DialogTitle>
            <DialogDescription>
              This will release the escrowed funds for prize distribution. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedEscrow && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Trophy className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{selectedEscrow.tournaments?.name}</p>
                    <p className="text-xs text-muted-foreground">Tournament Escrow</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Funded:</span>
                    <span className="font-medium">{formatCurrency(selectedEscrow.funded_amount_cents)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Already Released:</span>
                    <span className="font-medium">{formatCurrency(selectedEscrow.released_amount_cents)}</span>
                  </div>
                  <div className="border-t border-border pt-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Amount to Release:</span>
                      <span className="font-bold text-emerald-500">
                        {formatCurrency(selectedEscrow.funded_amount_cents - selectedEscrow.released_amount_cents)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                  <p className="text-sm text-amber-500">
                    Make sure all tournament results have been verified before releasing funds.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReleaseEscrow}
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Releasing...
                </>
              ) : (
                <>
                  <Unlock className="mr-2 h-4 w-4" />
                  Release Funds
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
