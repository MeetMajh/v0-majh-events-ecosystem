"use server"

import { createClient } from "@/lib/supabase/server"

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO CLIP SERVICE
// AI Highlight Detection → Clip Generation → Feed Distribution
// ═══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════

export interface ClipJob {
  id: string
  match_id: string
  source_url: string
  start_time: number
  end_time: number
  status: "pending" | "processing" | "completed" | "failed"
  priority: number
  highlight_type: string
  highlight_score: number
  output_url?: string
  thumbnail_url?: string
  error?: string
  created_at: string
  processed_at?: string
}

export interface HighlightCandidate {
  matchId: string
  timestamp: number
  duration: number
  type: "score_change" | "momentum_shift" | "clutch_moment" | "reaction_spike" | "manual"
  score: number
  context: {
    player1Score?: number
    player2Score?: number
    round?: number
    isMatchPoint?: boolean
    isFinalRound?: boolean
  }
}

export interface ClipGenerationResult {
  success: boolean
  clipId?: string
  jobId?: string
  error?: string
}

// ══════════════════════════════════════════
// HIGHLIGHT DETECTION
// ══════════════════════════════════════════

/**
 * Detect highlight moments from match events
 */
export async function detectHighlights(
  matchId: string,
  events: Array<{
    type: string
    timestamp: number
    data: Record<string, any>
  }>
): Promise<HighlightCandidate[]> {
  const candidates: HighlightCandidate[] = []
  
  let lastScoreChange = 0
  let consecutivePoints = 0
  let lastWinner: string | null = null
  
  for (const event of events) {
    let score = 0
    let type: HighlightCandidate["type"] = "score_change"
    let duration = 15 // Default clip duration
    
    switch (event.type) {
      case "game_won":
      case "point_scored":
      case "round_won":
        // Basic score change
        score += 0.3
        
        // Momentum tracking
        if (event.data.winner === lastWinner) {
          consecutivePoints++
          score += Math.min(consecutivePoints * 0.1, 0.3)
          if (consecutivePoints >= 3) {
            type = "momentum_shift"
          }
        } else {
          consecutivePoints = 1
        }
        lastWinner = event.data.winner
        
        // Match point detection
        if (event.data.isMatchPoint) {
          score += 0.4
          type = "clutch_moment"
          duration = 20
        }
        
        // Final game/round
        if (event.data.isFinal || event.data.isMatchWinning) {
          score += 0.5
          duration = 25
        }
        
        // Close score (tension)
        if (event.data.scoreDiff !== undefined && Math.abs(event.data.scoreDiff) <= 1) {
          score += 0.15
        }
        
        lastScoreChange = event.timestamp
        break
        
      case "reaction_spike":
        score = 0.4 + (event.data.intensity || 0) * 0.3
        type = "reaction_spike"
        break
        
      case "chat_spike":
        score = 0.2 + Math.min(event.data.messagesPerSecond / 10, 0.4)
        type = "reaction_spike"
        break
    }
    
    // Only include significant moments
    if (score >= 0.5) {
      candidates.push({
        matchId,
        timestamp: event.timestamp,
        duration,
        type,
        score,
        context: {
          player1Score: event.data.player1Score,
          player2Score: event.data.player2Score,
          round: event.data.round,
          isMatchPoint: event.data.isMatchPoint,
          isFinalRound: event.data.isFinal
        }
      })
    }
  }
  
  // Sort by score and deduplicate nearby moments
  const sorted = candidates.sort((a, b) => b.score - a.score)
  const deduped: HighlightCandidate[] = []
  
  for (const candidate of sorted) {
    // Skip if too close to an existing highlight
    const isTooClose = deduped.some(existing => 
      Math.abs(existing.timestamp - candidate.timestamp) < 10
    )
    
    if (!isTooClose) {
      deduped.push(candidate)
    }
  }
  
  return deduped.slice(0, 10) // Max 10 highlights per match
}

/**
 * Compute highlight score with all signals
 */
export function computeHighlightScore(signals: {
  gameImpact: number    // 0-1: How significant is this to the game
  engagement: number    // 0-1: Viewer reactions
  audioSpike: number    // 0-1: Audio excitement level
  momentum: number      // 0-1: Momentum shift significance
}): number {
  return (
    signals.gameImpact * 0.4 +
    signals.engagement * 0.3 +
    signals.audioSpike * 0.2 +
    signals.momentum * 0.1
  )
}

