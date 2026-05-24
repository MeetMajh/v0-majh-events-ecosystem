import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { formatCents } from "@/lib/format"
import { deleteMenuItem } from "@/lib/admin-actions"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, Pencil, Trash2, Star } from "lucide-react"

export default async function MenuAdminPage() {
  await requireRole(["owner", "manager"])
  const supabase = await createClient()

  const { data: categories } = await supabase.from("categories").select("*").order("sort_order")
  const { data: items } = await supabase
    .from("menu_items")
    .select("*, categories(name, slug)")
    .order("sort_order")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Menu Management</h1>
          <p className="text-sm text-muted-foreground">{items?.length ?? 0} items across {categories?.length ?? 0} categories</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/admin/menu/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Link>
        </Button>
      </div>

      {categories?.map((cat) => {
        const catItems = items?.filter((i: any) => i.category_id === cat.id) ?? []
        if (catItems.length === 0) return null

        return (
          <div key={cat.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">{cat.name}</h2>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{cat.type}</span>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Item</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">SKU</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Price</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {catItems.map((item: any) => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{item.name}</span>
                          {item.is_featured && <Star className="h-3 w-3 fill-primary text-primary" />}
                        </div>
                        {item.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.sku || "—"}</td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">{formatCents(item.price_cents)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${item.is_available ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"}`}>
                          {item.is_available ? "Available" : "Unavailable"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/admin/menu/${item.id}`}>
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="sr-only">Edit</span>
                            </Link>
                          </Button>
                          <form action={deleteMenuItem}>
                            <input type="hidden" name="id" value={item.id} />
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
