"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// ── Issue Categories ──
export const ISSUE_CATEGORIES = {
  pairing_failure: { label: "Pairing Failure", description: "Software failing to generate pairings" },
  round_generation: { label: "Round Generation", description: "Unable to generate new rounds" },
  top_cut_failure: { label: "Top Cut Failure", description: "Problems generating top cut brackets" },
  player_registration: { label: "Player Registration", description: "Issues with player sign-up or check-in" },
  player_data: { label: "Player Data", description: "Incorrect player info (age division, name, etc.)" },
  player_drop: { label: "Player Drop", description: "Unable to drop or re-add players" },
  system_freeze: { label: "System Freeze", description: "Software not responding or frozen" },
  timer_error: { label: "Timer Error", description: "Round timer not working correctly" },
  file_upload: { label: "File Upload", description: "Problems uploading tournament files" },
  decklist_mismatch: { label: "Decklist Mismatch", description: "Deck doesn't match registered list" },
  marked_cards: { label: "Marked Cards", description: "Damaged or identifiable sleeves/cards" },
  illegal_deck: { label: "Illegal Deck", description: "Invalid deck composition or banned cards" },
  judge_call: { label: "Judge Call", description: "Rules question or dispute requiring judge" },
  dispute: { label: "Dispute", description: "Player dispute or disagreement" },
  technical: { label: "Technical Issue", description: "Other technical problems" },
  other: { label: "Other", description: "Other issue type" },
} as const

export const ESCALATION_LEVELS = {
  1: { label: "Staff", role: "staff" },
  2: { label: "Tournament Organizer", role: "organizer" },
  3: { label: "Manager", role: "manager" },
} as const

// ── Get Issues ──
export async function getTournamentIssues(tournamentId: string, filters?: {
  status?: string
  severity?: string
  category?: string
  escalationLevel?: number
}) {
  try {
    const supabase = await createClient()
    
    // Simple query without comments join in case issue_comments table doesn't exist
    let query = supabase
      .from("tournament_issues")
      .select(`
        *,
        reporter:profiles!reported_by(id, first_name, last_name, avatar_url),
        assignee:profiles!assigned_to(id, first_name, last_name, avatar_url)
      `)
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: false })
    
    if (filters?.status) query = query.eq("status", filters.status)
    if (filters?.severity) query = query.eq("severity", filters.severity)
    if (filters?.category) query = query.eq("category", filters.category)
    if (filters?.escalationLevel) query = query.eq("escalation_level", filters.escalationLevel)
    
    const { data, error } = await query
    if (error) {
      console.error("Error fetching issues:", error)
      return []
    }
    return data ?? []
  } catch (err) {
    console.error("Exception fetching issues:", err)
    return []
  }
}

// ── Get All Issues for Staff Dashboard ──
export async function getAllIssues(filters?: {
  status?: string
  escalationLevel?: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  
  // Check staff role
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()
  
  if (!staffRole) return []
  
  let query = supabase
    .from("tournament_issues")
    .select(`
      *,
      tournament:tournaments(id, name, slug),
      reporter:profiles!reported_by(id, first_name, last_name, avatar_url),
      assignee:profiles!assigned_to(id, first_name, last_name, avatar_url)
    `)
    .order("created_at", { ascending: false })
  
  // Filter by escalation level based on role
  if (staffRole.role === "staff") {
    query = query.eq("escalation_level", 1)
  } else if (staffRole.role === "organizer") {
    query = query.lte("escalation_level", 2)
  }
  // Managers see all levels
  
  if (filters?.status) query = query.eq("status", filters.status)
  if (filters?.escalationLevel) query = query.eq("escalation_level", filters.escalationLevel)
  
  const { data, error } = await query
  if (error) {
    console.error("Error fetching all issues:", error)
    return []
  }
  return data ?? []
}

// ── Create Issue ──
export async function createIssue(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: "You must be logged in to report an issue" }
  }
  
  const tournamentId = formData.get("tournament_id") as string
  const category = formData.get("category") as string
  const severity = formData.get("severity") as string || "medium"
  const title = formData.get("title") as string
  const description = formData.get("description") as string
  const affectedPlayerId = formData.get("affected_player_id") as string | null
  const affectedRound = formData.get("affected_round") as string | null
  
  const { data, error } = await supabase
    .from("tournament_issues")
    .insert({
      tournament_id: tournamentId,
      reported_by: user.id,
      category,
      severity,
      title,
      description,
      affected_player_id: affectedPlayerId || null,
      affected_round: affectedRound ? parseInt(affectedRound) : null,
    })
    .select()
    .single()
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true, issue: data }
}

