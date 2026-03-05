"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

async function requireStaffRole(allowed: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (!data || !allowed.includes(data.role)) {
    redirect("/dashboard")
  }
  return { supabase, userId: user.id, role: data.role }
}

// ── Menu Items ──

export async function createMenuItem(formData: FormData) {
  const { supabase } = await requireStaffRole(["owner", "manager"])

  const item = {
    category_id: formData.get("category_id") as string,
    name: formData.get("name") as string,
    description: formData.get("description") as string,
    price_cents: Math.round(parseFloat(formData.get("price") as string) * 100),
    sku: (formData.get("sku") as string) || null,
    is_available: formData.get("is_available") === "on",
    is_featured: formData.get("is_featured") === "on",
  }

  const { data, error } = await supabase.from("menu_items").insert(item).select().single()

  if (error) {
    redirect(`/dashboard/admin/menu?error=${encodeURIComponent(error.message)}`)
  }

  // Create inventory record
  const trackInventory = formData.get("track_inventory") === "on"
  const qty = parseInt(formData.get("quantity") as string) || 0
  const threshold = parseInt(formData.get("low_stock_threshold") as string) || 5

  await supabase.from("inventory").insert({
    menu_item_id: data.id,
    quantity_on_hand: qty,
    low_stock_threshold: threshold,
    track_inventory: trackInventory,
  })

  revalidatePath("/dashboard/admin/menu")
  redirect("/dashboard/admin/menu")
}

