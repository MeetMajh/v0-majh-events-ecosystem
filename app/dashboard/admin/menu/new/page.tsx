import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { createMenuItem } from "@/lib/admin-actions"
import { MenuItemForm } from "@/components/admin/menu-item-form"

export default async function NewMenuItemPage() {
  await requireRole(["owner", "manager"])
  const supabase = await createClient()
  const { data: categories } = await supabase.from("categories").select("id, name, slug").order("sort_order")

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Add Menu Item</h1>
      <MenuItemForm categories={categories ?? []} action={createMenuItem} />
    </div>
  )
}
