"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatCents } from "@/lib/format"
import { createPosOrder } from "@/lib/admin-actions"
import { Minus, Plus, Trash2, ShoppingCart, CreditCard, Banknote, Loader2 } from "lucide-react"

interface CartItem {
  id: string
  name: string
  price_cents: number
  quantity: number
}

interface PosTerminalProps {
  categories: any[]
  menuItems: any[]
}

export function PosTerminal({ categories, menuItems }: PosTerminalProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerEmail, setCustomerEmail] = useState("")
  const [notes, setNotes] = useState("")
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState(false)

  const filteredItems = activeCategory
    ? menuItems.filter((i: any) => i.category_id === activeCategory)
    : menuItems

  const addToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id)
      if (existing) {
        return prev.map((c) => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      }
      return [...prev, { id: item.id, name: item.name, price_cents: item.price_cents, quantity: 1 }]
    })
    setSuccess(false)
  }

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    )
  }

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((c) => c.id !== id))
  }

  const subtotal = cart.reduce((sum, c) => sum + c.price_cents * c.quantity, 0)
  const total = subtotal

  const placeOrder = (paymentMethod: string) => {
    if (cart.length === 0) return

    const formData = new FormData()
    formData.set("items", JSON.stringify(cart.map((c) => ({ id: c.id, quantity: c.quantity, price_cents: c.price_cents }))))
    formData.set("payment_method", paymentMethod)
    if (customerEmail) formData.set("customer_email", customerEmail)
    if (notes) formData.set("notes", notes)

    startTransition(async () => {
      await createPosOrder(formData)
      setCart([])
      setCustomerEmail("")
      setNotes("")
      setSuccess(true)
    })
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Left: Item Grid */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        {/* Category Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-border p-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${!activeCategory ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${activeCategory === cat.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((item: any) => {
              const inv = item.inventory?.[0]
              const outOfStock = inv?.track_inventory && inv?.quantity_on_hand <= 0
              return (
                <button
                  key={item.id}
                  onClick={() => !outOfStock && addToCart(item)}
                  disabled={outOfStock}
                  className="flex flex-col rounded-lg border border-border bg-background p-3 text-left transition-all hover:border-primary/40 hover:shadow-sm disabled:opacity-40"
                >
                  <span className="text-sm font-medium text-foreground line-clamp-2">{item.name}</span>
                  <span className="mt-auto pt-2 text-xs text-muted-foreground">{item.categories?.name}</span>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-primary">{formatCents(item.price_cents)}</span>
                    {inv?.track_inventory && (
                      <span className={`text-xs ${inv.quantity_on_hand <= inv.low_stock_threshold ? "text-destructive" : "text-muted-foreground"}`}>
                        {inv.quantity_on_hand} left
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right: Cart */}
      <div className="flex w-80 flex-col rounded-xl border border-border bg-card lg:w-96">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Current Order</h2>
          <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {cart.length} {cart.length === 1 ? "item" : "items"}
          </span>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-3">
          {cart.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {success ? "Order placed successfully!" : "Tap items to add to order"}
            </p>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-lg bg-background p-2">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{formatCents(item.price_cents)} each</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.id, -1)} className="rounded p-1 text-muted-foreground hover:bg-muted">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-medium text-foreground">{item.quantity}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="rounded p-1 text-muted-foreground hover:bg-muted">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="w-16 text-right font-mono text-sm text-foreground">
                    {formatCents(item.price_cents * item.quantity)}
                  </span>
                  <button onClick={() => removeFromCart(item.id)} className="rounded p-1 text-destructive/60 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Customer + Notes */}
        <div className="space-y-2 border-t border-border p-3">
          <Input
            placeholder="Customer email (optional, for points)"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            className="h-8 text-xs"
          />
          <Input
            placeholder="Order notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        {/* Total + Payment */}
        <div className="border-t border-border p-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-bold text-foreground">{formatCents(total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => placeOrder("cash")}
              disabled={cart.length === 0 || isPending}
              variant="outline"
              className="gap-2"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
              Cash
            </Button>
            <Button
              onClick={() => placeOrder("stripe")}
              disabled={cart.length === 0 || isPending}
              className="gap-2"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Card
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
