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
  const { supabase, userId } = await requireStaffRole(["owner", "manager"])
  const email = formData.get("email") as string
  const role = formData.get("role") as string

  // Find user by email via profiles
  const { data: users } = await supabase.auth.admin.listUsers()
  const targetUser = users?.users?.find((u) => u.email === email)

  if (!targetUser) {
    // User doesn't exist - create an invitation instead
    const { error: inviteError } = await supabase
      .from("invitations")
      .insert({
        email: email.toLowerCase(),
        invitation_type: "staff",
        role,
        invited_by: userId,
      })

    if (inviteError) {
      redirect(`/dashboard/admin/staff?error=${encodeURIComponent(inviteError.message)}`)
    }

    revalidatePath("/dashboard/admin/staff")
    redirect(`/dashboard/admin/staff?success=${encodeURIComponent(`Invitation sent to ${email}`)}`)
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

export async function cancelInvitation(formData: FormData) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  const invitationId = formData.get("invitation_id") as string

  await supabase
    .from("invitations")
    .update({ status: "cancelled" })
    .eq("id", invitationId)

  revalidatePath("/dashboard/admin/staff")
}

export async function resendInvitation(formData: FormData) {
  const { supabase, userId } = await requireStaffRole(["owner", "manager"])
  const invitationId = formData.get("invitation_id") as string

  // Reset the invitation expiry
  await supabase
    .from("invitations")
    .update({ 
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: "pending"
    })
    .eq("id", invitationId)

  revalidatePath("/dashboard/admin/staff")
  redirect(`/dashboard/admin/staff?success=${encodeURIComponent("Invitation resent")}`)
}

// Get all pending invitations
export async function getPendingInvitations(type?: string) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  
  let query = supabase
    .from("invitations")
    .select("*, inviter:profiles!invited_by(first_name, last_name)")
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
  
  if (type) {
    query = query.eq("invitation_type", type)
  }
  
  const { data } = await query
  return data ?? []
}

// ── User Management ──

export async function getAllUsers() {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
  
  const { data: staffRoles } = await supabase
    .from("staff_roles")
    .select("user_id, role")
  
  const staffMap = new Map(staffRoles?.map(sr => [sr.user_id, sr.role]) ?? [])
  
  return authUsers?.users?.map(user => ({
    id: user.id,
    email: user.email,
    email_confirmed_at: user.email_confirmed_at,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    profile: profiles?.find(p => p.id === user.id),
    staff_role: staffMap.get(user.id),
  })) ?? []
}

export async function createUserManually(formData: FormData) {
  const { supabase, userId } = await requireStaffRole(["owner", "manager"])
  
  const email = formData.get("email") as string
  const firstName = formData.get("first_name") as string
  const lastName = formData.get("last_name") as string
  const role = formData.get("role") as string | null
  const sendInvite = formData.get("send_invite") === "on"
  
  // Check if user already exists
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const existingUser = authUsers?.users?.find(u => u.email === email.toLowerCase())
  
  if (existingUser) {
    redirect(`/dashboard/admin/users?error=${encodeURIComponent("User with this email already exists")}`)
  }
  
  if (sendInvite) {
    // Create invitation for new user
    const { error: inviteError } = await supabase
      .from("invitations")
      .insert({
        email: email.toLowerCase(),
        invitation_type: role ? "staff" : "general",
        role: role || null,
        invited_by: userId,
      })
    
    if (inviteError) {
      redirect(`/dashboard/admin/users?error=${encodeURIComponent(inviteError.message)}`)
    }
    
    revalidatePath("/dashboard/admin/users")
    redirect(`/dashboard/admin/users?success=${encodeURIComponent(`Invitation sent to ${email}`)}`)
  } else {
    // Create user directly using admin API
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      email_confirm: true, // Skip email confirmation for manual creation
      user_metadata: { first_name: firstName, last_name: lastName },
    })
    
    if (createError || !newUser.user) {
      redirect(`/dashboard/admin/users?error=${encodeURIComponent(createError?.message || "Failed to create user")}`)
    }
    
    // Create profile
    await supabase.from("profiles").upsert({
      id: newUser.user.id,
      first_name: firstName,
      last_name: lastName,
    })
    
    // Assign role if specified
    if (role) {
      await supabase.from("staff_roles").upsert({
        user_id: newUser.user.id,
        role,
      }, { onConflict: "user_id" })
    }
    
    revalidatePath("/dashboard/admin/users")
    redirect(`/dashboard/admin/users?success=${encodeURIComponent(`User ${email} created successfully`)}`)
  }
}

