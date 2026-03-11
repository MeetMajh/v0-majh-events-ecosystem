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

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  return { supabase, userId: user.id }
}

// ── Teams ──

export async function getTeams() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("teams")
    .select("*, team_members(count), profiles:captain_id(display_name)")
    .eq("is_active", true)
    .order("name")
  return data ?? []
}

export async function getTeamBySlug(slug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("teams")
    .select(`
      *,
      profiles:captain_id(display_name, avatar_url),
      team_members(
        id,
        role,
        joined_at,
        profiles:user_id(id, display_name, avatar_url)
      )
    `)
    .eq("slug", slug)
    .single()
  return data
}

export async function createTeam(formData: FormData) {
  const { supabase, userId } = await requireAuth()
  const name = formData.get("name") as string
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

  const { data: team, error } = await supabase.from("teams").insert({
    name,
    slug,
    tag: formData.get("tag") as string,
    description: formData.get("description") as string,
    captain_id: userId,
  }).select().single()

  if (error) return { error: error.message }

  // Add captain as team member
  await supabase.from("team_members").insert({
    team_id: team.id,
    user_id: userId,
    role: "captain",
  })

  revalidatePath("/esports/teams")
  return { success: true, slug: team.slug }
}

export async function updateTeam(formData: FormData) {
  const { supabase, userId } = await requireAuth()
  const id = formData.get("id") as string

  // Verify captain
  const { data: team } = await supabase.from("teams").select("captain_id").eq("id", id).single()
  if (!team || team.captain_id !== userId) return { error: "Not authorized" }

  const { error } = await supabase.from("teams").update({
    name: formData.get("name") as string,
    tag: formData.get("tag") as string,
    description: formData.get("description") as string,
  }).eq("id", id)

  if (error) return { error: error.message }
  revalidatePath("/esports/teams")
}

export async function joinTeam(teamId: string) {
  const { supabase, userId } = await requireAuth()
  const { error } = await supabase.from("team_members").insert({
    team_id: teamId,
    user_id: userId,
    role: "member",
  })
  if (error) {
    if (error.code === "23505") return { error: "Already a member" }
    return { error: error.message }
  }
  revalidatePath("/esports/teams")
  return { success: true }
}

export async function leaveTeam(teamId: string) {
  const { supabase, userId } = await requireAuth()
  await supabase.from("team_members").delete().eq("team_id", teamId).eq("user_id", userId)
  revalidatePath("/esports/teams")
  return { success: true }
}

export async function removeTeamMember(teamId: string, memberId: string) {
  const { supabase, userId } = await requireAuth()
  const { data: team } = await supabase.from("teams").select("captain_id").eq("id", teamId).single()
  if (!team || team.captain_id !== userId) return { error: "Not authorized" }
  await supabase.from("team_members").delete().eq("team_id", teamId).eq("user_id", memberId)
  revalidatePath("/esports/teams")
  return { success: true }
}

// ── Forums ──

export async function getForumThreads(category?: string) {
  const supabase = await createClient()
  let query = supabase
    .from("forum_threads")
    .select("*, profiles:author_id(display_name, avatar_url)")
    .order("is_pinned", { ascending: false })
    .order("last_reply_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (category && category !== "all") query = query.eq("category", category)
  const { data } = await query
  return data ?? []
}

export async function getForumThread(threadId: string) {
  const supabase = await createClient()
  const { data: thread } = await supabase
    .from("forum_threads")
    .select("*, profiles:author_id(id, display_name, avatar_url)")
    .eq("id", threadId)
    .single()

  if (!thread) return null

  const { data: replies } = await supabase
    .from("forum_replies")
    .select("*, profiles:author_id(id, display_name, avatar_url)")
    .eq("thread_id", threadId)
    .order("created_at")

  return { ...thread, replies: replies ?? [] }
}

export async function createThread(formData: FormData) {
  const { supabase, userId } = await requireAuth()

  const { data, error } = await supabase.from("forum_threads").insert({
    title: formData.get("title") as string,
    category: formData.get("category") as string,
    author_id: userId,
  }).select().single()

  if (error) return { error: error.message }

  // Create initial post as first reply
  const content = formData.get("content") as string
  if (content) {
    await supabase.from("forum_replies").insert({
      thread_id: data.id,
      author_id: userId,
      content,
    })
  }

  revalidatePath("/community")
  return { success: true, threadId: data.id }
}

export async function createReply(threadId: string, content: string) {
  const { supabase, userId } = await requireAuth()

  // Check if thread is locked
  const { data: thread } = await supabase.from("forum_threads").select("is_locked").eq("id", threadId).single()
  if (thread?.is_locked) return { error: "Thread is locked" }

  const { error } = await supabase.from("forum_replies").insert({
    thread_id: threadId,
    author_id: userId,
    content,
  })

  if (error) return { error: error.message }
  revalidatePath(`/community/${threadId}`)
  return { success: true }
}

export async function deleteReply(replyId: string) {
  const { supabase, userId } = await requireAuth()
  await supabase.from("forum_replies").delete().eq("id", replyId).eq("author_id", userId)
  revalidatePath("/community")
}

export async function pinThread(threadId: string, pinned: boolean) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  await supabase.from("forum_threads").update({ is_pinned: pinned }).eq("id", threadId)
  revalidatePath("/community")
}

