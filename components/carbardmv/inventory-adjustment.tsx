"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Plus, Minus } from "lucide-react"
import { adjustInventory } from "@/lib/carbardmv-actions"
import { toast } from "sonner"

interface InventoryItem {
  id: string
  name: string
  current_stock: number
  unit: string
}

const REASONS = [
  { value: "restock", label: "Restock (+)" },
  { value: "used", label: "Used (-)" },
  { value: "waste", label: "Waste (-)" },
  { value: "adjustment", label: "Adjustment (+/-)" },
  { value: "returned", label: "Returned (+)" },
]

export function InventoryAdjustment({ item }: { item: InventoryItem }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState("used")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    let qty = parseFloat(formData.get("quantity") as string) || 0
    const notes = formData.get("notes") as string

    // For used/waste, make quantity negative
    if ((reason === "used" || reason === "waste") && qty > 0) {
      qty = -qty
    }

    const result = await adjustInventory({
      item_id: item.id,
      change_qty: qty,
      reason: reason as "restock" | "used" | "waste" | "adjustment" | "returned",
      notes: notes || undefined,
    })

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`${item.name} stock updated`)
      setOpen(false)
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <Plus className="mr-1 h-3 w-3" />
          <Minus className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm font-medium">Adjust: {item.name}</p>
          <p className="text-xs text-muted-foreground">
            Current: {item.current_stock} {item.unit}
          </p>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              step="0.01"
              required
              placeholder={`Amount in ${item.unit}`}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" placeholder="Optional" />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Updating..." : "Update"}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
