import Link from "next/link"
import { getSponsors } from "@/lib/content-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Award, ExternalLink } from "lucide-react"

export const metadata = { title: "Sponsors | MAJH EVENTS" }

const TIER_ORDER = ["platinum", "gold", "silver", "bronze", "community"]
const TIER_STYLES: Record<string, string> = {
  platinum: "border-primary/40 bg-primary/5",
  gold: "border-yellow-500/30 bg-yellow-500/5",
  silver: "border-muted-foreground/30 bg-muted/30",
  bronze: "border-orange-700/30 bg-orange-700/5",
  community: "border-border bg-card",
}
const TIER_BADGE: Record<string, string> = {
  platinum: "border-primary/40 bg-primary/10 text-primary",
  gold: "border-yellow-500/30 bg-yellow-500/10 text-yellow-500",
  silver: "border-muted-foreground/30 bg-muted text-muted-foreground",
  bronze: "border-orange-700/30 bg-orange-700/10 text-orange-600",
  community: "border-border text-muted-foreground",
}

export default async function SponsorsPage() {
  const allSponsors = await getSponsors()

  const grouped = TIER_ORDER.reduce<Record<string, any[]>>((acc, tier) => {
    const s = allSponsors.filter((sp: any) => sp.tier === tier)
    if (s.length > 0) acc[tier] = s
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Award className="h-3 w-3" />
          Partners
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Our Sponsors</h1>
        <p className="mt-2 text-muted-foreground">Thank you to our amazing sponsors who make MAJH EVENTS possible.</p>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Award className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium text-foreground">No sponsors yet</p>
          <p className="mb-4 text-sm text-muted-foreground">Interested in becoming a sponsor?</p>
          <Button asChild size="sm">
            <Link href="/contact">Contact Us</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(grouped).map(([tier, sponsors]) => (
            <section key={tier}>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold capitalize text-foreground">
                <Award className="h-4 w-4 text-primary" />
                {tier} Sponsors
              </h2>
              <div className={`grid gap-4 ${tier === "platinum" ? "sm:grid-cols-1 lg:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
                {sponsors.map((sponsor: any) => (
                  <div key={sponsor.id} className={`rounded-xl border p-6 transition-colors hover:border-primary/30 ${TIER_STYLES[tier] ?? ""}`}>
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{sponsor.name}</h3>
                        <Badge variant="outline" className={`mt-1 text-[10px] capitalize ${TIER_BADGE[tier] ?? ""}`}>
                          {tier}
                        </Badge>
                      </div>
                      {sponsor.website_url && (
                        <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                          <ExternalLink className="h-4 w-4" />
                          <span className="sr-only">Visit {sponsor.name} website</span>
                        </a>
                      )}
                    </div>
                    {sponsor.description && (
                      <p className="text-sm text-muted-foreground line-clamp-3">{sponsor.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* CTA */}
      <div className="mt-12 rounded-xl border border-primary/20 bg-primary/5 p-8 text-center">
        <h2 className="mb-2 text-xl font-semibold text-foreground">Become a Sponsor</h2>
        <p className="mb-4 text-muted-foreground">Partner with MAJH EVENTS and reach our growing gaming community.</p>
        <Button asChild>
          <Link href="/contact">Get in Touch</Link>
        </Button>
      </div>
    </div>
  )
}
