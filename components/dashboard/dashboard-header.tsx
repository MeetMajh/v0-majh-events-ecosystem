"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/actions"
import {
  Menu,
  X,
  LayoutDashboard,
  User,
  Gift,
  Gamepad2,
  UtensilsCrossed,
  CalendarCheck,
  Monitor,
  LogOut,
} from "lucide-react"

const NAV_ITEMS = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Profile", href: "/dashboard/profile", icon: User },
  { label: "Points & Rewards", href: "/dashboard/rewards", icon: Gift },
  { label: "My Orders", href: "/dashboard/orders", icon: UtensilsCrossed },
  { label: "Esports", href: "/dashboard/esports", icon: Gamepad2, disabled: true },
  { label: "My Events", href: "/dashboard/events", icon: CalendarCheck, disabled: true },
  { label: "My Rentals", href: "/dashboard/rentals", icon: Monitor, disabled: true },
]

export function DashboardHeader({ displayName }: { displayName: string }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4 md:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <h1 className="text-sm font-medium text-foreground">
          Welcome back, <span className="text-primary">{displayName}</span>
        </h1>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 top-14 z-50 bg-background/95 p-4 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile dashboard navigation">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.disabled ? "#" : item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    item.disabled && "pointer-events-none opacity-40"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
            <form action={signOut} className="mt-4 border-t border-border pt-4">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </form>
          </nav>
        </div>
      )}
    </header>
  )
}
