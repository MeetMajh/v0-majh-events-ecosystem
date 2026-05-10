import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { HeaderMobileMenu } from "@/components/header-mobile-menu"
import { NotificationBellWithPanel } from "@/components/notifications/notification-bell"

const NAV_ITEMS = [
  { label: "Esports", href: "/esports" },
  { label: "Live", href: "/live" },
  { label: "VODs", href: "/live/vods" },
  { label: "Clips", href: "/clips" },
  { label: "Bar / Cafe", href: "/bar-cafe" },
  { label: "CARBARDMV", href: "/carbardmv" },
  { label: "News", href: "/news" },
  { label: "Community", href: "/community" },
]

export async function Header() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <NotificationBellWithPanel />
              <Button asChild size="sm">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/auth/login">Log In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/auth/sign-up">Sign Up</Link>
              </Button>
            </>
          )}
        </div>
        <HeaderMobileMenu isLoggedIn={!!user} />
      </div>
    </header>
  )
}
