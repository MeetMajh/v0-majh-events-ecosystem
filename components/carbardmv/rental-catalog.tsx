"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { formatCents } from "@/lib/format"
import { createRentalCheckout } from "@/lib/carbardmv-actions"
import {
  Plus,
  Minus,
  ShoppingCart,
  Trash2,
  Loader2,
  CreditCard,
  Monitor,
  Gamepad2,
  Sofa,
  Lightbulb,
  Tent,
  Sparkles,
} from "lucide-react"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type RentalItem = {
  id: string
  name: string
  slug: string
  description: string | null
  category: string
  daily_rate_cents: number
  weekend_rate_cents: number
  weekly_rate_cents: number
  quantity_available: number
}

type CartItem = {
  itemId: string
  quantity: number
  rateType: "daily" | "weekend" | "weekly"
}

const CATEGORY_ICONS: Record<string, typeof Monitor> = {
  av: Monitor,
  gaming: Gamepad2,
  furniture: Sofa,
  lighting: Lightbulb,
  tents: Tent,
  decor: Sparkles,
}

const CATEGORY_LABELS: Record<string, string> = {
  av: "AV & Sound",
  gaming: "Gaming",
  furniture: "Furniture",
  lighting: "Lighting",
  tents: "Tents & Canopies",
  decor: "Decor",
  other: "Other",
}

