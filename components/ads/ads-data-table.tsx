"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { 
  Search, Filter, MoreHorizontal, ChevronRight, 
  Play, Pause, Copy, Trash2, BarChart3, Edit, Eye
} from "lucide-react"
import { bulkUpdateStatus, bulkDelete, updateCampaign, updateAdSet, updateAd } from "@/lib/ads-manager-actions"

interface AdsDataTableProps {
  type: "campaigns" | "adsets" | "ads"
  data: any[]
  parentFilter?: string
}

const columns = {
  campaigns: [
    { key: "name", label: "Campaign Name", width: "w-[280px]" },
    { key: "status", label: "Status", width: "w-[100px]" },
    { key: "budget", label: "Budget", width: "w-[120px]" },
    { key: "spend", label: "Spend", width: "w-[100px]" },
    { key: "impressions", label: "Impressions", width: "w-[110px]" },
    { key: "clicks", label: "Clicks", width: "w-[80px]" },
    { key: "ctr", label: "CTR", width: "w-[80px]" },
    { key: "conversions", label: "Conv.", width: "w-[80px]" },
    { key: "actions", label: "", width: "w-[50px]" },
  ],
  adsets: [
    { key: "name", label: "Ad Set Name", width: "w-[280px]" },
    { key: "status", label: "Status", width: "w-[100px]" },
    { key: "budget", label: "Budget", width: "w-[120px]" },
    { key: "spend", label: "Spend", width: "w-[100px]" },
    { key: "impressions", label: "Impressions", width: "w-[110px]" },
    { key: "clicks", label: "Clicks", width: "w-[80px]" },
    { key: "ctr", label: "CTR", width: "w-[80px]" },
    { key: "conversions", label: "Conv.", width: "w-[80px]" },
    { key: "actions", label: "", width: "w-[50px]" },
  ],
  ads: [
    { key: "name", label: "Ad Name", width: "w-[280px]" },
    { key: "status", label: "Status", width: "w-[100px]" },
    { key: "format", label: "Format", width: "w-[100px]" },
    { key: "spend", label: "Spend", width: "w-[100px]" },
    { key: "impressions", label: "Impressions", width: "w-[110px]" },
    { key: "clicks", label: "Clicks", width: "w-[80px]" },
    { key: "ctr", label: "CTR", width: "w-[80px]" },
    { key: "conversions", label: "Conv.", width: "w-[80px]" },
    { key: "actions", label: "", width: "w-[50px]" },
  ],
}

