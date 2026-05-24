"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { format, subDays } from "date-fns"
import { CalendarIcon, Plus, Settings, Download } from "lucide-react"
import type { DateRange } from "react-day-picker"

interface AdsManagerHeaderProps {
  overview: {
    account: {
      id: string
      account_name: string
      balance_cents: number
      status: string
    }
    counts: {
      campaigns: number
      activeCampaigns: number
      adSets: number
      activeAdSets: number
      ads: number
      activeAds: number
    }
    today: {
      spend: number
      impressions: number
      clicks: number
    }
  } | null
}

export function AdsManagerHeader({ overview }: AdsManagerHeaderProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  })

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(num)
  }

  return (
    <div className="border-b border-border bg-card">
      {/* Top row - Account info + Actions */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">Ads Manager</h1>
          
          {overview?.account && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{overview.account.account_name}</span>
              <span className="text-muted-foreground">|</span>
              <span>Balance: {formatCurrency(overview.account.balance_cents)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d")}
                    </>
                  ) : (
                    format(dateRange.from, "MMM d, yyyy")
                  )
                ) : (
                  "Select dates"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>

          <Link href="/dashboard/ads/settings">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>

          <Link href="/dashboard/ads/create">
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Create
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats row */}
      {overview && (
        <div className="flex items-center gap-8 px-4 py-3 text-sm">
          <div>
            <span className="text-muted-foreground">Today&apos;s Spend</span>
            <p className="text-lg font-semibold text-foreground">{formatCurrency(overview.today.spend)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Impressions</span>
            <p className="text-lg font-semibold text-foreground">{formatNumber(overview.today.impressions)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Clicks</span>
            <p className="text-lg font-semibold text-foreground">{formatNumber(overview.today.clicks)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">CTR</span>
            <p className="text-lg font-semibold text-foreground">
              {overview.today.impressions > 0 
                ? ((overview.today.clicks / overview.today.impressions) * 100).toFixed(2)
                : "0.00"
              }%
            </p>
          </div>
          <div className="ml-auto flex items-center gap-6 text-muted-foreground">
            <span>{overview.counts.activeCampaigns} / {overview.counts.campaigns} Campaigns</span>
            <span>{overview.counts.activeAdSets} / {overview.counts.adSets} Ad Sets</span>
            <span>{overview.counts.activeAds} / {overview.counts.ads} Ads</span>
          </div>
        </div>
      )}
    </div>
  )
}
