"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe"

// ── Auth helper ──

async function requireStaff() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data } = await supabase.from("staff_roles").select("role").eq("user_id", user.id).single()

  if (!data || !["admin", "staff", "owner", "manager"].includes(data.role)) {
    redirect("/dashboard")
  }
  return { supabase, userId: user.id, role: data.role }
}

// ════════════════════════════════════════════
// STRIPE CHECKOUT SESSIONS
// ════════════════════════════════════════════

export async function createEventBookingCheckout(bookingData: {
  packageId: string
  addonIds: string[]
  guestCount: number
  eventDate: string
  startTime?: string
  contactName: string
  contactEmail: string
  contactPhone?: string
  venueNotes?: string
  cateringItems?: Array<{ itemId: string; quantity: number }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch package from DB (server-side price validation)
  const { data: pkg } = await supabase
    .from("cb_event_packages")
    .select("*")
    .eq("id", bookingData.packageId)
    .single()

  if (!pkg) throw new Error("Package not found")

  // Fetch addons from DB
  let addonsTotal = 0
  const addonDetails: Array<{ id: string; name: string; price_cents: number }> = []
  if (bookingData.addonIds.length > 0) {
    const { data: addons } = await supabase
      .from("cb_event_addons")
      .select("id, name, price_cents, price_type")
      .in("id", bookingData.addonIds)

    if (addons) {
      for (const addon of addons) {
        let cost = addon.price_cents
        if (addon.price_type === "per_person") cost *= bookingData.guestCount
        addonsTotal += cost
        addonDetails.push({ id: addon.id, name: addon.name, price_cents: cost })
      }
    }
  }

  // Fetch catering items from DB
  let cateringTotal = 0
  if (bookingData.cateringItems && bookingData.cateringItems.length > 0) {
    const itemIds = bookingData.cateringItems.map((ci) => ci.itemId)
    const { data: cItems } = await supabase
      .from("cb_catering_items")
      .select("id, name, price_cents, price_type")
      .in("id", itemIds)

    if (cItems) {
      for (const ci of bookingData.cateringItems) {
        const dbItem = cItems.find((c) => c.id === ci.itemId)
        if (dbItem) {
          let cost = dbItem.price_cents
          if (dbItem.price_type === "per_person") cost *= bookingData.guestCount
          cateringTotal += cost * ci.quantity
        }
      }
    }
  }

  const totalCents = pkg.base_price_cents + addonsTotal + cateringTotal
  const depositCents = Math.round(totalCents * 0.25) // 25% deposit

  // Create booking record
  const { data: booking, error: bookingError } = await supabase
    .from("cb_bookings")
    .insert({
      client_id: user?.id ?? null,
      package_id: bookingData.packageId,
      contact_name: bookingData.contactName,
      contact_email: bookingData.contactEmail,
      contact_phone: bookingData.contactPhone ?? null,
      event_date: bookingData.eventDate,
      start_time: bookingData.startTime ?? null,
      guest_count: bookingData.guestCount,
      venue_notes: bookingData.venueNotes ?? null,
      status: "inquiry",
      total_cents: totalCents,
      deposit_cents: depositCents,
    })
    .select()
    .single()

  if (bookingError || !booking) throw new Error(bookingError?.message || "Failed to create booking")

  // Insert booking addons
  if (addonDetails.length > 0) {
    await supabase.from("cb_booking_addons").insert(
      addonDetails.map((a) => ({
        booking_id: booking.id,
        addon_id: a.id,
        quantity: 1,
        line_total_cents: a.price_cents,
      }))
    )
  }

  // Create Stripe checkout session for deposit
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"
  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    return_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${pkg.name} - Event Deposit (25%)`,
            description: `Event on ${bookingData.eventDate} for ${bookingData.guestCount} guests`,
          },
          unit_amount: depositCents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    metadata: {
      type: "event_booking",
      booking_id: booking.id,
    },
  })

  // Store stripe session id
  await supabase.from("cb_bookings").update({ stripe_session_id: session.id }).eq("id", booking.id)

  return { clientSecret: session.client_secret, bookingId: booking.id }
}

export async function createRentalCheckout(rentalData: {
  items: Array<{ itemId: string; quantity: number; rateType: "daily" | "weekend" | "weekly" }>
  pickupDate: string
  returnDate: string
  contactName: string
  contactEmail: string
  contactPhone?: string
  notes?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch rental items from DB for server-side price validation
  const itemIds = rentalData.items.map((i) => i.itemId)
  const { data: dbItems } = await supabase
    .from("cb_rental_items")
    .select("id, name, daily_rate_cents, weekend_rate_cents, weekly_rate_cents")
    .in("id", itemIds)

  if (!dbItems) throw new Error("Failed to load rental items")

  let totalCents = 0
  const lineItems: Array<{ itemId: string; quantity: number; rateType: string; lineTotalCents: number }> = []
  for (const ri of rentalData.items) {
    const dbItem = dbItems.find((d) => d.id === ri.itemId)
    if (!dbItem) continue
    const rate =
      ri.rateType === "weekly"
        ? dbItem.weekly_rate_cents
        : ri.rateType === "weekend"
          ? dbItem.weekend_rate_cents
          : dbItem.daily_rate_cents
    const lineTotal = rate * ri.quantity
    totalCents += lineTotal
    lineItems.push({ itemId: ri.itemId, quantity: ri.quantity, rateType: ri.rateType, lineTotalCents: lineTotal })
  }

  const depositCents = Math.round(totalCents * 0.5) // 50% deposit for rentals

  // Create rental booking
  const { data: rental, error: rentalError } = await supabase
    .from("cb_rental_bookings")
    .insert({
      client_id: user?.id ?? null,
      contact_name: rentalData.contactName,
      contact_email: rentalData.contactEmail,
      contact_phone: rentalData.contactPhone ?? null,
      pickup_date: rentalData.pickupDate,
      return_date: rentalData.returnDate,
      total_cents: totalCents,
      deposit_cents: depositCents,
      notes: rentalData.notes ?? null,
    })
    .select()
    .single()

  if (rentalError || !rental) throw new Error(rentalError?.message || "Failed to create rental booking")

  // Insert items
  await supabase.from("cb_rental_booking_items").insert(
    lineItems.map((li) => ({
      booking_id: rental.id,
      item_id: li.itemId,
      quantity: li.quantity,
      rate_type: li.rateType,
      line_total_cents: li.lineTotalCents,
    }))
  )

  // Create Stripe session
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"
  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    return_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Equipment Rental Deposit (50%)",
            description: `Pickup: ${rentalData.pickupDate} | Return: ${rentalData.returnDate}`,
          },
          unit_amount: depositCents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    metadata: {
      type: "rental_booking",
      rental_id: rental.id,
    },
  })

  await supabase.from("cb_rental_bookings").update({ stripe_session_id: session.id }).eq("id", rental.id)

  return { clientSecret: session.client_secret, rentalId: rental.id }
}

// ════════════════════════════════════════════
// CATERING INQUIRY (public, no auth required)
// ════════════════════════════════════════════

export async function submitCateringInquiry(formData: FormData) {
  const supabase = await createClient()

  const inquiry = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    phone: (formData.get("phone") as string) || null,
    event_type: (formData.get("event_type") as string) || null,
    guest_count: parseInt(formData.get("guest_count") as string) || null,
    event_date: (formData.get("event_date") as string) || null,
    dietary_needs: (formData.get("dietary_needs") as string) || null,
    message: (formData.get("message") as string) || null,
  }

  const { error } = await supabase.from("cb_catering_inquiries").insert(inquiry)
  if (error) return { error: error.message }

  return { success: true }
}

// ════════════════════════════════════════════
// DASHBOARD: BOOKING MANAGEMENT
// ════════════════════════════════════════════

export async function updateBookingStatus(bookingId: string, status: string) {
  const { supabase } = await requireStaff()

  const { error } = await supabase.from("cb_bookings").update({ status, updated_at: new Date().toISOString() }).eq("id", bookingId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/events")
  return { success: true }
}

export async function updateRentalStatus(rentalId: string, status: string) {
  const { supabase } = await requireStaff()

  const { error } = await supabase
    .from("cb_rental_bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", rentalId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/rentals")
  return { success: true }
}

export async function updateCateringOrderStatus(orderId: string, status: string) {
  const { supabase } = await requireStaff()

  const { error } = await supabase
    .from("cb_catering_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/catering")
  return { success: true }
}

export async function updateInquiryStatus(inquiryId: string, status: string) {
  const { supabase } = await requireStaff()

  const { error } = await supabase.from("cb_catering_inquiries").update({ status }).eq("id", inquiryId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/catering")
  return { success: true }
}

// ════════════════════════════════════════════
// CRM: CLIENT MANAGEMENT
// ════════════════════════════════════════════

export async function createClient_CRM(formData: FormData) {
  const { supabase } = await requireStaff()

  const client = {
    contact_name: formData.get("contact_name") as string,
    email: formData.get("email") as string,
    phone: (formData.get("phone") as string) || null,
    company_name: (formData.get("company_name") as string) || null,
    address: (formData.get("address") as string) || null,
    city: (formData.get("city") as string) || null,
    state: (formData.get("state") as string) || null,
    zip: (formData.get("zip") as string) || null,
    source: (formData.get("source") as string) || "website",
    status: (formData.get("status") as string) || "lead",
    notes: (formData.get("notes") as string) || null,
  }

  const { error } = await supabase.from("cb_clients").insert(client)
  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/clients")
  return { success: true }
}

export async function updateClient_CRM(clientId: string, formData: FormData) {
  const { supabase } = await requireStaff()

  const updates = {
    contact_name: formData.get("contact_name") as string,
    email: formData.get("email") as string,
    phone: (formData.get("phone") as string) || null,
    company_name: (formData.get("company_name") as string) || null,
    address: (formData.get("address") as string) || null,
    city: (formData.get("city") as string) || null,
    state: (formData.get("state") as string) || null,
    zip: (formData.get("zip") as string) || null,
    source: (formData.get("source") as string) || "website",
    status: (formData.get("status") as string) || "lead",
    notes: (formData.get("notes") as string) || null,
    birthday: (formData.get("birthday") as string) || null,
    anniversary: (formData.get("anniversary") as string) || null,
    preferred_contact: (formData.get("preferred_contact") as string) || "email",
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from("cb_clients").update(updates).eq("id", clientId)
  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/clients")
  return { success: true }
}

export async function addClientInteraction(formData: FormData) {
  const { supabase, userId } = await requireStaff()

  const interaction = {
    client_id: formData.get("client_id") as string,
    staff_id: userId,
    type: formData.get("type") as string,
    subject: (formData.get("subject") as string) || null,
    body: (formData.get("body") as string) || null,
  }

  const { error } = await supabase.from("cb_client_interactions").insert(interaction)
  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/clients")
  return { success: true }
}

// ════════════════════════════════════════════
// PROPOSALS
// ════════════════════════════════════════════

export async function createProposal(formData: FormData) {
  const { supabase } = await requireStaff()

  // Auto-generate proposal number
  const { count } = await supabase.from("cb_proposals").select("*", { count: "exact", head: true })
  const proposalNumber = `PROP-${String((count ?? 0) + 1).padStart(4, "0")}`

  const itemsJson = formData.get("items") as string
  const items: Array<{ description: string; quantity: number; unitPriceCents: number }> = JSON.parse(itemsJson)

  const subtotalCents = items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0)
  const taxRate = parseFloat(formData.get("tax_rate") as string) || 0
  const taxCents = Math.round(subtotalCents * (taxRate / 100))
  const totalCents = subtotalCents + taxCents

  const { data: proposal, error } = await supabase
    .from("cb_proposals")
    .insert({
      proposal_number: proposalNumber,
      client_id: (formData.get("client_id") as string) || null,
      booking_id: (formData.get("booking_id") as string) || null,
      title: formData.get("title") as string,
      intro_text: (formData.get("intro_text") as string) || null,
      terms_text: (formData.get("terms_text") as string) || null,
      valid_until: (formData.get("valid_until") as string) || null,
      subtotal_cents: subtotalCents,
      tax_rate: taxRate,
      tax_cents: taxCents,
      total_cents: totalCents,
    })
    .select()
    .single()

  if (error || !proposal) return { error: error?.message || "Failed to create proposal" }

  // Insert line items
  if (items.length > 0) {
    await supabase.from("cb_proposal_items").insert(
      items.map((item, idx) => ({
        proposal_id: proposal.id,
        description: item.description,
        quantity: item.quantity,
        unit_price_cents: item.unitPriceCents,
        line_total_cents: item.unitPriceCents * item.quantity,
        sort_order: idx,
      }))
    )
  }

  revalidatePath("/dashboard/carbardmv/proposals")
  return { success: true, proposalId: proposal.id }
}

export async function updateProposalStatus(proposalId: string, status: string) {
  const { supabase } = await requireStaff()

  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === "sent") updates.sent_at = new Date().toISOString()
  if (status === "accepted") updates.accepted_at = new Date().toISOString()

  const { error } = await supabase.from("cb_proposals").update(updates).eq("id", proposalId)
  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/proposals")
  return { success: true }
}

// ════════════════════════════════════════════
// INVOICES
// ════════════════════════════════════════════

export async function createInvoice(formData: FormData) {
  const { supabase } = await requireStaff()

  const { count } = await supabase.from("cb_invoices").select("*", { count: "exact", head: true })
  const invoiceNumber = `INV-${String((count ?? 0) + 1).padStart(4, "0")}`

  const itemsJson = formData.get("items") as string
  const items: Array<{ description: string; quantity: number; unitPriceCents: number }> = JSON.parse(itemsJson)

  const subtotalCents = items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0)
  const taxRate = parseFloat(formData.get("tax_rate") as string) || 0
  const taxCents = Math.round(subtotalCents * (taxRate / 100))
  const totalCents = subtotalCents + taxCents

  const { data: invoice, error } = await supabase
    .from("cb_invoices")
    .insert({
      invoice_number: invoiceNumber,
      client_id: (formData.get("client_id") as string) || null,
      booking_id: (formData.get("booking_id") as string) || null,
      proposal_id: (formData.get("proposal_id") as string) || null,
      title: formData.get("title") as string,
      notes: (formData.get("notes") as string) || null,
      due_date: (formData.get("due_date") as string) || null,
      subtotal_cents: subtotalCents,
      tax_rate: taxRate,
      tax_cents: taxCents,
      total_cents: totalCents,
    })
    .select()
    .single()

  if (error || !invoice) return { error: error?.message || "Failed to create invoice" }

  if (items.length > 0) {
    await supabase.from("cb_invoice_items").insert(
      items.map((item, idx) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price_cents: item.unitPriceCents,
        line_total_cents: item.unitPriceCents * item.quantity,
        sort_order: idx,
      }))
    )
  }

  revalidatePath("/dashboard/carbardmv/invoices")
  return { success: true, invoiceId: invoice.id }
}

export async function updateInvoiceStatus(invoiceId: string, status: string) {
  const { supabase } = await requireStaff()

  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === "sent") updates.sent_at = new Date().toISOString()
  if (status === "paid") updates.paid_at = new Date().toISOString()

  const { error } = await supabase.from("cb_invoices").update(updates).eq("id", invoiceId)
  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/invoices")
  return { success: true }
}

export async function recordInvoicePayment(invoiceId: string, amountCents: number) {
  const { supabase } = await requireStaff()

  const { data: invoice } = await supabase.from("cb_invoices").select("amount_paid_cents, total_cents").eq("id", invoiceId).single()
  if (!invoice) return { error: "Invoice not found" }

  const newPaid = invoice.amount_paid_cents + amountCents
  const status = newPaid >= invoice.total_cents ? "paid" : "partial"

  const { error } = await supabase
    .from("cb_invoices")
    .update({
      amount_paid_cents: newPaid,
      status,
      updated_at: new Date().toISOString(),
      ...(status === "paid" ? { paid_at: new Date().toISOString() } : {}),
    })
    .eq("id", invoiceId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/invoices")
  return { success: true }
}

// ════════════════════════════════════════════
// STAFF SCHEDULING
// ════════════════════════════════════════════

export async function createStaffShift(formData: FormData) {
  console.log("[v0] createStaffShift called")
  
  try {
    const { supabase } = await requireStaff()
    console.log("[v0] Staff auth passed")

    const shift = {
      staff_id: formData.get("staff_id") as string,
      booking_id: (formData.get("booking_id") as string) || null,
      shift_date: formData.get("shift_date") as string,
      start_time: formData.get("start_time") as string,
      end_time: formData.get("end_time") as string,
      role: formData.get("role") as string,
      location: (formData.get("location") as string) || null,
      notes: (formData.get("notes") as string) || null,
      status: "scheduled",
    }

    console.log("[v0] Creating staff shift:", shift)

    const { data, error } = await supabase.from("cb_staff_shifts").insert(shift).select()
    
    if (error) {
      console.log("[v0] Error creating shift:", error.message, error.code)
      return { error: error.message }
    }

    console.log("[v0] Shift created successfully:", data)

    revalidatePath("/dashboard/carbardmv/staff")
    return { success: true }
  } catch (e: any) {
    console.log("[v0] createStaffShift exception:", e.message)
    return { error: e.message || "Failed to create shift" }
  }
}

export async function updateShiftStatus(shiftId: string, status: string) {
  const { supabase } = await requireStaff()

  const { error } = await supabase.from("cb_staff_shifts").update({ status }).eq("id", shiftId)
  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/staff")
  return { success: true }
}

export async function deleteStaffShift(shiftId: string) {
  const { supabase } = await requireStaff()

  const { error } = await supabase.from("cb_staff_shifts").delete().eq("id", shiftId)
  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/staff")
  return { success: true }
}

// ════════════════════════════════════════════
// PREP TASKS
// ═════════════��══���═══════════════════════════

export async function createPrepTask(data: {
  title: string
  description?: string
  category: string
  priority: string
  start_date?: string
  due_date?: string
  due_time?: string
  booking_id?: string
  catering_order_id?: string
  assigned_to?: string
  time_estimate_minutes?: number
  tags?: string[]
}) {
  try {
    const { supabase } = await requireStaff()

    const task = {
      booking_id: data.booking_id || null,
      catering_order_id: data.catering_order_id || null,
      assigned_to: data.assigned_to || null,
      title: data.title,
      description: data.description || null,
      category: data.category,
      priority: data.priority,
      start_date: data.start_date || null,
      due_date: data.due_date || null,
      due_time: data.due_time || null,
      time_estimate_minutes: data.time_estimate_minutes || null,
      tags: data.tags || null,
      status: "pending",
    }

    const { error } = await supabase.from("cb_prep_tasks").insert(task).select()
    
    if (error) {
      return { error: error.message }
    }

    revalidatePath("/dashboard/carbardmv/prep")
    return { success: true }
  } catch (e: any) {
    return { error: e.message || "Failed to create prep task" }
  }
}

export async function updatePrepTaskStatus(taskId: string, status: string) {
  const { supabase } = await requireStaff()

  const updates: Record<string, unknown> = { status }
  if (status === "done") updates.completed_at = new Date().toISOString()

  const { error } = await supabase.from("cb_prep_tasks").update(updates).eq("id", taskId)
  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/prep")
  return { success: true }
}

// ════════════════════════════════════════════
// INVENTORY MANAGEMENT (CB)
// ════════════════════════════════════════════

export async function createInventoryItem_CB(formData: FormData) {
  const { supabase } = await requireStaff()

  const item = {
    name: formData.get("name") as string,
    category: formData.get("category") as string,
    unit: formData.get("unit") as string,
    current_stock: parseFloat(formData.get("current_stock") as string) || 0,
    min_stock: parseFloat(formData.get("min_stock") as string) || 0,
    cost_per_unit_cents: Math.round(parseFloat(formData.get("cost_per_unit") as string) * 100) || 0,
    supplier: (formData.get("supplier") as string) || null,
  }

  const { error } = await supabase.from("cb_inventory_items").insert(item)
  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/inventory")
  return { success: true }
}

export async function adjustInventoryStock(itemId: string, changeQty: number, reason: string, notes?: string) {
  const { supabase, userId } = await requireStaff()

  // Log the change
  const { error: logError } = await supabase.from("cb_inventory_log").insert({
    item_id: itemId,
    change_qty: changeQty,
    reason,
    staff_id: userId,
    notes: notes ?? null,
  })

  if (logError) return { error: logError.message }

  // Update current stock
  const { data: item } = await supabase.from("cb_inventory_items").select("current_stock").eq("id", itemId).single()
  if (item) {
    await supabase
      .from("cb_inventory_items")
      .update({
        current_stock: Math.max(0, item.current_stock + changeQty),
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)
  }

  revalidatePath("/dashboard/carbardmv/inventory")
  return { success: true }
}

// ════════════════════════════════════════════
// EVENT PACKAGE / ADDON MANAGEMENT (Admin)
// ════════════════════════════════════════════

export async function createEventPackage(formData: FormData) {
  const { supabase } = await requireStaff()

  const name = formData.get("name") as string
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

  const pkg = {
    name,
    slug,
    description: (formData.get("description") as string) || null,
    base_price_cents: Math.round(parseFloat(formData.get("base_price") as string) * 100),
    duration_hours: parseFloat(formData.get("duration_hours") as string) || 4,
    max_guests: parseInt(formData.get("max_guests") as string) || null,
    min_guests: parseInt(formData.get("min_guests") as string) || 10,
    category: formData.get("category") as string,
  }

  const { error } = await supabase.from("cb_event_packages").insert(pkg)
  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/events")
  return { success: true }
}

// ════════════════════════════════════════════
// STRIPE WEBHOOK HANDLER HELPER
// ════════════════════════════════════════════

export async function handleStripePaymentSuccess(sessionId: string) {
  const supabase = await createClient()

  // Check event bookings
  const { data: booking } = await supabase
    .from("cb_bookings")
    .select("id")
    .eq("stripe_session_id", sessionId)
    .single()

  if (booking) {
    await supabase
      .from("cb_bookings")
      .update({ deposit_paid: true, status: "deposit_paid", updated_at: new Date().toISOString() })
      .eq("id", booking.id)
    return
  }

  // Check rental bookings
  const { data: rental } = await supabase
    .from("cb_rental_bookings")
    .select("id")
    .eq("stripe_session_id", sessionId)
    .single()

  if (rental) {
    await supabase
      .from("cb_rental_bookings")
      .update({ deposit_paid: true, status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", rental.id)
  }
}

// ============================================
// Proposal Actions (Public)
// ============================================

export async function acceptProposal(proposalId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("cb_proposals")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", proposalId)
    .in("status", ["sent", "viewed"])

  if (error) return { error: error.message }
  return { success: true }
}

// ============================================
// Invoice Payment (Public checkout)
// ============================================

export async function createInvoicePaymentCheckout(invoiceId: string) {
  const supabase = await createClient()

  // Fetch invoice from DB for server-side validation
  const { data: invoice } = await supabase
    .from("cb_invoices")
    .select("*, cb_clients(contact_name, email)")
    .eq("id", invoiceId)
    .single()

  if (!invoice) throw new Error("Invoice not found")

  // Calculate balance due
  const balanceDue = invoice.total_cents - invoice.amount_paid_cents
  if (balanceDue <= 0) throw new Error("Invoice is already paid")

  // Create Stripe checkout session
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"
  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    return_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Invoice ${invoice.invoice_number}`,
            description: invoice.title || "Payment for services",
          },
          unit_amount: balanceDue,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    customer_email: invoice.cb_clients?.email || undefined,
    metadata: {
      type: "invoice_payment",
      invoice_id: invoice.id,
    },
  })

  // Update invoice to mark as viewed
  if (invoice.status === "sent") {
    await supabase
      .from("cb_invoices")
      .update({ status: "viewed", updated_at: new Date().toISOString() })
      .eq("id", invoiceId)
  }

  return { clientSecret: session.client_secret }
}