export async function deleteUser(formData: FormData) {
  const { supabase } = await requireStaffRole(["owner"])
  const userId = formData.get("user_id") as string
  
  // Delete user from auth (this will cascade to profiles via trigger if set up)
  const { error } = await supabase.auth.admin.deleteUser(userId)
  
  if (error) {
    redirect(`/dashboard/admin/users?error=${encodeURIComponent(error.message)}`)
  }
  
  revalidatePath("/dashboard/admin/users")
}

// ── Accept Invitation (for new user signup) ──

export async function acceptInvitation(token: string, userId: string) {
  const supabase = await createClient()
  
  // Find the invitation
  const { data: invitation, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .single()
  
  if (error || !invitation) {
    return { error: "Invalid or expired invitation" }
  }
  
  // Mark invitation as accepted
  await supabase
    .from("invitations")
    .update({ 
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
    })
    .eq("id", invitation.id)
  
  // Apply the invitation effect
  if (invitation.invitation_type === "staff" && invitation.role) {
    await supabase.from("staff_roles").upsert({
      user_id: userId,
      role: invitation.role,
    }, { onConflict: "user_id" })
  } else if (invitation.invitation_type === "tournament_participant" && invitation.tournament_id) {
    // Register user for tournament
    await supabase.from("tournament_registrations").insert({
      tournament_id: invitation.tournament_id,
      user_id: userId,
      status: "registered",
    })
  }
  
  return { success: true, invitation }
}

export async function getInvitationByToken(token: string) {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from("invitations")
    .select("*, tournaments(name, slug)")
    .eq("token", token)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .single()
  
  return data
}

export async function removeStaffRole(formData: FormData) {
  const { supabase } = await requireStaffRole(["owner"])
  const userId = formData.get("user_id") as string

  await supabase.from("staff_roles").delete().eq("user_id", userId)

  revalidatePath("/dashboard/admin/staff")
}

// ── Organizer Requests ──

export async function getOrganizerRequests(status?: string) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  
  let query = supabase
    .from("organizer_requests")
    .select(`
      *,
      user:profiles!user_id(id, first_name, last_name, avatar_url),
      reviewer:profiles!reviewed_by(first_name, last_name)
    `)
    .order("created_at", { ascending: false })
  
  if (status) {
    query = query.eq("status", status)
  }
  
  const { data, error } = await query
  if (error) console.error("Error fetching organizer requests:", error)
  return data ?? []
}

export async function approveOrganizerRequest(formData: FormData) {
  const { supabase, userId } = await requireStaffRole(["owner", "manager"])
  const requestId = formData.get("request_id") as string
  const notes = formData.get("notes") as string | null
  
  // Get the request
  const { data: request, error: fetchError } = await supabase
    .from("organizer_requests")
    .select("user_id")
    .eq("id", requestId)
    .single()
  
  if (fetchError || !request) {
    redirect(`/dashboard/admin/organizers?error=${encodeURIComponent("Request not found")}`)
  }
  
  // Update request status
  const { error: updateError } = await supabase
    .from("organizer_requests")
    .update({
      status: "approved",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_notes: notes,
    })
    .eq("id", requestId)
  
  if (updateError) {
    redirect(`/dashboard/admin/organizers?error=${encodeURIComponent(updateError.message)}`)
  }
  
  // Grant organizer role
  await supabase.from("staff_roles").upsert({
    user_id: request.user_id,
    role: "organizer",
  }, { onConflict: "user_id" })
  
  revalidatePath("/dashboard/admin/organizers")
  redirect(`/dashboard/admin/organizers?success=${encodeURIComponent("Request approved - user is now an organizer")}`)
}

export async function rejectOrganizerRequest(formData: FormData) {
  const { supabase, userId } = await requireStaffRole(["owner", "manager"])
  const requestId = formData.get("request_id") as string
  const notes = formData.get("notes") as string | null
  
  const { error } = await supabase
    .from("organizer_requests")
    .update({
      status: "rejected",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_notes: notes,
    })
    .eq("id", requestId)
  
  if (error) {
    redirect(`/dashboard/admin/organizers?error=${encodeURIComponent(error.message)}`)
  }
  
  revalidatePath("/dashboard/admin/organizers")
  redirect(`/dashboard/admin/organizers?success=${encodeURIComponent("Request rejected")}`)
}

// User-facing action to submit an organizer request
export async function submitOrganizerRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect("/auth/login")
  }
  
  const reason = formData.get("reason") as string
  const experience = formData.get("experience") as string
  const gamesOfInterest = formData.getAll("games") as string[]
  
  // Check if user already has a pending request
  const { data: existing } = await supabase
    .from("organizer_requests")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .single()
  
  if (existing) {
    return { error: "You already have a pending organizer request" }
  }
  
  const { error } = await supabase.from("organizer_requests").insert({
    user_id: user.id,
    reason,
    experience,
    games_of_interest: gamesOfInterest,
  })
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath("/dashboard")
  return { success: true }
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
