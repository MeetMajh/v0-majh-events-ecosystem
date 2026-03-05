"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

async function requireStaffRole(allowed: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const { data } = await supabase.from("staff_roles").select("role").eq("user_id", user.id).single()
  if (!data || !allowed.includes(data.role)) redirect("/dashboard")
  return { supabase, userId: user.id }
}

// ── News Articles ──

export async function getArticles(filters?: { category?: string; limit?: number }) {
  const supabase = await createClient()
  let query = supabase
    .from("news_articles")
    .select("*, profiles!news_articles_author_id_fkey(display_name, avatar_url), tournaments(name, slug)")
    .eq("is_published", true)
    .order("published_at", { ascending: false })

  if (filters?.category) query = query.eq("category", filters.category)
  if (filters?.limit) query = query.limit(filters.limit)

  const { data } = await query
  return data ?? []
}

export async function getArticleBySlug(slug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("news_articles")
    .select("*, profiles!news_articles_author_id_fkey(display_name, avatar_url), tournaments(name, slug)")
    .eq("slug", slug)
    .single()
  return data
}

export async function getAllArticlesAdmin() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("news_articles")
    .select("*, profiles!news_articles_author_id_fkey(display_name)")
    .order("created_at", { ascending: false })
  return data ?? []
}

export async function createArticle(formData: FormData) {
  const { supabase, userId } = await requireStaffRole(["owner", "manager"])
  const title = formData.get("title") as string
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  const isPublished = formData.get("is_published") === "on"

  const { error } = await supabase.from("news_articles").insert({
    title,
    slug,
    excerpt: formData.get("excerpt") as string,
    content: formData.get("content") as string,
    cover_image_url: formData.get("cover_image_url") as string || null,
    category: formData.get("category") as string,
    tournament_id: formData.get("tournament_id") as string || null,
    author_id: userId,
    is_published: isPublished,
    published_at: isPublished ? new Date().toISOString() : null,
  })

  if (error) return { error: error.message }
  revalidatePath("/news")
  revalidatePath("/dashboard/admin/news")
  return { success: true }
}

export async function updateArticle(formData: FormData) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  const id = formData.get("id") as string
  const isPublished = formData.get("is_published") === "on"

  const { error } = await supabase.from("news_articles").update({
    title: formData.get("title") as string,
    excerpt: formData.get("excerpt") as string,
    content: formData.get("content") as string,
    cover_image_url: formData.get("cover_image_url") as string || null,
    category: formData.get("category") as string,
    is_published: isPublished,
    published_at: isPublished ? new Date().toISOString() : null,
  }).eq("id", id)

  if (error) return { error: error.message }
  revalidatePath("/news")
  return { success: true }
}

export async function deleteArticle(id: string) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  await supabase.from("news_articles").delete().eq("id", id)
  revalidatePath("/news")
  revalidatePath("/dashboard/admin/news")
  return { success: true }
}

// ── Livestreams ──

export async function getLivestreams() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("livestreams")
    .select("*, tournaments(name, slug)")
    .order("is_live", { ascending: false })
    .order("scheduled_at", { ascending: true })
  return data ?? []
}

export async function createLivestream(formData: FormData) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  const url = formData.get("embed_url") as string
  let platform: string = "other"
  if (url.includes("twitch")) platform = "twitch"
  else if (url.includes("youtube") || url.includes("youtu.be")) platform = "youtube"
  else if (url.includes("kick")) platform = "kick"

  const { error } = await supabase.from("livestreams").insert({
    title: formData.get("title") as string,
    platform,
    embed_url: url,
    channel_name: formData.get("channel_name") as string || null,
    tournament_id: formData.get("tournament_id") as string || null,
    is_live: formData.get("is_live") === "on",
    scheduled_at: formData.get("scheduled_at") as string || null,
  })

  if (error) return { error: error.message }
  revalidatePath("/live")
  return { success: true }
}

export async function toggleLiveStatus(id: string, isLive: boolean) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  await supabase.from("livestreams").update({ is_live: isLive }).eq("id", id)
  revalidatePath("/live")
  return { success: true }
}

export async function deleteLivestream(id: string) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  await supabase.from("livestreams").delete().eq("id", id)
  revalidatePath("/live")
  return { success: true }
}

// ── Event Calendar ──

export async function getCalendarEvents(startDate?: string, endDate?: string) {
  const supabase = await createClient()
  let query = supabase
    .from("event_calendar")
    .select("*, tournaments(name, slug)")
    .order("start_date")

  if (startDate) query = query.gte("start_date", startDate)
  if (endDate) query = query.lte("start_date", endDate)

  const { data } = await query
  return data ?? []
}

export async function createCalendarEvent(formData: FormData) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  const { error } = await supabase.from("event_calendar").insert({
    title: formData.get("title") as string,
    description: formData.get("description") as string,
    type: formData.get("type") as string,
    tournament_id: formData.get("tournament_id") as string || null,
    start_date: formData.get("start_date") as string,
    end_date: formData.get("end_date") as string || null,
    location: formData.get("location") as string || null,
    is_all_day: formData.get("is_all_day") === "on",
    color: formData.get("color") as string || "#c4a24e",
  })

  if (error) return { error: error.message }
  revalidatePath("/calendar")
  return { success: true }
}

