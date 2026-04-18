"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  GripVertical,
} from "lucide-react"

interface TicketType {
  id: string
  name: string
  description: string | null
  price_cents: number
  compare_at_price_cents: number | null
  quantity_total: number
  quantity_sold: number
  quantity_reserved: number
  min_per_order: number
  max_per_order: number
  sales_start_at: string | null
  sales_end_at: string | null
  visibility: string
  sort_order: number
  created_at: string
}

interface TicketTypeManagerProps {
  eventId: string
  tenantId: string
  ticketTypes: TicketType[]
}

export function TicketTypeManager({ eventId, tenantId, ticketTypes }: TicketTypeManagerProps) {
  const router = useRouter()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingType, setEditingType] = useState<TicketType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [comparePrice, setComparePrice] = useState("")
  const [quantity, setQuantity] = useState("")
  const [minOrder, setMinOrder] = useState("1")
  const [maxOrder, setMaxOrder] = useState("10")
  const [isVisible, setIsVisible] = useState(true)

  const resetForm = () => {
    setName("")
    setDescription("")
    setPrice("")
    setComparePrice("")
    setQuantity("")
    setMinOrder("1")
    setMaxOrder("10")
    setIsVisible(true)
    setError(null)
  }

  const openEditDialog = (type: TicketType) => {
    setEditingType(type)
    setName(type.name)
    setDescription(type.description || "")
    setPrice((type.price_cents / 100).toString())
    setComparePrice(type.compare_at_price_cents ? (type.compare_at_price_cents / 100).toString() : "")
    setQuantity(type.quantity_total.toString())
    setMinOrder(type.min_per_order.toString())
    setMaxOrder(type.max_per_order.toString())
    setIsVisible(type.visibility === "visible")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name || !quantity) {
      setError("Name and quantity are required")
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()

      const ticketData = {
        tenant_id: tenantId,
        event_id: eventId,
        name,
        description: description || null,
        price_cents: Math.round(parseFloat(price || "0") * 100),
        compare_at_price_cents: comparePrice ? Math.round(parseFloat(comparePrice) * 100) : null,
        quantity_total: parseInt(quantity),
        min_per_order: parseInt(minOrder) || 1,
        max_per_order: parseInt(maxOrder) || 10,
        visibility: isVisible ? "visible" : "hidden",
        sort_order: editingType ? editingType.sort_order : ticketTypes.length,
      }

      if (editingType) {
        const { error: updateError } = await supabase
          .from("ticket_types")
          .update(ticketData)
          .eq("id", editingType.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from("ticket_types")
          .insert(ticketData)

        if (insertError) throw insertError
      }

      setShowCreateDialog(false)
      setEditingType(null)
      resetForm()
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (typeId: string) => {
    if (!confirm("Are you sure you want to delete this ticket type?")) return

    try {
      const supabase = createClient()
      await supabase.from("ticket_types").delete().eq("id", typeId)
      router.refresh()
    } catch (err) {
      console.error("Failed to delete:", err)
    }
  }

  const sortedTypes = [...ticketTypes].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Ticket Types</h3>
          <p className="text-sm text-muted-foreground">
            Configure ticket tiers and pricing for your event
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Ticket Type
        </Button>
      </div>

      {sortedTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="mb-2 text-lg font-medium">No ticket types yet</p>
            <p className="mb-4 text-muted-foreground text-center max-w-sm">
              Create your first ticket type to start selling tickets
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Ticket Type
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedTypes.map(type => {
            const available = type.quantity_total - type.quantity_sold - type.quantity_reserved
            const soldPercent = type.quantity_total > 0 
              ? Math.round((type.quantity_sold / type.quantity_total) * 100)
              : 0
            const isFree = type.price_cents === 0

            return (
              <Card key={type.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="cursor-move text-muted-foreground">
                      <GripVertical className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{type.name}</h4>
                            {type.visibility === "hidden" && (
                              <Badge variant="outline" className="text-xs">
                                <EyeOff className="mr-1 h-3 w-3" />
                                Hidden
                              </Badge>
                            )}
                          </div>
                          {type.description && (
                            <p className="text-sm text-muted-foreground">{type.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            {isFree ? (
                              <span className="font-semibold text-emerald-600">Free</span>
                            ) : (
                              <>
                                <span className="font-semibold">
                                  ${(type.price_cents / 100).toFixed(2)}
                                </span>
                                {type.compare_at_price_cents && (
                                  <span className="ml-2 text-sm text-muted-foreground line-through">
                                    ${(type.compare_at_price_cents / 100).toFixed(2)}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(type)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => handleDelete(type.id)}
                                disabled={type.quantity_sold > 0}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>{type.quantity_sold} sold</span>
                            <span>{available} remaining</span>
                          </div>
                          <Progress value={soldPercent} className="h-2" />
                        </div>
                        <div className="text-muted-foreground">
                          {soldPercent}% sold
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog 
        open={showCreateDialog || !!editingType} 
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false)
            setEditingType(null)
            resetForm()
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingType ? "Edit Ticket Type" : "Add Ticket Type"}</DialogTitle>
            <DialogDescription>
              {editingType 
                ? "Update the details for this ticket type"
                : "Create a new ticket tier for your event"
              }
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., General Admission"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What&apos;s included with this ticket..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00 for free"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comparePrice">Compare at Price ($)</Label>
                <Input
                  id="comparePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Optional strikethrough"
                  value={comparePrice}
                  onChange={(e) => setComparePrice(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity Available *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                placeholder="Total tickets of this type"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minOrder">Min per Order</Label>
                <Input
                  id="minOrder"
                  type="number"
                  min="1"
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxOrder">Max per Order</Label>
                <Input
                  id="maxOrder"
                  type="number"
                  min="1"
                  value={maxOrder}
                  onChange={(e) => setMaxOrder(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Switch
                id="visibility"
                checked={isVisible}
                onCheckedChange={setIsVisible}
              />
              <Label htmlFor="visibility">Visible to public</Label>
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowCreateDialog(false)
                  setEditingType(null)
                  resetForm()
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingType ? "Save Changes" : "Create Ticket Type"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
