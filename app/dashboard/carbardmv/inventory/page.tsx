import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getUserRole } from "@/lib/roles"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { NewInventoryItemForm } from "@/components/carbardmv/new-inventory-item-form"
import { InventoryAdjustment } from "@/components/carbardmv/inventory-adjustment"
import { Boxes, AlertTriangle, Package, TrendingDown } from "lucide-react"

const CATEGORY_LABELS: Record<string, string> = {
  food: "Food",
  beverage: "Beverage",
  supplies: "Supplies",
  equipment: "Equipment",
  disposables: "Disposables",
  other: "Other",
}

export default async function InventoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/sign-in")

  const role = await getUserRole(user.id)
  if (role !== "admin" && role !== "staff") redirect("/dashboard")

  const { data: items } = await supabase
    .from("cb_inventory_items")
    .select("*")
    .eq("is_active", true)
    .order("category")
    .order("name")

  const lowStockItems = items?.filter((i) => i.current_stock <= i.min_stock) || []
  const totalValue = items?.reduce((sum, i) => sum + (i.current_stock * i.cost_per_unit_cents), 0) || 0

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader
        title="CARBARDMV Inventory"
        description="Track supplies, equipment, and stock levels"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{lowStockItems.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(items?.map((i) => i.category)).size}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(totalValue / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Inventory Items</h2>
        <NewInventoryItemForm />
      </div>

      {lowStockItems.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map((item) => (
                <Badge key={item.id} variant="destructive">
                  {item.name}: {item.current_stock} {item.unit} (min: {item.min_stock})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items?.map((item) => (
          <Card key={item.id} className={item.current_stock <= item.min_stock ? "border-destructive/50" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{item.name}</CardTitle>
                  <Badge variant="secondary" className="mt-1">
                    {CATEGORY_LABELS[item.category] || item.category}
                  </Badge>
                </div>
                <InventoryAdjustment item={item} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Stock:</span>{" "}
                  <span className={item.current_stock <= item.min_stock ? "font-semibold text-destructive" : "font-semibold"}>
                    {item.current_stock} {item.unit}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Min:</span>{" "}
                  <span className="font-semibold">{item.min_stock} {item.unit}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Cost:</span>{" "}
                  <span className="font-semibold">
                    ${(item.cost_per_unit_cents / 100).toFixed(2)}/{item.unit}
                  </span>
                </div>
                {item.supplier && (
                  <div>
                    <span className="text-muted-foreground">Supplier:</span>{" "}
                    <span className="font-semibold">{item.supplier}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!items || items.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Boxes className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No inventory items yet</p>
            <p className="text-muted-foreground">Add your first item to start tracking</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
