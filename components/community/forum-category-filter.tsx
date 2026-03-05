"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "general", label: "General" },
  { key: "match_discussion", label: "Match Discussion" },
  { key: "lfg", label: "Looking for Group" },
  { key: "announcements", label: "Announcements" },
  { key: "off_topic", label: "Off Topic" },
]

export function ForumCategoryFilter({ current }: { current?: string }) {
  const router = useRouter()
  const active = current || "all"

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.key}
          onClick={() => {
            const params = cat.key === "all" ? "/community" : `/community?category=${cat.key}`
            router.push(params)
          }}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            active === cat.key
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:border-primary/30"
          )}
        >
          {cat.label}
        </button>
      ))}
    </div>
  )
}
