import Link from "next/link"
import { Logo } from "@/components/logo"
import { Instagram } from "lucide-react"

const FOOTER_LINKS = [
  {
    title: "Platform",
    links: [
      { label: "Esports", href: "/esports" },
      { label: "Bar / Cafe", href: "/bar-cafe" },
      { label: "CARBARDMV Events", href: "/events" },
      { label: "Rentals", href: "/rentals" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign Up", href: "/auth/sign-up" },
      { label: "Log In", href: "/auth/login" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="flex flex-col gap-4">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              The ultimate esports and entertainment ecosystem. Game, eat, drink, and celebrate -- all under one roof.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://www.instagram.com/majheventsbds/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                aria-label="Follow MAJH EVENTS on Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
            </div>
          </div>
          <div className="flex flex-wrap gap-12">
            {FOOTER_LINKS.map((group) => (
              <div key={group.title} className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
                <nav className="flex flex-col gap-2" aria-label={`${group.title} links`}>
                  {group.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center gap-2 border-t border-border pt-6">
          <p className="text-center text-xs text-muted-foreground">
            Millers Building, Tudor Street | @MAJHEVENTSBDS
          </p>
          <p className="text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} MAJH EVENTS. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
