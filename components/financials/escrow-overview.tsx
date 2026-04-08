"use client"

import { useState, useTransition } from "react"
import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, Shield, Unlock, AlertTriangle, Trophy, Calendar } from "lucide-react"
import { toast } from "sonner"

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

export function EscrowOverview() {
  const { data, error, isLoading, mutate } = useSWR<{ escrows: EscrowAccount[] }>(
    "/api/admin/escrow/list",
    fetcher,
    { refreshInterval: 60000 }
  )
  const [isPending, startTransition] = useTransition()
  const [selectedEscrow, setSelectedEscrow] = useState<EscrowAccount | null>(null)
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false)

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Pending Funding</Badge>
      case "funded":
        return <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50"><Shield className="mr-1 h-3 w-3" />Funded</Badge>
      case "partially_released":
        return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50"><Unlock className="mr-1 h-3 w-3" />Partially Released</Badge>
      case "released":
        return <Badge variant="secondary">Released</Badge>
      case "disputed":
        return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Disputed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Escrow Accounts</CardTitle>
          <CardDescription>
            Tournament prize pools held in escrow
          </CardDescription>
        </CardHeader>
        <CardContent>
          {escrows.length === 0 ? (
            <div className="py-8 text-center">
              <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No active escrow accounts</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tournament</TableHead>
                  <TableHead>Prize Pool</TableHead>
                  <TableHead>Funded</TableHead>
                  <TableHead>Released</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {escrows.map((escrow) => {
                  const releasePercent = escrow.funded_amount_cents > 0
                    ? (escrow.released_amount_cents / escrow.funded_amount_cents) * 100
                    : 0
                  
                  return (
                    <TableRow key={escrow.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-sm font-medium">{escrow.tournaments?.name}</p>
                            <Badge variant="outline" className="text-[10px]">
                              {escrow.tournaments?.status}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(escrow.tournaments?.prize_pool_cents || 0)}
                      </TableCell>
                      <TableCell className="font-medium text-emerald-600">
                        {formatCurrency(escrow.funded_amount_cents)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm">{formatCurrency(escrow.released_amount_cents)}</p>
                          <Progress value={releasePercent} className="h-1 w-20" />
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(escrow.status)}</TableCell>
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
                            onClick={() => {
                              setSelectedEscrow(escrow)
                              setReleaseDialogOpen(true)
                            }}
                          >
                            Release
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
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
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium">{selectedEscrow.tournaments?.name}</p>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount to release:</span>
                  <span className="font-medium text-emerald-600">
                    {formatCurrency(selectedEscrow.funded_amount_cents - selectedEscrow.released_amount_cents)}
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-800">
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
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Releasing...
                </>
              ) : (
                "Release Funds"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
