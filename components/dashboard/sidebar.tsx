"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  User,
  Gift,
  Gamepad2,
  UtensilsCrossed,
  CalendarCheck,
  Monitor,
  LogOut,
  ShieldCheck,
  Package,
  ClipboardList,
  Warehouse,
  Users,
  CreditCard,
  Truck,
  FileText,
  Receipt,
  UserCheck,
  Clock,
  BarChart3,
  Boxes,
  Filter,
  Mail,
  Settings,
  Newspaper,
  Trophy,
  MessageSquare,
  Joystick,
  Wallet,
  DollarSign,
  Megaphone,
  Radio,
  TrendingUp,
  Activity,
  Tv,
} from "lucide-react"
import { signOut } from "@/lib/actions"
import { Button } from "@/components/ui/button"

const NAV_ITEMS = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Profile", href: "/dashboard/profile", icon: User },
  { label: "Go Live", href: "/dashboard/stream", icon: Radio },
  { label: "Points & Rewards", href: "/dashboard/rewards", icon: Gift },
  { label: "My Orders", href: "/dashboard/orders", icon: UtensilsCrossed },
  { label: "Esports", href: "/esports", icon: Gamepad2 },
  { label: "My Events", href: "/dashboard/my-events", icon: CalendarCheck },
  { label: "My Bookings", href: "/dashboard/my-bookings", icon: CalendarCheck },
  { label: "Player Portal", href: "/dashboard/player-portal", icon: Joystick },
  { label: "Player Controller", href: "/dashboard/player-controller", icon: Gamepad2 },
  { label: "My Rentals", href: "/dashboard/rentals", icon: Monitor },
]

const ADMIN_ITEMS = [
  { label: "Admin Overview", href: "/dashboard/admin", icon: ShieldCheck },
  { label: "Site Settings", href: "/dashboard/admin/site", icon: Settings },
  { label: "Tournaments", href: "/dashboard/admin/tournaments", icon: Trophy },
  { label: "TO Requests", href: "/dashboard/admin/organizers", icon: UserCheck },
  { label: "News Articles", href: "/dashboard/admin/news", icon: Newspaper },
  { label: "Menu Items", href: "/dashboard/admin/menu", icon: Package },
  { label: "Inventory", href: "/dashboard/admin/inventory", icon: Warehouse },
  { label: "Orders", href: "/dashboard/admin/orders", icon: ClipboardList },
  { label: "POS Terminal", href: "/dashboard/pos", icon: CreditCard },
  { label: "All Users", href: "/dashboard/admin/users", icon: UserCheck },
  { label: "Staff", href: "/dashboard/admin/staff", icon: Users },
]

const CARBARDMV_ITEMS = [
  { label: "CB Overview", href: "/dashboard/carbardmv", icon: Truck },
  { label: "Event Bookings", href: "/dashboard/carbardmv/events", icon: CalendarCheck },
  { label: "Catering", href: "/dashboard/carbardmv/catering", icon: UtensilsCrossed },
  { label: "Rentals", href: "/dashboard/carbardmv/rentals", icon: Monitor },
  { label: "Clients (CRM)", href: "/dashboard/carbardmv/clients", icon: UserCheck },
  { label: "Segments", href: "/dashboard/carbardmv/segments", icon: Filter },
  { label: "Marketing", href: "/dashboard/carbardmv/marketing", icon: Mail },
  { label: "Proposals", href: "/dashboard/carbardmv/proposals", icon: FileText },
  { label: "Invoices", href: "/dashboard/carbardmv/invoices", icon: Receipt },
  { label: "Staff Schedule", href: "/dashboard/carbardmv/staff", icon: Clock },
  { label: "Prep Lists", href: "/dashboard/carbardmv/prep", icon: ClipboardList },
  { label: "Inventory", href: "/dashboard/carbardmv/inventory", icon: Boxes },
  { label: "Reports", href: "/dashboard/carbardmv/reports", icon: BarChart3 },
]

const TOURNAMENT_ITEMS = [
  { label: "My Tournaments", href: "/dashboard/tournaments", icon: Trophy },
  { label: "Create Tournament", href: "/dashboard/tournaments/new", icon: CalendarCheck },
]

const FINANCIAL_ITEMS = [
  { label: "Wallet & Earnings", href: "/dashboard/financials", icon: Wallet },
  { label: "Withdraw", href: "/dashboard/financials/withdraw", icon: DollarSign },
  { label: "Payout Methods", href: "/dashboard/financials/payout-methods", icon: CreditCard },
]

const SETTINGS_ITEMS = [
  { label: "Identity Verification", href: "/dashboard/settings/verification", icon: ShieldCheck },
]

