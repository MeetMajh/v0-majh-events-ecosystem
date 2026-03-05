"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatCents } from "@/lib/format"
import { createEventBookingCheckout } from "@/lib/carbardmv-actions"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  Calendar,
  UtensilsCrossed,
  Sparkles,
  CreditCard,
  Loader2,
  Plus,
  Minus,
} from "lucide-react"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type Package = {
  id: string
  name: string
  slug: string
  description: string | null
  base_price_cents: number
  duration_hours: number
  max_guests: number | null
  min_guests: number | null
  category: string
  includes: string[] | null
}

type Addon = {
  id: string
  name: string
  description: string | null
  price_cents: number
  price_type: string
  category: string
}

type CateringCategory = {
  id: string
  name: string
  slug: string
}

type CateringItem = {
  id: string
  name: string
  description: string | null
  price_cents: number
  price_type: string
  dietary_tags: string[]
  category_id: string
  cb_catering_categories: { name: string; slug: string } | null
}

const STEPS = [
  { label: "Package", icon: Sparkles },
  { label: "Add-ons", icon: Plus },
  { label: "Catering", icon: UtensilsCrossed },
  { label: "Details", icon: Calendar },
  { label: "Payment", icon: CreditCard },
]

interface Props {
  packages: Package[]
  addons: Addon[]
  cateringCategories: CateringCategory[]
  cateringItems: CateringItem[]
  isLoggedIn: boolean
}

