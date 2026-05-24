"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCents } from "@/lib/format"
import { submitCateringInquiry } from "@/lib/carbardmv-actions"
import { Loader2, Send, CheckCircle2 } from "lucide-react"

type Category = { id: string; name: string; slug: string; description: string | null }
type Item = {
  id: string; name: string; description: string | null
  price_cents: number; price_type: string
  dietary_tags: string[]; category_id: string
  cb_catering_categories: { name: string; slug: string } | null
}

export function CateringMenu({ categories, items }: { categories: Category[]; items: Item[] }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const filtered = activeCategory ? items.filter((i) => i.category_id === activeCategory) : items

  async function handleInquiry(formData: FormData) {
    setSubmitting(true)
    const result = await submitCateringInquiry(formData)
    setSubmitting(false)
    if (result.success) setSubmitted(true)
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      {/* Menu */}
      <div>
        {/* Category Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              !activeCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            All Items
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="grid gap-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/20"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-foreground">{item.name}</h3>
                  {item.dietary_tags?.map((tag) => (
                    <Badge key={tag} variant="outline" className="px-1.5 py-0 text-[9px]">{tag}</Badge>
                  ))}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                {item.cb_catering_categories && (
                  <span className="mt-1 inline-block rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {item.cb_catering_categories.name}
                  </span>
                )}
              </div>
              <div className="ml-4 text-right">
                <span className="text-sm font-semibold text-primary">{formatCents(item.price_cents)}</span>
                <span className="block text-[10px] text-muted-foreground">
                  {item.price_type === "per_person" ? "per person" : "flat rate"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Inquiry Form */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Request a Quote</CardTitle>
            <p className="text-xs text-muted-foreground">
              Tell us about your event and we will create a custom catering proposal.
            </p>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-primary" />
                <h3 className="font-semibold text-foreground">Inquiry Submitted</h3>
                <p className="text-sm text-muted-foreground">
                  We will reach out within 24 hours with a custom proposal.
                </p>
                <Button variant="outline" size="sm" onClick={() => setSubmitted(false)}>
                  Submit Another
                </Button>
              </div>
            ) : (
              <form action={handleInquiry} className="space-y-3">
                <div>
                  <Label htmlFor="ciq-name" className="text-xs">Name *</Label>
                  <Input id="ciq-name" name="name" required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="ciq-email" className="text-xs">Email *</Label>
                  <Input id="ciq-email" name="email" type="email" required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="ciq-phone" className="text-xs">Phone</Label>
                  <Input id="ciq-phone" name="phone" type="tel" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="ciq-type" className="text-xs">Event Type</Label>
                  <Select name="event_type">
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wedding">Wedding</SelectItem>
                      <SelectItem value="corporate">Corporate</SelectItem>
                      <SelectItem value="birthday">Birthday</SelectItem>
                      <SelectItem value="festival">Festival</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="ciq-guests" className="text-xs">Guests</Label>
                    <Input id="ciq-guests" name="guest_count" type="number" min={1} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="ciq-date" className="text-xs">Event Date</Label>
                    <Input id="ciq-date" name="event_date" type="date" className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="ciq-dietary" className="text-xs">Dietary Needs</Label>
                  <Input id="ciq-dietary" name="dietary_needs" placeholder="Vegetarian, vegan, allergies..." className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="ciq-message" className="text-xs">Message</Label>
                  <Textarea id="ciq-message" name="message" rows={3} placeholder="Tell us about your event..." className="mt-1" />
                </div>
                <Button type="submit" size="sm" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Send className="mr-2 h-3 w-3" />}
                  {submitting ? "Sending..." : "Request Quote"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
