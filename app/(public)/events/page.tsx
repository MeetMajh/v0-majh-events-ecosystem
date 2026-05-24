import { createClient } from "@/lib/supabase/server"
import Image from "next/image"
import { IMAGES } from "@/lib/images"
import { PartyPopper } from "lucide-react"
import { EventBookingWizard } from "@/components/carbardmv/event-booking-wizard"

export const metadata = {
  title: "CARBARDMV Events - Book Your Event | MAJH EVENTS",
  description: "Full-service mobile entertainment events. Browse packages, customize add-ons, add catering, and book online with a secure deposit.",
}

export default async function EventsPage() {
  const supabase = await createClient()

  const [
    { data: packages },
    { data: addons },
    { data: cateringCategories },
    { data: cateringItems },
  ] = await Promise.all([
    supabase
      .from("cb_event_packages")
      .select("*")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("cb_event_addons")
      .select("*")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("cb_catering_categories")
      .select("*")
      .order("sort_order"),
    supabase
      .from("cb_catering_items")
      .select("*, cb_catering_categories(name, slug)")
      .eq("is_active", true)
      .order("sort_order"),
  ])

  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      {/* Hero */}
      <div className="relative mb-10 overflow-hidden rounded-2xl border border-border">
        <div className="relative aspect-[21/8]">
          <Image
            src={IMAGES.events.outdoor}
            alt="MAJH EVENTS outdoor mobile entertainment event"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-transparent" />
        </div>
        <div className="absolute inset-0 flex flex-col justify-center p-8 md:p-12">
          <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <PartyPopper className="h-3 w-3" />
            Book Your Event
          </div>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            CARBARDMV Events
          </h1>
          <p className="mt-3 max-w-lg text-muted-foreground">
            The mobile entertainment hub that brings the MAJH experience to you.
            Choose a package, customize with add-ons, add catering, and book with a 25% deposit.
          </p>
        </div>
      </div>

      {/* Booking Wizard */}
      <EventBookingWizard
        packages={packages ?? []}
        addons={addons ?? []}
        cateringCategories={cateringCategories ?? []}
        cateringItems={cateringItems ?? []}
        isLoggedIn={!!user}
      />
    </div>
  )
}
