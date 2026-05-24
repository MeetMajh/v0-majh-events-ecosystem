import { createClient } from "@/lib/supabase/server"
import Image from "next/image"
import { IMAGES } from "@/lib/images"
import { Monitor } from "lucide-react"
import { RentalCatalog } from "@/components/carbardmv/rental-catalog"

export const metadata = {
  title: "Equipment Rentals | CARBARDMV - MAJH EVENTS",
  description: "Rent gaming consoles, speakers, AV equipment, tents, furniture, and more for your events. Browse our catalog and book online.",
}

export default async function RentalsPage() {
  const supabase = await createClient()

  const { data: items } = await supabase
    .from("cb_rental_items")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")

  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      {/* Hero */}
      <div className="relative mb-10 overflow-hidden rounded-2xl border border-border">
        <div className="relative aspect-[21/8]">
          <Image
            src={IMAGES.events.consoleStation}
            alt="Console gaming stations and equipment available for rent"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-transparent" />
        </div>
        <div className="absolute inset-0 flex flex-col justify-center p-8 md:p-12">
          <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Monitor className="h-3 w-3" />
            Rent Equipment
          </div>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            Equipment Rentals
          </h1>
          <p className="mt-3 max-w-lg text-muted-foreground">
            AV equipment, gaming stations, furniture, tents, and lighting.
            Browse the catalog, build your cart, and book with a 50% deposit.
          </p>
        </div>
      </div>

      <RentalCatalog items={items ?? []} isLoggedIn={!!user} />
    </div>
  )
}