export async function deleteCalendarEvent(id: string) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  await supabase.from("event_calendar").delete().eq("id", id)
  revalidatePath("/calendar")
  return { success: true }
}

// ── Sponsors ──

export async function getSponsors() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("sponsors")
    .select("*")
    .eq("is_active", true)
    .order("tier")
  return data ?? []
}

export async function createSponsor(formData: FormData) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  const name = formData.get("name") as string
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

  const { error } = await supabase.from("sponsors").insert({
    name, slug,
    logo_url: formData.get("logo_url") as string || null,
    website_url: formData.get("website_url") as string || null,
    description: formData.get("description") as string || null,
    contact_email: formData.get("contact_email") as string || null,
    tier: formData.get("tier") as string,
  })

  if (error) return { error: error.message }
  revalidatePath("/esports/sponsors")
  return { success: true }
}

export async function linkSponsorToTournament(formData: FormData) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  const { error } = await supabase.from("tournament_sponsors").insert({
    tournament_id: formData.get("tournament_id") as string,
    sponsor_id: formData.get("sponsor_id") as string,
    custom_logo_url: formData.get("custom_logo_url") as string || null,
    custom_primary_color: formData.get("custom_primary_color") as string || null,
    custom_secondary_color: formData.get("custom_secondary_color") as string || null,
    ad_banner_url: formData.get("ad_banner_url") as string || null,
    ad_link_url: formData.get("ad_link_url") as string || null,
    placement: formData.get("placement") as string || "sidebar",
  })

  if (error) return { error: error.message }
  revalidatePath("/esports")
  return { success: true }
}

// ── Contact ──

export async function submitContactForm(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.from("contact_submissions").insert({
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string || null,
    subject: formData.get("subject") as string || null,
    type: formData.get("type") as string || "general",
    message: formData.get("message") as string,
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function getContactSubmissions() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("contact_submissions")
    .select("*")
    .order("created_at", { ascending: false })
  return data ?? []
}

export async function updateContactStatus(id: string, status: string) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  await supabase.from("contact_submissions").update({ status }).eq("id", id)
  revalidatePath("/dashboard/admin/contacts")
  return { success: true }
}

// ── Recruitment ──

export async function submitRecruitmentApplication(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from("recruitment_applications").insert({
    user_id: user?.id || null,
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    type: formData.get("type") as string,
    game_interests: formData.get("game_interests") as string || null,
    experience: formData.get("experience") as string || null,
    availability: formData.get("availability") as string || null,
    message: formData.get("message") as string || null,
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function getRecruitmentApplications() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("recruitment_applications")
    .select("*")
    .order("created_at", { ascending: false })
  return data ?? []
}

export async function updateApplicationStatus(id: string, status: string) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  await supabase.from("recruitment_applications").update({ status }).eq("id", id)
  revalidatePath("/dashboard/admin/recruitment")
  return { success: true }
}

// ── Forum ──

export async function getForumThreads(category?: string) {
  const supabase = await createClient()
  let query = supabase
    .from("forum_threads")
    .select("*, profiles!forum_threads_author_id_fkey(id, display_name, avatar_url)")
    .order("is_pinned", { ascending: false })
    .order("last_reply_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (category && category !== "all") query = query.eq("category", category)

  const { data } = await query
  return data ?? []
}

export async function getThread(threadId: string) {
  const supabase = await createClient()
  const [
    { data: thread },
    { data: replies },
  ] = await Promise.all([
    supabase
      .from("forum_threads")
      .select("*, profiles!forum_threads_author_id_fkey(id, display_name, avatar_url)")
      .eq("id", threadId)
      .single(),
    supabase
      .from("forum_replies")
      .select("*, profiles!forum_replies_author_id_fkey(id, display_name, avatar_url)")
      .eq("thread_id", threadId)
      .order("created_at"),
  ])

  if (!thread) return null
  return { ...thread, replies: replies ?? [] }
}

export async function createThread(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "You must be signed in" }

  const { data, error } = await supabase.from("forum_threads").insert({
    title: formData.get("title") as string,
    category: formData.get("category") as string,
    author_id: user.id,
  }).select().single()

  if (error) return { error: error.message }

  // Add first reply as the thread body
  const body = formData.get("body") as string
  if (body) {
    await supabase.from("forum_replies").insert({
      thread_id: data.id,
      author_id: user.id,
      content: body,
    })
  }

  revalidatePath("/community")
  return { success: true, threadId: data.id }
}

export async function createReply(threadId: string, content: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "You must be signed in" }

  // Check if thread is locked
  const { data: thread } = await supabase.from("forum_threads").select("is_locked").eq("id", threadId).single()
  if (thread?.is_locked) return { error: "This thread is locked" }

  const { error } = await supabase.from("forum_replies").insert({
    thread_id: threadId,
    author_id: user.id,
    content,
  })

  if (error) return { error: error.message }
  revalidatePath(`/community/${threadId}`)
  return { success: true }
}

export async function togglePinThread(threadId: string, isPinned: boolean) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  await supabase.from("forum_threads").update({ is_pinned: isPinned }).eq("id", threadId)
  revalidatePath("/community")
  return { success: true }
}

export async function toggleLockThread(threadId: string, isLocked: boolean) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  await supabase.from("forum_threads").update({ is_locked: isLocked }).eq("id", threadId)
  revalidatePath("/community")
  return { success: true }
}
