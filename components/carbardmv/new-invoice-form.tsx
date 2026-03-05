"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { createInvoice } from "@/lib/carbardmv-actions"
import { Plus, Loader2, Trash2 } from "lucide-react"

type LineItem = { description: string; quantity: number; unitPriceCents: number }

export function NewInvoiceForm({ clients }: { clients: Array<{ id: string; contact_name: string; email: string }> }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPriceCents: 0 },
  ])

  const addItem = () => setItems([...items, { description: "", quantity: 1, unitPriceCents: 0 }])
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx))
  const updateItem = (idx: number, field: keyof LineItem, value: string | number) => {
    setItems(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)))
  }

  const subtotal = items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    formData.set("items", JSON.stringify(items))
    await createInvoice(formData)
    setLoading(false)
    setOpen(false)
    setItems([{ description: "", quantity: 1, unitPriceCents: 0 }])
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-3 w-3" /> New Invoice</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs">Title *</Label>
            <Input name="title" required className="mt-1" placeholder="Event Services - March 2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Client</Label>
              <Select name="client_id">
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.contact_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Due Date</Label>
              <Input name="due_date" type="date" className="mt-1" />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-xs font-semibold">Line Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-1 h-3 w-3" /> Add Item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-end gap-2 rounded-lg border border-border bg-muted/50 p-2">
                  <div className="flex-1">
                    <Label className="text-[10px]">Description</Label>
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(idx, "description", e.target.value)}
                      className="mt-0.5 h-8 text-xs"
                    />
                  </div>
                  <div className="w-16">
                    <Label className="text-[10px]">Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                      className="mt-0.5 h-8 text-xs"
                    />
                  </div>
                  <div className="w-24">
                    <Label className="text-[10px]">Price (cents)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={item.unitPriceCents}
                      onChange={(e) => updateItem(idx, "unitPriceCents", parseInt(e.target.value) || 0)}
                      className="mt-0.5 h-8 text-xs"
                    />
                  </div>
                  {items.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeItem(idx)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-right text-xs text-muted-foreground">
              Subtotal: <span className="font-medium text-foreground">${(subtotal / 100).toFixed(2)}</span>
            </p>
          </div>

          <div>
            <Label className="text-xs">Tax Rate (%)</Label>
            <Input name="tax_rate" type="number" step="0.01" defaultValue="0" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea name="notes" rows={2} className="mt-1" placeholder="Payment instructions, notes..." />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
            {loading ? "Creating..." : "Create Invoice"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