const ADMIN_FINANCIAL_ITEMS = [
  { label: "Financial Overview", href: "/dashboard/admin/financials", icon: DollarSign },
  { label: "Compliance", href: "/dashboard/admin/compliance", icon: ShieldCheck },
  { label: "Stream Sources", href: "/dashboard/admin/streams", icon: Tv },
  { label: "Broadcast Control", href: "/dashboard/admin/broadcast", icon: Radio },
  { label: "Ops Command Center", href: "/dashboard/admin/ops", icon: Activity },
]

const ADS_ITEMS = [
  { label: "Ads Manager", href: "/dashboard/ads", icon: Megaphone },
  { label: "Create Campaign", href: "/dashboard/ads/create", icon: Megaphone },
]

const CREATOR_ITEMS = [
  { label: "Creator Analytics", href: "/dashboard/creator/analytics", icon: TrendingUp },
]

export function DashboardSidebar({
  displayName,
  email,
  userRole,
  isOrganizer = false,
}: {
  displayName: string
  email: string
  userRole?: string | null
  isOrganizer?: boolean
}) {
  const pathname = usePathname()
  const isStaff = userRole === "owner" || userRole === "manager" || userRole === "staff"
  const canOrganize = isStaff || userRole === "organizer" || isOrganizer
  const isManager = userRole === "owner" || userRole === "manager"

  const adminItems = isStaff
    ? ADMIN_ITEMS.filter((item) => {
        // Staff and Users pages only for owners and managers
        if (item.href === "/dashboard/admin/staff" && !isManager) return false
        if (item.href === "/dashboard/admin/users" && !isManager) return false
        // Menu and Inventory management only for owners/managers
        if (item.href === "/dashboard/admin/menu" && userRole === "staff") return false
        if (item.href === "/dashboard/admin/inventory" && userRole === "staff") return false
        return true
      })
    : []

  const carbardmvItems = isStaff ? CARBARDMV_ITEMS : []
  const tournamentItems = canOrganize ? TOURNAMENT_ITEMS : []

  return (
    <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="p-4">
        <Logo />
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2" aria-label="Dashboard navigation">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.disabled ? "#" : item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                item.disabled && "pointer-events-none opacity-40"
              )}
              aria-current={isActive ? "page" : undefined}
              aria-disabled={item.disabled}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {item.disabled && (
                <span className="ml-auto rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] text-sidebar-foreground/50">
                  Soon
                </span>
              )}
            </Link>
          )
        })}

        {tournamentItems.length > 0 && (
          <>
            <div className="my-3 border-t border-sidebar-border" />
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              Tournament Organizing
            </p>
            {tournamentItems.map((item) => {
              const isActive = item.href === "/dashboard/tournaments"
                ? pathname === "/dashboard/tournaments"
                : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </>
        )}

        {/* Ads Manager - visible to organizers */}
        {canOrganize && (
          <>
            <div className="my-3 border-t border-sidebar-border" />
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              Advertising
            </p>
            {ADS_ITEMS.map((item) => {
              const isActive = item.href === "/dashboard/ads"
                ? pathname === "/dashboard/ads"
                : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </>
        )}

        {/* Financials Section - visible to all users */}
        <div className="my-3 border-t border-sidebar-border" />
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          Financials
        </p>
        {FINANCIAL_ITEMS.map((item) => {
          const isActive = item.href === "/dashboard/financials"
            ? pathname === "/dashboard/financials"
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}

        {/* Creator Section */}
        <div className="my-3 border-t border-sidebar-border" />
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          Creator
        </p>
        {CREATOR_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}

        {/* Settings Section */}
        <div className="my-3 border-t border-sidebar-border" />
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          Settings
        </p>
        {SETTINGS_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}

        {adminItems.length > 0 && (
          <>
            <div className="my-3 border-t border-sidebar-border" />
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              Staff
            </p>
            {adminItems.map((item) => {
              const isActive = item.href === "/dashboard/admin"
                ? pathname === "/dashboard/admin"
                : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
            {/* Admin Financial Items */}
            {ADMIN_FINANCIAL_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </>
        )}

        {carbardmvItems.length > 0 && (
          <>
            <div className="my-3 border-t border-sidebar-border" />
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              CARBARDMV
            </p>
            {carbardmvItems.map((item) => {
              const isActive = item.href === "/dashboard/carbardmv"
                ? pathname === "/dashboard/carbardmv"
                : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-sidebar-foreground">{displayName}</p>
            {userRole && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {userRole}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-sidebar-foreground/50">{email}</p>
        </div>
        <form action={signOut}>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </form>
      </div>
    </aside>
  )
}
