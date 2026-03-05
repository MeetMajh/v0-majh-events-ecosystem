import Image from "next/image"
import Link from "next/link"
import { IMAGES } from "@/lib/images"
import { getSocialLinks } from "@/lib/esports-actions"
import { getSponsors } from "@/lib/content-actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Heart, Gamepad2, Coffee, PartyPopper, Users, ExternalLink } from "lucide-react"

export const metadata = { title: "About | MAJH EVENTS" }

const PILLARS = [
  { icon: Gamepad2, title: "Esports", description: "Competitive gaming across console, TCG, PC, tabletop, and sports with 7 bracket formats." },
  { icon: Coffee, title: "Bar & Cafe", description: "Full food and drink menu with a loyalty points system and online/in-store ordering." },
  { icon: PartyPopper, title: "Events", description: "Community meetups, CARBARDMV events, and private rentals at our gaming lounge." },
  { icon: Users, title: "Community", description: "Forums, teams, news, livestreaming, and a recruitment pipeline for volunteers and staff." },
]

const SOCIAL_ICONS: Record<string, string> = {
  discord: "Discord",
  twitter: "Twitter / X",
  instagram: "Instagram",
  facebook: "Facebook",
  twitch: "Twitch",
  youtube: "YouTube",
  tiktok: "TikTok",
}

export default async function AboutPage() {
  const [socialLinks, sponsors] = await Promise.all([
    getSocialLinks(),
    getSponsors(),
  ])

  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      {/* Hero */}
      <div className="relative mb-12 overflow-hidden rounded-2xl border border-border">
        <div className="relative aspect-[21/9]">
          <Image src={IMAGES.events.team} alt="MAJH EVENTS team" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-transparent" />
        </div>
        <div className="absolute inset-0 flex flex-col justify-center p-8 md:p-12">
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Heart className="h-3 w-3" />
            Our Story
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-balance text-foreground md:text-5xl">About MAJH EVENTS</h1>
          <p className="mt-3 max-w-lg text-muted-foreground">
            A DMV-area gaming and entertainment hub combining competitive esports, a bar and cafe, community events, and a growing esports ecosystem.
          </p>
        </div>
      </div>

      {/* Pillars */}
      <section className="mb-12">
        <h2 className="mb-4 text-xl font-bold text-foreground">What We Do</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <div key={p.title} className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
              <p.icon className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-1 font-semibold text-foreground">{p.title}</h3>
              <p className="text-sm text-muted-foreground">{p.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Imagery */}
      <div className="mb-12 grid gap-4 sm:grid-cols-3">
        <div className="relative aspect-square overflow-hidden rounded-xl border border-border">
          <Image src={IMAGES.events.barGaming} alt="MAJH EVENTS bar gaming" fill className="object-cover" />
        </div>
        <div className="relative aspect-square overflow-hidden rounded-xl border border-border">
          <Image src={IMAGES.events.consoleStation} alt="Console gaming station" fill className="object-cover" />
        </div>
        <div className="relative aspect-square overflow-hidden rounded-xl border border-border">
          <Image src={IMAGES.events.gamingInAction} alt="Gaming in action" fill className="object-cover" />
        </div>
      </div>

      {/* Social Links */}
      {socialLinks.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-bold text-foreground">Follow Us</h2>
          <div className="flex flex-wrap gap-3">
            {socialLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
              >
                {SOCIAL_ICONS[link.platform] ?? link.platform}
                <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Sponsors */}
      {sponsors.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-bold text-foreground">Our Sponsors</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {sponsors.map((sponsor: any) => (
              <div key={sponsor.id} className="rounded-xl border border-border bg-card p-5 text-center">
                <p className="font-semibold text-foreground">{sponsor.name}</p>
                <Badge variant="outline" className="mt-1 text-[10px] capitalize">{sponsor.tier}</Badge>
                {sponsor.website_url && (
                  <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" className="mt-2 block text-xs text-primary hover:underline">
                    Visit website
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-12 text-center">
        <h2 className="mb-2 text-xl font-semibold text-foreground">Want to Get Involved?</h2>
        <p className="mb-6 text-muted-foreground">Join our community, volunteer, or apply to be part of the MAJH EVENTS team.</p>
        <div className="flex justify-center gap-3">
          <Button asChild>
            <Link href="/recruitment">Apply Now</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/contact">Contact Us</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
