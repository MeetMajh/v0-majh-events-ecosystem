import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { updateMenuItem } from "@/lib/admin-actions"
import { MenuItemForm } from "@/components/admin/menu-item-form"
import { notFound } from "next/navigation"

export default async function EditMenuItemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRole(["owner", "manager"])
  const { id } = await params
  const supabase = await createClient()
  
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("sort_order")
  
  const { data: item } = await supabase
    .from("menu_items")
    .select("*, inventory(*)")
    .eq("id", id)
    .single()
  
  if (!item) {
    notFound()
  }

  const defaultValues = {
    id: item.id,
    category_id: item.category_id,
    name: item.name,
    description: item.description,
    price_cents: item.price_cents,
    sku: item.sku,
    is_available: item.is_available,
    is_featured: item.is_featured,
    track_inventory: item.inventory?.[0]?.track_inventory ?? false,
    quantity_on_hand: item.inventory?.[0]?.quantity_on_hand ?? 0,
    low_stock_threshold: item.inventory?.[0]?.low_stock_threshold ?? 5,
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Edit Menu Item</h1>
      <MenuItemForm 
        categories={categories ?? []} 
        action={updateMenuItem} 
        defaultValues={defaultValues} 
      />
    </div>
  )
}
