"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

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
// SEGMENTS
// ════════════════════════════════════════════

export async function createSegment(formData: FormData) {
  const { supabase, userId } = await requireStaff()

  // Build criteria object from form
  const criteria: Record<string, any> = {}
  
  const minLtv = formData.get("min_ltv") as string
  if (minLtv && parseInt(minLtv) > 0) {
    criteria.min_lifetime_value = parseInt(minLtv) * 100 // Convert to cents
  }
  
  const statusFilter = formData.get("status_filter") as string
  if (statusFilter && statusFilter !== "any") {
    criteria.status = [statusFilter]
  }
  
  const cityFilter = formData.get("city_filter") as string
  if (cityFilter) {
    criteria.city = cityFilter
  }
  
  const sourceFilter = formData.get("source_filter") as string
  if (sourceFilter && sourceFilter !== "any") {
    criteria.source = sourceFilter
  }
  
  const hasBirthday = formData.get("has_birthday") === "on"
  if (hasBirthday) {
    criteria.has_birthday = true
  }

  const { data: segment, error } = await supabase
    .from("crm_segments")
    .insert({
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      criteria,
      is_dynamic: formData.get("is_dynamic") === "on",
      created_by: userId,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // If dynamic, populate members based on criteria
  if (segment && formData.get("is_dynamic") === "on") {
    await refreshSegmentMembers(segment.id, criteria)
  }

  revalidatePath("/dashboard/carbardmv/segments")
  return { success: true, segmentId: segment?.id }
}

export async function refreshSegmentMembers(segmentId: string, criteria: Record<string, any>) {
  const supabase = await createClient()

  // Build query based on criteria
  let query = supabase.from("cb_clients").select("id")

  if (criteria.min_lifetime_value) {
    query = query.gte("total_revenue_cents", criteria.min_lifetime_value)
  }

  if (criteria.status && Array.isArray(criteria.status)) {
    query = query.in("status", criteria.status)
  }

  if (criteria.city) {
    query = query.ilike("city", `%${criteria.city}%`)
  }

  if (criteria.source) {
    query = query.eq("source", criteria.source)
  }

  if (criteria.has_birthday) {
    query = query.not("birthday", "is", null)
  }

  const { data: clients } = await query

  // Clear existing members
  await supabase.from("crm_segment_members").delete().eq("segment_id", segmentId)

  // Insert new members
  if (clients && clients.length > 0) {
    await supabase.from("crm_segment_members").insert(
      clients.map((c: { id: string }) => ({
        segment_id: segmentId,
        client_id: c.id,
      }))
    )

    // Update member count
    await supabase
      .from("crm_segments")
      .update({ member_count: clients.length, updated_at: new Date().toISOString() })
      .eq("id", segmentId)
  }

  return { success: true, memberCount: clients?.length || 0 }
}

export async function deleteSegment(segmentId: string) {
  const { supabase } = await requireStaff()

  const { error } = await supabase.from("crm_segments").delete().eq("id", segmentId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/segments")
  return { success: true }
}

// ════════════════════════════════════════════
// MARKETING CAMPAIGNS
// ════════════════════════════════════════════

export async function createCampaign(formData: FormData) {
  const { supabase, userId } = await requireStaff()

  const { data: campaign, error } = await supabase
    .from("marketing_campaigns")
    .insert({
      name: formData.get("name") as string,
      type: (formData.get("type") as string) || "email",
      template_id: (formData.get("template_id") as string) || null,
      segment_id: (formData.get("segment_id") as string) || null,
      subject: (formData.get("subject") as string) || null,
      body: (formData.get("body") as string) || null,
      status: "draft",
      created_by: userId,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/marketing")
  return { success: true, campaignId: campaign?.id }
}

export async function updateCampaignStatus(campaignId: string, status: string) {
  const { supabase } = await requireStaff()

  const updates: Record<string, any> = { status, updated_at: new Date().toISOString() }
  if (status === "sent") updates.sent_at = new Date().toISOString()

  const { error } = await supabase.from("marketing_campaigns").update(updates).eq("id", campaignId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/marketing")
  return { success: true }
}

export async function scheduleCampaign(campaignId: string, scheduledAt: string) {
  const { supabase } = await requireStaff()

  const { error } = await supabase
    .from("marketing_campaigns")
    .update({
      status: "scheduled",
      scheduled_at: scheduledAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/marketing")
  return { success: true }
}

// ════════════════════════════════════════════
// MARKETING TEMPLATES
// ════════════════════════════════════════════

export async function createTemplate(formData: FormData) {
  const { supabase, userId } = await requireStaff()

  // Extract variables from body using {{variable}} pattern
  const body = formData.get("body") as string
  const variableMatches = body.match(/\{\{(\w+)\}\}/g) || []
  const variables = [...new Set(variableMatches.map((v) => v.replace(/\{\{|\}\}/g, "")))]

  const { error } = await supabase.from("marketing_templates").insert({
    name: formData.get("name") as string,
    type: (formData.get("type") as string) || "email",
    subject: (formData.get("subject") as string) || null,
    body,
    variables,
    is_active: true,
    created_by: userId,
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/marketing/templates")
  return { success: true }
}

export async function updateTemplate(templateId: string, formData: FormData) {
  const { supabase } = await requireStaff()

  const body = formData.get("body") as string
  const variableMatches = body.match(/\{\{(\w+)\}\}/g) || []
  const variables = [...new Set(variableMatches.map((v) => v.replace(/\{\{|\}\}/g, "")))]

  const { error } = await supabase
    .from("marketing_templates")
    .update({
      name: formData.get("name") as string,
      type: (formData.get("type") as string) || "email",
      subject: (formData.get("subject") as string) || null,
      body,
      variables,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/marketing/templates")
  return { success: true }
}

// ════════════════════════════════════════════
// AUTOMATION RULES
// ════════════════════════════════════════════

export async function toggleAutomation(ruleId: string, isActive: boolean) {
  const { supabase } = await requireStaff()

  const { error } = await supabase
    .from("automation_rules")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", ruleId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/marketing/automations")
  return { success: true }
}

export async function updateAutomationRule(ruleId: string, formData: FormData) {
  const { supabase } = await requireStaff()

  const triggerConfig: Record<string, any> = {}
  const daysBefore = formData.get("days_before") as string
  const daysAfter = formData.get("days_after") as string
  const delayHours = formData.get("delay_hours") as string

  if (daysBefore) triggerConfig.days_before = parseInt(daysBefore)
  if (daysAfter) triggerConfig.days_after = parseInt(daysAfter)
  if (delayHours) triggerConfig.delay_hours = parseInt(delayHours)

  const { error } = await supabase
    .from("automation_rules")
    .update({
      name: formData.get("name") as string,
      template_id: (formData.get("template_id") as string) || null,
      trigger_config: triggerConfig,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ruleId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/carbardmv/marketing/automations")
  return { success: true }
}