// ══════════════════════════════════════════
// CLIP JOB MANAGEMENT
// ══════════════════════════════════════════

/**
 * Create a clip job from a highlight candidate
 */
export async function createClipJob(
  candidate: HighlightCandidate,
  sourceUrl: string
): Promise<{ jobId: string } | { error: string }> {
  const supabase = await createClient()
  
  // Calculate clip window (start 8s before, end 12s after the moment)
  const startTime = Math.max(0, candidate.timestamp - 8)
  const endTime = candidate.timestamp + (candidate.duration - 8)
  
  const { data: job, error } = await supabase
    .from("clip_jobs")
    .insert({
      match_id: candidate.matchId,
      source_url: sourceUrl,
      start_time: startTime,
      end_time: endTime,
      status: "pending",
      priority: Math.round(candidate.score * 100),
      highlight_type: candidate.type,
      highlight_score: candidate.score,
      context: candidate.context
    })
    .select("id")
    .single()
  
  if (error) {
    console.error("Failed to create clip job:", error)
    return { error: "Failed to create clip job" }
  }
  
  return { jobId: job.id }
}

/**
 * Get pending clip jobs
 */
export async function getPendingClipJobs(limit: number = 10): Promise<ClipJob[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("clip_jobs")
    .select("*")
    .eq("status", "pending")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit)
  
  if (error) {
    console.error("Failed to get pending jobs:", error)
    return []
  }
  
  return data || []
}

/**
 * Update clip job status
 */
export async function updateClipJobStatus(
  jobId: string,
  status: ClipJob["status"],
  data?: {
    output_url?: string
    thumbnail_url?: string
    error?: string
  }
) {
  const supabase = await createClient()
  
  const updates: Record<string, any> = {
    status,
    updated_at: new Date().toISOString()
  }
  
  if (status === "completed" || status === "failed") {
    updates.processed_at = new Date().toISOString()
  }
  
  if (data) {
    Object.assign(updates, data)
  }
  
  const { error } = await supabase
    .from("clip_jobs")
    .update(updates)
    .eq("id", jobId)
  
  if (error) {
    console.error("Failed to update job status:", error)
    return { error: "Failed to update job" }
  }
  
  return { success: true }
}

// ══════════════════════════════════════════
// CLIP CREATION
// ══════════════════════════════════════════

/**
 * Create clip from completed job and publish to feed
 */
export async function publishClipFromJob(job: ClipJob): Promise<ClipGenerationResult> {
  const supabase = await createClient()
  
  if (!job.output_url) {
    return { success: false, error: "No output URL" }
  }
  
  // Get match info for metadata
  const { data: match } = await supabase
    .from("matches")
    .select(`
      id,
      game_id,
      tournament_id,
      player1:players!matches_player1_id_fkey(id, display_name),
      player2:players!matches_player2_id_fkey(id, display_name)
    `)
    .eq("id", job.match_id)
    .single()
  
  // Generate title based on highlight type
  let title = "Highlight"
  if (match) {
    const p1 = match.player1?.display_name || "Player 1"
    const p2 = match.player2?.display_name || "Player 2"
    
    switch (job.highlight_type) {
      case "clutch_moment":
        title = `CLUTCH: ${p1} vs ${p2}`
        break
      case "momentum_shift":
        title = `Momentum Swing: ${p1} vs ${p2}`
        break
      case "reaction_spike":
        title = `Hype Moment: ${p1} vs ${p2}`
        break
      default:
        title = `${p1} vs ${p2} Highlight`
    }
  }
  
  // Create the clip entry
  const { data: clip, error } = await supabase
    .from("player_media")
    .insert({
      player_id: match?.player1?.id || null,
      title,
      media_type: "clip",
      media_url: job.output_url,
      thumbnail_url: job.thumbnail_url,
      duration_seconds: job.end_time - job.start_time,
      status: "approved",
      is_highlight: true,
      auto_generated: true,
      match_id: job.match_id,
      game_id: match?.game_id,
      tournament_id: match?.tournament_id,
      highlight_type: job.highlight_type,
      highlight_score: job.highlight_score,
      // Initial ranking boost for new auto-highlights
      trending_score: Math.round(job.highlight_score * 100),
      momentum_score: job.highlight_score
    })
    .select("id")
    .single()
  
  if (error) {
    console.error("Failed to create clip:", error)
    return { success: false, error: "Failed to create clip" }
  }
  
  // Update job with clip ID
  await supabase
    .from("clip_jobs")
    .update({ clip_id: clip.id })
    .eq("id", job.id)
  
  // Send notifications to followers
  await notifyFollowersOfHighlight(match?.player1?.id, clip.id, title)
  
  return { success: true, clipId: clip.id, jobId: job.id }
}

