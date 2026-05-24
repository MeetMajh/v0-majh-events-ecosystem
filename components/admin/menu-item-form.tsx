"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"

interface Category {
  id: string
  name: string
  slug: string
}

interface MenuItemFormProps {
  categories: Category[]
  action: (formData: FormData) => Promise<void>
  defaultValues?: {
    id?: string
    category_id?: string
    name?: string
    description?: string
    price_cents?: number
    sku?: string
    is_available?: boolean
    is_featured?: boolean
    track_inventory?: boolean
    quantity_on_hand?: number
    low_stock_threshold?: number
  }
}

export function MenuItemForm({ categories, action, defaultValues }: MenuItemFormProps) {
  const isEdit = !!defaultValues?.id

  return (
    <form action={action} className="mx-auto max-w-2xl space-y-6">
      {defaultValues?.id && <input type="hidden" name="id" value={defaultValues.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Item Name</Label>
          <Input id="name" name="name" defaultValue={defaultValues?.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category_id">Category</Label>
          <select
            id="category_id"
            name="category_id"
            defaultValue={defaultValues?.category_id}
            required
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="" className="bg-card">Select category...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id} className="bg-card">{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" defaultValue={defaultValues?.description ?? ""} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="price">Price ($)</Label>
          <Input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues?.price_cents ? (defaultValues.price_cents / 100).toFixed(2) : ""}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" name="sku" defaultValue={defaultValues?.sku ?? ""} placeholder="e.g. DRK-005" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">Initial Stock</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min="0"
            defaultValue={defaultValues?.quantity_on_hand ?? 0}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="low_stock_threshold">Low Stock Threshold</Label>
          <Input
            id="low_stock_threshold"
            name="low_stock_threshold"
            type="number"
            min="0"
            defaultValue={defaultValues?.low_stock_threshold ?? 5}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox name="is_available" defaultChecked={defaultValues?.is_available ?? true} />
          Available for sale
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox name="is_featured" defaultChecked={defaultValues?.is_featured ?? false} />
          Featured item
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox name="track_inventory" defaultChecked={defaultValues?.track_inventory ?? true} />
          Track inventory
        </label>
      </div>

      <div className="flex gap-3">
        <Button type="submit">{isEdit ? "Update Item" : "Create Item"}</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/admin/menu">Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
