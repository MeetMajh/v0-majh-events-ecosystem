import { createClient } from "@/lib/supabase/server"
import { requireStaff } from "@/lib/auth/require-staff"
import { PosTerminal } from "@/components/pos/pos-terminal"

export const metadata = { title: "POS Terminal - MAJH EVENTS" }

export default async function PosPage() {
  await requireStaff("staff")
  const supabase = await createClient()

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")

  const { data: menuItems } = await supabase
    .from("menu_items")
    .select("*, categories(name, slug), inventory(quantity_on_hand, track_inventory)")
    .eq("is_available", true)
    .order("sort_order")

  return (
    <PosTerminal
      categories={categories ?? []}
      menuItems={menuItems ?? []}
    />
  )
}