/**
 * Notify followers of a new highlight
 */
async function notifyFollowersOfHighlight(
  playerId: string | null,
  clipId: string,
  title: string
) {
  if (!playerId) return
  
  const supabase = await createClient()
  
  // Get followers
  const { data: followers } = await supabase
    .from("player_follows")
    .select("user_id")
    .eq("player_id", playerId)
    .limit(1000)
  
  if (!followers || followers.length === 0) return
  
  // Create notifications in batch
  const notifications = followers.map(f => ({
    user_id: f.user_id,
    type: "new_highlight",
    title: "New highlight dropped",
    message: title,
    link: `/clips/${clipId}`,
    data: { clipId, playerId }
  }))
  
  // Insert in batches of 100
  for (let i = 0; i < notifications.length; i += 100) {
    await supabase
      .from("notifications")
      .insert(notifications.slice(i, i + 100))
  }
}

// ══════════════════════════════════════════
// AUTO PIPELINE ORCHESTRATION
// ══════════════════════════════════════════

/**
 * Process auto highlights for a match
 * Called when a match ends or at intervals during live matches
 */
export async function processMatchHighlights(
  matchId: string,
  sourceUrl: string
): Promise<{ jobs: string[]; error?: string }> {
  const supabase = await createClient()
  
  // Get match events
  const { data: events } = await supabase
    .from("match_events")
    .select("type, timestamp, data")
    .eq("match_id", matchId)
    .order("timestamp", { ascending: true })
  
  if (!events || events.length === 0) {
    return { jobs: [], error: "No events found" }
  }
  
  // Detect highlights
  const highlights = await detectHighlights(matchId, events)
  
  if (highlights.length === 0) {
    return { jobs: [] }
  }
  
  // Create jobs for top highlights
  const topHighlights = highlights.slice(0, 5) // Max 5 auto-clips per match
  const jobIds: string[] = []
  
  for (const highlight of topHighlights) {
    const result = await createClipJob(highlight, sourceUrl)
    if ("jobId" in result) {
      jobIds.push(result.jobId)
    }
  }
  
  return { jobs: jobIds }
}

/**
 * Worker function to process pending clip jobs
 * Should be called by a cron job or queue worker
 */
export async function processClipJobsWorker(): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  const jobs = await getPendingClipJobs(5)
  
  let succeeded = 0
  let failed = 0
  
  for (const job of jobs) {
    // Mark as processing
    await updateClipJobStatus(job.id, "processing")
    
    try {
      // In a real implementation, this would call FFmpeg or a video processing service
      // For now, we'll simulate by using the source URL directly
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // For MVP, use source URL with timestamp parameters
      // In production, this would be the processed clip URL
      const outputUrl = `${job.source_url}#t=${job.start_time},${job.end_time}`
      
      // Mark as completed
      await updateClipJobStatus(job.id, "completed", {
        output_url: outputUrl,
        thumbnail_url: undefined // Would be generated
      })
      
      // Publish to feed
      const completedJob = { ...job, output_url: outputUrl }
      const result = await publishClipFromJob(completedJob)
      
      if (result.success) {
        succeeded++
      } else {
        failed++
      }
    } catch (error) {
      console.error(`Failed to process job ${job.id}:`, error)
      await updateClipJobStatus(job.id, "failed", {
        error: error instanceof Error ? error.message : "Unknown error"
      })
      failed++
    }
  }
  
  return { processed: jobs.length, succeeded, failed }
}

/**
 * Get auto-generated clips for a match
 */
export async function getMatchAutoClips(matchId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("player_media")
    .select("*")
    .eq("match_id", matchId)
    .eq("auto_generated", true)
    .order("highlight_score", { ascending: false })
  
  if (error) {
    console.error("Failed to get auto clips:", error)
    return []
  }
  
  return data || []
}
