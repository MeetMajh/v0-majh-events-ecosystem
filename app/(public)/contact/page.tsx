import { ContactForm } from "@/components/community/contact-form"
import { getSocialLinks } from "@/lib/esports-actions"
import { Mail, MapPin, ExternalLink } from "lucide-react"

export const metadata = { title: "Contact Us | MAJH EVENTS" }

const SOCIAL_ICONS: Record<string, string> = {
  discord: "Discord",
  twitter: "Twitter / X",
  instagram: "Instagram",
  facebook: "Facebook",
  twitch: "Twitch",
  youtube: "YouTube",
  tiktok: "TikTok",
}

export default async function ContactPage() {
  const socialLinks = await getSocialLinks()

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Mail className="h-3 w-3" />
          Get in Touch
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Contact Us</h1>
        <p className="mt-2 text-muted-foreground">Have questions, want to sponsor, or partner with us? Send us a message.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Info Sidebar */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-3 font-semibold text-foreground">Location</h3>
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>DMV Area (Washington DC, Maryland, Virginia)</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-3 font-semibold text-foreground">Inquiry Types</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>General Questions</li>
              <li>Sponsorship Inquiries</li>
              <li>Tournament Inquiries</li>
              <li>Partnership Proposals</li>
              <li>Recruitment</li>
            </ul>
          </div>

          {socialLinks.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-3 font-semibold text-foreground">Connect</h3>
              <div className="space-y-2">
                {socialLinks.map((link: any) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {SOCIAL_ICONS[link.platform] ?? link.platform}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Send a Message</h2>
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  )
}