export function RentalCatalog({ items, isLoggedIn }: { items: RentalItem[]; isLoggedIn: boolean }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCheckout, setShowCheckout] = useState(false)
  const [pickupDate, setPickupDate] = useState("")
  const [returnDate, setReturnDate] = useState("")
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  const categories = [...new Set(items.map((i) => i.category))]
  const filtered = activeCategory ? items.filter((i) => i.category === activeCategory) : items

  const addToCart = (itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === itemId)
      if (existing) {
        const item = items.find((i) => i.id === itemId)
        if (item && existing.quantity >= item.quantity_available) return prev
        return prev.map((c) => (c.itemId === itemId ? { ...c, quantity: c.quantity + 1 } : c))
      }
      return [...prev, { itemId, quantity: 1, rateType: "daily" as const }]
    })
  }

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((c) => c.itemId !== itemId))
  }

  const updateCartQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.itemId !== itemId) return c
          const item = items.find((i) => i.id === itemId)
          const newQty = Math.max(0, Math.min(c.quantity + delta, item?.quantity_available ?? 99))
          return { ...c, quantity: newQty }
        })
        .filter((c) => c.quantity > 0)
    )
  }

  const updateRateType = (itemId: string, rateType: "daily" | "weekend" | "weekly") => {
    setCart((prev) => prev.map((c) => (c.itemId === itemId ? { ...c, rateType } : c)))
  }

  const getRate = (item: RentalItem, rateType: string) => {
    if (rateType === "weekly") return item.weekly_rate_cents
    if (rateType === "weekend") return item.weekend_rate_cents
    return item.daily_rate_cents
  }

  const cartTotal = cart.reduce((sum, c) => {
    const item = items.find((i) => i.id === c.itemId)
    if (!item) return sum
    return sum + getRate(item, c.rateType) * c.quantity
  }, 0)

  const deposit = Math.round(cartTotal * 0.5)

  const handleCheckout = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await createRentalCheckout({
        items: cart,
        pickupDate,
        returnDate,
        contactName,
        contactEmail,
        contactPhone: contactPhone || undefined,
        notes: notes || undefined,
      })
      setClientSecret(result.clientSecret)
      setShowCheckout(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start checkout")
    } finally {
      setLoading(false)
    }
  }, [cart, pickupDate, returnDate, contactName, contactEmail, contactPhone, notes])

  if (showCheckout && clientSecret) {
    return (
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-1 text-xl font-semibold text-foreground">Secure Payment</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Pay your 50% deposit ({formatCents(deposit)}) to confirm your rental.
        </p>
        <div className="rounded-xl border border-border bg-card p-4">
          <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      {/* Catalog */}
      <div>
        {/* Category Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              !activeCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            All Equipment
          </button>
          {categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat] || Monitor
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3 w-3" />
                {CATEGORY_LABELS[cat] || cat}
              </button>
            )
          })}
        </div>

        {/* Items Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((item) => {
            const inCart = cart.find((c) => c.itemId === item.id)
            return (
              <div
                key={item.id}
                className={`rounded-xl border p-5 transition-all ${
                  inCart ? "border-primary/30 bg-primary/5" : "border-border bg-card hover:border-primary/20"
                }`}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{item.name}</h3>
                    <Badge variant="secondary" className="mt-1 text-[10px]">
                      {CATEGORY_LABELS[item.category] || item.category}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.quantity_available} avail.</span>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">{item.description}</p>
                <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-muted px-2 py-1.5">
                    <span className="block text-xs font-semibold text-foreground">{formatCents(item.daily_rate_cents)}</span>
                    <span className="text-[10px] text-muted-foreground">daily</span>
                  </div>
                  <div className="rounded-md bg-muted px-2 py-1.5">
                    <span className="block text-xs font-semibold text-foreground">{formatCents(item.weekend_rate_cents)}</span>
                    <span className="text-[10px] text-muted-foreground">weekend</span>
                  </div>
                  <div className="rounded-md bg-muted px-2 py-1.5">
                    <span className="block text-xs font-semibold text-foreground">{formatCents(item.weekly_rate_cents)}</span>
                    <span className="text-[10px] text-muted-foreground">weekly</span>
                  </div>
                </div>
                {inCart ? (
                  <div className="flex items-center gap-2">
                    <div className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-muted px-2 py-1">
                      <button onClick={() => updateCartQty(item.id, -1)} className="text-muted-foreground hover:text-foreground">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-sm font-medium text-foreground">{inCart.quantity}</span>
                      <button onClick={() => updateCartQty(item.id, 1)} className="text-muted-foreground hover:text-foreground">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <select
                      value={inCart.rateType}
                      onChange={(e) => updateRateType(item.id, e.target.value as "daily" | "weekend" | "weekly")}
                      className="rounded-md border border-border bg-muted px-2 py-1 text-xs text-foreground"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekend">Weekend</option>
                      <option value="weekly">Weekly</option>
                    </select>
                    <button onClick={() => removeFromCart(item.id)} className="text-destructive hover:text-destructive/80">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => addToCart(item.id)}>
                    <Plus className="mr-1 h-3 w-3" /> Add to Cart
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4" />
              Rental Cart
              {cart.length > 0 && (
                <Badge variant="secondary" className="ml-auto">{cart.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cart.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                Add equipment to get started
              </p>
            ) : (
              <>
                {cart.map((c) => {
                  const item = items.find((i) => i.id === c.itemId)
                  if (!item) return null
                  const rate = getRate(item, c.rateType)
                  return (
                    <div key={c.itemId} className="flex justify-between text-xs">
                      <div>
                        <span className="text-foreground">{item.name}</span>
                        <span className="ml-1 text-muted-foreground">x{c.quantity} ({c.rateType})</span>
                      </div>
                      <span className="font-medium text-foreground">{formatCents(rate * c.quantity)}</span>
                    </div>
                  )
                })}

                <Separator />
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-foreground">Total</span>
                  <span className="text-foreground">{formatCents(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-primary">50% Deposit Due</span>
                  <span className="font-bold text-primary">{formatCents(deposit)}</span>
                </div>

                <Separator />

                {/* Booking Details */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Pickup *</Label>
                      <Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="mt-0.5 h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Return *</Label>
                      <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="mt-0.5 h-8 text-xs" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">Name *</Label>
                    <Input value={contactName} onChange={(e) => setContactName(e.target.value)} className="mt-0.5 h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Email *</Label>
                    <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="mt-0.5 h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Phone</Label>
                    <Input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="mt-0.5 h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Notes</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-0.5 text-xs" rows={2} />
                  </div>
                </div>

                {error && <p className="text-xs text-destructive">{error}</p>}

                <Button
                  size="sm"
                  className="w-full"
                  disabled={loading || !pickupDate || !returnDate || !contactName || !contactEmail}
                  onClick={handleCheckout}
                >
                  {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CreditCard className="mr-1 h-3 w-3" />}
                  {loading ? "Processing..." : `Pay ${formatCents(deposit)} Deposit`}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
