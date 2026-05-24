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
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Featured Hero Banner */}
      <div className="relative mb-10 overflow-hidden rounded-2xl border border-border shadow-2xl">
        <div className="relative aspect-[21/9] md:aspect-[21/8]">
          <Image 
            src="/images/bar-cafe-banner.jpeg" 
            alt="Bar & Cafe - Good Drinks, Great Times. Order online for pickup and enjoy your favorites at your convenience." 
            fill 
            className="object-cover" 
            priority 
          />
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
