import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { updateInventory } from "@/lib/admin-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertTriangle, Package } from "lucide-react"

export default async function InventoryPage() {
  await requireRole(["owner", "manager"])
  const supabase = await createClient()

  const { data: inventory } = await supabase
    .from("inventory")
    .select("*, menu_items(id, name, sku, categories(name))")
    .eq("track_inventory", true)
    .order("quantity_on_hand", { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inventory Management</h1>
        <p className="text-sm text-muted-foreground">Track stock levels and set low-stock alerts</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Item</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">SKU</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">On Hand</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Threshold</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Update</th>
            </tr>
          </thead>
          <tbody>
            {inventory?.map((inv: any) => {
              const isLow = inv.quantity_on_hand <= inv.low_stock_threshold
              return (
                <tr key={inv.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{inv.menu_items?.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{inv.menu_items?.categories?.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inv.menu_items?.sku || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-mono font-bold ${isLow ? "text-destructive" : "text-foreground"}`}>
                      {inv.quantity_on_hand}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-muted-foreground">{inv.low_stock_threshold}</td>
                  <td className="px-4 py-3 text-center">
                    {isLow ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        Low
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
                        <Package className="h-3 w-3" />
                        OK
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <form action={updateInventory} className="flex items-center justify-end gap-2">
                      <input type="hidden" name="menu_item_id" value={inv.menu_items?.id} />
                      <Input
                        name="quantity_on_hand"
                        type="number"
                        min="0"
                        defaultValue={inv.quantity_on_hand}
                        className="h-8 w-20 text-center"
                      />
                      <Input
                        name="low_stock_threshold"
                        type="hidden"
                        value={inv.low_stock_threshold}
                      />
                      <Button size="sm" type="submit" variant="outline">Save</Button>
                    </form>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
