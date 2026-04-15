"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  LayoutDashboard,
  Receipt,
  ArrowLeftRight,
  Shield,
  ShieldAlert,
  Wallet,
  ArrowDownToLine,
  Undo2,
  ScrollText,
  Settings,
  User,
  Zap,
  ChevronDown,
  Bell,
} from "lucide-react"

const sidebarNav = [
  {
    title: "Overview",
    href: "/dashboard/admin/control-panel",
    icon: LayoutDashboard,
  },
  {
    title: "Reconciliation",
    href: "/dashboard/admin/control-panel/reconciliation",
    icon: ArrowLeftRight,
  },
  {
    title: "Transactions",
    href: "/dashboard/admin/control-panel/transactions",
    icon: Receipt,
  },
  {
    title: "Escrow",
    href: "/dashboard/admin/control-panel/escrow",
    icon: Shield,
  },
  {
    title: "Payouts",
    href: "/dashboard/admin/control-panel/payouts",
    icon: Wallet,
  },
  {
    title: "Withdrawals",
    href: "/dashboard/admin/control-panel/withdrawals",
    icon: ArrowDownToLine,
  },
  {
    title: "Reversals",
    href: "/dashboard/admin/control-panel/reversals",
    icon: Undo2,
  },
  {
    title: "Audit Log",
    href: "/dashboard/admin/control-panel/audit-log",
    icon: ScrollText,
  },
  {
    title: "System Controls",
    href: "/dashboard/admin/control-panel/system",
    icon: ShieldAlert,
  },
  {
    title: "Chaos Testing",
    href: "/dashboard/admin/control-panel/chaos",
    icon: Zap,
  },
]

export default function ControlPanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isLive = process.env.NODE_ENV === "production"

  return (
    <div className="flex min-h-screen bg-zinc-950">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-zinc-800 bg-zinc-900">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-zinc-800 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-zinc-100">Financial Control</p>
            <p className="text-xs text-zinc-500">MAJH Events</p>
          </div>
        </div>

        {/* Environment Badge */}
        <div className="px-4 py-3 border-b border-zinc-800">
          <Badge 
            variant="outline" 
            className={cn(
              "w-full justify-center py-1.5 font-mono text-xs",
              isLive 
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" 
                : "border-amber-500/50 bg-amber-500/10 text-amber-400"
            )}
          >
            {isLive ? "LIVE" : "TEST"} ENVIRONMENT
          </Badge>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {sidebarNav.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/dashboard/admin/control-panel" && pathname.startsWith(item.href))
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                )}
              >
                <item.icon className={cn(
                  "h-4 w-4",
                  isActive ? "text-emerald-400" : "text-zinc-500"
                )} />
                {item.title}
              </Link>
            )
          })}
        </nav>

        {/* Settings Link */}
        <div className="border-t border-zinc-800 p-3">
          <Link
            href="/dashboard/admin/control-panel/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 transition-all"
          >
            <Settings className="h-4 w-4 text-zinc-500" />
            Settings
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 pl-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-900/95 backdrop-blur px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-zinc-100">
              {sidebarNav.find(item => 
                pathname === item.href || 
                (item.href !== "/dashboard/admin/control-panel" && pathname.startsWith(item.href))
              )?.title || "Control Panel"}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100">
                  <Zap className="h-4 w-4 mr-2" />
                  Quick Actions
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-zinc-900 border-zinc-800">
                <DropdownMenuLabel className="text-zinc-400">Actions</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem className="text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100">
                  <Undo2 className="h-4 w-4 mr-2" />
                  New Reversal
                </DropdownMenuItem>
                <DropdownMenuItem className="text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100">
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  Run Reconciliation
                </DropdownMenuItem>
                <DropdownMenuItem className="text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100">
                  <Wallet className="h-4 w-4 mr-2" />
                  Process Payouts
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-zinc-900 border-zinc-800">
                <DropdownMenuLabel className="text-zinc-400">My Account</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem className="text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100">
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100">
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem className="text-red-400 focus:bg-zinc-800 focus:text-red-300">
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 bg-zinc-950 min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  )
}