export function EventBookingWizard({ packages, addons, cateringCategories, cateringItems, isLoggedIn }: Props) {
  const [step, setStep] = useState(0)
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null)
  const [selectedAddons, setSelectedAddons] = useState<string[]>([])
  const [selectedCatering, setSelectedCatering] = useState<Record<string, number>>({})
  const [guestCount, setGuestCount] = useState(25)
  const [eventDate, setEventDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [venueNotes, setVenueNotes] = useState("")
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pkg = packages.find((p) => p.id === selectedPackage)
  const selectedAddonItems = addons.filter((a) => selectedAddons.includes(a.id))

  const addonsTotal = selectedAddonItems.reduce((sum, a) => {
    if (a.price_type === "per_person") return sum + a.price_cents * guestCount
    return sum + a.price_cents
  }, 0)

  const cateringTotal = Object.entries(selectedCatering).reduce((sum, [itemId, qty]) => {
    const item = cateringItems.find((ci) => ci.id === itemId)
    if (!item) return sum
    const cost = item.price_type === "per_person" ? item.price_cents * guestCount : item.price_cents
    return sum + cost * qty
  }, 0)

  const total = (pkg?.base_price_cents ?? 0) + addonsTotal + cateringTotal
  const deposit = Math.round(total * 0.25)

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]))
  }

  const updateCatering = (itemId: string, delta: number) => {
    setSelectedCatering((prev) => {
      const current = prev[itemId] || 0
      const next = Math.max(0, current + delta)
      if (next === 0) {
        const { [itemId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [itemId]: next }
    })
  }

  const canProceed = () => {
    switch (step) {
      case 0: return !!selectedPackage
      case 1: return true
      case 2: return true
      case 3: return !!eventDate && !!contactName && !!contactEmail
      default: return false
    }
  }

  const handleCheckout = useCallback(async () => {
    if (!selectedPackage) return
    setLoading(true)
    setError(null)
    try {
      const result = await createEventBookingCheckout({
        packageId: selectedPackage,
        addonIds: selectedAddons,
        guestCount,
        eventDate,
        startTime: startTime || undefined,
        contactName,
        contactEmail,
        contactPhone: contactPhone || undefined,
        venueNotes: venueNotes || undefined,
        cateringItems: Object.entries(selectedCatering).map(([itemId, quantity]) => ({ itemId, quantity })),
      })
      setClientSecret(result.clientSecret)
      setStep(4)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create checkout session")
    } finally {
      setLoading(false)
    }
  }, [selectedPackage, selectedAddons, guestCount, eventDate, startTime, contactName, contactEmail, contactPhone, venueNotes, selectedCatering])

  return (
    <div>
      {/* Step Indicator */}
      <div className="mb-8 flex items-center justify-center gap-1" role="navigation" aria-label="Booking steps">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1">
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i >= step}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-primary/20 text-primary cursor-pointer hover:bg-primary/30"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="h-3 w-3" /> : <s.icon className="h-3 w-3" />}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-4 sm:w-8 ${i < step ? "bg-primary/50" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main Content */}
        <div>
          {/* Step 0: Package Selection */}
          {step === 0 && (
            <div>
              <h2 className="mb-1 text-xl font-semibold text-foreground">Choose Your Package</h2>
              <p className="mb-6 text-sm text-muted-foreground">Select the event package that fits your needs.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {packages.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPackage(p.id)
                      if (p.min_guests && guestCount < p.min_guests) setGuestCount(p.min_guests)
                    }}
                    className={`rounded-xl border p-5 text-left transition-all ${
                      selectedPackage === p.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border bg-card hover:border-primary/30"
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">{p.name}</h3>
                        <Badge variant="secondary" className="mt-1 text-[10px]">{p.category}</Badge>
                      </div>
                      <span className="text-lg font-bold text-primary">
                        {p.base_price_cents === 0 ? "Custom" : formatCents(p.base_price_cents)}
                      </span>
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground">{p.description}</p>
                    <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{p.duration_hours}h</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{p.min_guests}-{p.max_guests ?? "unlimited"}</span>
                    </div>
                    {p.includes && (
                      <div className="flex flex-wrap gap-1">
                        {p.includes.slice(0, 4).map((inc) => (
                          <span key={inc} className="rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{inc}</span>
                        ))}
                        {p.includes.length > 4 && (
                          <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            +{p.includes.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Add-ons */}
          {step === 1 && (
            <div>
              <h2 className="mb-1 text-xl font-semibold text-foreground">Customize with Add-ons</h2>
              <p className="mb-6 text-sm text-muted-foreground">Enhance your event with additional services. All add-ons are optional.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {addons.map((a) => {
                  const isSelected = selectedAddons.includes(a.id)
                  const displayPrice = a.price_type === "per_person"
                    ? `${formatCents(a.price_cents)}/person`
                    : formatCents(a.price_cents)
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggleAddon(a.id)}
                      className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border bg-card hover:border-primary/30"
                      }`}
                    >
                      <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                      }`}>
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-foreground">{a.name}</h3>
                          <span className="text-sm font-semibold text-primary">{displayPrice}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 2: Catering */}
          {step === 2 && (
            <div>
              <h2 className="mb-1 text-xl font-semibold text-foreground">Add Catering</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Optional: Add food to your event. Prices are per person for {guestCount} guests.
              </p>
              {cateringCategories.map((cat) => {
                const items = cateringItems.filter((ci) => ci.category_id === cat.id)
                if (items.length === 0) return null
                return (
                  <div key={cat.id} className="mb-6">
                    <h3 className="mb-3 text-sm font-semibold text-foreground">{cat.name}</h3>
                    <div className="grid gap-2">
                      {items.map((item) => {
                        const qty = selectedCatering[item.id] || 0
                        const displayPrice = item.price_type === "per_person"
                          ? `${formatCents(item.price_cents)}/person`
                          : formatCents(item.price_cents)
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                              qty > 0 ? "border-primary/30 bg-primary/5" : "border-border bg-card"
                            }`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-foreground">{item.name}</span>
                                {item.dietary_tags?.map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-[9px] px-1 py-0">{tag}</Badge>
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-primary">{displayPrice}</span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => updateCatering(item.id, -1)}
                                  disabled={qty === 0}
                                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted text-foreground transition-colors hover:bg-muted/80 disabled:opacity-30"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-6 text-center text-sm font-medium text-foreground">{qty}</span>
                                <button
                                  onClick={() => updateCatering(item.id, 1)}
                                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted text-foreground transition-colors hover:bg-muted/80"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Step 3: Contact Details */}
          {step === 3 && (
            <div>
              <h2 className="mb-1 text-xl font-semibold text-foreground">Event Details</h2>
              <p className="mb-6 text-sm text-muted-foreground">Tell us about your event and how to reach you.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="guest-count">Guest Count</Label>
                  <Input
                    id="guest-count"
                    type="number"
                    min={pkg?.min_guests ?? 5}
                    max={pkg?.max_guests ?? 1000}
                    value={guestCount}
                    onChange={(e) => setGuestCount(parseInt(e.target.value) || 10)}
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pkg ? `${pkg.min_guests}-${pkg.max_guests ?? "unlimited"} guests for ${pkg.name}` : "Select a package first"}
                  </p>
                </div>
                <div>
                  <Label htmlFor="event-date">Event Date *</Label>
                  <Input id="event-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="mt-1" required />
                </div>
                <div>
                  <Label htmlFor="start-time">Start Time</Label>
                  <Input id="start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="contact-name">Your Name *</Label>
                  <Input id="contact-name" value={contactName} onChange={(e) => setContactName(e.target.value)} className="mt-1" required />
                </div>
                <div>
                  <Label htmlFor="contact-email">Email *</Label>
                  <Input id="contact-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="mt-1" required />
                </div>
                <div>
                  <Label htmlFor="contact-phone">Phone</Label>
                  <Input id="contact-phone" type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="mt-1" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="venue-notes">Venue / Special Requests</Label>
                  <Textarea id="venue-notes" value={venueNotes} onChange={(e) => setVenueNotes(e.target.value)} className="mt-1" rows={3} placeholder="Venue address, parking info, special requirements..." />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Stripe Checkout */}
          {step === 4 && clientSecret && (
            <div>
              <h2 className="mb-1 text-xl font-semibold text-foreground">Secure Payment</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Pay your 25% deposit ({formatCents(deposit)}) to confirm your booking.
              </p>
              <div className="rounded-xl border border-border bg-card p-4">
                <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            </div>
          )}
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pkg ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{pkg.name}</span>
                    <span className="font-medium text-foreground">{formatCents(pkg.base_price_cents)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" /> {guestCount} guests
                    <Clock className="h-3 w-3 ml-2" /> {pkg.duration_hours}h
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Select a package to start</p>
              )}

              {selectedAddonItems.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">ADD-ONS</span>
                    {selectedAddonItems.map((a) => {
                      const cost = a.price_type === "per_person" ? a.price_cents * guestCount : a.price_cents
                      return (
                        <div key={a.id} className="flex justify-between text-xs">
                          <span className="text-foreground">{a.name}</span>
                          <span className="text-foreground">{formatCents(cost)}</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {Object.keys(selectedCatering).length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">CATERING</span>
                    {Object.entries(selectedCatering).map(([itemId, qty]) => {
                      const item = cateringItems.find((ci) => ci.id === itemId)
                      if (!item) return null
                      const cost = (item.price_type === "per_person" ? item.price_cents * guestCount : item.price_cents) * qty
                      return (
                        <div key={itemId} className="flex justify-between text-xs">
                          <span className="text-foreground">{item.name} x{qty}</span>
                          <span className="text-foreground">{formatCents(cost)}</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              <Separator />
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-foreground">Total</span>
                <span className="text-foreground">{formatCents(total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-primary">25% Deposit Due</span>
                <span className="font-bold text-primary">{formatCents(deposit)}</span>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              {/* Navigation */}
              {step < 4 && (
                <div className="flex gap-2 pt-2">
                  {step > 0 && (
                    <Button variant="outline" size="sm" onClick={() => setStep(step - 1)} className="flex-1">
                      <ChevronLeft className="mr-1 h-3 w-3" /> Back
                    </Button>
                  )}
                  {step < 3 && (
                    <Button size="sm" onClick={() => setStep(step + 1)} disabled={!canProceed()} className="flex-1">
                      Next <ChevronRight className="ml-1 h-3 w-3" />
                    </Button>
                  )}
                  {step === 3 && (
                    <Button size="sm" onClick={handleCheckout} disabled={!canProceed() || loading} className="flex-1">
                      {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CreditCard className="mr-1 h-3 w-3" />}
                      {loading ? "Processing..." : `Pay ${formatCents(deposit)} Deposit`}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
