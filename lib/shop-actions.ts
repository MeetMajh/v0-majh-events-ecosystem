"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function placeOnlineOrder(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: "You must be signed in to place an order" }
  }

  const itemsJson = formData.get("items") as string
  const items: Array<{ id: string; quantity: number; price_cents: number }> = JSON.parse(itemsJson)
  const pointsToRedeem = parseInt(formData.get("points_redeem") as string) || 0
  const notes = formData.get("notes") as string | null

  if (items.length === 0) {
    return { error: "Cart is empty" }
  }

  // Validate prices server-side
  const { data: menuItems } = await supabase
    .from("menu_items")
    .select("id, price_cents, is_available")
    .in("id", items.map((i) => i.id))

  if (!menuItems) return { error: "Failed to validate items" }

  const validatedItems = items.map((item) => {
    const dbItem = menuItems.find((m) => m.id === item.id)
    if (!dbItem || !dbItem.is_available) throw new Error(`Item ${item.id} is unavailable`)
    return { ...item, price_cents: dbItem.price_cents } // Use server price
  })

  const subtotal = validatedItems.reduce((sum, i) => sum + i.price_cents * i.quantity, 0)

  // Validate points redemption
  let discountCents = 0
  if (pointsToRedeem > 0) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("points_balance")
      .eq("id", user.id)
      .single()

    const maxRedeem = Math.min(pointsToRedeem, profile?.points_balance ?? 0, Math.floor(subtotal / 2))
    discountCents = maxRedeem // 1 point = 1 cent discount
  }

  const total = subtotal - discountCents

  // Create order
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      customer_id: user.id,
      order_number: "",
      status: "pending",
      type: "online",
      subtotal_cents: subtotal,
      discount_cents: discountCents,
      total_cents: total,
      points_redeemed: pointsToRedeem > 0 ? discountCents : 0,
      payment_method: "stripe",
      payment_status: "pending",
      notes,
    })
    .select()
    .single()

  if (error || !order) {
    return { error: error?.message || "Failed to create order" }
  }

  // Insert order items
  const orderItems = validatedItems.map((i) => ({
    order_id: order.id,
    menu_item_id: i.id,
    quantity: i.quantity,
    unit_price_cents: i.price_cents,
    total_cents: i.price_cents * i.quantity,
  }))

  await supabase.from("order_items").insert(orderItems)

  // Deduct points if used
  if (discountCents > 0) {
    await supabase.from("points_transactions").insert({
      user_id: user.id,
      order_id: order.id,
      amount: -discountCents,
      type: "redemption",
      description: `Redeemed for order ${order.order_number}`,
    })

    const { data: profile } = await supabase
      .from("profiles")
      .select("points_balance")
      .eq("id", user.id)
      .single()

    if (profile) {
      await supabase
        .from("profiles")
        .update({ points_balance: Math.max(0, profile.points_balance - discountCents) })
        .eq("id", user.id)
    }
  }

  // Decrement inventory
  for (const item of validatedItems) {
    const { data: inv } = await supabase
      .from("inventory")
      .select("quantity_on_hand, track_inventory")
      .eq("menu_item_id", item.id)
      .single()

    if (inv?.track_inventory) {
      await supabase
        .from("inventory")
        .update({ quantity_on_hand: Math.max(0, inv.quantity_on_hand - item.quantity) })
        .eq("menu_item_id", item.id)
    }
  }

  revalidatePath("/bar-cafe")
  revalidatePath("/dashboard/orders")

  return { success: true, orderNumber: order.order_number, orderId: order.id }
}
