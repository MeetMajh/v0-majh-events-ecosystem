import { createClient } from "@/lib/supabase/server"
import { requireStaff } from "@/lib/auth/require-staff"
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
  await requireStaff("staff")
  const supabase = await createClient()

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
        <h2 className="text-lg font
