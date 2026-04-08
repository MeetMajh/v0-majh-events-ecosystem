"use client"

import { useState, useTransition } from "react"
import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Loader2, MoreHorizontal, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

interface PendingPayout {
  id: string
  user_id: string
  tournament_id: string
  gross_amount_cents: number
  platform_fee_cents: number
  net_amount_cents: number
  placement: number
  payout_method: string
  status: string
  created_at: string
  profiles: {
    display_name: string
    avatar_url: string | null
    kyc_verified: boolean
    stripe_connect_status: string | null
  }
  tournaments: {
    name: string
  }
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function AdminPayoutQueue() {
  const { data, error, isLoading, mutate } = useSWR<{ payouts: PendingPayout[] }>(
    "/api/admin/payouts/pending",
    fetcher,
    { refreshInterval: 30000 }
  )
  const [isPending, startTransition] = useTransition()
  const [processingId, setProcessingId] = useState<string | null>(null)

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  const handleApprovePayout = async (payoutId: string) => {
    setProcessingId(payoutId)
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/payouts/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payoutId }),
        })
        
        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.message || "Failed to approve payout")
        }

        toast.success("Payout approved and processing")
        mutate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to approve payout")
      } finally {
        setProcessingId(null)
      }
    })
  }

  const handleRejectPayout = async (payoutId: string, reason: string) => {
    setProcessingId(payoutId)
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/payouts/reject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payoutId, reason }),
        })
        
        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.message || "Failed to reject payout")
        }

        toast.success("Payout rejected")
        mutate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to reject payout")
      } finally {
        setProcessingId(null)
      }
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50"><Clock className="mr-1 h-3 w-3" />Pending</Badge>
      case "approved":
        return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Approved</Badge>
      case "processing":
        return <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Processing</Badge>
      case "completed":
        return <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50"><CheckCircle className="mr-1 h-3 w-3" />Completed</Badge>
      case "failed":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Failed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
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
          <p className="text-sm text-destructive">Failed to load payout queue</p>
        </CardContent>
      </Card>
    )
  }

  const payouts = data?.payouts || []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Payouts</CardTitle>
        <CardDescription>
          Review and process player prize payouts
        </CardDescription>
      </CardHeader>
      <CardContent>
        {payouts.length === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
            <p className="mt-2 text-sm text-muted-foreground">All payouts processed</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Tournament</TableHead>
                <TableHead>Placement</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((payout) => (
                <TableRow key={payout.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={payout.profiles?.avatar_url || undefined} />
                        <AvatarFallback>
                          {payout.profiles?.display_name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{payout.profiles?.display_name}</p>
                        <div className="flex items-center gap-1">
                          {payout.profiles?.kyc_verified ? (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 text-emerald-600">KYC</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600">No KYC</Badge>
                          )}
                          {payout.profiles?.stripe_connect_status === "complete" ? (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 text-emerald-600">Stripe</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600">No Stripe</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{payout.tournaments?.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">#{payout.placement}</Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{formatCurrency(payout.net_amount_cents)}</p>
                      <p className="text-xs text-muted-foreground">
                        Fee: {formatCurrency(payout.platform_fee_cents)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize text-sm">{payout.payout_method?.replace("_", " ")}</TableCell>
                  <TableCell>{getStatusBadge(payout.status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          disabled={processingId === payout.id}
                        >
                          {processingId === payout.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => handleApprovePayout(payout.id)}
                          disabled={!payout.profiles?.kyc_verified || payout.profiles?.stripe_connect_status !== "complete"}
                        >
                          <CheckCircle className="mr-2 h-4 w-4 text-emerald-500" />
                          Approve Payout
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleRejectPayout(payout.id, "Failed verification")}
                          className="text-destructive"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
