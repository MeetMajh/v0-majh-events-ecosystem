"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { 
  Hash, 
  Megaphone,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Users,
  Gamepad2,
  Calendar,
  Lock,
} from "lucide-react"
import { useState } from "react"

type Room = {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  room_type: string
  category: string
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  general: { label: "General", icon: MessageSquare },
  gaming: { label: "Gaming", icon: Gamepad2 },
  events: { label: "Events", icon: Calendar },
  official: { label: "Official", icon: Megaphone },
}

const ROOM_ICONS: Record<string, React.ElementType> = {
  public: Hash,
  private: Lock,
  announcement: Megaphone,
}

export function ChatSidebar({ 
  roomsByCategory,
  isAuthenticated,
}: { 
  roomsByCategory: Record<string, Room[]>
  isAuthenticated: boolean
}) {
  const pathname = usePathname()
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    general: true,
    gaming: true,
    events: true,
    official: true,
  })

  function toggleCategory(category: string) {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  const categoryOrder = ["official", "general", "gaming", "events"]
  const sortedCategories = Object.entries(roomsByCategory).sort(([a], [b]) => {
    return categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  })

  return (
    <aside className="flex w-60 flex-col border-r border-border bg-card/50">
      <div className="border-b border-border p-4">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <Users className="h-4 w-4 text-primary" />
          Community Chat
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Connect with the MAJH community
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {sortedCategories.map(([category, rooms]) => {
          const config = CATEGORY_CONFIG[category] || { 
            label: category.charAt(0).toUpperCase() + category.slice(1), 
            icon: Hash 
          }
          const isExpanded = expandedCategories[category]

          return (
            <div key={category} className="mb-2">
              <button
                onClick={() => toggleCategory(category)}
                className="flex w-full items-center gap-1 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {config.label}
              </button>

              {isExpanded && (
                <div className="space-y-0.5">
                  {rooms.map((room) => {
                    const isActive = pathname === `/community/chat/${room.slug}`
                    const Icon = ROOM_ICONS[room.room_type] || Hash

                    return (
                      <Link
                        key={room.id}
                        href={`/community/chat/${room.slug}`}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0 opacity-70" />
                        <span className="truncate">{room.name}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {!isAuthenticated && (
        <div className="border-t border-border p-4">
          <p className="text-xs text-muted-foreground">
            <Link href="/auth/sign-in" className="text-primary hover:underline">
              Sign in
            </Link>{" "}
            to join the conversation
          </p>
        </div>
      )}
    </aside>
  )
}
