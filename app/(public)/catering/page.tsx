import { createClient } from "@/lib/supabase/server"
import Image from "next/image"
import { IMAGES } from "@/lib/images"
import { UtensilsCrossed } from "lucide-react"
import { CateringMenu } from "@/components/carbardmv/catering-menu"

export const metadata = {
  title: "Catering Services | CARBARDMV - MAJH EVENTS",
  description: "Full-service catering for events of any size. Browse our menu featuring BBQ, appetizers, entrees, and more. Request a custom quote.",
}

export default async function CateringPage() {
  const supabase = await createClient()

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from("cb_catering_categories").select("*").order("sort_order"),
    supabase
      .from("cb_catering_items")
      .select("*, cb_catering_categories(name, slug)")
      .eq("is_active", true)
      .order("sort_order"),
  ])

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      {/* Hero */}
      <div className="relative mb-10 overflow-hidden rounded-2xl border border-border">
        <div className="relative aspect-[21/8]">
          <Image
            src={IMAGES.events.barGaming}
            alt="CARBARDMV catering service setup"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-transparent" />
        </div>
        <div className="absolute inset-0 flex flex-col justify-center p-8 md:p-12">
          <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <UtensilsCrossed className="h-3 w-3" />
            Catering
          </div>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            Catering Services
          </h1>
          <p className="mt-3 max-w-lg text-muted-foreground">
            From intimate gatherings to large festivals -- our kitchen delivers bold flavors and professional service.
            Browse the menu and request a custom quote.
          </p>
        </div>
      </div>

      <CateringMenu categories={categories ?? []} items={items ?? []} />
    </div>
  )
}
