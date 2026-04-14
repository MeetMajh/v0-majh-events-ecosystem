"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  Search,
  Trophy,
  Wallet,
  CheckCircle,
  Clock,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Payout {
  id: string
  tournament_id: string
  user_id: string
  position: number
  amount_cents: number
  status: string
  paid_at: string | null
  created_at: string
  tournaments: {
    title: string
  } | null
  profiles: {
    display_name: string | null
    email: string | null
  } | null
}

export function PayoutsManager({ payouts }: { payouts: Payout[] }) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  const getPositionBadge = (position: number) => {
    if (position === 1) {
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">1st</Badge>
    }
    if (position === 2) {
      return <Badge className="bg-zinc-400/20 text-zinc-300 border-zinc-400/30">2nd</Badge>
    }
    if (position === 3) {
      return <Badge className="bg-orange-700/20 text-orange-400 border-orange-700/30">3rd</Badge>
    }
    return <Badge className="bg-zinc-700/20 text-zinc-400 border-zinc-700/30">{position}th</Badge>
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      failed: "bg-red-500/20 text-red-400 border-red-500/30",
    }
    return <Badge className={styles[status] || "bg-zinc-500/20 text-zinc-400"}>{status}</Badge>
  }

  const filteredPayouts = payouts.filter((p) => {
    const matchesSearch = 
      p.tournaments?.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.profiles?.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.profiles?.email?.toLowerCase().includes(search.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || p.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const totalPaid = payouts
    .filter(p => p.status === "completed")
    .reduce((sum, p) => sum + p.amount_cents, 0)
  
  const pendingTotal = payouts
    .filter(p => p.status === "pending")
    .reduce((sum, p) => sum + p.amount_cents, 0)

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span className="text-sm text-zinc-400">Total Paid Out</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="text-sm text-zinc-400">Pending Payouts</span>
            </div>
            <p className="text-2xl font-bold text-amber-400">{formatCurrency(pendingTotal)}</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-purple-400" />
              <span className="text-sm text-zinc-400">Total Winners</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">{payouts.length}</p>
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
                placeholder="Search by tournament or user..."
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
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Zap className="h-4 w-4 mr-2" />
              Process All Pending
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payouts Table */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-zinc-100">Tournament Payouts</CardTitle>
          <CardDescription className="text-zinc-500">
            {filteredPayouts.length} payout records
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPayouts.length > 0 ? (
            <div className="rounded-lg border border-zinc-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Tournament</TableHead>
                    <TableHead className="text-zinc-400">User</TableHead>
                    <TableHead className="text-zinc-400">Position</TableHead>
                    <TableHead className="text-zinc-400 text-right">Amount</TableHead>
                    <TableHead className="text-zinc-400">Status</TableHead>
                    <TableHead className="text-zinc-400">Paid At</TableHead>
                    <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayouts.map((p) => (
                    <TableRow key={p.id} className="border-zinc-800 hover:bg-zinc-800/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-purple-400" />
                          <span className="text-zinc-100 text-sm">
                            {p.tournaments?.title || "Unknown Tournament"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-zinc-100 text-sm font-medium">
                            {p.profiles?.display_name || "Unknown"}
                          </p>
                          <p className="text-zinc-500 text-xs">{p.profiles?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getPositionBadge(p.position)}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-purple-400">
                        +{formatCurrency(p.amount_cents)}
                      </TableCell>
                      <TableCell>{getStatusBadge(p.status)}</TableCell>
                      <TableCell className="text-zinc-400 text-sm">
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.status === "pending" && (
                          <Button 
                            size="sm" 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-8"
                          >
                            <Wallet className="h-3 w-3 mr-1" />
                            Pay
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Trophy className="h-12 w-12 mb-4" />
              <p>No payouts found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