export async function updateMenuItem(formData: FormData) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  const id = formData.get("id") as string

  const updates = {
    category_id: formData.get("category_id") as string,
    name: formData.get("name") as string,
    description: formData.get("description") as string,
    price_cents: Math.round(parseFloat(formData.get("price") as string) * 100),
    sku: (formData.get("sku") as string) || null,
    is_available: formData.get("is_available") === "on",
    is_featured: formData.get("is_featured") === "on",
  }

  const { error } = await supabase.from("menu_items").update(updates).eq("id", id)

  if (error) {
    redirect(`/dashboard/admin/menu?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath("/dashboard/admin/menu")
  redirect("/dashboard/admin/menu")
}

export async function deleteMenuItem(formData: FormData) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  const id = formData.get("id") as string

  await supabase.from("menu_items").delete().eq("id", id)

  revalidatePath("/dashboard/admin/menu")
}

// ── Inventory ──

export async function updateInventory(formData: FormData) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  const menuItemId = formData.get("menu_item_id") as string
  const quantity = parseInt(formData.get("quantity_on_hand") as string)
  const threshold = parseInt(formData.get("low_stock_threshold") as string)

  await supabase
    .from("inventory")
    .update({ quantity_on_hand: quantity, low_stock_threshold: threshold })
    .eq("menu_item_id", menuItemId)

  revalidatePath("/dashboard/admin/inventory")
}

// ── Orders ──

export async function updateOrderStatus(formData: FormData) {
  const { supabase } = await requireStaffRole(["owner", "manager", "staff"])
  const orderId = formData.get("order_id") as string
  const status = formData.get("status") as string

  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId)

  if (error) {
    return
  }

  // If completing order and payment was cash, mark as paid and award points
  if (status === "completed") {
    const { data: order } = await supabase
      .from("orders")
      .select("*, customer_id, total_cents, payment_method, payment_status")
      .eq("id", orderId)
      .single()

    if (order && order.payment_status !== "paid" && order.payment_method === "cash") {
      await supabase.from("orders").update({ payment_status: "paid" }).eq("id", orderId)
    }

    // Award points: 1 point per dollar spent
    if (order?.customer_id && order.total_cents > 0) {
      const pointsToAward = Math.floor(order.total_cents / 100)

      if (pointsToAward > 0) {
        await supabase.from("points_transactions").insert({
          user_id: order.customer_id,
          order_id: orderId,
          amount: pointsToAward,
          type: "purchase_earn",
          description: `Earned from order ${order.order_number}`,
        })

        await supabase.rpc("increment_points", { uid: order.customer_id, pts: pointsToAward }).catch(() => {
          // Fallback: manual update
          supabase.from("profiles")
            .select("points_balance")
            .eq("id", order.customer_id)
            .single()
            .then(({ data: profile }) => {
              if (profile) {
                supabase.from("profiles")
                  .update({ points_balance: profile.points_balance + pointsToAward })
                  .eq("id", order.customer_id)
              }
            })
        })
      }
    }
  }

  revalidatePath("/dashboard/admin/orders")
  revalidatePath("/dashboard/pos")
}

// ── Staff Roles ──

export async function assignStaffRole(formData: FormData) {
  const { supabase } = await requireStaffRole(["owner"])
  const email = formData.get("email") as string
  const role = formData.get("role") as string

  // Find user by email via profiles
  const { data: users } = await supabase.auth.admin.listUsers()
  const targetUser = users?.users?.find((u) => u.email === email)

  if (!targetUser) {
    redirect(`/dashboard/admin/staff?error=${encodeURIComponent("No user found with that email")}`)
  }

  const { error } = await supabase
    .from("staff_roles")
    .upsert({ user_id: targetUser.id, role }, { onConflict: "user_id" })

  if (error) {
    redirect(`/dashboard/admin/staff?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath("/dashboard/admin/staff")
  redirect("/dashboard/admin/staff")
}

export async function removeStaffRole(formData: FormData) {
  const { supabase } = await requireStaffRole(["owner"])
  const userId = formData.get("user_id") as string

  await supabase.from("staff_roles").delete().eq("user_id", userId)

  revalidatePath("/dashboard/admin/staff")
}

// ── POS: Create order (staff-facing) ──

export async function createPosOrder(formData: FormData) {
  const { supabase } = await requireStaffRole(["owner", "manager", "staff"])

  const itemsJson = formData.get("items") as string
  const items: Array<{ id: string; quantity: number; price_cents: number }> = JSON.parse(itemsJson)
  const paymentMethod = formData.get("payment_method") as string
  const customerEmail = formData.get("customer_email") as string | null
  const notes = formData.get("notes") as string | null

  const subtotal = items.reduce((sum, i) => sum + i.price_cents * i.quantity, 0)
  const total = subtotal

  // Find customer if email provided
  let customerId: string | null = null
  if (customerEmail) {
    const { data: users } = await supabase.auth.admin.listUsers()
    const found = users?.users?.find((u) => u.email === customerEmail)
    customerId = found?.id ?? null
  }

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      customer_id: customerId,
      order_number: "",
      status: "confirmed",
      type: "in_store",
      subtotal_cents: subtotal,
      total_cents: total,
      payment_method: paymentMethod,
      payment_status: paymentMethod === "cash" ? "pending" : "pending",
      notes,
    })
    .select()
    .single()

  if (error || !order) {
    return { error: error?.message || "Failed to create order" }
  }

  // Insert order items
  const orderItems = items.map((i) => ({
    order_id: order.id,
    menu_item_id: i.id,
    quantity: i.quantity,
    unit_price_cents: i.price_cents,
    total_cents: i.price_cents * i.quantity,
  }))

  await supabase.from("order_items").insert(orderItems)

  // Decrement inventory
  for (const item of items) {
    await supabase.rpc("decrement_inventory", { item_id: item.id, qty: item.quantity }).catch(async () => {
      const { data: inv } = await supabase
        .from("inventory")
        .select("quantity_on_hand")
        .eq("menu_item_id", item.id)
        .single()
      if (inv) {
        await supabase
          .from("inventory")
          .update({ quantity_on_hand: Math.max(0, inv.quantity_on_hand - item.quantity) })
          .eq("menu_item_id", item.id)
      }
    })
  }

  revalidatePath("/dashboard/pos")
  revalidatePath("/dashboard/admin/orders")
  revalidatePath("/dashboard/admin/inventory")
}
