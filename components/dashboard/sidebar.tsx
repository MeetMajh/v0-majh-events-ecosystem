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
  Joystick,
  Wallet,
  DollarSign,
  Megaphone,
  Video,
  TrendingUp,
  Activity,
  Radio,
  Tv,
  Sliders,
  Ticket,
  QrCode,
  Key,
  Shield,
  type LucideIcon,
} from "lucide-react"
import { signOut } from "@/lib/actions"
import { Button } from "@/components/ui/button"
import { getRoleDisplayName, getRoleBadgeColor } from "@/lib/authorization-shared"

// Types for navigation items
interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  disabled?: boolean
}

interface NavSection {
  id: string
  title: string
  items: NavItem[]
  // Function to determine if this section should be visible
  isVisible: (permissions: SidebarPermissions) => boolean
  // Function to filter items based on permissions
  filterItems?: (items: NavItem[], permissions: SidebarPermissions) => NavItem[]
}

// Permission flags passed from server component
export interface SidebarPermissions {
  isStaff: boolean
  isManager: boolean
  isOwner: boolean
  canOrganize: boolean
  canManageUsers: boolean
  canManageFinancials: boolean
  canAccessAdmin: boolean
  canAccessCarBardMV: boolean
  canManagePermissions: boolean
  canCreateBroadcasts: boolean
  isPlatformLevel: boolean
  isTenantLevel: boolean
}

// Base navigation items (visible to all users)
const BASE_NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Profile", href: "/dashboard/profile", icon: User },
  { label: "MAJH Studio", href: "/dashboard/studio", icon: Tv },
  { label: "Go Live (OBS)", href: "/dashboard/stream", icon: Radio },
  { label: "My Recordings", href: "/dashboard/recordings", icon: Video },
  { label: "Points & Rewards", href: "/dashboard/rewards", icon: Gift },
  { label: "My Orders", href: "/dashboard/orders", icon: UtensilsCrossed },
  { label: "Esports", href: "/esports", icon: Gamepad2 },
  { label: "My Events", href: "/dashboard/my-events", icon: CalendarCheck },
  { label: "My Bookings", href: "/dashboard/my-bookings", icon: CalendarCheck },
  { label: "Player Portal", href: "/dashboard/player-portal", icon: Joystick },
  { label: "Player Controller", href: "/dashboard/player-controller", icon: Gamepad2 },
  { label: "My Rentals", href: "/dashboard/rentals", icon: Monitor },
]

