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
  Wallet,
  ArrowLeftRight,
  ArrowUpRight,
  Key,
  BarChart3,
  Settings,
  User,
  ChevronDown,
  Bell,
  CreditCard,
  Home,
} from "lucide-react"

const sidebarNav = [
  {
    title: "Wallet",
    href: "/dashboard/financial",
    icon: Wallet,
    description: "Balance & Activity",
  },
  {
    title: "Transactions",
    href: "/dashboard/financial/transactions",
    icon: ArrowLeftRight,
    description: "Ledger History",
  },
  {
    title: "Payouts",
    href: "/dashboard/financial/payouts",
    icon: ArrowUpRight,
    description: "Withdraw Funds",
  },
  {
    title: "API Keys",
    href: "/dashboard/financial/api-keys",
    icon: Key,
    description: "Developer Access",
  },
  {
    title: "Usage & Billing",
    href: "/dashboard/financial/usage",
    icon: BarChart3,
    description: "Plan & Limits",
  },
]

export default function FinancialDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isLive = process.env.NODE_ENV === "production"

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-card">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-border px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80">
            <CreditCard className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Financial</p>
            <p className="text-xs text-muted-foreground">MAJH Events</p>
          </div>
        </div>

        {/* Environment Badge */}
        <div className="px-4 py-3 border-b border-border">
          <Badge 
            variant="outline" 
            className={cn(
              "w-full justify-center py-1.5 font-mono text-xs",
              isLive 
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500" 
                : "border-amber-500/50 bg-amber-500/10 text-amber-500"
            )}
          >
            {isLive ? "LIVE" : "TEST"} MODE
          </Badge>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {sidebarNav.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/dashboard/financial" && pathname.startsWith(item.href))
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all group",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className={cn(
                  "h-5 w-5",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} />
                <div>
                  <span className="block">{item.title}</span>
                  <span className={cn(
                    "text-xs",
                    isActive ? "text-primary/70" : "text-muted-foreground/70"
                  )}>
                    {item.description}
                  </span>
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Back to Dashboard */}
        <div className="border-t border-border p-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            <Home className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <Link
            href="/dashboard/financial/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 pl-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-card/95 backdrop-blur px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-foreground">
              {sidebarNav.find(item => 
                pathname === item.href || 
                (item.href !== "/dashboard/financial" && pathname.startsWith(item.href))
              )?.title || "Financial Dashboard"}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Quick Actions
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Wallet className="h-4 w-4 mr-2" />
                  Add Funds
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ArrowUpRight className="h-4 w-4 mr-2" />
                  Request Payout
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Key className="h-4 w-4 mr-2" />
                  Create API Key
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  )
}
