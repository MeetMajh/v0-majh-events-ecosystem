"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatCents } from "@/lib/format"
import { placeOnlineOrder } from "@/lib/shop-actions"
import {
  ShoppingCart, Plus, Minus, Trash2, Star, Loader2,
  Wine, Cookie, Swords, CalendarHeart, GlassWater, Monitor, X, CheckCircle2
} from "lucide-react"
import Link from "next/link"

interface CartItem {
  id: string
  name: string
  price_cents: number
  quantity: number
}

const CATEGORY_ICONS: Record<string, any> = {
  drinks: Wine,
  snacks: Cookie,
  "tcg-merch": Swords,
  "event-services": CalendarHeart,
  bartending: GlassWater,
  rentals: Monitor,
}

interface ShopMenuProps {
  categories: any[]
  menuItems: any[]
  isLoggedIn: boolean
  pointsBalance: number
}

export function ShopMenu({ categories, menuItems, isLoggedIn, pointsBalance }: ShopMenuProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [notes, setNotes] = useState("")
  const [isPending, startTransition] = useTransition()
  const [orderResult, setOrderResult] = useState<{ success?: boolean; orderNumber?: string; error?: string } | null>(null)

  const filtered = activeCategory
    ? menuItems.filter((i: any) => i.category_id === activeCategory)
    : menuItems

  const addToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id)
      if (existing) return prev.map((c) => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { id: item.id, name: item.name, price_cents: item.price_cents, quantity: 1 }]
    })
    setShowCart(true)
    setOrderResult(null)
  }

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => prev.map((c) => c.id === id ? { ...c, quantity: c.quantity + delta } : c).filter((c) => c.quantity > 0))
  }

  const subtotal = cart.reduce((sum, c) => sum + c.price_cents * c.quantity, 0)
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0)

  const handlePlaceOrder = () => {
    if (!isLoggedIn || cart.length === 0) return

    const formData = new FormData()
    formData.set("items", JSON.stringify(cart.map((c) => ({ id: c.id, quantity: c.quantity, price_cents: c.price_cents }))))
    formData.set("points_redeem", "0")
    if (notes) formData.set("notes", notes)

    startTransition(async () => {
      const result = await placeOnlineOrder(formData)
      setOrderResult(result)
      if (result.success) {
        setCart([])
        setNotes("")
      }
    })
  }

  return (
    <div>
      {/* Category Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${!activeCategory ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:text-foreground"}`}
        >
          All Items
        </button>
        {categories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.slug] || Star
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${activeCategory === cat.id ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {cat.name}
            </button>
          )
        })}
      </div>

      {/* Items Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((item: any) => {
          const inv = item.inventory?.[0]
          const outOfStock = inv?.track_inventory && inv?.quantity_on_hand <= 0
          const isService = item.categories?.type === "service"
          const inCart = cart.find((c) => c.id === item.id)

          return (
            <div
              key={item.id}
              className={`flex flex-col rounded-xl border bg-card p-4 transition-all ${outOfStock ? "border-border opacity-50" : "border-border hover:border-primary/30"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground">{item.name}</h3>
                    {item.is_featured && <Star className="h-3.5 w-3.5 fill-primary text-primary" />}
                  </div>
                  {item.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                  )}
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between pt-3">
                <div>
                  <span className="text-lg font-bold text-foreground">{formatCents(item.price_cents)}</span>
                  {isService && <span className="ml-1 text-xs text-muted-foreground">service</span>}
                </div>
                {outOfStock ? (
                  <span className="text-xs text-destructive">Out of stock</span>
                ) : (
                  <div className="flex items-center gap-1">
                    {inCart ? (
                      <>
                        <button onClick={() => updateQty(item.id, -1)} className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm font-bold text-foreground">{inCart.quantity}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => addToCart(item)} className="gap-1">
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Floating Cart Button */}
      {cartCount > 0 && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105"
        >
          <ShoppingCart className="h-5 w-5" />
          {cartCount} {cartCount === 1 ? "item" : "items"} &middot; {formatCents(subtotal)}
        </button>
      )}

      {/* Cart Slide-over */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div className="relative flex w-full max-w-md flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="flex items-center gap-2 font-semibold text-foreground">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Your Order
              </h2>
              <button onClick={() => setShowCart(false)} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {orderResult?.success ? (
                <div className="flex flex-col items-center gap-4 py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-400" />
                  <h3 className="text-xl font-bold text-foreground">Order Placed!</h3>
                  <p className="text-muted-foreground">
                    {"Your order "}
                    <span className="font-mono font-bold text-primary">{orderResult.orderNumber}</span>
                    {" has been submitted."}
                  </p>
                  <p className="text-sm text-muted-foreground">{"You'll earn points when it's completed."}</p>
                  <Button onClick={() => { setShowCart(false); setOrderResult(null) }}>Continue Shopping</Button>
                </div>
              ) : cart.length === 0 ? (
                <p className="py-12 text-center text-muted-foreground">Your cart is empty</p>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{formatCents(item.price_cents)} each</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(item.id, -1)} className="rounded p-1 text-muted-foreground hover:text-foreground">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="rounded p-1 text-muted-foreground hover:text-foreground">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="w-16 text-right font-mono text-sm font-medium text-foreground">
                        {formatCents(item.price_cents * item.quantity)}
                      </span>
                      <button onClick={() => setCart((p) => p.filter((c) => c.id !== item.id))} className="text-destructive/60 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  <div className="pt-2">
                    <Input
                      placeholder="Order notes (optional)"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="text-sm"
                    />
                  </div>

                  {isLoggedIn && pointsBalance > 0 && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <p className="text-xs text-muted-foreground">
                        {"You have "}
                        <span className="font-bold text-primary">{pointsBalance}</span>
                        {" loyalty points available"}
                      </p>
                    </div>
                  )}

                  {orderResult?.error && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                      <p className="text-sm text-destructive">{orderResult.error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {cart.length > 0 && !orderResult?.success && (
              <div className="border-t border-border p-4">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-xl font-bold text-foreground">{formatCents(subtotal)}</span>
                </div>

                {!isLoggedIn ? (
                  <Button asChild className="w-full">
                    <Link href="/auth/login">Sign in to order</Link>
                  </Button>
                ) : (
                  <Button onClick={handlePlaceOrder} disabled={isPending} className="w-full gap-2">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                    Place Order &middot; {formatCents(subtotal)}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