// ── Update Issue Status ──
export async function updateIssueStatus(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Not authenticated" }
  
  const issueId = formData.get("issue_id") as string
  const status = formData.get("status") as string
  const resolution = formData.get("resolution") as string | null
  
  const updates: Record<string, unknown> = { status }
  
  if (status === "resolved" || status === "closed") {
    updates.resolved_at = new Date().toISOString()
    updates.resolved_by = user.id
    if (resolution) updates.resolution = resolution
  }
  
  const { error } = await supabase
    .from("tournament_issues")
    .update(updates)
    .eq("id", issueId)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath("/dashboard")
  return { success: true }
}

// ── Escalate Issue ──
export async function escalateIssue(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Not authenticated" }
  
  const issueId = formData.get("issue_id") as string
  const reason = formData.get("reason") as string
  
  // Get current issue
  const { data: issue, error: fetchError } = await supabase
    .from("tournament_issues")
    .select("escalation_level")
    .eq("id", issueId)
    .single()
  
  if (fetchError || !issue) {
    return { error: "Issue not found" }
  }
  
  if (issue.escalation_level >= 3) {
    return { error: "Issue is already at maximum escalation level" }
  }
  
  // Escalate
  const { error } = await supabase
    .from("tournament_issues")
    .update({
      escalation_level: issue.escalation_level + 1,
      status: "escalated",
      escalated_at: new Date().toISOString(),
      escalated_by: user.id,
    })
    .eq("id", issueId)
  
  if (error) {
    return { error: error.message }
  }
  
  // Add escalation comment
  await supabase.from("issue_comments").insert({
    issue_id: issueId,
    user_id: user.id,
    comment: `Issue escalated to ${ESCALATION_LEVELS[(issue.escalation_level + 1) as 1 | 2 | 3].label}. Reason: ${reason}`,
    is_internal: true,
  })
  
  revalidatePath("/dashboard")
  return { success: true }
}

// ── Assign Issue ──
export async function assignIssue(formData: FormData) {
  const supabase = await createClient()
  
  const issueId = formData.get("issue_id") as string
  const assigneeId = formData.get("assignee_id") as string
  
  const { error } = await supabase
    .from("tournament_issues")
    .update({
      assigned_to: assigneeId,
      status: "in_progress",
    })
    .eq("id", issueId)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath("/dashboard")
  return { success: true }
}

// ── Add Comment ──
export async function addIssueComment(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Not authenticated" }
  
  const issueId = formData.get("issue_id") as string
  const comment = formData.get("comment") as string
  const isInternal = formData.get("is_internal") === "true"
  
  const { error } = await supabase.from("issue_comments").insert({
    issue_id: issueId,
    user_id: user.id,
    comment,
    is_internal: isInternal,
  })
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath("/dashboard")
  return { success: true }
}

// ── Get Issue Stats ──
export async function getIssueStats(tournamentId?: string) {
  const supabase = await createClient()
  
  let query = supabase.from("tournament_issues").select("status, severity, escalation_level")
  
  if (tournamentId) {
    query = query.eq("tournament_id", tournamentId)
  }
  
  const { data, error } = await query
  if (error) return { open: 0, inProgress: 0, escalated: 0, resolved: 0, critical: 0 }
  
  const stats = {
    open: data.filter(i => i.status === "open").length,
    inProgress: data.filter(i => i.status === "in_progress").length,
    escalated: data.filter(i => i.status === "escalated").length,
    resolved: data.filter(i => i.status === "resolved" || i.status === "closed").length,
    critical: data.filter(i => i.severity === "critical" && i.status !== "resolved" && i.status !== "closed").length,
  }
  
  return stats
}
