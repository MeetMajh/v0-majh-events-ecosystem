"use client"

import { Home, Play, PlusSquare, Trophy, User, Bell } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { useNotificationCount } from "@/hooks/use-notifications"

const tabs = [
  { href: "/esports", icon: Home, label: "Home" },
  { href: "/clips", icon: Play, label: "Clips" },
  { href: "/create", icon: PlusSquare, label: "Create", highlight: true },
  { href: "/esports/tournaments", icon: Trophy, label: "Tourneys" },
  { href: "/profile", icon: User, label: "Profile" },
]

// Routes that use full-screen immersive UI
const IMMERSIVE_ROUTES = ["/clips", "/match/"]

export function MobileNav() {
  const pathname = usePathname()
  const { count: notificationCount } = useNotificationCount()

  // Hide on immersive routes
  const isImmersive = IMMERSIVE_ROUTES.some(route => pathname.startsWith(route))
  if (isImmersive) return null

  // Haptic feedback on tap
  const triggerHaptic = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10)
    }
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 glass-panel-darker border-t border-border/30 flex justify-around items-center z-50 md:hidden safe-area-bottom">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/")

        return (
          <Link
            key={tab.href}
            href={tab.href}
            onClick={triggerHaptic}
            className="relative flex flex-col items-center justify-center w-16 h-full"
          >
            {/* Active indicator */}
            {isActive && (
              <motion.div
                layoutId="mobile-nav-indicator"
                className="absolute -top-0.5 w-8 h-1 bg-primary rounded-full"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}

            {/* Icon container */}
            <div
              className={cn(
                "flex items-center justify-center transition-all duration-200",
                tab.highlight
                  ? "bg-primary text-primary-foreground rounded-xl p-2.5 -mt-4 shadow-lg shadow-primary/30"
                  : isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5", tab.highlight && "w-6 h-6")} />
            </div>

            {/* Label */}
            {!tab.highlight && (
              <span
                className={cn(
                  "text-[10px] mt-0.5 transition-colors",
                  isActive ? "text-primary font-medium" : "text-muted-foreground"
                )}
              >
                {tab.label}
              </span>
            )}

            {/* Notification badge for profile */}
            {tab.href === "/profile" && notificationCount > 0 && (
              <span className="absolute top-1.5 right-2.5 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

// Spacer to prevent content from being hidden behind mobile nav
export function MobileNavSpacer() {
  const pathname = usePathname()
  const isImmersive = IMMERSIVE_ROUTES.some(route => pathname.startsWith(route))
  if (isImmersive) return null
  
  return <div className="h-16 md:hidden" />
}