// All navigation sections with visibility rules
const NAV_SECTIONS: NavSection[] = [
  {
    id: "tournament-organizing",
    title: "Tournament Organizing",
    items: [
      { label: "My Tournaments", href: "/dashboard/tournaments", icon: Trophy },
      { label: "Create Tournament", href: "/dashboard/tournaments/new", icon: CalendarCheck },
    ],
    isVisible: (p) => p.canOrganize,
  },
  {
    id: "advertising",
    title: "Advertising",
    items: [
      { label: "Ads Manager", href: "/dashboard/ads", icon: Megaphone },
      { label: "Create Campaign", href: "/dashboard/ads/create", icon: Megaphone },
    ],
    isVisible: (p) => p.canOrganize,
  },
  {
    id: "ticketing",
    title: "Ticketing",
    items: [
      { label: "Events & Ticketing", href: "/dashboard/ticketing", icon: Ticket },
      { label: "Check-In Scanner", href: "/dashboard/ticketing/scanner", icon: QrCode },
    ],
    isVisible: (p) => p.canOrganize,
  },
  {
    id: "financials",
    title: "Financials",
    items: [
      { label: "Financial Dashboard", href: "/dashboard/financial", icon: Wallet },
      { label: "Transactions", href: "/dashboard/financial/transactions", icon: DollarSign },
      { label: "API Keys", href: "/dashboard/financial/api-keys", icon: Key },
      { label: "Payout Methods", href: "/dashboard/financials/payout-methods", icon: CreditCard },
    ],
    isVisible: () => true, // Visible to all users (their own financials)
  },
  {
    id: "organization",
    title: "Organization",
    items: [
      { label: "Team Management", href: "/dashboard/team", icon: Users },
      { label: "Permission Manager", href: "/dashboard/admin/permissions", icon: Shield },
    ],
    isVisible: (p) => p.isManager || p.canManagePermissions,
    filterItems: (items, p) => {
      return items.filter(item => {
        if (item.href === "/dashboard/admin/permissions") {
          return p.canManagePermissions
        }
        return true
      })
    },
  },
  {
    id: "creator",
    title: "Creator",
    items: [
      { label: "Creator Analytics", href: "/dashboard/creator/analytics", icon: TrendingUp },
    ],
    isVisible: () => true,
  },
  {
    id: "settings",
    title: "Settings",
    items: [
      { label: "Identity Verification", href: "/dashboard/settings/verification", icon: ShieldCheck },
    ],
    isVisible: () => true,
  },
  {
    id: "staff",
    title: "Staff",
    items: [
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
    ],
    isVisible: (p) => p.isStaff || p.canAccessAdmin,
    filterItems: (items, p) => {
      return items.filter(item => {
        // Staff and Users pages only for managers+
        if (item.href === "/dashboard/admin/staff" && !p.isManager) return false
        if (item.href === "/dashboard/admin/users" && !p.isManager) return false
        // Menu and Inventory management only for managers+
        if (item.href === "/dashboard/admin/menu" && !p.isManager) return false
        if (item.href === "/dashboard/admin/inventory" && !p.isManager) return false
        return true
      })
    },
  },
  {
    id: "admin-financials",
    title: "Admin Financials",
    items: [
      { label: "Financial Overview", href: "/dashboard/admin/financials", icon: DollarSign },
      { label: "Reconciliation", href: "/dashboard/admin/reconciliation", icon: ShieldCheck },
      { label: "Compliance", href: "/dashboard/admin/compliance", icon: ShieldCheck },
      { label: "Control Panel", href: "/dashboard/admin/control-panel", icon: Sliders },
      { label: "Stream Sources", href: "/dashboard/admin/streams", icon: Tv },
      { label: "Broadcast Control", href: "/dashboard/admin/broadcast", icon: Radio },
      { label: "Ops Command Center", href: "/dashboard/admin/ops", icon: Activity },
    ],
    isVisible: (p) => p.isStaff || p.canAccessAdmin || p.canManageFinancials,
  },
  {
    id: "carbardmv",
    title: "CARBARDMV",
    items: [
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
    ],
    isVisible: (p) => p.isStaff || p.canAccessCarBardMV,
  },
]

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = item.href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname.startsWith(item.href)

  console.log("[v0] NavLink:", item.label, "href:", item.href, "disabled:", item.disabled)

  // Using native <a> tag temporarily to debug Link issues
  return (
    <a
      href={item.disabled ? "#" : item.href}
      onClick={(e) => {
        console.log("[v0] NavLink clicked:", item.label, "href:", item.href)
        if (item.disabled) {
          e.preventDefault()
          console.log("[v0] Click prevented - item disabled")
        }
      }}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
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
    </a>
  )
}

export function DashboardSidebar({
  displayName,
  email,
  userRole,
  permissions,
}: {
  displayName: string
  email: string
  userRole?: string | null
  permissions: SidebarPermissions
}) {
  const pathname = usePathname()

  // Get visible sections based on permissions
  const visibleSections = NAV_SECTIONS.filter(section => section.isVisible(permissions))
    .map(section => ({
      ...section,
      items: section.filterItems ? section.filterItems(section.items, permissions) : section.items,
    }))
    .filter(section => section.items.length > 0)

  return (
    <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex h-screen sticky top-0">
      <div className="p-4">
        <Logo />
      </div>

      <nav 
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2" 
        aria-label="Dashboard navigation"
        onClick={(e) => {
          console.log("[v0] Nav container clicked, target:", (e.target as HTMLElement).tagName, (e.target as HTMLElement).className)
        }}
      >
        {/* Base navigation items */}
        {BASE_NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        {/* Dynamic sections based on permissions */}
        {visibleSections.map((section) => (
          <div 
            key={section.id}
            onClick={(e) => {
              console.log("[v0] Section div clicked:", section.title, "target:", (e.target as HTMLElement).tagName)
            }}
          >
            <div className="my-3 border-t border-sidebar-border" />
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              {section.title}
            </p>
            {section.items.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-sidebar-foreground">{displayName}</p>
            {userRole && (
              <span className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium",
                getRoleBadgeColor(userRole)
              )}>
                {getRoleDisplayName(userRole)}
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
