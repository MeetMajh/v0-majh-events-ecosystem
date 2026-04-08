"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

interface AdsManagerTabsProps {
  activeTab: string
}

const tabs = [
  { id: "campaigns", label: "Campaigns" },
  { id: "adsets", label: "Ad Sets" },
  { id: "ads", label: "Ads" },
]

export function AdsManagerTabs({ activeTab }: AdsManagerTabsProps) {
  const searchParams = useSearchParams()
  
  const createTabUrl = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", tabId)
    // Clear child filters when switching tabs
    if (tabId === "campaigns") {
      params.delete("campaign")
      params.delete("adset")
    } else if (tabId === "adsets") {
      params.delete("adset")
    }
    return `/dashboard/ads?${params.toString()}`
  }

  return (
    <div className="border-b border-border bg-card">
      <div className="flex items-center px-4">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={createTabUrl(tab.id)}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