export async function lockThread(threadId: string, locked: boolean) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  await supabase.from("forum_threads").update({ is_locked: locked }).eq("id", threadId)
  revalidatePath("/community")
}

export async function deleteThread(threadId: string) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  await supabase.from("forum_threads").delete().eq("id", threadId)
  revalidatePath("/community")
}

// ���─ Recruitment ──

export async function submitRecruitmentApplication(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from("recruitment_applications").insert({
    user_id: user?.id ?? null,
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    type: formData.get("type") as string,
    game_interests: formData.get("game_interests") as string,
    experience: formData.get("experience") as string,
    availability: formData.get("availability") as string,
    message: formData.get("message") as string,
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function getRecruitmentApplications(status?: string) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  let query = supabase
    .from("recruitment_applications")
    .select("*")
    .order("created_at", { ascending: false })
  if (status && status !== "all") query = query.eq("status", status)
  const { data } = await query
  return data ?? []
}

export async function updateApplicationStatus(id: string, status: string) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  const { error } = await supabase.from("recruitment_applications").update({ status }).eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/recruitment")
  return { success: true }
}

// ── Community Rooms (Discord-like) ──

export async function getCommunityRooms() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  let query = supabase
    .from("community_rooms")
    .select("*")
    .eq("is_archived", false)
    .order("category")
    .order("name")
  
  const { data, error } = await query
  
  if (error) {
    console.error("Error fetching rooms:", error)
    return []
  }
  
  return data || []
}

export async function getCommunityRoom(slug: string) {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from("community_rooms")
    .select("*")
    .eq("slug", slug)
    .single()
  
  return data
}

export async function createCommunityRoom(formData: FormData) {
  const { supabase, userId } = await requireAuth()
  
  const name = formData.get("name") as string
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  
  const { error } = await supabase
    .from("community_rooms")
    .insert({
      name,
      slug,
      description: formData.get("description") as string || null,
      icon: formData.get("icon") as string || null,
      room_type: formData.get("room_type") as string || "public",
      category: formData.get("category") as string || "general",
      created_by: userId,
    })
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath("/community")
  return { success: true, slug }
}

// ── Room Messages ──

export async function getRoomMessages(roomId: string, limit = 50, before?: string) {
  const supabase = await createClient()
  
  let query = supabase
    .from("community_messages")
    .select(`
      *,
      profiles:user_id(id, display_name, avatar_url)
    `)
    .eq("room_id", roomId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(limit)
  
  if (before) {
    query = query.lt("created_at", before)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error("Error fetching messages:", error)
    return []
  }
  
  // Return in ascending order for display
  return (data || []).reverse()
}

export async function sendMessage(roomId: string, content: string, replyToId?: string) {
  const { supabase, userId } = await requireAuth()
  
  if (!content?.trim()) {
    return { error: "Message cannot be empty" }
  }
  
  const { data, error } = await supabase
    .from("community_messages")
    .insert({
      room_id: roomId,
      user_id: userId,
      content: content.trim(),
      reply_to_id: replyToId || null,
    })
    .select(`
      *,
      profiles:user_id(id, display_name, avatar_url)
    `)
    .single()
  
  if (error) {
    return { error: error.message }
  }
  
  return { success: true, message: data }
}

export async function editMessage(messageId: string, content: string) {
  const { supabase, userId } = await requireAuth()
  
  const { error } = await supabase
    .from("community_messages")
    .update({ 
      content: content.trim(),
      edited_at: new Date().toISOString(),
    })
    .eq("id", messageId)
    .eq("user_id", userId)
  
  if (error) {
    return { error: error.message }
  }
  
  return { success: true }
}

export async function deleteMessage(messageId: string) {
  const { supabase, userId } = await requireAuth()
  
  // Soft delete - check if user owns message or is staff
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle()
  
  let query = supabase
    .from("community_messages")
    .update({ is_deleted: true })
    .eq("id", messageId)
  
  // If not staff, restrict to own messages
  if (!staffRole || !["owner", "manager"].includes(staffRole.role)) {
    query = query.eq("user_id", userId)
  }
  
  const { error } = await query
  
  if (error) {
    return { error: error.message }
  }
  
  return { success: true }
}

export async function togglePinMessage(messageId: string, isPinned: boolean) {
  const { supabase, userId } = await requireAuth()
  
  // Check if user is moderator or staff
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle()
  
  const { data: moderator } = await supabase
    .from("community_moderators")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()
  
  if (!staffRole && !moderator) {
    return { error: "Unauthorized" }
  }
  
  const { error } = await supabase
    .from("community_messages")
    .update({ is_pinned: isPinned })
    .eq("id", messageId)
  
  if (error) {
    return { error: error.message }
  }
  
  return { success: true }
}

// ── Room Membership ──

export async function joinRoom(roomId: string) {
  const { supabase, userId } = await requireAuth()
  
  const { error } = await supabase
    .from("community_room_members")
    .insert({ room_id: roomId, user_id: userId })
  
  if (error && !error.message.includes("duplicate")) {
    return { error: error.message }
  }
  
  revalidatePath("/community")
  return { success: true }
}

export async function leaveRoom(roomId: string) {
  const { supabase, userId } = await requireAuth()
  
  const { error } = await supabase
    .from("community_room_members")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath("/community")
  return { success: true }
}
