import { createClient } from "@/lib/supabase/server"
import Image from "next/image"
import { IMAGES } from "@/lib/images"
import { UtensilsCrossed } from "lucide-react"
import { ShopMenu } from "@/components/shop/shop-menu"

export const metadata = { title: "Bar & Cafe - Order Online | MAJH EVENTS" }

export default async function BarCafePage() {
  const supabase = await createClient()

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")

  const { data: menuItems } = await supabase
    .from("menu_items")
    .select("*, categories(name, slug, type), inventory(quantity_on_hand, track_inventory)")
    .eq("is_available", true)
    .order("sort_order")

  // Get current user profile for points
  const { data: { user } } = await supabase.auth.getUser()
  let pointsBalance = 0
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("points_balance")
      .eq("id", user.id)
      .single()
    pointsBalance = profile?.points_balance ?? 0
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      {/* Hero */}
      <div className="relative mb-10 overflow-hidden rounded-2xl border border-border">
        <div className="relative aspect-[21/8]">
          <Image src={IMAGES.events.barGaming} alt="MAJH EVENTS bar and cafe" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-transparent" />
        </div>
        <div className="absolute inset-0 flex flex-col justify-center p-8 md:p-12">
          <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <UtensilsCrossed className="h-3 w-3" />
            Order Online
          </div>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-5xl">Bar & Cafe</h1>
          <p className="mt-3 max-w-lg text-muted-foreground">
            Browse our full menu and order online for pickup. Every purchase earns loyalty points.
          </p>
        </div>
      </div>

      {/* Live Menu */}
      <ShopMenu
        categories={categories ?? []}
        menuItems={menuItems ?? []}
        isLoggedIn={!!user}
        pointsBalance={pointsBalance}
      />
    </div>
  )
}