export function AdsDataTable({ type, data, parentFilter }: AdsDataTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const currentColumns = columns[type]

  // Filter data
  const filteredData = data.filter(item => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (item.status === "deleted") return false
    return true
  })

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num)
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredData.map(item => item.id)))
    }
  }

  const handleBulkAction = async (action: string) => {
    if (selectedIds.size === 0) return

    startTransition(async () => {
      const ids = Array.from(selectedIds)
      
      if (action === "pause") {
        await bulkUpdateStatus(type, ids, "paused")
      } else if (action === "activate") {
        await bulkUpdateStatus(type, ids, "active")
      } else if (action === "delete") {
        await bulkDelete(type, ids)
      }
      
      setSelectedIds(new Set())
      router.refresh()
    })
  }

  const handleStatusToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active"
    
    startTransition(async () => {
      if (type === "campaigns") {
        await updateCampaign(id, { status: newStatus })
      } else if (type === "adsets") {
        await updateAdSet(id, { status: newStatus })
      } else {
        await updateAd(id, { status: newStatus })
      }
      router.refresh()
    })
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      paused: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      draft: "bg-muted text-muted-foreground border-muted",
      archived: "bg-muted text-muted-foreground border-muted",
      pending_review: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      rejected: "bg-destructive/10 text-destructive border-destructive/20",
    }
    
    return (
      <Badge variant="outline" className={cn("capitalize", variants[status] || variants.draft)}>
        {status.replace("_", " ")}
      </Badge>
    )
  }

  const getDrillDownUrl = (item: any) => {
    if (type === "campaigns") {
      return `/dashboard/ads?tab=adsets&campaign=${item.id}`
    } else if (type === "adsets") {
      return `/dashboard/ads?tab=ads&adset=${item.id}`
    }
    return null
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${type}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              {type === "ads" && <SelectItem value="pending_review">Pending Review</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
            <Button variant="outline" size="sm" onClick={() => handleBulkAction("activate")} disabled={isPending}>
              <Play className="h-4 w-4 mr-1" />
              Activate
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkAction("pause")} disabled={isPending}>
              <Pause className="h-4 w-4 mr-1" />
              Pause
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkAction("delete")} disabled={isPending} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[40px_1fr] bg-muted/30 border-b border-border">
          <div className="flex items-center justify-center py-3">
            <Checkbox 
              checked={selectedIds.size === filteredData.length && filteredData.length > 0}
              onCheckedChange={toggleSelectAll}
            />
          </div>
          <div className="flex items-center">
            {currentColumns.map((col) => (
              <div 
                key={col.key}
                className={cn(
                  "px-3 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider",
                  col.width
                )}
              >
                {col.label}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        {filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-4 opacity-20" />
            <p>No {type} found</p>
            <Link href="/dashboard/ads/create">
              <Button variant="link" className="mt-2">Create your first {type.slice(0, -1)}</Button>
            </Link>
          </div>
        ) : (
          filteredData.map((item) => (
            <div 
              key={item.id}
              className="grid grid-cols-[40px_1fr] border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center justify-center py-3">
                <Checkbox 
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={() => toggleSelect(item.id)}
                />
              </div>
              <div className="flex items-center">
                {/* Name column */}
                <div className={cn("px-3 py-3 flex items-center gap-2", currentColumns[0].width)}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">{item.name}</span>
                      {getDrillDownUrl(item) && (
                        <Link href={getDrillDownUrl(item)!}>
                          <ChevronRight className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        </Link>
                      )}
                    </div>
                    {item.objective && (
                      <span className="text-xs text-muted-foreground capitalize">{item.objective}</span>
                    )}
                  </div>
                </div>

                {/* Status column */}
                <div className={cn("px-3 py-3 flex items-center gap-2", currentColumns[1].width)}>
                  <Switch
                    checked={item.status === "active"}
                    onCheckedChange={() => handleStatusToggle(item.id, item.status)}
                    disabled={isPending || item.status === "pending_review"}
                    className="scale-75"
                  />
                  {getStatusBadge(item.status)}
                </div>

                {/* Budget or Format column */}
                {type !== "ads" ? (
                  <div className={cn("px-3 py-3 text-sm", currentColumns[2].width)}>
                    <span className="text-foreground">{formatCurrency(item.budget_cents || 0)}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      /{item.budget_type === "lifetime" ? "lifetime" : "day"}
                    </span>
                  </div>
                ) : (
                  <div className={cn("px-3 py-3 text-sm capitalize", currentColumns[2].width)}>
                    {item.format}
                  </div>
                )}

                {/* Spend */}
                <div className={cn("px-3 py-3 text-sm", currentColumns[3].width)}>
                  {formatCurrency(item.spend_cents || 0)}
                </div>

                {/* Impressions */}
                <div className={cn("px-3 py-3 text-sm", currentColumns[4].width)}>
                  {formatNumber(item.impressions || 0)}
                </div>

                {/* Clicks */}
                <div className={cn("px-3 py-3 text-sm", currentColumns[5].width)}>
                  {formatNumber(item.clicks || 0)}
                </div>

                {/* CTR */}
                <div className={cn("px-3 py-3 text-sm", currentColumns[6].width)}>
                  {item.impressions > 0 
                    ? ((item.clicks / item.impressions) * 100).toFixed(2) 
                    : "0.00"
                  }%
                </div>

                {/* Conversions */}
                <div className={cn("px-3 py-3 text-sm", currentColumns[7].width)}>
                  {formatNumber(item.conversions || 0)}
                </div>

                {/* Actions */}
                <div className={cn("px-3 py-3", currentColumns[8].width)}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        View Analytics
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Showing {filteredData.length} of {data.length} {type}</span>
      </div>
    </div>
  )
}
